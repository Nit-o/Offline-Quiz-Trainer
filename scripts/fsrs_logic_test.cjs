// 行为逻辑测试：QuizState 复习模式语义 + FsrsStore 持久化 + 复习队列构建（无 DOM）
// 用法：node scripts/fsrs_logic_test.cjs
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
const srcFile = path.join(__dirname, "..", ".tmp-fsrs", "logic_src.cjs");
fs.writeFileSync(srcFile, html.slice(start, end) + '\nmodule.exports = { QuizState, FsrsStore, FsrsEngine, autoRateFor, AUTO_RATE_PRESETS, resolvePreset };');
const { QuizState, FsrsStore, FsrsEngine, autoRateFor, AUTO_RATE_PRESETS, resolvePreset } = require(srcFile);

let checks = 0;
const ok = (label, cond) => { checks++; assert.ok(cond, `[FAIL] ${label}`); console.log(`[ok] ${label}`); };

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

/* ============ 3. FsrsStore 序列化往返 + prune ============ */
{
    const engine = new FsrsEngine();
    const now = new Date(2026, 0, 1, 10, 0, 0);
    const card = engine.next(engine.createEmptyCard(now), now, 3);
    FsrsStore.upsert("题干A", card);
    const back = FsrsStore.get("题干A");
    ok("upsert 后 due 序列化为 number", typeof back.due === "number" && back.due === card.due.getTime());
    ok("upsert 后 last_review 序列化为 number", back.last_review === now.getTime());
    ok("upsert 后状态字段完整", back.stability === card.stability && back.reps === 1 && back.state === 2);
    const card2 = engine.next(back, new Date(2026, 0, 4, 10, 0, 0), 3);
    ok("序列化卡可直接再次调度（number → Date 归一化）", card2.reps === 2 && card2.elapsed_days === 3);
    FsrsStore.upsert("题干B", engine.next(engine.createEmptyCard(now), now, 1));
    ok("prune 删除孤儿卡", FsrsStore.prune(["题干A"]) === 1 && FsrsStore.count() === 1);
    FsrsStore.save({}); // 清理
}

/* ============ 4. 复习队列端到端（与 #buildFsrsQueue 相同逻辑） ============ */
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

    // 首答间隔（含四评分排序约束）：Again=1, Hard=2, Good=3, Easy=8
    const expDays = { 1: 1, 2: 2, 3: 3, 4: 8 };
    ratings.forEach((r, i) => {
        const c = FsrsStore.get(questions[i].text);
        ok(`Q${i} 评分 ${r} → 间隔 ${expDays[r]} 天`, c.scheduled_days === expDays[r] && c.due === NOW.getTime() + expDays[r] * 86400000);
    });

    // 队列构建（复制 #buildFsrsQueue 逻辑）
    const buildQueue = at => {
        const due = [], fresh = [];
        questions.forEach(q => {
            const card = FsrsStore.get(q.text);
            if (!card) fresh.push(q);
            else if (card.due <= at.getTime()) due.push(q);
        });
        due.sort((a, b) => engine.getRetrievability(FsrsStore.get(a.text), at) - engine.getRetrievability(FsrsStore.get(b.text), at));
        return { queue: due.concat(fresh), due: due.length, fresh: fresh.length };
    };

    let q1 = buildQueue(NOW);
    ok("当天队列：0 到期 + 46 新卡，未到期卡不入队", q1.due === 0 && q1.fresh === 46 && q1.queue.length === 46);

    const day2 = new Date(NOW.getTime() + 1 * 86400000);
    let q2 = buildQueue(day2);
    ok("次日队列：Again 卡（1 天）到期", q2.due === 1 && q2.fresh === 46 && q2.queue.length === 47);
    ok("到期卡排在最前", q2.queue[0].text === "Q1");

    const day4 = new Date(NOW.getTime() + 3 * 86400000);
    let q3 = buildQueue(day4);
    ok("第 4 天队列：Again/Hard/Good×2 共 4 张到期", q3.due === 4 && q3.fresh === 46 && q3.queue.length === 50);
    ok("到期卡按记忆率升序（Q1 最弱排第一）", q3.queue[0].text === "Q1");
    const rs = q3.queue.slice(0, 4).map(q => engine.getRetrievability(FsrsStore.get(q.text), day4));
    ok("记忆率升序：r1 ≤ r2 ≤ r3 ≤ r4", rs[0] <= rs[1] && rs[1] <= rs[2] && rs[2] <= rs[3]);

    // 第 4 天把 4 张到期卡全部复习（Good），明天队列应只剩新卡
    q3.queue.slice(0, 4).forEach(q => {
        const card = FsrsStore.get(q.text);
        FsrsStore.upsert(q.text, engine.next(card, day4, 3));
    });
    const day5 = new Date(day4.getTime() + 1 * 86400000);
    let q4 = buildQueue(day5);
    ok("复习后次日：4 张到期卡不再出现（due 已推迟）", q4.due === 0 && q4.fresh === 46 && q4.queue.length === 46);
    FsrsStore.save({});
}

