/* DOM-stub smoke test for Offline-Quiz-Trainer index.html module script.
   Simulates: init → file import (parse+cache) → cached load → delete → export chooser
   (share/save chains) → stats 累计/近3次 toggle & reset → daily-new estimate → trend dialog. */
'use strict';
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const src = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const md = fs.readFileSync('doc/B类题库_origin.md', 'utf8');

/* ---------- Element stub ---------- */
class El {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.listeners = {};
        this.dataset = {};
        this.style = {};
        this.attributes = {};
        this.classList = {
            _s: new Set(),
            add: (...c) => c.forEach(x => this.classList._s.add(x)),
            remove: (...c) => c.forEach(x => this.classList._s.delete(x)),
            toggle: (c, force) => { const on = force !== undefined ? !!force : !this.classList._s.has(c); on ? this.classList._s.add(c) : this.classList._s.delete(c); return on; },
            contains: c => this.classList._s.has(c),
        };
        this.textContent = '';
        this.innerText = '';
        this.value = '';
        this.checked = false;
        this.disabled = false;
        this.hidden = false;
        this.open = false;
        this.tabIndex = 0;
        this.files = [];
        this.className = '';
        this.title = '';
        this.type = '';
    }
    addEventListener(ev, cb) { (this.listeners[ev] ||= []).push(cb); }
    trigger(ev, ...args) {
        const event = args[0] || {};
        if (!event.target) event.target = this;
        let el = this;
        while (el) { (el.listeners[ev] || []).forEach(cb => cb(event)); el = el._parent; }
    }
    click() { this.trigger('click', { target: this }); }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    appendChild(c) { this.children.push(c); c._parent = this; return c; }
    append(...cs) { cs.forEach(c => { if (c && typeof c === 'object') { this.children.push(c); c._parent = this; } }); }
    replaceChildren(...cs) { this.children = []; cs.forEach(c => { this.children.push(c); c._parent = this; }); }
    removeChild(c) { this.children = this.children.filter(x => x !== c); }
    remove() { /* noop */ }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
    querySelectorAll(sel) {
        const out = [];
        const walk = el => {
            el.children.forEach(c => { if (c.matches?.(sel)) out.push(c); walk(c); });
        };
        walk(this);
        return out;
    }
    matches(sel) {
        if ((this._sel ?? '') === sel) return true;
        if (sel.startsWith('.')) return this.className.split(/\s+/).includes(sel.slice(1));
        if (sel.startsWith('[') && sel.endsWith(']')) {
            const attr = sel.slice(1, -1).split('=')[0];
            const key = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            return this.dataset[key] !== undefined;
        }
        if (!sel.startsWith('[')) return this.tagName === sel.toUpperCase();
        return false;
    }
    focus() {}
    select() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    closest(sel) { let el = this; while (el) { if (el.matches?.(sel)) return el; el = el._parent; } return null; }
    get innerHTML() { return this._html ?? ''; }
    set innerHTML(v) { this._html = v; this.children = []; }
    get firstChild() { return this.children[0] ?? null; }
}

