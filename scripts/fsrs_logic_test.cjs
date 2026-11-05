// 行为逻辑测试：QuizState 复习模式语义 + FsrsStore 持久化 + 复习队列构建（无 DOM）
// 另含第 10 节版本号一致性（README ↔ index.html 常量 ↔ vendor/katex/VERSION）
// 用法：node scripts/fsrs_logic_test.cjs
// 对拍（与官方 ts-fsrs 比对公式结果）见 scripts/fsrs_compare.cjs，需联网装包，不在本测试内
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

/* ---- mock localStorage ---- */
const kv = new Map();
globalThis.localStorage = {
    getItem: k => (kv.has(k) ? kv.get(k) : null),
    setItem: (k, v) => kv.set(k, String(v)),
    removeItem: k => kv.delete(k),
};

/* ---- 提取 index.html 中 EventBus → QuizState 的纯逻辑层 ---- */
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("class EventBus");
const end = html.indexOf("/* ===== Components ===== */");
if (start < 0 || end < 0) { console.error("[extract] 找不到提取标记"); process.exit(1); }
const TMP_DIR = path.join(__dirname, "..", ".tmp-fsrs");
fs.mkdirSync(TMP_DIR, { recursive: true });
const srcFile = path.join(TMP_DIR, "logic_src.cjs");
/* index.html 里 FSRS_TS_VERSION 用 export 暴露（供 tsc 的 noUnusedLocals 与对拍脚本读取）；
   这里抽成 CJS，需去掉 export 关键字 */
const slice = html.slice(start, end).replace(/^export\s+(const\s+FSRS_TS_VERSION)/m, "$1");
fs.writeFileSync(srcFile, slice + '\nmodule.exports = { QuizState, FsrsStore, FsrsEngine, autoRateFor, AUTO_RATE_PRESETS, resolveThresholds, normalizeRetention, retentionImpact, FSRS_TS_VERSION };');
const { QuizState, FsrsStore, FsrsEngine, autoRateFor, AUTO_RATE_PRESETS, resolveThresholds, normalizeRetention, retentionImpact, FSRS_TS_VERSION } = require(srcFile);

let checks = 0;
const ok = (label, cond) => { checks++; assert.ok(cond, `[FAIL] ${label}`); console.log(`[ok] ${label}`); };
/* FSRS-7 允许分钟级间隔，日志按 分钟 / 天 递进表述 */
const fmtIvl = d => d < 1 ? `${Math.round(d * 1440)} 分钟` : `${d.toFixed(4)} 天`;

/* ============ 1. QuizState 普通模式（practice/exam）语义不变 ============ */
{
    const qs = [{ text: "t1", type: "single", answer: "A", options: [{ key: "A" }, { key: "B" }] }];
    const st = new QuizState(qs);
    st.select(0, "B");
    ok("普通模式：单选作答后 isAnswered=true", st.isAnswered(0) === true);
    ok("普通模式：答错 isCorrect=false", st.isCorrect(0) === false);
    ok("普通模式：isErrorAnswered=true", st.isErrorAnswered(0) === true);
    ok("普通模式：未评分概念不存在 isRated=false", st.isRated(0) === false);
}

/* ============ 2. QuizState 复习模式（ratedMode）语义 ============ */
{
    const qs = [{ text: "t2", type: "single", answer: "A", options: [{ key: "A" }, { key: "B" }] }];
    const st = new QuizState(qs, { ratedMode: true });
    st.select(0, "A");
    ok("复习模式：选中但未评分 isAnswered=false（未复习）", st.isAnswered(0) === false);
    ok("复习模式：选中即判定真实对错 isCorrect=true", st.isCorrect(0) === true);
    st.markRated(0, 3, new Date(2026, 0, 4));
    ok("复习模式：评分后 isAnswered=true", st.isAnswered(0) === true);
    ok("复习模式：isRated=true", st.isRated(0) === true);
    ok("复习模式：rating 与 nextDue 已记录", st.get(0).rating === 3 && st.get(0).nextDue.getFullYear() === 2026);
    ok("复习模式：答对且评 Good → 非 error", st.isErrorAnswered(0) === false);
}

