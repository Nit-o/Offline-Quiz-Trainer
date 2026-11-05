// 对拍验证：index.html 内联 FsrsEngine vs 官方 ts-fsrs（FSRS-7，DefaultScheduler 语义）
// 版本号唯一来源：index.html 的 FSRS_TS_VERSION 常量（不在此处硬编码，避免与实际移植版本漂移）
// 前置：网络可用（首次运行自动 npm install 到 .tmp-fsrs/，仅用于对拍，不进运行时）
// 用法：node scripts/fsrs_compare.cjs
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, ".tmp-fsrs");
const DAY_MS = 86400000;
const T0 = new Date(Date.UTC(2026, 0, 1));

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
fs.writeFileSync(portFile, engineSrc + "\nmodule.exports = { FsrsEngine, FSRS_STATE, FSRS_RATING, FSRS_GRADES, FSRS7_MAXIMUM_INTERVAL, normalizeRetention, retentionImpact, FSRS_TS_VERSION };\n");

const { FsrsEngine, FSRS_STATE, FSRS_RATING, FSRS_GRADES, FSRS7_MAXIMUM_INTERVAL, normalizeRetention, retentionImpact, FSRS_TS_VERSION: portVersion } = require(portFile);
const official = require(OFFICIAL);
if (typeof official.DefaultScheduler !== "function") {
    console.error(`[setup] ts-fsrs@${TS_FSRS_VERSION} 未导出 DefaultScheduler —— FSRS-7 调度语义需要 v6.x`);
    process.exit(1);
}

/* 参考调度器：只覆盖保持率，其余沿用 DefaultScheduler 默认
   （fractionalDays / enableShortTerm / allowModelOverride 开、fuzz 关、学习步 1m+10m、重学步 10m、毕业 1 天、上限 36500 天） */
const refScheduler = retention =>
    official.DefaultScheduler({ version: "FSRS-7", desiredRetention: retention, enableFuzz: false });

let checks = 0, fails = 0;
const TOL = 1e-8;
const near = (a, b, tol = TOL) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;
/** 单项断言：通过返回 true，失败计数并打印 */
const ok = (cond, label, detail) => {
    checks++;
    if (cond) return true;
    fails++;
    console.log(`  [FAIL] ${label}${detail ? ` ${detail}` : ""}`);
    return false;
};
const STATE_NAMES = ["New", "Learning", "Review", "Relearning"];
const stateName = s => STATE_NAMES[s] ?? `#${s}`;
const fmtDays = d => d < 1 ? `${(d * 1440).toFixed(1)} 分` : `${d.toFixed(4)} 天`;

/* FSRS-7 卡面：双轨迹 + 分数天 + 学习步序号 */
const snap = card => ({
    stability: card.stability,
    stabilityFast: card.stabilityFast,
    difficulty: card.difficulty,
    state: card.state,
    scheduleStatus: card.scheduleStatus,
    learningStep: card.learningStep,
    scheduledDays: card.scheduledDays,
    dueAt: card.dueAt.getTime(),
    lastReviewAt: card.lastReviewAt ? card.lastReviewAt.getTime() : null,
    reps: card.reps,
    lapses: card.lapses,
});

/** 逐字段对拍：官方为基准，移植版必须完全一致 */
function diffCard(label, refCard, portCard) {
    const a = snap(refCard), b = snap(portCard);
    for (const k of Object.keys(a))
        ok(a[k] === b[k] || near(a[k], b[k]), `${label} ${k}`, `ref=${a[k]} port=${b[k]}`);
}