/* ---------- document / window / globals ---------- */
const els = {};
const collections = { '.theme-option': [], '.mode-card': [], '.preset-row': [], '.swipe-indicator.left': [], '.swipe-indicator.right': [] };
const byId = [
    'menuPanel','fileInput','fileDropZone','fileList','fileStatus','bankCacheList','modeSection','startQuizBtn',
    'autoNextToggle','autoNextDelay','showHistoryToggle','hideMasteredToggle','autoRateToggle','fsrsEnabledToggle',
    'fsrsSubmenu','autoRatePresetSelect','autoRatePresetRow','autoRateCustomToggle','presetDialog','presetDialogClose',
    'presetResetBtn','presetSaveBtn','retentionInput','dailyNewInput','resetFsrsBtn','exportFsrsBtn','copyFsrsBtn',
    'importFsrsBtn','fsrsImportInput','fsrsTotalCards','fsrsDueToday','fsrsAvgStability','ovSessions','ovAnswered',
    'ovAccuracy','ovMastered','ovReps','ovLapses','ovAvgTime','trendChart','fc0','fc1','fc2','trendChartWide',
    'ovSessionsLabel','ovAnsweredLabel','ovAccuracyLabel','statsModeBtn','statsResetBtn','statsGrid','dailyNewEstimate',
    'trendDetailBtn','trendDialog','trendDialogClose','backupDialog','backupDialogClose','backupShareBtn','backupSaveBtn',
    'quizSection','resultSection','questionContainer','answerFeedback','prevBtn','nextBtn','markBtn','masterBtn',
    'restartBtn','reviewBtn','wrongContainer','exportBtn','exportPanel','exportLinks','copyExportBtn','closeExportBtn',
    'historyPanel','historyList','snackbar','curTime','totalTime','progressBar','currentQ','totalQ','correctCount',
    'incorrectCount','unansweredCount','scoreValue','totalScore','resultTotalTime','avgTime','resCorrect','resIncorrect',
    'resUnanswered','resultMsg','touchSwipeZone','questionSlideWrap','markBadge','navFab','navOverlay','navOverlayClose',
    'navSubmitBtn','questionNav',
];
byId.forEach(id => { els[id] = new El(); if (id === 'quizSection' || id === 'modeSection' || id === 'resultSection') els[id].classList.add('hidden'); });
// masterBtn/markBtn 内的 .btn-text
els.markBtn._sel = 'markBtn';
els.masterBtn._sel = 'masterBtn';

const keyListeners = [];
const document = {
    getElementById: id => els[id] ?? null,
    querySelectorAll: sel => collections[sel] ?? [],
    querySelector: sel => (collections[sel] ?? [])[0] ?? null,
    createElement: tag => new El(tag),
    createDocumentFragment: () => new El(),
    execCommand: () => true,
    documentElement: new El('html'),
    addEventListener(ev, cb) { if (ev === 'keydown') keyListeners.push(cb); },
    body: new El('body'),
};
const dispatchKey = key => { const e = { key, preventDefault() {}, shiftKey: false, target: document.body }; keyListeners.forEach(cb => cb(e)); };
const listeners = {};

/* localStorage */
const store = new Map();
const localStorage = {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
};
/* 配额模拟：超过 5MB（接近真实 localStorage 上限）抛错 */
const origSet = localStorage.setItem.bind(localStorage);
localStorage.setItem = (k, v) => { if (String(v).length > 5000000) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } origSet(k, v); };

/* navigator / share 桩 */
const shareCalls = [];
const shareBehavior = []; // 'ok' | 'fail'
const navigator = {
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile',
    share: async data => {
        shareCalls.push({ ...data, _files: data.files?.length });
        const mode = shareBehavior.shift() ?? 'ok';
        if (mode === 'fail') throw new Error('NotAllowedError');
        if (mode === 'abort') { const e = new Error('AbortError'); e.name = 'AbortError'; throw e; }
    },
    canShare: () => false, // 模拟旧 WebView：canShare 存在但返回 false（修复前的行为）
    clipboard: { writeText: async () => {} },
};

const matchMedia = () => ({ matches: false, addEventListener() {} });
const performance = { now: () => Date.now() };
const sandbox = {
    document, localStorage, navigator, matchMedia, performance,
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    confirm: () => true,
    File: class { constructor(parts, name, opts) { this.name = name; this.type = opts?.type; this._parts = parts; } async text() { return this._parts.join(''); } },
    FileReader: class { readAsText() {} },
    Blob: class { constructor(parts, opts) { this._parts = parts; this.type = opts?.type; } },
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
    window: {},
    console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, Error, RegExp, isNaN, parseInt, parseFloat,
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'index-module.mjs' });