/* ============ 3. FsrsStore 序列化往返（FSRS-7 字段：dueAt / lastReviewAt / stabilityFast / scheduledDays / learningStep） ============ */
{
    const engine = new FsrsEngine();
    const now = new Date(2026, 0, 1, 10, 0, 0);
    const card = engine.next(engine.createEmptyCard(now), now, 3);
    FsrsStore.upsert("题干A", card);
    const back = FsrsStore.get("题干A");
    ok("upsert 后 dueAt 序列化为 number", typeof back.dueAt === "number" && back.dueAt === card.dueAt.getTime());
    ok("upsert 后 lastReviewAt 序列化为 number", back.lastReviewAt === now.getTime());
    ok("upsert 后双轨迹字段完整", back.stability === 3.9221 && back.stabilityFast === 3.13768 && back.state === 2 && back.reps === 1);
    ok("upsert 后学习步字段完整", back.learningStep === 0 && back.scheduleStatus === "review" && Math.abs(back.scheduledDays - 4.777721809) < 1e-9);
    ok("卡表不含 FSRS-6 旧字段", !("due" in back) && !("last_review" in back) && !("scheduled_days" in back)
        && !("elapsed_days" in back) && !("learning_steps" in back));
    /* 到期时刻再评 Good：4.7777 天 → 26.1673 天（真值表见 scripts/fsrs_compare.cjs） */
    const card2 = engine.next(back, new Date(card.dueAt.getTime()), 3);
    ok("序列化卡可直接再次调度（number → Date 归一化）", card2.reps === 2 && Math.abs(card2.scheduledDays - 26.167346521) < 1e-6);
    FsrsStore.upsert("题干B", engine.next(engine.createEmptyCard(now), now, 1));
    ok("换题干写入后两张卡并存（不做孤儿卡清理）", FsrsStore.count() === 2 && !!FsrsStore.get("题干A") && !!FsrsStore.get("题干B"));
    ok("卡表键名为 fsrs_cards_v2（FSRS-7 双轨迹表，不与旧 FSRS-6 表共用）", FsrsStore.KEY === "fsrs_cards_v2" && kv.has("fsrs_cards_v2"));
    FsrsStore.save({}); // 清理
}

/* ============ 4. 复习队列端到端（与 #buildFsrsQueue 相同逻辑；FSRS-7 允许分钟级间隔） ============ */
{
    const engine = new FsrsEngine();
    const NOW = new Date(2026, 0, 1, 10, 0, 0);
    const mkQ = i => ({ text: `Q${i}`, type: "single", answer: "A", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }] });
    const questions = Array.from({ length: 51 }, (_, i) => mkQ(i));

    // 复习前 5 题：Good / Again / Hard / Easy / Good（全为新卡）
    const ratings = [3, 1, 2, 4, 3];
    ratings.forEach((r, i) => {
        const card = FsrsStore.get(questions[i].text) ?? engine.createEmptyCard(NOW);
        FsrsStore.upsert(questions[i].text, engine.next(card, NOW, r));
    });
    ok("5 题评分后存储 5 张卡", FsrsStore.count() === 5);

    /* 新卡首答间隔（官方 FSRS-7 实测）：Again=1 分钟、Hard≈14.3 小时、Good≈4.78 天、Easy≈53.87 天
       —— 单调间隔约束使 Hard/Good/Easy 依次递增 */
    const expDays = { 1: 1 / 1440, 2: 0.597461174, 3: 4.777721809, 4: 53.869513162 };
    ratings.forEach((r, i) => {
        const c = FsrsStore.get(questions[i].text);
        ok(`Q${i} 评分 ${r} → 间隔 ${fmtIvl(expDays[r])}`,
            Math.abs(c.scheduledDays - expDays[r]) < 1e-9 && Math.abs(c.dueAt - (NOW.getTime() + expDays[r] * 86400000)) < 1);
    });
    ok("Again 新卡进入学习态（未毕业，scheduledDays < 1 天）", FsrsStore.get("Q1").state === 1 && FsrsStore.get("Q1").learningStep === 0);
    ok("Good/Easy 新卡直接毕业为复习态", FsrsStore.get("Q0").state === 2 && FsrsStore.get("Q3").state === 2);

    // 队列构建（复制 #buildFsrsQueue 逻辑）
    const buildQueue = at => {
        const due = [], fresh = [];
        questions.forEach(q => {
            const card = FsrsStore.get(q.text);
            if (!card) fresh.push(q);
            else if (card.dueAt <= at.getTime()) due.push(q);
        });
        due.sort((a, b) => engine.getRetrievability(FsrsStore.get(a.text), at) - engine.getRetrievability(FsrsStore.get(b.text), at));
        return { queue: due.concat(fresh), due: due.length, fresh: fresh.length };
    };

    const q1 = buildQueue(NOW);
    ok("当天队列：0 到期 + 46 新卡（首答后都还没到期）", q1.due === 0 && q1.fresh === 46 && q1.queue.length === 46);

    const day2 = new Date(NOW.getTime() + 1 * 86400000);
    const q2 = buildQueue(day2);
    ok("次日队列：1 分钟「忘记了」与 14 小时「困难」两张未毕业卡均已到期", q2.due === 2 && q2.fresh === 46 && q2.queue.length === 48);
    ok("到期卡排在最前", q2.queue[0].text === "Q1" && q2.queue[1].text === "Q2");

    const day6 = new Date(NOW.getTime() + 5 * 86400000);
    const q3 = buildQueue(day6);
    ok("第 6 天队列：Again/Hard 超期 + Good×2 到期，共 4 张", q3.due === 4 && q3.fresh === 46 && q3.queue.length === 50);
    const rs = q3.queue.slice(0, 4).map(q => engine.getRetrievability(FsrsStore.get(q.text), day6));
    ok("到期卡按记忆率升序（Q1 最弱排第一）", q3.queue[0].text === "Q1" && rs[0] <= rs[1] && rs[1] <= rs[2] && rs[2] <= rs[3]);

    // 第 6 天把 4 张到期卡全部评 Good，次日队列只剩「学习步未走完」的那张
    q3.queue.slice(0, 4).forEach(q => FsrsStore.upsert(q.text, engine.next(FsrsStore.get(q.text), day6, 3)));
    const day7 = new Date(day6.getTime() + 1 * 86400000);
    const q4 = buildQueue(day7);
    ok("毕业卡（≥1 天）不再出现，未走完学习步的 Q1 仍是分钟级到期", q4.due === 1 && q4.queue[0].text === "Q1" && q4.fresh === 46);
    FsrsStore.save({});
}