/* ============ 5. FsrsStore.stats 汇总 ============ */
{
    const engine = new FsrsEngine();
    const now = new Date(2026, 0, 1, 10, 0, 0);
    FsrsStore.save({});
    FsrsStore.upsert("A", engine.next(engine.createEmptyCard(now), now, 3)); // due +3 天
    FsrsStore.upsert("B", engine.next(engine.createEmptyCard(now), now, 1)); // due +1 天
    const s0 = FsrsStore.stats(now);
    ok("stats：当天 0 到期，共 2 卡", s0.due === 0 && s0.total === 2);
    const s1 = FsrsStore.stats(new Date(now.getTime() + 2 * 86400000));
    ok("stats：+2 天 1 张到期（Again 卡）", s1.due === 1);
    ok("stats：平均稳定度 = (2.3065 + 0.212) / 2", Math.abs(s1.avgStability - (2.3065 + 0.212) / 2) < 1e-9);
    ok("stats：reps/lapses 统计", s1.reps === 2 && s1.lapses === 0);
    FsrsStore.save({});
}

/* ============ 6. autoRateFor 自动评分映射（标准/严格/宽松预设） ============ */
{
    ok("答错 → 忘记了(1)", autoRateFor(false, 3000) === 1);
    ok("标准：答对 ≤5s → 简单(4)", autoRateFor(true, 5000) === 4);
    ok("标准：答对 5–15s → 良好(3)", autoRateFor(true, 15000) === 3);
    ok("标准：答对 >15s → 困难(2)", autoRateFor(true, 15001) === 2);
    ok("标准：答对 0ms 边界 → 简单(4)", autoRateFor(true, 0) === 4);
    ok("严格：3s 内 → 简单", autoRateFor(true, 3000, AUTO_RATE_PRESETS.strict) === 4);
    ok("严格：3–10s → 良好", autoRateFor(true, 10000, AUTO_RATE_PRESETS.strict) === 3);
    ok("严格：>10s → 困难", autoRateFor(true, 10001, AUTO_RATE_PRESETS.strict) === 2);
    ok("宽松：10s 内 → 简单", autoRateFor(true, 10000, AUTO_RATE_PRESETS.relaxed) === 4);
    ok("宽松：30s 内 → 良好", autoRateFor(true, 30000, AUTO_RATE_PRESETS.relaxed) === 3);
    ok("宽松：>30s → 困难", autoRateFor(true, 30001, AUTO_RATE_PRESETS.relaxed) === 2);
    ok("宽松：答错仍 → 忘记了", autoRateFor(false, 99999, AUTO_RATE_PRESETS.relaxed) === 1);
}

/* ============ 7. resolvePreset 自定义阈值解析 ============ */
{
    const std = resolvePreset({});
    ok("默认 → 标准预设 5/15s", std.easyMs === 5000 && std.goodMs === 15000);
    ok("strict 预设 3/10s", resolvePreset({ autoRatePreset: "strict" }).easyMs === 3000 && resolvePreset({ autoRatePreset: "strict" }).goodMs === 10000);
    ok("custom 开启且含当前标准 → 自定义值", (() => { const p = resolvePreset({ autoRatePreset: "strict", autoRateCustom: true, autoRatePresets: { strict: { easySec: 2, goodSec: 9 } } }); return p.easyMs === 2000 && p.goodMs === 9000; })());
    ok("custom 开启但无当前标准 → 预设值", resolvePreset({ autoRatePreset: "relaxed", autoRateCustom: true, autoRatePresets: { strict: { easySec: 2, goodSec: 9 } } }).easyMs === 10000);
    ok("custom 关闭 → 预设值", resolvePreset({ autoRatePreset: "strict", autoRateCustom: false, autoRatePresets: { strict: { easySec: 2, goodSec: 9 } } }).easyMs === 3000);
    ok("custom=true 但 presets=null → 预设值", resolvePreset({ autoRatePreset: "relaxed", autoRateCustom: true, autoRatePresets: null }).easyMs === 10000);
    ok("非法标准名 → standard", resolvePreset({ autoRatePreset: "bogus" }).easyMs === 5000);
    ok("settings 为 null → standard", resolvePreset(null).easyMs === 5000);
}

console.log(`\n===== 结果: ${checks}/${checks} 项通过 =====`);
