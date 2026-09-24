// 对拍验证：index.html 内联 FsrsEngine vs 官方 ts-fsrs（FSRS-6，LongTermScheduler 语义）
// 版本号唯一来源：index.html 的 FSRS_TS_VERSION 常量（不在此处硬编码，避免与实际移植版本漂移）
// 前置：网络可用（首次运行自动 npm install 到 .tmp-fsrs/，仅用于对拍，不进运行时）
// 用法：node scripts/fsrs_compare.cjs
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, ".tmp-fsrs");

/* ---- 0. 读取移植版本 + 准备官方包（缺失时自动安装同版本） ---- */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const versionMatch = html.match(/const FSRS_TS_VERSION\s*=\s*"([\d.]+)"/);
if (!versionMatch) { console.error("[extract] 找不到 FSRS_TS_VERSION 常量"); process.exit(1); }
const TS_FSRS_VERSION = versionMatch[1];

const OFFICIAL = path.join(TMP, "node_modules", "ts-fsrs");
const installedVersion = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(OFFICIAL, "package.json"), "utf8")).version; }
    catch { return null; }
})();
if (installedVersion !== TS_FSRS_VERSION) {
    console.log(`[setup] 安装 ts-fsrs@${TS_FSRS_VERSION}${installedVersion ? `（现有 ${installedVersion} 版本不符，重装）` : ""} …`);
    const r = spawnSync("npm", ["install", "--prefix", TMP, `ts-fsrs@${TS_FSRS_VERSION}`, "--no-save", "--no-package-lock", "--no-audit", "--no-fund"], { cwd: ROOT, stdio: "inherit" });
    if (r.status !== 0) { console.error("[setup] 安装失败，请检查网络后重试"); process.exit(1); }
}

/* ---- 1. 提取 index.html 中的 FSRS Engine 源码 ---- */
const START = html.indexOf("/* ===== FSRS Engine");
const END = html.indexOf("/* ===== End FSRS Engine");
if (START < 0 || END < 0) { console.error("[extract] 找不到 FSRS Engine 标记"); process.exit(1); }
const portFile = path.join(TMP, "engine_port.cjs");
/* index.html 里 FSRS_TS_VERSION 用 export 暴露（供 tsc 与对拍脚本读取）；抽成 CJS 需去掉 export */
const engineSrc = html.slice(START, END).replace(/^export\s+(const\s+FSRS_TS_VERSION)/m, "$1");
fs.writeFileSync(portFile, engineSrc + '\nmodule.exports = { FsrsEngine, FSRS_STATE, FSRS_RATING, FSRS_TS_VERSION };\n');

const { FsrsEngine, FSRS_TS_VERSION: portVersion } = require(portFile);
const official = require(OFFICIAL);
if (portVersion !== TS_FSRS_VERSION) { console.error(`[check] 常量漂移：port=${portVersion} 期望=${TS_FSRS_VERSION}`); process.exit(1); }
console.log(`[ver ] 对拍目标 ts-fsrs@${TS_FSRS_VERSION}（官方包 ${official.FSRSVersion ?? "?"}）`);

let checks = 0, fails = 0;
const TOL = 1e-8;
const snap = card => ({
    state: card.state,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    elapsed_days: card.elapsed_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    due: card.due.getTime(),
    last_review: card.last_review ? card.last_review.getTime() : null,
});

function compareSeq(name, ratings, { retention = 0.9, now = new Date(2022, 11, 29, 12, 30, 0, 0) } = {}) {
    const ref = official.fsrs({ enable_short_term: false, enable_fuzz: false, request_retention: retention });
    const eng = new FsrsEngine({ requestRetention: retention });
    let refCard = official.createEmptyCard();
    let engCard = eng.createEmptyCard();
    let t = new Date(now.getTime());
    ratings.forEach((rating, i) => {
        const a = ref.next(refCard, t, rating).card;
        const b = eng.next(engCard, t, rating);
        const sa = snap(a), sb = snap(b);
        const issues = [];
        for (const k of Object.keys(sa)) {
            checks++;
            const av = sa[k], bv = sb[k];
            const ok = typeof av === "number" ? Math.abs(av - bv) <= TOL : av === bv;
            if (!ok) { fails++; issues.push(`${k}: ref=${av} port=${bv}`); }
        }
        if (issues.length) console.log(`  [FAIL] ${name} #${i + 1} (rating=${rating}) ${issues.join("; ")}`);
        refCard = a; engCard = b; t = a.due;
    });
    return { refCard, engCard, now: t };
}