/* ============ 5. FsrsStore.stats 汇总 ============ */
{
    const engine = new FsrsEngine();
    const now = new Date(2026, 0, 1, 10, 0, 0);
    FsrsStore.save({});
    FsrsStore.upsert("A", engine.next(engine.createEmptyCard(now), now, 3)); // due +4.78 天
    FsrsStore.upsert("B", engine.next(engine.createEmptyCard(now), now, 1)); // due +1 分钟
    const s0 = FsrsStore.stats(now);
    ok("stats：当天 0 到期，共 2 卡", s0.due === 0 && s0.total === 2);
    const s1 = FsrsStore.stats(new Date(now.getTime() + 2 * 86400000));
    ok("stats：+2 天 1 张到期（1 分钟学习步卡）", s1.due === 1);
    ok("stats：平均稳定度 = (3.9221 + 0.1104) / 2", Math.abs(s1.avgStability - (3.9221 + 0.1104) / 2) < 1e-9);
    ok("stats：reps/lapses 统计", s1.reps === 2 && s1.lapses === 0);
    FsrsStore.save({});
}

/* ============ 6. autoRateFor 自动评分映射（标准/严格/宽松预设） ============ */
{
    const STD = { easyMs: 5000, goodMs: 15000 };
    ok("答错 → 忘记了(1)", autoRateFor(false, 3000, STD) === 1);
    ok("标准：答对 ≤5s → 简单(4)", autoRateFor(true, 5000, STD) === 4);
    ok("标准：答对 5–15s → 良好(3)", autoRateFor(true, 15000, STD) === 3);
    ok("标准：答对 >15s → 困难(2)", autoRateFor(true, 15001, STD) === 2);
    ok("标准：答对 0ms 边界 → 简单(4)", autoRateFor(true, 0, STD) === 4);
    ok("严格：3s 内 → 简单", autoRateFor(true, 3000, AUTO_RATE_PRESETS.strict) === 4);
    ok("严格：3–10s → 良好", autoRateFor(true, 10000, AUTO_RATE_PRESETS.strict) === 3);
    ok("严格：>10s → 困难", autoRateFor(true, 10001, AUTO_RATE_PRESETS.strict) === 2);
    ok("宽松：10s 内 → 简单", autoRateFor(true, 10000, AUTO_RATE_PRESETS.relaxed) === 4);
    ok("宽松：30s 内 → 良好", autoRateFor(true, 30000, AUTO_RATE_PRESETS.relaxed) === 3);
    ok("宽松：>30s → 困难", autoRateFor(true, 30001, AUTO_RATE_PRESETS.relaxed) === 2);
    ok("宽松：答错仍 → 忘记了", autoRateFor(false, 99999, AUTO_RATE_PRESETS.relaxed) === 1);
}

