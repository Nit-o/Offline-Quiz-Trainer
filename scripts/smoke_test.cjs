/* DOM-stub smoke test for Offline-Quiz-Trainer index.html module script.
   Simulates: init → file import (parse+cache) → cached load → delete → export chooser
   (share/save chains) → stats 累计/近3次 toggle & reset → daily-new estimate → trend dialog. */
'use strict';
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
let src = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
/* index.html 里 FSRS_TS_VERSION 用 export 暴露（供 tsc 的 noUnusedLocals 与对拍脚本读取）；
   vm 沙箱按脚本（非模块）执行，需去掉 export 关键字 */
src = src.replace(/^export\s+(const\s+FSRS_TS_VERSION)/m, "$1");
/* 替换「Capacitor 原生桥」为可注入桩：
   - isNative() 恒为 true，但 Share/Filesystem/SaveFile 默认全空 → 走 Web 降级链；
   - CapacitorShareTarget 捕获回调，供「接收分享」测试触发；
   - ready 用可手动 resolve 的 deferred：验证主逻辑“先等桥就绪、再注册 shareReceived
     监听”的时序（回归：ready 曾恒为已 resolved，导致监听在桥加载完成前被跳过，
     接收分享在 APK 中永久失效）；
   - 测试可随时改写 sandbox.CapacitorBridge（分享/保存/接收均运行时读取该对象）。 */