/* ---- 2. 调度序列对拍 ---- */
const seq1 = [3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3]; // Good×6, Again×2, Good×5
const seq2 = [1, 2, 3, 4, 1, 2, 3, 4];                 // Again/Hard/Good/Easy 循环
const seq3 = [2, 4, 3, 1, 4, 2];                       // 混合（retention 0.85）

console.log("[seq1] 默认 retention=0.9，13 连评");
let { refCard, engCard, now } = compareSeq("seq1", seq1);

console.log("[seq2] 默认 retention=0.9，四评分循环");
compareSeq("seq2", seq2);

console.log("[seq3] retention=0.85，混合评分");
compareSeq("seq3", seq3, { retention: 0.85 });

/* ---- 3. get_retrievability 对拍 ---- */
{
    const t = new Date(now.getTime() + 100 * 86400000);
    const refR = official.fsrs({ enable_short_term: false }).get_retrievability(refCard, t, false);
    const engR = new FsrsEngine().getRetrievability(engCard, t);
    checks++;
    if (Math.abs(refR - engR) > TOL) { fails++; console.log(`  [FAIL] retrievability: ref=${refR} port=${engR}`); }
    else console.log(`[retr] 100 天后记忆率 ref=${refR} port=${engR} ✓`);
}

/* ---- 4. nextState 链 vs 仓库 FSRS-6.test.ts 断言（long-term: 53.335106 / 6.3574867） ---- */
{
    const eng = new FsrsEngine();
    const ratings = [1, 3, 3, 3, 3, 3];      // Again, Good×5
    const intervals = [0, 0, 1, 3, 8, 21];
    let d = 0, s = 0;
    ratings.forEach((g, i) => { const ns = eng.nextState(d, s, intervals[i], g); d = ns.difficulty; s = ns.stability; });
    checks += 2;
    if (Math.abs(s - 53.335106) > 1e-4) { fails++; console.log(`  [FAIL] nextState 链 stability: ref=53.335106 port=${s}`); }
    if (Math.abs(d - 6.3574867) > 1e-4) { fails++; console.log(`  [FAIL] nextState 链 difficulty: ref=6.3574867 port=${d}`); }
    console.log(`[nextState] 链式结果 stability=${s} difficulty=${d}（仓库断言 53.335106 / 6.3574867）`);
}

/* ---- 5. 不变量抽查 ---- */
{
    const eng = new FsrsEngine();
    const card = eng.next(eng.createEmptyCard(new Date(2022, 11, 29, 12, 30, 0, 0)), new Date(2022, 11, 29, 12, 30, 0, 0), 3);
    const invariants = [
        ["新卡首答 Good 间隔 3 天", card.scheduled_days === 3],
        ["新卡首答后为 Review 状态", card.state === 2],
        ["新卡首答 lapse 不增加", card.lapses === 0],
        ["新卡首答 reps=1", card.reps === 1],
    ];
    invariants.forEach(([label, ok]) => {
        checks++;
        if (!ok) { fails++; console.log(`  [FAIL] ${label}`); }
        else console.log(`[inv ] ${label} ✓`);
    });
}

/* ---- 6. 版本一致性：index.html 常量 == 官方包版本（README 也引用该常量） ---- */
{
    const officialVersion = JSON.parse(fs.readFileSync(path.join(OFFICIAL, "package.json"), "utf8")).version;
    checks++;
    if (officialVersion !== TS_FSRS_VERSION) { fails++; console.log(`  [FAIL] 版本不一致：常量=${TS_FSRS_VERSION} 官方包=${officialVersion}`); }
    else console.log(`[ver ] index.html FSRS_TS_VERSION=${TS_FSRS_VERSION} == 官方包 ✓`);
}

console.log(`\n===== 结果: ${checks - fails}/${checks} 项通过 =====`);
process.exit(fails ? 1 : 0);