/* ============ 7. resolveThresholds 动态阈值解析（题干/题型模型 + 自定义覆盖） ============ */
{
    /* 空题干 → 单选模型：baseMs 2500 + perChar 75 × 0 字 = 2500；good = ×2.5 */
    ok("默认 → 动态阈值 2500/6250", (() => { const r = resolveThresholds(null, {}); return r.easyMs === 2500 && r.goodMs === 6250; })());
    ok("strict 档位缩放 0.75 → 1875/4688", (() => { const r = resolveThresholds(null, { autoRatePreset: "strict" }); return r.easyMs === 1875 && r.goodMs === 4688; })());
    ok("relaxed 档位缩放 1.6 → 4000/10000", (() => { const r = resolveThresholds(null, { autoRatePreset: "relaxed" }); return r.easyMs === 4000 && r.goodMs === 10000; })());
    ok("custom 开启且含当前标准 → 固定秒数", (() => { const r = resolveThresholds(null, { autoRatePreset: "strict", autoRateCustom: true, autoRatePresets: { strict: { easySec: 2, goodSec: 9 } } }); return r.easyMs === 2000 && r.goodMs === 9000; })());
    ok("custom 开启但无当前标准 → 动态预设", (() => { const r = resolveThresholds(null, { autoRatePreset: "relaxed", autoRateCustom: true, autoRatePresets: { strict: { easySec: 2, goodSec: 9 } } }); return r.easyMs === 4000 && r.goodMs === 10000; })());
    ok("custom 关闭 → 动态预设", (() => { const r = resolveThresholds(null, { autoRatePreset: "strict", autoRateCustom: false, autoRatePresets: { strict: { easySec: 2, goodSec: 9 } } }); return r.easyMs === 1875 && r.goodMs === 4688; })());
    ok("presets=null → 动态预设", (() => { const r = resolveThresholds(null, { autoRatePreset: "relaxed", autoRateCustom: true, autoRatePresets: null }); return r.easyMs === 4000 && r.goodMs === 10000; })());
    ok("非法档位名 → standard", resolveThresholds(null, { autoRatePreset: "bogus" }).easyMs === 2500);
    ok("settings 为 null → standard 动态", (() => { const r = resolveThresholds(null, null); return r.easyMs === 2500 && r.goodMs === 6250; })());
    ok("题干越长阈值越高", (() => { const q = { type: "single", text: "一二三四五六七八九十", options: [{ text: "一二三" }, { text: "四五" }] }; const r = resolveThresholds(q, {}); return r.easyMs > 2500; })());
}

/* ============ 7.5 记忆保持率：自定义取值 + 越界兜底（FSRS-7 求解要求 0 < dr < 1） ============ */
{
    ok("合法小数直接保留", normalizeRetention("0.92") === 0.92 && normalizeRetention(0.8) === 0.8 && normalizeRetention("0.999") === 0.999);
    ok("多位小数截到 3 位", normalizeRetention(0.8564) === 0.856);
    ok("空值/非数/0/1/越界 → 回落 0.90", ["", " ", "abc", null, undefined, "0", "1", "1.5", "-0.5"].every(v => normalizeRetention(v) === 0.9));
    ok("兜底值可直接构造引擎", new FsrsEngine({ requestRetention: normalizeRetention("1") }).retention === 0.9);
    let threw = false;
    try { new FsrsEngine({ requestRetention: 1 }); } catch { threw = true; }
    ok("越界值不经兜底直接构造 → 抛错（与上游一致）", threw);
    ok("影响提示分档：≥0.96 分钟级 / ≥0.92 当天再见 / ≤0.8 间隔拉长 / 其余无提示",
        retentionImpact(0.96).includes("分钟级") && retentionImpact(0.92).includes("当天") && retentionImpact(0.8).includes("拉长") && retentionImpact(0.9) === "");
    /* 自定义低保持率确实放大间隔（对照弹窗说明） */
    const loose = new FsrsEngine({ requestRetention: 0.8 }), tight = new FsrsEngine({ requestRetention: 0.95 });
    const now = new Date(Date.UTC(2026, 0, 1));
    ok("0.80 首答间隔远大于 0.95（同一张新卡）",
        loose.next(loose.createEmptyCard(now), now, 3).scheduledDays > tight.next(tight.createEmptyCard(now), now, 3).scheduledDays);
}