/** 固定卡面 + 单次评分：既与官方对拍，也锁住官方实测数值（防止包版本或语义漂移） */
async function checkRow(label, over, nowISO, grade, expected, retention = 0.9) {
    const ref = await refScheduler(retention);
    const eng = new FsrsEngine({ requestRetention: retention });
    const now = new Date(nowISO);
    const card = Object.assign(ref.newCard({ now: T0 }), over);
    card.dueAt = new Date(card.dueAt);
    if (card.lastReviewAt) card.lastReviewAt = new Date(card.lastReviewAt);
    const r = ref.review({ card: { ...card }, now, grade }).card;
    const p = eng.next({ ...card }, now, grade);
    diffCard(`${label} g=${grade}`, r, p);
    const bad = [];
    for (const [k, v] of Object.entries(expected)) {
        checks++;
        const actual = k === "minutes" ? p.scheduledDays * 1440 : p[k];
        const hit = typeof v === "number" ? near(actual, v, 1e-4) : actual === v;
        if (!hit) { fails++; bad.push(`${k} 期望=${v} 实际=${actual}`); }
    }
    if (bad.length) console.log(`  [FAIL] ${label} g=${grade} 数值漂移：${bad.join("; ")}`);
    else console.log(`  [ok  ] ${label} g=${grade} → ${fmtDays(p.scheduledDays)} · ${stateName(p.state)} · step=${p.learningStep} · ${p.scheduleStatus} · lapse=${p.lapses}`);
}

/** 连续序列对拍：两侧各自演进，时钟统一由官方到期时间推进 */
async function runChain(name, grades, { retention = 0.9, start = T0 } = {}) {
    const ref = await refScheduler(retention);
    const eng = new FsrsEngine({ requestRetention: retention });
    let refCard = ref.newCard({ now: start });
    let portCard = eng.createEmptyCard(start);
    let t = new Date(start.getTime());
    const trace = [];
    for (let i = 0; i < grades.length; i++) {
        const grade = grades[i];
        const r = ref.review({ card: refCard, now: t, grade }).card;
        const p = eng.next(portCard, t, grade);
        diffCard(`${name} #${i + 1} g=${grade}`, r, p);
        /* 移植版自洽：dueAt == now + scheduledDays（分钟级调度不得四舍五入到整天） */
        ok(near(p.dueAt.getTime(), t.getTime() + p.scheduledDays * DAY_MS, 1), `${name} #${i + 1} port dueAt 与 scheduledDays 一致`);
        trace.push(`${grade}→${fmtDays(p.scheduledDays)}/${stateName(p.state)}`);
        refCard = r; portCard = p;
        t = new Date(r.dueAt.getTime());
    }
    console.log(`[seq ] ${name}（dr=${retention}）：${trace.join("  ")}`);
    return { eng, ref, portCard, refCard, now: t };
}