src = src.replace(/\/\* ===== Capacitor 原生桥[\s\S]*?\/\* ===== Capacitor 原生桥 End ===== \*\//,
`globalThis.__bridgeReady = {};
globalThis.__bridgeReady.promise = new Promise(r => { globalThis.__bridgeReady.resolve = r; });
globalThis.CapacitorBridge = {
    isNative: () => true,
    Share: null, Filesystem: null, Directory: {}, Encoding: {}, SaveFile: null,
    CapacitorShareTarget: {
        _cb: null,
        addListener(ev, cb) { this._cb = cb; return Promise.resolve({ remove() {} }); },
    },
    ready: globalThis.__bridgeReady.promise,
};`);
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
const collections = { '.theme-option': [], '.mode-card': [], '.preset-row': [], '.swipe-indicator.left': [], '.swipe-indicator.right': [], '[data-import-panel]': [] };
const byId = [
    'menuPanel','fileInput','fileDropZone','fileList','fileStatus','bankCacheList','modeSection','startQuizBtn',
    'clipboardImportBtn','importFsrsDialog','importFsrsDialogClose','importFsrsDialogTitle','importFsrsDialogHint',
    'importFileBtn','importClipboardBtn','importBackupBtn',
    'clipboardImportText','clipboardImportConfirm','clipboardImportCancel',
    'shuffleOptionsToggle',
    'autoNextToggle','autoNextDelay','showHistoryToggle','hideMasteredToggle','autoRateToggle','fsrsEnabledToggle',
    'fsrsSubmenu','autoRatePresetSelect','autoRatePresetRow','autoRateCustomToggle','presetDialog','presetDialogClose',
    'presetResetBtn','presetSaveBtn','retentionInput','dailyNewInput','resetFsrsBtn','exportFsrsBtn','copyFsrsBtn',
    'importFsrsBtn','fsrsImportInput','fsrsTotalCards','fsrsDueToday','fsrsAvgStability','ovSessions','ovAnswered',
    'ovAccuracy','ovMastered','ovReps','ovLapses','ovAvgTime','trendChart','fc0','fc1','fc2','trendChartWide',
    'ovSessionsLabel','ovAnsweredLabel','ovAccuracyLabel','statsModeBtn','statsResetBtn','statsGrid','dailyNewEstimate',
    'fsrsHint','fsrsHintDetail','fsrsHintSummary','fsrsHintDetailText',
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
// 合并导入对话框的三个动作按钮：真实 DOM 里带 data-import-action 且是对话框子节点
// （桩不解析 HTML，故手动补 dataset 并把它们挂进对话框的 children——事件委托依赖冒泡路径）
els.importFileBtn.dataset.importAction = 'file';
els.importClipboardBtn.dataset.importAction = 'clipboard';
els.importBackupBtn.dataset.importAction = 'backup';
els.importFsrsDialog.append(els.importFileBtn, els.importClipboardBtn, els.importBackupBtn);
els.importFsrsDialog.append(els.clipboardImportConfirm, els.clipboardImportCancel, els.importFsrsDialogClose);
// 计时容器（真实 DOM 上的 data-timer-box）：TimerDisplay 把 .timer-paused 挂在其上
els.curTime._sel = 'curTime';
els.totalTime._sel = 'totalTime';

// 合并导入对话框的两个面板（data-import-panel）：合并入口 / 手动粘贴
collections['[data-import-panel]'] = ['merge', 'paste'].map(mode => {
    const p = new El('div');
    p.dataset.importPanel = mode;
    return p;
});
const importPanel = mode => collections['[data-import-panel]'].find(p => p.dataset.importPanel === mode);

const keyListeners = [];
const visibilityListeners = [];
const document = {
    getElementById: id => els[id] ?? null,
    querySelectorAll: sel => collections[sel] ?? [],
    querySelector: sel => (collections[sel] ?? [])[0] ?? null,
    createElement: tag => new El(tag),
    createDocumentFragment: () => new El(),
    execCommand: () => true,
    documentElement: new El('html'),
    visibilityState: 'visible',
    addEventListener(ev, cb) { if (ev === 'keydown') keyListeners.push(cb); else if (ev === 'visibilitychange') visibilityListeners.push(cb); },
    body: new El('body'),
};
const dispatchKey = key => { const e = { key, preventDefault() {}, shiftKey: false, target: document.body }; keyListeners.forEach(cb => cb(e)); };
/* 模拟前后台切换：document.visibilityState 变化 + visibilitychange 事件 */
/* 模拟前后台切换：document.visibilityState 变化 + visibilitychange 事件。
   计时模块读的是沙箱内的 document.visibilityState，必须同时更新它，否则事件触发了、
   状态却仍是 visible（#applyAppState 会误判为「回前台」）。 */
const setVisibility = state => {
    document.visibilityState = state;
    if (sandbox?.document) sandbox.document.visibilityState = state;
    visibilityListeners.forEach(cb => cb());
};
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
const shareBehavior = []; // 'ok' | 'fail' | 'abort'
/* VM 沙箱里的 navigator 是代理对象，直接改写 navigator.share 不会生效（沙箱读取仍走原对象），
   故行为强制项经变量下发：webShareMode = 'ok' | 'fail' | 'abort' 时忽略 shareBehavior 队列。 */
let webShareMode = null;
const navigator = {
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile',
    share: async data => {
        shareCalls.push({ ...data, _files: data.files?.length });
        const mode = webShareMode ?? shareBehavior.shift() ?? 'ok';
        if (mode === 'fail') throw new Error('NotAllowedError');
        if (mode === 'abort') { const e = new Error('AbortError'); e.name = 'AbortError'; throw e; }
    },
    canShare: () => false, // 模拟旧 WebView：canShare 存在但返回 false（修复前的行为）
    /* 剪贴板桩：writeText 记录内容；readText 由 readTextImpl 控制（默认拒绝，
       模拟 Android WebView 无读取权限 → 走手动粘贴对话框） */
    clipboard: {
        writeText: async text => { clipboardWrites.push(text); },
        readText: async () => readTextImpl(),
    },
};
/* 剪贴板读取实现可替换：返回字符串 = 成功；抛错/null = 不可用（转手动粘贴） */
const clipboardWrites = [];
let readTextImpl = async () => { throw new Error('NotAllowedError'); };

const matchMedia = () => ({ matches: false, addEventListener() {} });
const performance = { now: () => Date.now() };
/* 下载链路观测点：blob 下载兜底的 <a download="..."> 由 createElement('a') + click() 触发，
   直接记录 click 时读到的 download 属性，用于断言「文件分享失败 → JSON 下载」。 */
const downloadedFiles = [];
class AnchorEl extends El {
    click() { if (this.download) downloadedFiles.push({ download: this.download, href: this.href }); this.trigger('click', { target: this }); }
}
const sandbox = {
    document: { ...document, createElement: tag => (tag === 'a' ? new AnchorEl(tag) : new El(tag)) },
    localStorage, navigator, matchMedia, performance,
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    confirm: () => true,
    File: class { constructor(parts, name, opts) { this.name = name; this.type = opts?.type; this._parts = parts; } async text() { return this._parts.join(''); } },
    FileReader: class { readAsText() {} },
    Blob: class { constructor(parts, opts) { this._parts = parts; this.type = opts?.type; } },
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
    /* 接收分享（#onSharedContent）用：base64 → 二进制串 → TextDecoder 还原 UTF-8 */
    atob: b64 => Buffer.from(b64, 'base64').toString('latin1'),
    TextDecoder: class { decode(bytes) { return Buffer.from(bytes).toString('utf8'); } },
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
    /* 回归：ready 必须等桥加载完成后再注册 shareReceived 监听（曾因 ready 恒为已 resolved，
       监听在桥就绪前被 isNative()=false 跳过 → APK 接收分享失效） */
    assert(typeof sandbox.CapacitorBridge.CapacitorShareTarget._cb !== 'function', '桥未就绪时不注册 shareReceived 监听');
    sandbox.__bridgeReady.resolve(); /* 桥就绪 */
    await flush();
    assert(typeof sandbox.CapacitorBridge.CapacitorShareTarget._cb === 'function', '桥就绪后注册 shareReceived 监听');

    /* ---------- 原生调用专项回归（见「原生调用完成度专项评价」） ---------- */
    const flushRounds = async n => { for (let i = 0; i < n; i++) await flush(); };
    const installBridge = stub => Object.assign(sandbox.CapacitorBridge, {
        Share: null, Filesystem: null, SaveFile: null, App: null,
        Directory: {}, Encoding: {},
    }, stub);

    console.log('== 1.1 原生保存契约：{success:true} → 成功；{success:false,cancelled:true} → 静默不降级 ==');
    const saveCalls = [];
    let saveImpl = async () => ({ success: true });
    installBridge({ SaveFile: { saveFile: async opts => { saveCalls.push(opts); return saveImpl(opts); } } });
    els.exportFsrsBtn.trigger('click');
    els.backupSaveBtn.trigger('click');
    await flushRounds(2);
    assert(saveCalls.length === 1, '调起一次原生保存');
    assert(els.snackbar.textContent.includes('备份已保存到本地'), `{success:true} 成功提示: "${els.snackbar.textContent}"`);
    /* 回归：返回 {success:true}（非旧实现的 "ok" 字符串）必须判定为成功并 return，
       否则会继续走 ② File System Access / ③ <a download> 降级链（重复保存） */
    saveImpl = async () => ({ success: false, cancelled: true });
    const saveCountBefore = saveCalls.length;
    els.exportFsrsBtn.trigger('click');
    els.backupSaveBtn.trigger('click');
    await flushRounds(2);
    assert(saveCalls.length === saveCountBefore + 1, '取消路径仍调用原生保存');
    assert(!/失败|无法|超时/.test(els.snackbar.textContent), `用户取消保存不提示错误: "${els.snackbar.textContent}"`);
    /* 回归：旧实现用 "timeout" 字符串判定超时并提示「保存超时，请重试」。
       现已改为按返回结构判定，且不再有 15s 计时器 —— 取消后 15s 内不应出现超时提示。 */
    assert(!/保存超时/.test(els.snackbar.textContent), '取消后不出现「保存超时，请重试」假失败提示');

    console.log('== 1.2 分享导入：读取后清理缓存、超大文件拒收绕过 readFile ==');
    const shareCb = sandbox.CapacitorBridge.CapacitorShareTarget._cb;
    const mdOne = '## 一、单选题\n\n### 1. 分享题\nA. 甲\nB. 乙\n**答案： A**\n';
    const shareOps = [];
    let statImpl = async () => ({ size: 1024 });
    let readImpl = async () => ({ data: Buffer.from(mdOne, 'utf8').toString('base64') });
    installBridge({
        Filesystem: {
            stat: async opts => { shareOps.push(['stat', opts.path]); return statImpl(opts); },
            readFile: async opts => { shareOps.push(['read', opts.path]); return readImpl(opts); },
            deleteFile: async opts => { shareOps.push(['delete', opts.path]); },
        },
    });
    shareCb({ title: '', texts: [], files: [{ name: '来自分享.md', mimeType: 'text/markdown', uri: '/cache/shared_files/来自分享.md' }] });
    await flushRounds(3);
    assert(/成功加载 1 题/.test(els.fileStatus.innerText), `分享文件导入: "${els.fileStatus.innerText}"`);
    /* 回归：插件每次都把分享文件复制到 cacheDir/shared_files（同名静默覆盖），
       不删除会让缓存只增不减 */
    assert(
        shareOps.some(o => o[0] === 'read') && shareOps.some(o => o[0] === 'delete' && o[1] === '/cache/shared_files/来自分享.md'),
        '读取后删除插件复制的缓存副本（shareOps: ' + JSON.stringify(shareOps) + '）'
    );
    /* 回归：大文件必须在 stat 阶段拒绝，绝不进入 readFile（base64 解码会同时持有三份副本） */
    shareOps.length = 0;
    statImpl = async () => ({ size: 5 * 1024 * 1024 });
    shareCb({ title: '', texts: [], files: [{ name: '超大题库.md', mimeType: 'text/markdown', uri: '/cache/shared_files/超大题库.md' }] });
    await flushRounds(3);
    assert(!shareOps.some(o => o[0] === 'read'), '超大文件不进入 readFile（避免 OOM）');
    assert(/过大/.test(els.snackbar.textContent), `超大文件给出明确提示: "${els.snackbar.textContent}"`);
    assert(shareOps.some(o => o[0] === 'delete'), '被拒收的文件同样清理缓存副本');
    /* 回归：读取失败也要清理（否则损坏/无权限文件会在缓存里永久堆积） */
    shareOps.length = 0;
    statImpl = async () => ({ size: 1024 });
    readImpl = async () => { throw new Error('denied'); };
    shareCb({ title: '', texts: [], files: [{ name: '读不了.md', mimeType: 'text/markdown', uri: '/cache/shared_files/读不了.md' }] });
    await flushRounds(3);
    assert(shareOps.some(o => o[0] === 'delete' && o[1] === '/cache/shared_files/读不了.md'), '读取失败也清理缓存副本');

    console.log('== 1.3 前后台切换：Timer.pause/resume 用时口径 ==');
    /* 独立构造 Timer（纯逻辑，无 DOM）。注入的 performance/rAF 必须以形参形式在类作用域内
       遮蔽全局：只写 new Function('performance', …) 却不引用该形参时不会遮蔽，
       模块内 performance.now() 仍走真实时钟（这会让假时钟断言失真）。 */
    const timerSrc = html.slice(html.indexOf('class Timer {'), html.indexOf('/* ===== Storage'))
        .replace(/\bperformance\.now\(\)/g, '__perf.now()')
        .replace(/\brequestAnimationFrame\(/g, '__raf(')
        .replace(/\bcancelAnimationFrame\(/g, '__caf(');
    let fakeNow = 1000;
    const Timer = new Function('__perf', '__raf', '__caf', `${timerSrc}\nreturn Timer;`)(
        { now: () => fakeNow }, () => 1, () => {});
    const t = new Timer({ emit() {} });
    /* 时间线必须单调递增（performance.now() 语义）：假时钟若回退，断言本身就无意义 */
    t.start();                            /* t=1_000 */
    fakeNow = 6_000;                      /* 前台已答 5s */
    t.pause();                            /* 切后台 */
    fakeNow = 60_000;                     /* 后台停留 54s */
    assert(t.getTotalTime() === 5_000, `暂停期间不计入总用时: ${t.getTotalTime()}ms（期望 5000）`);
    assert(t.getQuestionTime(0) === 5_000, `暂停期间单题用时冻结: ${t.getQuestionTime(0)}ms（期望 5000）`);
    t.resume();                           /* 回前台 */
    assert(t.getTotalTime() === 5_000, `恢复瞬间总用时仍为 5000ms: ${t.getTotalTime()}ms`);
    fakeNow = 61_000;                     /* 前台再走 1s */
    assert(t.getTotalTime() === 6_000, `恢复后继续累计: ${t.getTotalTime()}ms（期望 6000）`);
    assert(t.getQuestionTime(0) === 6_000, `单题用时同样排除暂停: ${t.getQuestionTime(0)}ms`);
    t.stop();
    assert(t.getTotalTime() === 6_000, `stop() 后仍为前台累计: ${t.getTotalTime()}ms（期望 6000）`);
    /* 复位：本节把 1 题小样本写进了题库缓存，后面各节都假设缓存为空/单条，
       故清掉本节产生的缓存与桥桩（Section 2 会重新导入 1143 题主题库）。
       只重建列表 DOM，不触发文件导入，避免干扰 fileStatus/fileInput 的既有断言。 */
    [...store.keys()].filter(k => k.startsWith('quiz_bank_')).forEach(k => store.delete(k));
    sandbox.CapacitorBridge.Filesystem = null;
    sandbox.CapacitorBridge.Share = null;
    sandbox.CapacitorBridge.SaveFile = null;
    {
        const empty = new El('p');
        empty.className = 'bank-cache-empty';
        els.bankCacheList.replaceChildren(empty);
    }

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

    console.log('== 7. 分享降级链：文件分享失败 → JSON 下载/复制（绝不分享纯文本）==');
    shareBehavior.push('fail');
    const downloadsBefore = downloadedFiles.length;
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(shareCalls.length === 2 && shareCalls[1]._files === 1, '第二次导出先尝试文件分享');
    assert(!shareCalls.some(c => !c._files && c.text), '任何一次分享都不以纯文本作为分享内容');
    assert(downloadedFiles.length === downloadsBefore + 1 && /^fsrs-backup-\d{4}-\d{2}-\d{2}\.json$/.test(downloadedFiles.at(-1).download), `文件分享失败 → 降级 .json 下载: ${JSON.stringify(downloadedFiles.at(-1))}`);
    assert(!/无法直接保存|无法自动复制/.test(els.snackbar.textContent), `降级导出不误报错误: "${els.snackbar.textContent}"`);

    console.log('== 8. 剪贴板兜底：只复制 JSON 文本（提示另存为 .json）==');
    clipboardWrites.length = 0;
    els.copyFsrsBtn.trigger('click');
    await flush();
    assert(clipboardWrites.length === 1 && clipboardWrites[0].includes('"kind": "fsrs-cards"'), '复制备份写入的是完整 JSON 文本');
    assert(els.snackbar.textContent.includes('请粘贴保存为 .json'), `复制兜底提示另存为 .json: "${els.snackbar.textContent}"`);
    readTextImpl = async () => clipboardWrites[0];

    console.log('== 9. 用户取消分享不降级（文本分享路径已删除）==');
    shareBehavior.push('abort');
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(els.snackbar.textContent.includes('备份已通过系统分享导出'), 'AbortError 视为完成，不降级');
    readTextImpl = async () => { throw new Error('NotAllowedError'); }; /* 复位：默认无剪贴板读取权限 */

    console.log('== 10. 保存到本地（无 File System Access 时降级并提示）==');
    els.exportFsrsBtn.trigger('click');
    els.backupSaveBtn.trigger('click');
    await flush();
    assert(els.snackbar.textContent.includes('无法直接保存'), `Android WebView 保存提示: "${els.snackbar.textContent}"`);
    assert(!els.backupDialog.open, '保存后对话框已关闭');

    console.log('== 10.5 Capacitor 原生分享/保存（优先于 navigator.share）==');
    const nativeCalls = [];
    const bridge = sandbox.CapacitorBridge;
    bridge.Directory = { Cache: 'CACHE' };
    bridge.Encoding = { UTF8: 'utf8' };
    bridge.Share = {
        /* 先记录调用再按需抛错：否则「文件分享失败」路径不会在 nativeCalls 留下痕迹，
           无法断言“失败后没有文本分享” */
        share: async opts => { nativeCalls.push(['share', opts.files ? 'file' : 'text']); },
    };    bridge.Filesystem = {
        writeFile: async opts => { nativeCalls.push(['writeFile', opts.path, opts.directory === bridge.Directory.Cache, opts.encoding === bridge.Encoding.UTF8]); return {}; },
        getUri: async opts => ({ uri: `file:///cache/${opts.path}` }),
    };
    bridge.SaveFile = {
        saveFile: async opts => { nativeCalls.push(['saveFile', opts.fileName, typeof opts.content]); },
    };
    const shareCallsBefore = shareCalls.length;
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(nativeCalls[0]?.[0] === 'writeFile' && nativeCalls[0][2] === true && nativeCalls[0][3] === true, '原生优先：备份写入缓存目录（Cache + UTF8）');
    assert(nativeCalls[1]?.[0] === 'share' && nativeCalls[1][1] === 'file', '原生优先：分享 .json 文件（FileProvider）');
    assert(els.snackbar.textContent.includes('备份已通过系统分享导出'), `原生分享成功提示: "${els.snackbar.textContent}"`);
    assert(shareCalls.length === shareCallsBefore, '原生路径不调用 navigator.share');
    // 原生文件分享失败 → 不再降级文本分享，改为 JSON 下载/复制兜底
    bridge.Share.share = async opts => { nativeCalls.push(['share', opts.files ? 'file' : 'text']); if (opts.files) throw new Error('boom'); };
    webShareMode = 'fail'; /* ② Web Share 同样不可用（沙箱 navigator 是代理，行为经变量下发） */
    const downloadsBeforeNative = downloadedFiles.length;
    const nativeCallsBeforeFallback = nativeCalls.length;
    const shareCallsBeforeFallback = shareCalls.length;
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    webShareMode = null;
    const fallbackCalls = nativeCalls.slice(nativeCallsBeforeFallback);
    assert(
        fallbackCalls.length === 2 && fallbackCalls[0][0] === 'writeFile' &&
        fallbackCalls[1][0] === 'share' && fallbackCalls[1][1] === 'file' &&
        !fallbackCalls.some(c => c[1] === 'text'),
        `文件分享失败后写缓存并只重试 .json 文件，无文本分享: ${JSON.stringify(fallbackCalls)}`
    );
    assert(downloadedFiles.length === downloadsBeforeNative + 1 && /\.json$/.test(downloadedFiles.at(-1).download), `文件分享失败 → 降级 .json 下载: ${JSON.stringify(downloadedFiles.at(-1))}`);
    assert(shareCalls.length === shareCallsBeforeFallback + 1 && shareCalls.at(-1)._files === 1 && !shareCalls.at(-1).text, '降级只尝试一次文件分享，未把纯文本交给分享面板');
    // 原生分享被用户取消 → 视为完成，不降级不报错
    bridge.Share.share = async () => { throw new Error('Share canceled'); };
    els.exportFsrsBtn.trigger('click');
    els.backupShareBtn.trigger('click');
    await flush();
    assert(els.snackbar.textContent.includes('备份已通过系统分享导出'), '用户取消分享视为完成，不降级');
    // 原生保存优先于 Web 降级
    bridge.Share.share = async opts => { nativeCalls.push(['share', opts.files ? 'file' : 'text']); };
    els.exportFsrsBtn.trigger('click');
    els.backupSaveBtn.trigger('click');
    await flush();
    assert(nativeCalls.at(-1)?.[0] === 'saveFile' && nativeCalls.at(-1)[2] === 'string', '原生保存到本地优先');
    assert(els.snackbar.textContent.includes('备份已保存到本地'), `原生保存成功提示: "${els.snackbar.textContent}"`);
    // 原生保存取消 → 静默
    bridge.SaveFile.saveFile = async () => { throw new Error('cancelled'); };
    els.exportFsrsBtn.trigger('click');
    els.backupSaveBtn.trigger('click');
    await flush();
    assert(!/失败|无法/.test(els.snackbar.textContent), '用户取消保存不提示错误');

    console.log('== 10.6 接收分享（share-target）：外部 .md 文件 / 文本自动导入 ==');
    const shareTarget = bridge.CapacitorShareTarget;
    assert(typeof shareTarget._cb === 'function', 'share-target 监听已在初始化时注册');
    bridge.Filesystem = {
        readFile: async opts => {
            nativeCalls.push(['readFile', opts.path]);
            const mdText = '## 一、单选题\n\n### 1. 来自分享的题\nA. 甲\nB. 乙\n**答案： A**\n';
            return { data: Buffer.from(mdText, 'utf8').toString('base64') };
        },
    };
    shareTarget._cb({ title: '测试', texts: [], files: [{ name: '来自分享.md', mimeType: 'text/markdown', uri: '/data/user/0/com.quiztrainer.app/cache/shared_files/来自分享.md' }] });
    await flush();
    assert(/成功加载 1 题/.test(els.fileStatus.innerText), `分享 .md 文件自动导入: "${els.fileStatus.innerText}"`);
    // 纯文本分享
    shareTarget._cb({ title: '', texts: ['## 一、单选题\n\n### 1. 文本分享题\nA. 甲\nB. 乙\n**答案： A**\n'], files: [] });
    await flush();
    assert(/成功加载 1 题/.test(els.fileStatus.innerText), '分享文本自动导入');
    // 非文本内容 → 明确提示
    bridge.Filesystem.readFile = async () => { throw new Error('denied'); };
    shareTarget._cb({ title: '', texts: [], files: [{ name: '图.png', mimeType: 'image/png', uri: '/x.png' }] });
    await flush();
    assert(els.snackbar.textContent.includes('不是可导入的题库'), `非文本分享给出提示: "${els.snackbar.textContent}"`);
    // 复位桥桩，避免影响后续用例
    bridge.Share = null; bridge.Filesystem = null; bridge.SaveFile = null; bridge.Directory = {}; bridge.Encoding = {};

    console.log('== 10.7 从剪贴板导入：一键读取（Markdown / FSRS JSON）/ 无权限 → 手动粘贴 ==');
    const clipMd = '## 一、单选题\n\n### 1. 剪贴板题\nA. 甲\nB. 乙\n**答案： A**\n';
    /* ① 读取被拒 → 同一个对话框切到「手动粘贴」面板（Android WebView 无 readText 权限） */
    readTextImpl = async () => { throw new Error('NotAllowedError'); };
    els.clipboardImportBtn.trigger('click');
    await flush();
    assert(els.importFsrsDialog.open, '「从剪贴板导入」打开统一导入对话框');
    assert(importPanel('merge').hidden && !importPanel('paste').hidden, '读取被拒 → 切到手动粘贴面板');
    assert(els.importFsrsDialogTitle.textContent === '手动粘贴导入', `面板标题已切换: "${els.importFsrsDialogTitle.textContent}"`);
    /* ② 弹窗里粘贴 Markdown → 走 #load（解析 → 缓存 → 应用） */
    els.clipboardImportText.value = clipMd;
    els.clipboardImportConfirm.trigger('click');
    await flush();
    assert(!els.importFsrsDialog.open, '导入后关闭粘贴对话框');
    assert(/成功加载 1 题/.test(els.fileStatus.innerText), `手动粘贴 Markdown 导入: "${els.fileStatus.innerText}"`);
    /* ③ 弹窗里空内容 → 明确提示，不误报“无有效题目”，且对话框保持打开 */
    els.clipboardImportBtn.trigger('click');
    await flush();
    els.clipboardImportText.value = '   \n  ';
    els.clipboardImportConfirm.trigger('click');
    await flush();
    assert(els.importFsrsDialog.open && /请先粘贴/.test(els.snackbar.textContent), `空粘贴给出提示: "${els.snackbar.textContent}"`);
    els.clipboardImportCancel.trigger('click');
    assert(!els.importFsrsDialog.open, '取消关闭粘贴对话框');
    /* ④ 剪贴板可直接读取：Markdown 一键导入（不弹粘贴面板） */
    readTextImpl = async () => clipMd;
    els.clipboardImportBtn.trigger('click');
    await flush();
    assert(!els.importFsrsDialog.open, '可读取剪贴板时不留对话框');
    assert(/成功加载 1 题/.test(els.fileStatus.innerText), `剪贴板 Markdown 一键导入: "${els.fileStatus.innerText}"`);
    /* ⑤ 合并入口：开启随机选项排列时的入口也不影响路由；三个动作分别触发对应管线 */
    els.importFsrsBtn.trigger('click');
    await flush();
    assert(els.importFsrsDialog.open && !importPanel('merge').hidden, '「导入备份」打开同一个合并入口面板');
    let fileInputClicks = 0, backupInputClicks = 0;
    /* 只计数不转发：模块调用 input.click() 后若再走一次桩自身的 click 会重复计数 */
    els.fileInput.click = () => { fileInputClicks++; };
    els.fsrsImportInput.click = () => { backupInputClicks++; };
    els.importFileBtn.trigger('click', { target: els.importFileBtn });
    assert(fileInputClicks === 1 && !els.importFsrsDialog.open, '「选择题库文件」关闭对话框并调起题库文件选择器');
    els.importFsrsBtn.trigger('click');
    await flush();
    els.importBackupBtn.trigger('click', { target: els.importBackupBtn });
    assert(backupInputClicks === 1 && fileInputClicks === 1, `「导入 FSRS 备份」调起备份文件选择器（复用同一对话框）: file=${fileInputClicks} backup=${backupInputClicks}`);
    /* ⑥ 合并入口里的「从剪贴板导入」：读取成功 → 关闭对话框并导入 */
    readTextImpl = async () => clipMd;
    els.importFsrsBtn.trigger('click');
    await flush();
    els.importClipboardBtn.trigger('click', { target: els.importClipboardBtn });
    await flush();
    assert(/成功加载 1 题/.test(els.fileStatus.innerText), `合并入口的剪贴板导入: "${els.fileStatus.innerText}"`);
    assert(!els.importFsrsDialog.open, '剪贴板读取成功后关闭对话框');
    /* ⑦ 剪贴板为 FSRS 备份 JSON → 走 #importFsrsFromText（含无效卡片跳过与计数） */
    const card = { due: Date.now() + 86400000, stability: 2.5, difficulty: 5, state: 2, reps: 1, lapses: 0, last_review: null };
    const backup = JSON.stringify({ app: 'Offline-Quiz-Trainer', kind: 'fsrs-cards', version: 1, cards: { '剪贴板题': card, '坏卡': { due: 'nope' } } });
    readTextImpl = async () => backup;
    els.clipboardImportBtn.trigger('click');
    await flush();
    assert(/已导入 1 张卡，跳过 1 条无效数据/.test(els.snackbar.textContent), `剪贴板 FSRS 备份路由正确: "${els.snackbar.textContent}"`);
    assert(JSON.parse(store.get('fsrs_cards_v1'))['剪贴板题']?.stability === 2.5, 'FSRS 备份已覆盖写入（无效卡被跳过）');
    /* ⑧ 以 { 开头但 JSON 无效 → 明确提示（不静默按 Markdown 处理） */
    readTextImpl = async () => '{"kind":"fsrs-cards", bad json';
    els.clipboardImportBtn.trigger('click');
    await flush();
    assert(/JSON 格式无效/.test(els.snackbar.textContent), `无效 JSON 明确提示: "${els.snackbar.textContent}"`);
    /* ⑨ 合法 JSON 但不是备份（无 cards）→ 明确提示，不落进 Markdown 解析 */
    readTextImpl = async () => '{"foo":"bar","n":1}';
    els.clipboardImportBtn.trigger('click');
    await flush();
    assert(/未找到有效的卡片表/.test(els.snackbar.textContent), `非备份 JSON 明确提示: "${els.snackbar.textContent}"`);
    readTextImpl = async () => { throw new Error('NotAllowedError'); }; /* 复位 */
    /* 恢复主题库（10.6/10.7 导入的是 1 题小样本，后续用例按 1143 题主题库假设） */
    els.fileInput.files = [{ name: 'B类题库_origin.md', text: async () => md }];
    els.fileInput.trigger('change');
    await flush();
    assert(/成功加载 1143 题/.test(els.fileStatus.innerText), '恢复 1143 题主题库');

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

    console.log('== 15. 随机选项排列：顺序稳定（多次 render 不跳位）、开关恢复、答案仍判对 ==');
    /* 反馈面板同样是 innerHTML 字符串：按 data-rating 解析四档按钮及其高亮状态 */
    const ratingButtons = () => [...els.answerFeedback.innerHTML.matchAll(/<button[^>]*data-rating="(\d)"[^>]*>/g)]
        .map(m => ({ rating: +m[1], accent: m[0].includes('btn-accent'), pressed: m[0].includes('aria-pressed="true"'), el: els.answerFeedback }));
    const renderedOptions = () => [...(els.questionContainer.innerHTML.matchAll(/<button[^>]*class="option[^"]*"[^>]*data-key="([A-E])"[^>]*>(?:<span>)?([^<]*)/g))]
        .map(m => ({ key: m[1], text: m[2] }));
    els.fileInput.files = [{ name: 'shuffle.md', text: async () => [
        '## 一、单选题',
        '',
        '### 1. 选项顺序题',   /* 稳定洗牌对该题干为反序：[B, A] */
        'A. 甲',
        'B. 乙',
        '**答案： A**',
    ].join('\n') }];
    els.fileInput.trigger('change');
    await flush();
    assert(els.shuffleOptionsToggle.checked === false, '默认关闭随机选项排列');
    els.startQuizBtn.click();
    await flush();
    assert(JSON.stringify(renderedOptions()) === JSON.stringify([{ key: 'A', text: 'A. 甲' }, { key: 'B', text: 'B. 乙' }]), `关闭时保持原始顺序: ${JSON.stringify(renderedOptions())}`);
    dispatchKey('1');
    await flush();
    assert(String(els.correctCount.textContent) === '1', '原始顺序下按 1 → A 判对');
    els.navSubmitBtn.click();
    await flush();
    /* 开启随机排列：当前题立即按稳定顺序重排（该题为反序 → B 在前） */
    els.shuffleOptionsToggle.checked = true;
    els.shuffleOptionsToggle.trigger('change');
    await flush();
    assert(/已开启随机选项排列/.test(els.snackbar.textContent), `开启提示: "${els.snackbar.textContent}"`);
    const shuffled1 = renderedOptions();
    assert(JSON.stringify(shuffled1) === JSON.stringify([{ key: 'B', text: 'B. 乙' }, { key: 'A', text: 'A. 甲' }]), `开启后按稳定顺序重排（B 在前）: ${JSON.stringify(shuffled1)}`);
    /* 稳定性：反馈/评分/重渲染都不会再次重排 */
    dispatchKey('1'); // 仍按原始字母 A 选择 → 判对
    await flush();
    assert(String(els.correctCount.textContent) === '1', '随机顺序下按 1 仍对应 A，答案判定正确');
    els.restartBtn.click();
    await flush();
    els.menuPanel.trigger('toggle');
    els.menuPanel.trigger('toggle');
    assert(JSON.stringify(renderedOptions()) === JSON.stringify(shuffled1), `重新开始后同一题顺序不变: ${JSON.stringify(renderedOptions())}`);
    /* 关闭后恢复原始顺序 */
    els.shuffleOptionsToggle.checked = false;
    els.shuffleOptionsToggle.trigger('change');
    await flush();
    assert(JSON.stringify(renderedOptions()) === JSON.stringify([{ key: 'A', text: 'A. 甲' }, { key: 'B', text: 'B. 乙' }]), `关闭后恢复原始顺序: ${JSON.stringify(renderedOptions())}`);
    /* 洗牌函数本身的确定性（直接取 index.html 的实现，按大括号配平截取完整箭头函数体） */
    const srcOf = marker => {
        const s = html.indexOf(marker);
        const open = html.indexOf('{', s);
        let depth = 0;
        for (let i = open; i < html.length; i++) {
            if (html[i] === '{') depth++;
            else if (html[i] === '}' && --depth === 0) return html.slice(s, i + 1);
        }
        throw new Error('未找到函数体: ' + marker);
    };
    const orderFactory = new Function(`${srcOf('const hashSeed')};\n${srcOf('const shuffledOrder')};\nreturn { hashSeed, shuffledOrder };`);
    const { hashSeed, shuffledOrder } = orderFactory();
    assert(JSON.stringify(shuffledOrder(5, hashSeed('题目甲'))) === JSON.stringify(shuffledOrder(5, hashSeed('题目甲'))), '同一题干两次洗牌结果一致（稳定）');
    assert(JSON.stringify([...shuffledOrder(6, hashSeed('题目甲'))].sort()) === JSON.stringify([0, 1, 2, 3, 4, 5]), '洗牌结果是 0..n-1 的排列（不丢不重）');

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

    console.log('== 18. FSRS 评分后可改评价（重评从原始卡快照重算，间隔不滚雪球） ==');
    /* 预置一张到期卡：让本题走「已有记录」路径，避免新卡基线恰好也等于空卡而掩盖快照错误。
       必须经 FsrsStore.save 写入：FsrsStore 有内存缓存，直接写 localStorage 不会被读到。
       期望值同样由 index.html 里的 FsrsEngine 现算（elapsed_days 由卡片字段决定，写死数字会失真）。 */
    const fsimSrc = html.slice(html.indexOf('const FSRS_STATE'), html.indexOf('/* ===== FsrsStore'));
    const FsrsEngine = new Function(`${fsimSrc}\nreturn FsrsEngine;`)();
    const simEngine = new FsrsEngine();
    const cardShape = next => ({
        due: next.due instanceof Date ? next.due.getTime() : next.due,
        stability: next.stability, difficulty: next.difficulty,
        scheduled_days: next.scheduled_days, elapsed_days: next.elapsed_days,
        reps: next.reps, lapses: next.lapses, learning_steps: next.learning_steps,
        state: next.state,
        last_review: next.last_review ? (next.last_review instanceof Date ? next.last_review.getTime() : next.last_review) : null,
    });
    const baseCard = { due: Date.now() - 1000, stability: 5, difficulty: 5, scheduled_days: 5, elapsed_days: 5, reps: 3, lapses: 0, learning_steps: 0, state: 2, last_review: Date.now() - 5 * 86400000 };
    sandbox.FsrsStore.save({ '重评题': baseCard });
    assert(JSON.parse(store.get('fsrs_cards_v1'))['重评题'].stability === 5, '预置到期卡已落盘');
    els.fileInput.files = [{ name: 'relevel.md', text: async () => [
        '## 一、单选题',
        '',
        '### 1. 重评题',
        'A. 甲',
        'B. 乙',
        '**答案： A**',
        '**解析：** 重评解析。',
    ].join('\n') }];
    els.fileInput.trigger('change');
    await flush();
    els.startQuizBtn.click();
    await flush();
    assert(String(els.totalQ.textContent) === '1', '到期卡进入复习队列');
    dispatchKey('1');
    await flush();
    assert(els.answerFeedback.innerHTML.includes('评分'), '作答后显示评分条');
    dispatchKey('3'); /* Good */
    await flush();
    const cardAfter3 = JSON.parse(store.get('fsrs_cards_v1'))['重评题'];
    const expect3 = cardShape(simEngine.next(baseCard, new Date(cardAfter3.last_review), 3));
    assert(cardAfter3.reps === 4 && cardAfter3.stability === expect3.stability, `首次评分 Good 基于原始卡（reps 3→4, stability ${baseCard.stability}→${expect3.stability}）: ${JSON.stringify(cardAfter3)}`);
    assert(Math.abs(cardAfter3.due - expect3.due) <= 2 && cardAfter3.scheduled_days === expect3.scheduled_days, `首次评分与 engine.next(原始卡, now, Good) 完全一致（due/scheduled_days 同步）`);
    assert(els.answerFeedback.innerHTML.includes('rating-bar--relevel'), '已评分后显示可改评价的评分条');
    const ratingBtns = ratingButtons();
    assert(ratingBtns.length === 4, `重评条含四档按钮: ${ratingBtns.length}`);
    assert(ratingBtns[2].accent && ratingBtns[2].pressed, '当前档（良好）高亮且 aria-pressed=true');
    assert(!ratingBtns[0].accent, '非当前档不高亮');
    assert(els.answerFeedback.innerHTML.includes('修改将重新计算下次复习'), '提示重评会重新计算');
    /* 键盘改评价：1 = 忘记了 */
    dispatchKey('1');
    await flush();
    const cardAfter1 = JSON.parse(store.get('fsrs_cards_v1'))['重评题'];
    const expect1 = cardShape(simEngine.next(baseCard, new Date(cardAfter1.last_review), 1));
    assert(cardAfter1.stability === expect1.stability && cardAfter1.reps === 4, `改评价为「忘记了」仍从原始卡重算（stability ${expect3.stability}→${expect1.stability}，reps 仍为 4）: ${JSON.stringify(cardAfter1)}`);
    assert(cardAfter1.due === expect1.due && cardAfter1.due < cardAfter3.due, '改评价后下次复习时间随之重算（更早）');    assert(/已改为/.test(els.snackbar.textContent), `改评价提示: "${els.snackbar.textContent}"`);
    assert(ratingButtons()[0].accent, '改评价后高亮切到新档位（忘记了）');
    /* 改评价为「简单」：桩不解析 innerHTML（无真实 DOM 按钮），故走与按钮相同的 emit 通道
       （dispatchKey('4') → #rateCard(4)）；真实点击路径已由 15 节的 .rating-btn 委托点击覆盖。 */
    dispatchKey('4');
    await flush();
    const cardAfter4 = JSON.parse(store.get('fsrs_cards_v1'))['重评题'];
    const expect4 = cardShape(simEngine.next(baseCard, new Date(cardAfter4.last_review), 4));
    assert(cardAfter4.stability === expect4.stability && cardAfter4.reps === 4, `改评价为「简单」同样从原始卡重算: ${JSON.stringify(cardAfter4)}`);
    /* 刷新后的「下次复习/用时」面板：档位文案与 due 一致（QuizState 的 rating/nextDue 私有，
       这里用渲染结果验证它确实被同步刷新） */
    assert(els.answerFeedback.innerHTML.includes('已评分「简单」'), `面板显示当前评分: ${els.answerFeedback.innerHTML.slice(0, 200)}`);
    const daysText = cardAfter4.scheduled_days <= 0 ? '今天' : cardAfter4.scheduled_days === 1 ? '明天' : `${cardAfter4.scheduled_days} 天后`;
    assert(els.answerFeedback.innerHTML.includes(`下次复习：${daysText}`), `面板显示与重算结果一致的下次复习时间（${daysText}）`);
    assert(/用时/.test(els.answerFeedback.innerHTML), '面板显示本题用时');
    /* 点当前档不重算：再评 4 不应改变任何字段 */
    const snapshot4 = store.get('fsrs_cards_v1');
    dispatchKey('4');
    await flush();
    assert(store.get('fsrs_cards_v1') === snapshot4, '重复选择当前档不重算（卡数据不变）');
    /* 连续重评不会滚雪球：始终等价于 engine.next(原始卡, now, rating) */
    dispatchKey('3');
    await flush();
    const cardBack3 = JSON.parse(store.get('fsrs_cards_v1'))['重评题'];
    /* due 必须按各自评分时刻重算（两次调用相隔数 ms，绝对时刻必然不同），
       因此断言 scheduled_days/stability 一致 —— 这才是「无滚雪球」的可比证据 */
    assert(cardBack3.stability === cardAfter3.stability && cardBack3.scheduled_days === cardAfter3.scheduled_days, `反复重评回到 Good 与首次一致（无滚雪球）: ${cardBack3.stability}/${cardBack3.scheduled_days}天 vs ${cardAfter3.stability}/${cardAfter3.scheduled_days}天`);
    assert(cardBack3.last_review >= baseCard.last_review, 'reps 与 last_review 由原始卡 + 当前时刻决定');
    /* 答对可改评价；答错同理，且判定仍以原始答案为准 */
    assert(els.answerFeedback.innerHTML.includes('正确'), '改评价不影响对错判定');

    console.log('== 19. Timer 自动暂停：答题后停表 / 切题恢复 / 后台不累计 / 重复事件幂等 ==');
    /* 假时钟：Timer 通过全局 performance.now() 取时，替换沙箱里的 performance 即可精确驱动 */
    let fakeMs = 1000000;
    sandbox.performance = { now: () => fakeMs };
    store.set('fsrs_cards_v1', JSON.stringify({})); /* 清空复习卡：让两道题都作为新卡入队 */
    sandbox.FsrsStore.save({});
    els.fsrsEnabledToggle.checked = false;
    els.fsrsEnabledToggle.trigger('change');
    els.autoNextToggle.checked = false;
    els.autoNextToggle.trigger('change');
    setVisibility('visible');
    els.fileInput.files = [{ name: 'timing.md', text: async () => [
        '## 一、单选题',
        '',
        '### 1. 计时题一',
        'A. 甲',
        'B. 乙',
        '**答案： A**',
        '',
        '### 2. 计时题二',
        'A. 甲',
        'B. 乙',
        '**答案： A**',
    ].join('\n') }];
    els.fileInput.trigger('change');
    await flush();
    els.startQuizBtn.click();
    await flush();
    fakeMs += 5000;
    dispatchKey('1'); /* 答对 → 立即停表 */
    await flush();
    assert(els.curTime.textContent === '00:05' && els.totalTime.textContent === '00:05', `作答后停表（本题/总用时均为 5s）: ${els.curTime.textContent}/${els.totalTime.textContent}`);
    assert(els.totalTime.classList.contains('timer-paused'), '暂停态对用户可见（弱化样式）');
    fakeMs += 50000; /* 解读解析 50s：不应计入 */
    assert(els.totalTime.textContent === '00:05' && els.curTime.textContent === '00:05', `答题后停留不计时: ${els.curTime.textContent}/${els.totalTime.textContent}`);
    /* 当前题已完成：切后台/回前台的 visible 不应把表重新拉起来 */
    setVisibility('hidden');
    fakeMs += 60000;
    setVisibility('hidden'); /* 重复 hidden：幂等，不重复结算 */
    assert(els.totalTime.textContent === '00:05', `已完成题回前台不自动续跑（重复 hidden 也安全）: ${els.totalTime.textContent}`);
    setVisibility('visible');
    assert(els.totalTime.classList.contains('timer-paused') && els.totalTime.textContent === '00:05', `当前题已完成时 visible 不恢复计时: ${els.totalTime.textContent}`);
    dispatchKey('ArrowRight'); /* 切到未作答的第 2 题 → 恢复计时 */
    await flush();
    assert(!els.totalTime.classList.contains('timer-paused'), '切到未答题后恢复计时（暂停样式移除）');
    fakeMs += 4000;
    dispatchKey('1');
    await flush();
    assert(els.curTime.textContent === '00:04', `第 2 题用时从切题时刻重新起算: ${els.curTime.textContent}`);
    assert(els.totalTime.textContent === '00:09', `总用时 = 5s + 4s（不含答题后的 110s）: ${els.totalTime.textContent}`);
    /* 当前题已完成：切回第 1 题保持暂停，单题显示冻结在原值 */
    dispatchKey('ArrowLeft');
    await flush();
    assert(els.totalTime.classList.contains('timer-paused'), '切回已作答的题保持暂停（不累计犹豫时间）');
    assert(els.curTime.textContent === '00:05', `已完成题的单题用时冻结在 5s: ${els.curTime.textContent}`);
    setVisibility('visible');
    els.restartBtn.click();
    await flush();
    fakeMs += 5000;
    dispatchKey('1');           /* 第 1 题答对 → 停表 */
    await flush();
    dispatchKey('ArrowRight');  /* 切到未作答的第 2 题 → 恢复计时 */
    await flush();
    assert(!els.totalTime.classList.contains('timer-paused'), '切到未作答的第 2 题再次恢复计时');
    fakeMs += 3000;
    setVisibility('hidden');
    const hideDisplay = els.totalTime.textContent;
    fakeMs += 300000; /* 后台 5 分钟 */
    setVisibility('hidden'); /* 重复 hidden：幂等 */
    assert(els.totalTime.textContent === hideDisplay, `后台期间界面停在停表值（重复 hidden 也不推进）: ${els.totalTime.textContent}`);
    setVisibility('visible');
    assert(!els.totalTime.classList.contains('timer-paused'), '回前台恢复计时');
    dispatchKey('ArrowLeft');   /* 切回第 1 题：暂停态切题会 emit 一次 tick，把真实累计值刷到界面 */
    await flush();
    assert(els.totalTime.classList.contains('timer-paused'), '切回已答完的第 1 题保持暂停');
    assert(els.totalTime.textContent === '00:08', `暂停时长不计入（累计 5s + 3s = 8s，不含后台 5 分钟）: ${els.totalTime.textContent}`);
    assert(els.curTime.textContent === '00:05', `已完成题单题用时冻结在 5s: ${els.curTime.textContent}`);
    setVisibility('visible'); /* 重复 visible：resume 幂等（当前题已完成，不应续跑） */
    assert(els.totalTime.classList.contains('timer-paused'), '当前题已完成时重复 visible 也不续跑');
    /* 暂停态切题的纯逻辑验证（走 index.html 的 Timer 本体，第 1.3 节同款注入） */
    const timerSrc2 = html.slice(html.indexOf('class Timer {'), html.indexOf('/* ===== Storage'))
        .replace(/\bperformance\.now\(\)/g, '__perf.now()')
        .replace(/\brequestAnimationFrame\(/g, '__raf(')
        .replace(/\bcancelAnimationFrame\(/g, '__caf(');
    let tNow = 0;
    const TimerClass = new Function('__perf', '__raf', '__caf', `${timerSrc2}\nreturn Timer;`)({ now: () => tNow }, () => 1, () => {});
    const ticks = [];
    const t2 = new TimerClass({ emit: (ev, payload) => { if (ev === 'timer:tick') ticks.push(payload); } });
    t2.start();                       /* t=0 */
    tNow = 4000;
    t2.switchQuestion(0, 1);          /* 运行中切题：结算 0 → 4s，新题基准重置 */
    assert(t2.getQuestionTime(0) === 4000, `运行中切题结算旧题 4s: ${t2.getQuestionTime(0)}`);
    assert(t2.getQuestionTime(1) === 0, `新题从 0 起算: ${t2.getQuestionTime(1)}`);
    tNow = 5000;
    t2.pause();                       /* 答完第 2 题 → 停表，单题 1s */
    assert(t2.getQuestionTime(1) === 1000, `停表结算当前题 1s: ${t2.getQuestionTime(1)}`);
    tNow = 30000;
    t2.switchQuestion(1, 0);          /* 暂停态切题：只改题号，不得重复 accrue */
    assert(t2.getQuestionTime(1) === 1000 && t2.getQuestionTime(0) === 4000, `暂停态切题不重复结算（Q1=4s/Q2=1s）: ${t2.getQuestionTime(0)}/${t2.getQuestionTime(1)}`);
    assert(ticks.at(-1).questionTime === 4000 && ticks.at(-1).totalTime === 5000, `暂停态切题的 tick 对应切过去的那一题: ${JSON.stringify(ticks.at(-1))}`);
    tNow = 40000;
    t2.resume();                      /* 从暂停恢复：暂停时长不计入 */
    assert(t2.getTotalTime() === 5000, `恢复后总用时仍为 5000ms（后台 35s 不计入）: ${t2.getTotalTime()}`);
    tNow = 42000;
    assert(t2.getQuestionTime(0) === 6000, `恢复后从当前题重新起算（4s + 2s）: ${t2.getQuestionTime(0)}`);
    t2.pause(); t2.pause();           /* 重复 pause 幂等 */
    assert(t2.getQuestionTime(0) === 6000 && t2.getTotalTime() === 7000, `重复 pause 幂等: ${t2.getQuestionTime(0)}/${t2.getTotalTime()}`);
    t2.resume(); t2.resume();         /* 重复 resume 幂等 */
    assert(t2.getTotalTime() === 7000, `重复 resume 幂等: ${t2.getTotalTime()}`);

    console.log(failed ? `\n${failed} 项失败` : '\n全部通过 ✓');
    process.exit(failed ? 1 : 0);
})();