/* ============ 8. FsrsStore.snapshot 单次遍历汇总（含分钟级学习步卡） ============ */
{
    const now = new Date(2026, 0, 4, 10, 0, 0); // 2026-01-04 10:00（本地）
    const DAY = 86400000;
    const t = ms => now.getTime() + ms;
    FsrsStore.save({
        "A": { dueAt: t(DAY), stability: 5, stabilityFast: 4, difficulty: 5, state: 2, reps: 2, lapses: 1, scheduledDays: 1, learningStep: 0, scheduleStatus: "review", lastReviewAt: new Date(2026, 0, 3, 9, 0, 0).getTime() },
        "B": { dueAt: t(2 * DAY), stability: 0, stabilityFast: 0, difficulty: 1, state: 2, reps: 1, lapses: 0, scheduledDays: 2, learningStep: 0, scheduleStatus: "review", lastReviewAt: new Date(2026, 0, 4, 9, 30, 0).getTime() },
        "C": { dueAt: t(-DAY), stability: 2, stabilityFast: 1.6, difficulty: 5, state: 2, reps: 3, lapses: 0, scheduledDays: 2, learningStep: 0, scheduleStatus: "review", lastReviewAt: null },
        "D": { dueAt: t(8 * DAY), stability: 9, stabilityFast: 7.2, difficulty: 5, state: 2, reps: 4, lapses: 0, scheduledDays: 8, learningStep: 0, scheduleStatus: "review", lastReviewAt: new Date(2025, 11, 27, 8, 0, 0).getTime() },
        /* 学习步卡：1 分钟前到期，今天还要再见 —— 预测必须落在「今天」而不是明天 */
        "E": { dueAt: t(-60000), stability: 0.1104, stabilityFast: 0.08832, difficulty: 6.1686, state: 1, reps: 1, lapses: 0, scheduledDays: 1 / 1440, learningStep: 0, scheduleStatus: "learning", lastReviewAt: new Date(2026, 0, 4, 9, 59, 0).getTime() },
    });
    const s = FsrsStore.snapshot(now);
    ok("snapshot：总数/已到期/平均稳定度/reps/lapses", s.total === 5 && s.due === 2 && Math.abs(s.avgStability - (5 + 2 + 9 + 0.1104) / 4) < 1e-9 && s.reps === 11 && s.lapses === 1);
    ok("snapshot：近 7 天复习量按卡计（B、E 同日各 1）", s.reviews["2026-01-03"] === 1 && s.reviews["2026-01-04"] === 2 && s.reviews["2026-01-01"] === undefined);
    ok("snapshot：未来 3 天预测按到期日归档（分钟级卡落在今天）", s.forecast[0] === 2 && s.forecast[1] === 1 && s.forecast[2] === 1);
    const past = s.weekly.past, future = s.weekly.future;
    ok("snapshot：周明细过去（新增仅 reps=1）", past.at(-1).key === "2026-01-04" && past.at(-1).reviews === 2 && past.at(-1).fresh === 2 && past.at(-2).reviews === 1);
    ok("snapshot：周明细未来 7 天（超窗不计）", future[0].due === 1 && future[1].due === 1 && future.slice(2).every(f => f.due === 0));
    FsrsStore.save({});
}