/* ---------- 断言辅助 ---------- */
let failed = 0;
const assert = (cond, msg) => { if (cond) console.log('  ✓', msg); else { failed++; console.error('  ✗ FAIL:', msg); } };
const flush = () => new Promise(r => setTimeout(r, 30));

(async () => {
    console.log('== 1. 初始化 ==');
    assert(els.fileStatus.innerText === '', '初始化后无加载文案');
    assert(els.bankCacheList.children.length === 1 && els.bankCacheList.children[0].className === 'bank-cache-empty', '缓存列表显示空状态');

    console.log('== 2. 文件导入（解析 + 自动缓存）==');
    els.fileInput.files = [{ name: 'B类题库_origin.md', text: async () => md }];
    els.fileInput.trigger('change');
    await flush();
    const st = els.fileStatus.innerText;
    assert(/成功加载 1143 题，已缓存到本地/.test(st), `状态文案正确: "${st}"`);
    assert(els.fileStatus.getAttribute('aria-busy') === 'false', 'aria-busy 已复位');
    assert(els.fileInput.value === '', '导入后文件选择器已清空（可重选同一文件）');
    assert(!els.modeSection.classList.contains('hidden'), '模式选择已显示');
    assert(els.quizSection.classList.contains('hidden'), '答题区已收起');
    assert(els.bankCacheList.children.length === 1 && els.bankCacheList.children[0].className === 'bank-cache-item', '缓存列表出现 1 条记录');
    const item = els.bankCacheList.children[0];
    const loadBtn = item.querySelectorAll('button').find(b => b.dataset.bankLoad);
    const delBtn = item.querySelectorAll('button').find(b => b.dataset.bankDel);
    assert(!!loadBtn && !!delBtn, '条目含加载/删除按钮');
    assert(item.querySelectorAll('.bank-cache-name')[0].textContent === 'B类题库_origin.md', '缓存名称正确');
    assert(/1143 题/.test(item.querySelectorAll('.bank-cache-sub')[0].textContent), '缓存题数正确');

    console.log('== 3. 从缓存加载（免选文件）==');
    loadBtn.click();
    await flush();
    assert(/已从缓存加载 1143 题（B类题库_origin.md）/.test(els.fileStatus.innerText), `缓存加载状态: "${els.fileStatus.innerText}"`);
    assert(!els.modeSection.classList.contains('hidden'), '缓存加载后显示模式选择');

    console.log('== 4. 删除缓存 ==');
    delBtn.click();
    await flush();
    assert(els.bankCacheList.children[0].className === 'bank-cache-empty', '删除后回到空状态');

    console.log('== 5. 导出备份：点击先弹出导出方式选择 ==');
    els.exportFsrsBtn.trigger('click');
    await flush();
    assert(els.backupDialog.open, '导出按钮调起导出方式对话框');

    console.log('== 6. 分享（canShare=false 时仍调起系统分享）==');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(shareCalls.length >= 1 && shareCalls[0]._files === 1, `首次分享携带文件（调起系统分享面板）`);
    assert(els.snackbar.textContent.includes('备份已通过系统分享导出'), `分享成功提示: "${els.snackbar.textContent}"`);
    assert(!els.backupDialog.open, '分享后对话框已关闭');

    console.log('== 7. 分享降级链：文件分享失败 → 文本分享 ==');
    shareBehavior.push('fail', 'ok');
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(shareCalls.length === 3 && shareCalls[1]._files === 1, '第二次导出先尝试文件分享');
    assert(shareCalls[2].text?.includes('"kind": "fsrs-cards"'), '文件分享失败后降级文本分享');
    assert(els.snackbar.textContent.includes('备份已通过系统分享导出'), '降级后仍提示分享成功');

    console.log('== 8. 分享降级链：全部失败 → 复制剪贴板 ==');
    shareBehavior.push('fail', 'fail');
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(els.snackbar.textContent.includes('备份已复制到剪贴板'), `最终降级为复制: "${els.snackbar.textContent}"`);

    console.log('== 9. 用户取消分享不降级 ==');
    shareBehavior.push('abort');
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(els.snackbar.textContent.includes('备份已通过系统分享导出'), 'AbortError 视为完成，不降级');

    console.log('== 10. 保存到本地（无 File System Access 时降级并提示）==');
    els.exportFsrsBtn.trigger('click');
    els.backupSaveBtn.trigger('click');
    await flush();
    assert(els.snackbar.textContent.includes('无法直接保存'), `Android WebView 保存提示: "${els.snackbar.textContent}"`);
    assert(!els.backupDialog.open, '保存后对话框已关闭');

    console.log('== 10.5 Cordova 原生分享（NativeShare 优先于 navigator.share）==');
    const nativeCalls = [];
    sandbox.NativeShare = {
        shareFile: (t, n, c, ok) => { nativeCalls.push(['shareFile', t, n, typeof c]); ok(); },
        shareText: (t, c, ok) => { nativeCalls.push(['shareText', t, typeof c]); ok(); },
        saveFile: (t, n, c, ok) => { nativeCalls.push(['saveFile', t, n, typeof c]); ok(); },
    };
    const shareCallsBefore = shareCalls.length;
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(nativeCalls.length === 1 && nativeCalls[0][0] === 'shareFile' && nativeCalls[0][3] === 'string', '原生优先：分享 .json 文件内容');
    assert(els.snackbar.textContent.includes('备份已通过系统分享导出'), `原生分享成功提示: "${els.snackbar.textContent}"`);
    assert(shareCalls.length === shareCallsBefore, '原生路径不调用 navigator.share');
    // 原生文件分享失败 → 降级原生文本分享
    sandbox.NativeShare.shareFile = (t, n, c, ok, err) => { nativeCalls.push(['shareFile', t, n, typeof c]); err('boom'); };
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(nativeCalls.length === 3 && nativeCalls[2][0] === 'shareText', '文件分享失败降级为原生文本分享');
    // 原生保存优先于 Web 降级
    els.exportFsrsBtn.trigger('click');
    els.backupSaveBtn.trigger('click');
    await flush();
    assert(nativeCalls.length === 4 && nativeCalls[3][0] === 'saveFile', '原生保存到本地优先');
    assert(els.snackbar.textContent.includes('备份已保存到本地'), `原生保存成功提示: "${els.snackbar.textContent}"`);
    // 原生保存取消 → 静默
    sandbox.NativeShare.saveFile = (t, n, c, ok, err) => { nativeCalls.push(['saveFile', t, n, typeof c]); err('cancelled'); };
    els.exportFsrsBtn.trigger('click');
    els.backupSaveBtn.trigger('click');
    await flush();
    assert(nativeCalls.length === 5 && !/失败|无法/.test(els.snackbar.textContent), '用户取消保存不提示错误');
    delete sandbox.NativeShare;

    console.log('== 11. 数据统计：累计 ↔ 近 3 次切换 + 重置 ==');
    store.set('quiz_stats', JSON.stringify({
        sessions: 5, answered: 100, correct: 80, timeMs: 600000, daily: {}, recent: [
            { answered: 10, correct: 8, timeMs: 60000, at: '2026-08-05T10:00:00Z' },
            { answered: 20, correct: 14, timeMs: 120000, at: '2026-08-06T10:00:00Z' },
            { answered: 5, correct: 3, timeMs: 30000, at: '2026-08-07T10:00:00Z' },
        ],
    }));
    els.menuPanel.trigger('toggle');
    assert(String(els.ovSessions.textContent) === '5' && String(els.ovAnswered.textContent) === '100' && els.ovAccuracy.textContent === '80%', `累计显示正确: ${els.ovSessions.textContent}/${els.ovAnswered.textContent}/${els.ovAccuracy.textContent}`);
    assert(els.statsGrid.getAttribute('aria-pressed') === 'false', '默认累计模式');
    els.statsGrid.trigger('click');
    assert(els.statsGrid.getAttribute('aria-pressed') === 'true', '点击面板切换为近 3 次');
    assert(String(els.ovSessions.textContent) === '3' && String(els.ovAnswered.textContent) === '35' && els.ovAccuracy.textContent === `${Math.round((25 / 35) * 100)}%`, `近 3 次数值正确: ${els.ovSessions.textContent}/${els.ovAnswered.textContent}/${els.ovAccuracy.textContent}`);
    assert(els.ovSessionsLabel.textContent === '近 3 次练习' && els.ovAnsweredLabel.textContent === '近 3 次答题', `标签已切换: "${els.ovSessionsLabel.textContent}"`);
    els.statsResetBtn.trigger('click');
    els.menuPanel.trigger('toggle');
    assert(String(els.ovSessions.textContent) === '0' && String(els.ovAnswered.textContent) === '0', '重置后统计归零');

    console.log('== 12. 每日新卡上限预计完成时间 ==');
    els.dailyNewInput.value = '20';
    els.dailyNewInput.trigger('change');
    assert(els.dailyNewEstimate.hidden === false && /预计 58 天/.test(els.dailyNewEstimate.textContent), `预计完成时间提示: "${els.dailyNewEstimate.textContent}"`);
    els.dailyNewInput.value = '0';
    els.dailyNewInput.trigger('change');
    assert(els.dailyNewEstimate.hidden === true, '上限为 0（不限量）时隐藏估算');

    console.log('== 13. 周明细弹窗：点击打开，点击空白处关闭 ==');
    els.trendDetailBtn.trigger('click');
    assert(els.trendDialog.open, '「近 1 周实际 / 未来 1 周预计」弹窗已打开');
    els.trendDialog.trigger('click');
    assert(!els.trendDialog.open, '点击空白处关闭弹窗');

    console.log('== 14. 多行题干续行 + 代码块内容保护 ==');
    els.fileInput.files = [{ name: 'multi.md', text: async () => [
        '## 一、单选题',
        '',
        '[Q] 心脏位于胸腔',
        '的哪个位置？',
        '[A] 左前方',
        '[B] 右前方',
        '[T] A',
        '**解析：** 见代码：',
        '```',
        '# 注释不是标题',
        '**不是加粗**',
        '```',
        '',
        '### 2. 二选一',
        'A. 甲',
        'B. 乙',
        '**答案： B**',
        '**解析：** 使用 `**行内代码**` 原样。',
    ].join('\n') }];
    els.fileInput.trigger('change');
    await flush();
    assert(/成功加载 2 题/.test(els.fileStatus.innerText), `多行题干与代码块题库解析: "${els.fileStatus.innerText}"`);
    assert(els.fileInput.value === '', '再次导入后文件选择器已清空');

    console.log('== 15. MarkdownParser：代码/行内代码内容不被二次改写 ==');
    const escSrc = html.match(/const esc = [^\n]*\n/)[0];
    const parserClass = html.slice(html.indexOf('class MarkdownParser'), html.indexOf('/* ===== Timer'));
    const makeParser = new Function(`${escSrc}\n${parserClass}\nreturn MarkdownParser;`);
    const MarkdownParser = makeParser();
    const parsed = MarkdownParser.parse('使用 `**行内代码**` 与 \n\n\`\`\`js\n# 注释不是标题\n**不是加粗**\n\`\`\`');
    assert(parsed.includes('<code>**行内代码**</code>') && !parsed.includes('<strong>**行内代码**</strong>'), '行内代码内容不被加粗');
    assert(parsed.includes('<pre><code>js\n# 注释不是标题\n**不是加粗**\n</code></pre>'), '代码块内容原样保留（无 <h3>/加粗/<br>）');
    assert(!parsed.includes('<h3>'), '代码块内 # 行未被转为标题');

    console.log('== 16. 答题流程：普通模式作答/导航/交卷/错题回顾/重新开始 ==');
    els.autoNextToggle.checked = false; // 关闭自动下一题，保证断言时序
    els.autoNextToggle.trigger('change');
    els.fileInput.files = [{ name: 'flow.md', text: async () => [
        '## 一、单选题',
        '',
        '### 1. 第一题',
        'A. 甲',
        'B. 乙',
        '**答案： A**',
        '**解析：** 解析一。',
        '',
        '### 2. 第二题',
        'A. 甲',
        'B. 乙',
        '**答案： A**',
    ].join('\n') }];
    els.fileInput.trigger('change');
    await flush();
    els.startQuizBtn.click();
    await flush();
    assert(!els.quizSection.classList.contains('hidden'), '开始后答题区显示');
    assert(String(els.totalQ.textContent) === '2', '总题数显示 2');
    assert(els.questionContainer.innerHTML.includes('第一题'), '第 1 题题干已渲染');
    assert(String(els.currentQ.textContent) === '1', '当前题号 1');

    dispatchKey('1'); // 选 A → 正确
    await flush();
    assert(!els.answerFeedback.classList.contains('hidden'), '作答后反馈显示');
    assert(els.answerFeedback.innerHTML.includes('正确'), '答对反馈');
    assert(String(els.correctCount.textContent) === '1', '正确计数 1');

    dispatchKey('ArrowRight');
    await flush();
    assert(String(els.currentQ.textContent) === '2', '导航到第 2 题');
    dispatchKey('2'); // 选 B → 错误
    await flush();
    assert(els.answerFeedback.innerHTML.includes('错误'), '答错反馈');
    assert(els.answerFeedback.innerHTML.includes('您的答案'), '错误时展示您的答案/正确答案');
    assert(String(els.incorrectCount.textContent) === '1', '错误计数 1');

    els.navSubmitBtn.click();
    await flush();
    assert(!els.resultSection.classList.contains('hidden'), '交卷后结果区显示');
    assert(String(els.resCorrect.textContent) === '1' && String(els.resIncorrect.textContent) === '1' && String(els.resUnanswered.textContent) === '0', '结果统计 1/1/0');
    els.reviewBtn.click();
    assert(els.wrongContainer.innerHTML.includes('错题回顾') && els.wrongContainer.innerHTML.includes('第二题'), '错题回顾列出错题');

    els.restartBtn.click();
    await flush();
    assert(!els.quizSection.classList.contains('hidden'), '重新开始后答题区显示');
    assert(els.resultSection.classList.contains('hidden'), '结果区已隐藏');
    assert(String(els.totalQ.textContent) === '2', '重新开始后总题数仍为 2');

    console.log('== 17. FSRS 模式：评分 → 交卷 → 重新开始（队列重建后题数更新） ==');
    els.fsrsEnabledToggle.checked = true;
    els.fsrsEnabledToggle.trigger('change');
    els.startQuizBtn.click();
    await flush();
    assert(!els.quizSection.classList.contains('hidden'), 'FSRS 模式开始答题');
    assert(String(els.totalQ.textContent) === '2', 'FSRS 首次队列 2 题（全部新卡）');
    dispatchKey('1'); // 作答
    await flush();
    assert(els.answerFeedback.innerHTML.includes('评分'), 'FSRS 作答后显示评分条');
    dispatchKey('3'); // 评 Good
    await flush();
    assert(els.answerFeedback.innerHTML.includes('下次复习'), '评分后显示下次复习时间');
    els.menuPanel.trigger('toggle'); // 菜单刷新 → 复习数据摘要
    assert(String(els.fsrsTotalCards.textContent) === '1', '已写入 1 张复习卡');
    els.navSubmitBtn.click();
    await flush();
    els.restartBtn.click();
    await flush();
    assert(String(els.totalQ.textContent) === '1', '重建队列后总题数更新为 1（仅剩新卡）');

    console.log(failed ? `\n${failed} 项失败` : '\n全部通过 ✓');
    process.exit(failed ? 1 : 0);
})();