async function main() {
    console.log(`[ver ] 对拍目标 ts-fsrs@${TS_FSRS_VERSION}（${official.FSRSVersion ?? "?"} / FSRS-7）`);
    ok(portVersion === TS_FSRS_VERSION, "移植常量与 index.html 一致", `port=${portVersion}`);

    /* ---- 2. 真值表：新卡 / 学习步 0-1 / 复习（含提前复习）/ 重学 ---- */
    console.log("\n[rows] FSRS-7 关键调度行（dr=0.90，期望值取自 ts-fsrs@6.0.0 实测）");
    const LRN0 = { stability: 0.1104, stabilityFast: 0.08832, difficulty: 6.1686, state: FSRS_STATE.Learning, learningStep: 0, reps: 1, scheduledDays: 1 / 1440, lastReviewAt: "2026-01-01T00:00:00Z" };
    const LRN1 = { stability: 0.41502251, stabilityFast: 10.26968277, difficulty: 6.109214, state: FSRS_STATE.Learning, learningStep: 1, reps: 2, scheduledDays: 27.467002 / 1440, lastReviewAt: "2026-01-01T00:01:00Z" };
    const REV = { stability: 3.9221, stabilityFast: 3.13768, difficulty: 3.53072398, state: FSRS_STATE.Review, reps: 1, scheduledDays: 4.777721809, lastReviewAt: "2026-01-01T00:00:00Z" };
    const REL0 = { stability: 5.28531202, stabilityFast: 1.26463463, difficulty: 8.72439952, state: FSRS_STATE.Relearning, reps: 4, lapses: 1, scheduledDays: 0.6736192257, lastReviewAt: "2026-05-04T09:10:23Z" };
    const T1 = "2026-01-01T00:01:00Z", T11 = "2026-01-01T00:11:00Z", TDUE = "2026-01-05T18:39:55.164Z";

    const rows = [
        /* 新卡：S0 直接取 w[G-1]，Again 落 1 分钟学习步，Good/Easy 直接毕业 */
        ["新卡", {}, "2026-01-01T00:00:00Z", FSRS_RATING.Again, { minutes: 1, state: FSRS_STATE.Learning, scheduleStatus: "learning", learningStep: 0, stability: 0.1104, stabilityFast: 0.08832, difficulty: 6.1686, reps: 1, lapses: 0 }],
        ["新卡", {}, "2026-01-01T00:00:00Z", FSRS_RATING.Hard, { state: FSRS_STATE.Learning, learningStep: 0, scheduledDays: 0.597461174, stability: 2.2395, stabilityFast: 1.7916, difficulty: 5.26127831, reps: 1 }],
        ["新卡", {}, "2026-01-01T00:00:00Z", FSRS_RATING.Good, { scheduledDays: 4.777721809, state: FSRS_STATE.Review, scheduleStatus: "review", learningStep: 0, stability: 3.9221, stabilityFast: 3.13768, difficulty: 3.53072398 }],
        ["新卡", {}, "2026-01-01T00:00:00Z", FSRS_RATING.Easy, { scheduledDays: 53.869513162, state: FSRS_STATE.Review, stability: 11.7841, stabilityFast: 9.42728, difficulty: 1 }],
        /* 学习步 0（1 分钟后）：Good 进第 2 步（10m），Easy 以毕业间隔 1 天出步 */
        ["学习步0", LRN0, T1, FSRS_RATING.Again, { minutes: 1, state: FSRS_STATE.Learning, learningStep: 0, stability: 0.05443436, reps: 2, lapses: 0 }],
        ["学习步0", LRN0, T1, FSRS_RATING.Hard, { minutes: 7.886967044, state: FSRS_STATE.Learning, learningStep: 0, stability: 0.30529748, stabilityFast: 6.36207574 }],
        ["学习步0", LRN0, T1, FSRS_RATING.Good, { minutes: 27.467001688, state: FSRS_STATE.Learning, scheduleStatus: "learning", learningStep: 1, stability: 0.41502251, stabilityFast: 10.26968277, difficulty: 6.109214 }],
        ["学习步0", LRN0, T1, FSRS_RATING.Easy, { scheduledDays: 1, state: FSRS_STATE.Review, scheduleStatus: "review", learningStep: 0, stabilityFast: 11.1544432 }],
        /* 学习步 1：Again 回第 0 步，Hard 停在本步，Good 毕业，Easy 毕业 +1 天（单调间隔） */
        ["学习步1", LRN1, T11, FSRS_RATING.Again, { minutes: 1, learningStep: 0, stability: 0.17222872, difficulty: 9.29409002 }],
        ["学习步1", LRN1, T11, FSRS_RATING.Hard, { minutes: 53.138846667, state: FSRS_STATE.Learning, learningStep: 1, stability: 0.62963826 }],
        ["学习步1", LRN1, T11, FSRS_RATING.Good, { scheduledDays: 1, state: FSRS_STATE.Review, learningStep: 0, stability: 0.75046444 }],
        ["学习步1", LRN1, T11, FSRS_RATING.Easy, { scheduledDays: 2, state: FSRS_STATE.Review, stabilityFast: 25.99490754, difficulty: 4.4751321 }],
        /* 复习：Again 走 10 分钟重学步并计一次遗忘，其余评分走模型间隔（FSRS-7 快轨迹增益显著） */
        ["复习", REV, TDUE, FSRS_RATING.Again, { minutes: 10, state: FSRS_STATE.Relearning, scheduleStatus: "learning", learningStep: 0, stability: 1.2203504, stabilityFast: 0.26462178, difficulty: 8.73623888, lapses: 1 }],
        ["复习", REV, TDUE, FSRS_RATING.Hard, { scheduledDays: 8.231375844, state: FSRS_STATE.Review, stability: 8.41111233, lapses: 0 }],
        ["复习", REV, TDUE, FSRS_RATING.Good, { scheduledDays: 26.167346521, state: FSRS_STATE.Review, stability: 10.93837435, stabilityFast: 175.07668401, difficulty: 3.49771674 }],
        ["复习", REV, TDUE, FSRS_RATING.Easy, { scheduledDays: 52.829749803, state: FSRS_STATE.Review, stability: 10.93837435, difficulty: 1 }],
        /* 提前复习（未到期，已经过 0.5 天）：间隔按毫秒精确 elapsed 计算，不再按 UTC 日历日取整 */
        ["提前复习", REV, "2026-01-01T12:00:00Z", FSRS_RATING.Good, { scheduledDays: 16.248996756, state: FSRS_STATE.Review, stability: 7.63267775 }],
        /* 重学步 0：Again 保持 10 分钟，其余毕业 */
        ["重学步0", REL0, "2026-05-04T09:20:00Z", FSRS_RATING.Again, { minutes: 10, state: FSRS_STATE.Relearning, lapses: 1, stability: 1.47269984, stabilityFast: 0.08114121 }],
        ["重学步0", REL0, "2026-05-04T09:20:00Z", FSRS_RATING.Hard, { scheduledDays: 1.118742188, state: FSRS_STATE.Review, lapses: 1, stability: 6.18127162 }],
        ["重学步0", REL0, "2026-05-04T09:20:00Z", FSRS_RATING.Good, { scheduledDays: 2.118742188, state: FSRS_STATE.Review, stability: 6.68568651, difficulty: 8.63945553 }],
        ["重学步0", REL0, "2026-05-04T09:20:00Z", FSRS_RATING.Easy, { scheduledDays: 3.118742188, state: FSRS_STATE.Review, stabilityFast: 11.79544659 }],
    ];
    for (const [label, over, now, grade, expected] of rows)
        await checkRow(label, over, now, grade, expected);

    /* ---- 3. 连续序列对拍 ---- */
    console.log("\n[seq ] 连续复习序列");
    await runChain("学习步毕业链", [1, 3, 3, 3, 3]);        /* Again→1m，Good→10m，Good 毕业，复习… */
    await runChain("四评分循环", [3, 1, 3, 2, 4, 1, 3]);
    const c3 = await runChain("长链遗忘", [3, 3, 3, 3, 3, 1, 1, 3, 3, 3]);
    await runChain("高保持率", [3, 3, 3, 1, 3], { retention: 0.95 });
    await runChain("低保持率", [3, 3, 3, 1, 3], { retention: 0.8 });

    /* ---- 4. 遗忘曲线 / 间隔求解 / 队列记忆率对拍 ---- */
    console.log("\n[curve] 双轨迹曲线与间隔求解");
    {
        const { eng, ref, portCard, refCard, now } = c3;
        const ms = { stability: portCard.stability, stabilityFast: portCard.stabilityFast, difficulty: portCard.difficulty };
        ok(ms.stability === refCard.stability && ms.stabilityFast === refCard.stabilityFast && ms.difficulty === refCard.difficulty, "长链后记忆状态一致");
        for (const t of [0, 10 / 1440, 0.5, 3.7, 30.25, 120])
            ok(near(ref.model.forgettingCurve(ms, t), eng.forgettingCurve(t, ms), 1e-9), `forgettingCurve t=${t}`, `ref=${ref.model.forgettingCurve(ms, t)} port=${eng.forgettingCurve(t, ms)}`);
        for (const dr of [0.7, 0.85, 0.9, 0.95, 0.99])
            ok(near(ref.model.nextInterval(ms, dr), eng.nextInterval(ms, dr), 1e-6), `nextInterval dr=${dr}`, `ref=${ref.model.nextInterval(ms, dr)} port=${eng.nextInterval(ms, dr)}`);
        const later = new Date(now.getTime() + 100 * DAY_MS);
        const a = ref.model.forgettingCurve(ms, (later.getTime() - refCard.lastReviewAt.getTime()) / DAY_MS);
        const b = eng.getRetrievability(portCard, later);
        if (ok(near(a, b, 1e-9), "getRetrievability +100 天", `ref=${a} port=${b}`))
            console.log(`[retr] 到期 100 天后记忆率 ref=${a.toFixed(6)} port=${b.toFixed(6)} ✓`);
        ok(eng.getRetrievability(eng.createEmptyCard(), new Date()) === 0, "新卡记忆率固定为 0（排在到期卡之后）");
    }

    /* ---- 5. 存储形状兼容：localStorage 里是毫秒数字，读回后仍可调度 ---- */
    console.log("\n[store] 毫秒序列化的卡（FsrsStore.upsert 形状）");
    {
        const c = await runChain("存储链", [3, 3, 1]);
        const at = new Date(c.now.getTime() + DAY_MS / 3);
        const stored = snap(c.refCard);                       /* Date → 毫秒，与 FsrsStore.upsert 同形 */
        const r = c.ref.review({ card: c.refCard, now: at, grade: FSRS_RATING.Good }).card;
        const p = c.eng.next(stored, at, FSRS_RATING.Good);   /* 数字时间戳入，Date 出 */
        diffCard("存储形状 g=3", r, p);
        if (ok(p.dueAt instanceof Date && p.lastReviewAt instanceof Date, "调度结果时间为 Date"))
            console.log(`[store] ${stored.lastReviewAt} → ${stateName(p.state)} / ${fmtDays(p.scheduledDays)} ✓`);
    }

    /* ---- 6. 保持率扫描：核对 FSRS 设置弹窗里写死的「实测影响」对照表 ---- */
    console.log("\n[dr] 保持率对照表（index.html retentionNote 文案的数据来源；连续「良好」前 3 个间隔，单位天）");
    {
        const note = [
            { dr: 0.80, ivl: ["38", "308", "1796"] },
            { dr: 0.85, ivl: ["15", "98", "454"] },
            { dr: 0.90, ivl: ["4.8", "26", "92"] },
            { dr: 0.92, ivl: ["2.4", "14", "43"] },
        ];
        /* 文案精度：<10 天保留 1 位小数，更长按整天 */
        const asNote = v => (v < 10 ? Math.round(v * 10) / 10 : Math.round(v)).toString();
        for (const { dr, ivl } of note) {
            const ref = await refScheduler(dr);
            const eng = new FsrsEngine({ requestRetention: dr });
            let rc = ref.newCard({ now: T0 }), pc = eng.createEmptyCard(T0), t = new Date(T0.getTime());
            const shown = [];
            for (let i = 0; i < 3; i++) {
                const r = ref.review({ card: rc, now: t, grade: FSRS_RATING.Good }).card;
                const p = eng.next(pc, t, FSRS_RATING.Good);
                diffCard(`dr=${dr} Good#${i + 1}`, r, p);
                shown.push(asNote(p.scheduledDays));
                rc = r; pc = p; t = new Date(r.dueAt.getTime());
            }
            const hit = shown.join(",") === ivl.join(",");
            ok(hit, `dr=${dr} 对照表数值`, `文案=${ivl.join("/")} 实测=${shown.join("/")}`);
            if (!hit) console.log(`  [FAIL] dr=${dr} → ${shown.join(" / ")} 天`);
            else console.log(`  [ok  ] dr=${dr} → ${shown.join(" / ")} 天`);
        }
        /* 高保持率退化：0.95 首答约 7 小时；0.96 首答退化到分钟级 */
        for (const [dr, minutes] of [[0.95, 420], [0.96, 87]]) {
            const ref = await refScheduler(dr);
            const eng = new FsrsEngine({ requestRetention: dr });
            const r = ref.review({ card: ref.newCard({ now: T0 }), now: T0, grade: FSRS_RATING.Good }).card;
            const p = eng.next(eng.createEmptyCard(T0), T0, FSRS_RATING.Good);
            diffCard(`dr=${dr} 首答`, r, p);
            const actual = p.scheduledDays * 1440;
            ok(p.scheduledDays < 1 && Math.abs(actual - minutes) <= 1, `dr=${dr} 首答分钟数`, `期望≈${minutes} 分 实际=${actual.toFixed(1)} 分`);
            console.log(`  [ok  ] dr=${dr} → 新卡首答 ${actual.toFixed(1)} 分（${stateName(p.state)}）`);
        }
    }

    /* ---- 7. 语义不变量与边界 ---- */
    console.log("\n[inv ] 语义不变量");
    {
        const eng = new FsrsEngine();
        const now = new Date(T0.getTime());
        const fresh = eng.createEmptyCard(now);
        ok(fresh.state === FSRS_STATE.New && fresh.stability === 0 && fresh.stabilityFast === 0 && fresh.difficulty === 0
            && fresh.reps === 0 && fresh.lapses === 0 && fresh.lastReviewAt === null && fresh.learningStep === 0, "新卡初始字段");
        const good = eng.next(fresh, now, FSRS_RATING.Good);
        ok(good.state === FSRS_STATE.Review && good.scheduleStatus === "review" && good.learningStep === 0
            && good.reps === 1 && good.lapses === 0, "新卡首答毕业为复习态");
        const again = eng.next(fresh, now, FSRS_RATING.Again);
        ok(again.scheduledDays < 1 && again.state === FSRS_STATE.Learning && again.dueAt.getTime() === now.getTime() + 60000, "学习步 1 分钟精确到期");
        /* 遗忘只发生在「复习态 + Again」，学习期 Again 不计 lapse */
        const relearn = eng.next(good, new Date(good.dueAt.getTime() + DAY_MS), FSRS_RATING.Again);
        ok(relearn.lapses === good.lapses + 1 && relearn.state === FSRS_STATE.Relearning, "复习失败计一次遗忘");
        ok(eng.next(again, new Date(again.dueAt.getTime()), FSRS_RATING.Again).lapses === 0, "学习期 Again 不计遗忘");
        /* reps 恒为「第几次评分」，首答一律 1，与评分档位无关 */
        ok(FSRS_GRADES.every(g => eng.next(fresh, now, g).reps === 1), "任一评分的首答 reps=1");
        /* 间隔上限 36500 天 */
        const capped = eng.next({ ...good, stability: 40000, stabilityFast: 30000, difficulty: 1 }, new Date(good.dueAt.getTime()), FSRS_RATING.Easy);
        ok(capped.scheduledDays <= FSRS7_MAXIMUM_INTERVAL, "间隔封顶 36500 天", `实际=${capped.scheduledDays}`);
        /* 保持率兜底：越界/空值回落 0.90；构造器拒绝非法值（与上游 next_interval 一致） */
        ok(["", "1", "0", "1.2", "abc", undefined, null].every(v => normalizeRetention(v) === 0.9), "normalizeRetention 越界回落 0.90");
        ok(normalizeRetention("0.92") === 0.92 && normalizeRetention(0.8564) === 0.856 && normalizeRetention("0.999") === 0.999, "normalizeRetention 合法取值保留");
        let threw = false;
        try { new FsrsEngine({ requestRetention: 1 }); } catch { threw = true; }
        ok(threw, "dr=1 构造抛错（上游语义）");
        ok(retentionImpact(0.96).includes("分钟级") && retentionImpact(0.92).includes("当天")
            && retentionImpact(0.8).includes("拉长") && retentionImpact(0.9) === "", "影响提示文案分档");
        console.log("[inv ] 首答/学习步/遗忘计数/间隔封顶/保持率兜底 已抽查");
    }

    /* ---- 8. 版本一致性：index.html 常量 == 官方包版本（README 也引用该常量） ---- */
    {
        const officialVersion = JSON.parse(fs.readFileSync(path.join(OFFICIAL, "package.json"), "utf8")).version;
        ok(officialVersion === TS_FSRS_VERSION, "官方包版本与常量一致", `常量=${TS_FSRS_VERSION} 官方包=${officialVersion}`);
        console.log(`\n[ver ] index.html FSRS_TS_VERSION=${TS_FSRS_VERSION} == 官方包 ${officialVersion} ✓`);
    }

    console.log(`\n===== 结果: ${checks - fails}/${checks} 项通过 =====`);
    process.exit(fails ? 1 : 0);
}

main().catch(e => { console.error("[error]", e && e.stack || e); process.exit(1); });