/* ============ 8.5 QuizState.append：分钟级学习步的队尾追加 ============ */
{
    const qs = [{ text: "a1", type: "single", answer: "A", options: [{ key: "A" }, { key: "B" }] }];
    const st = new QuizState(qs, { ratedMode: true });
    st.markRated(0, 1, new Date());
    /* 与 #requeueIfNeeded 同步：题目数组先追加，状态表再补一项 */
    qs.push(qs[0]);
    st.append(1);
    ok("append：新条目为未评分初始态（会被再次复习）", st.isRated(1) === false && st.isAnswered(1) === false && st.get(1).rating === 0);
    st.select(1, "A");
    ok("append：追加项可独立作答与判定", st.isCorrect(1) === true);
    st.markRated(1, 3, new Date());
    ok("append：追加项可独立评分", st.isRated(1) === true && st.isRated(0) === true);
    st.reset();
    ok("reset 后追加项一并复位", st.isRated(1) === false);
}

/* ============ 9. 多选答案判定：与选择顺序、答案写法都无关 ============ */
{
    const mk = answer => [{ text: "m1", type: "multiple", answer, options: [{ key: "A" }, { key: "B" }, { key: "C" }, { key: "D" }] }];
    const judge = (answer, picks) => {
        const st = new QuizState(mk(answer));
        picks.forEach(k => st.select(0, k, true));
        st.submitMulti(0);
        return st.isCorrect(0);
    };
    ok("多选：乱序全选判对（选 C,B,A,D / 答案 ABCD）", judge("ABCD", ["C", "B", "A", "D"]) === true);
    ok("多选：顿号分隔答案判对（答案 A、B、C、D）", judge("A、B、C、D", ["C", "B", "A", "D"]) === true);
    ok("多选：半角逗号分隔答案判对（答案 A,B,D）", judge("A,B,D", ["D", "A", "B"]) === true);
    ok("多选：空格分隔答案判对（答案 A B C）", judge("A B C", ["B", "C", "A"]) === true);
    ok("多选：全选但答案重复字母判对（答案 A、A、B、C）", judge("A、A、B、C", ["C", "B", "A"]) === true);
    ok("多选：少选判错", judge("ABCD", ["A", "B", "C"]) === false);
    ok("多选：多选判错", judge("AB", ["A", "B", "C"]) === false);
    ok("多选：未提交不算已作答", (() => { const st = new QuizState(mk("AB")); st.select(0, "A", true); st.select(0, "B", true); return st.isCorrect(0) === false; })());
    ok("单选：仍按原始字母比较", (() => { const st = new QuizState([{ text: "s1", type: "single", answer: "A", options: [{ key: "A" }, { key: "B" }] }]); st.select(0, "A"); return st.isCorrect(0) === true; })());
}

/* ============ 10. 版本号一致性：index.html 常量 / README / vendor/katex/VERSION ============ */
{
    const repoRoot = path.join(__dirname, "..");
    const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

    /* 10a. FSRS 移植版本：README 显示的 ts-fsrs 版本必须与 FSRS_TS_VERSION 一致。
       README 里是 Markdown 链接（[ts-fsrs](url) **v6.0.0**），故允许链接目标与强调符号穿插 */
    ok("FSRS_TS_VERSION 是合法版本号", /^\d+\.\d+\.\d+$/.test(FSRS_TS_VERSION));
    const readmeFsrs = readme.match(/ts-fsrs\b[^\n]*?\bv(\d+\.\d+\.\d+)/);
    ok(`README 显示 ts-fsrs v${FSRS_TS_VERSION}`, !!readmeFsrs && readmeFsrs[1] === FSRS_TS_VERSION);

    /* 10b. KaTeX 版本：README / vendor/katex/VERSION / index.html 占位符三处一致 */
    const katexVersion = fs.readFileSync(path.join(repoRoot, "vendor", "katex", "VERSION"), "utf8").trim();
    ok("vendor/katex/VERSION 是合法版本号", /^\d+\.\d+\.\d+$/.test(katexVersion));
    const readmeKatex = readme.match(/KaTeX\b[^\n]*?\bv(\d+\.\d+\.\d+)/);
    ok(`README 显示 KaTeX v${katexVersion}`, !!readmeKatex && readmeKatex[1] === katexVersion);
    ok("index.html 保留 __KATEX_VERSION__ 占位符（构建时注入）", html.includes("__KATEX_VERSION__"));
    /* 不允许在 index.html 里硬编码 KaTeX 版本，避免与 vendor 漂移 */
    ok("index.html 未硬编码 KaTeX 版本", !new RegExp(`KaTeX\\s+v?${katexVersion.replace(/\./g, "\\.")}`).test(html));
}

console.log(`\n===== 结果: ${checks}/${checks} 项通过 =====`);
