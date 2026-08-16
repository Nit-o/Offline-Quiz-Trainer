/* 模拟 Capacitor APK 运行时环境（本地验证用）：
   按 Bridge/JSInjector 的方式，把 globalJS + native-bridge.js + 插件桩注入 index.html，
   并预置 androidBridge（无原生侧时 postMessage 为空操作）。
   产物: dist/index.sim.html（须位于 dist 根目录，相对导入 ./vendor/... 才能正确解析）。
   用法:
     node scripts/serve-dist.cjs 8399            # 先起静态服务
     node scripts/sim-apk.cjs                    # 生成 dist/index.sim.html
     chrome --headless=new --dump-dom http://127.0.0.1:8399/index.sim.html
     # <body data-bridge="..."> 的 regCalls≥1 表示 shareReceived 监听已注册 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

const bridgeJS = (() => {
    const candidates = [
        path.join(ROOT, 'android', 'app', 'build', 'intermediates', 'assets', 'debug', 'mergeDebugAssets', 'native-bridge.js'),
        path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'native-bridge.js'),
    ];
    for (const c of candidates) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
    throw new Error('找不到 native-bridge.js（先执行 cap sync android 或 gradle assembleDebug 生成）');
})();

/* 1. globalJS：与 JSExport.getGlobalJS 一致 */
const globalJS = `window.Capacitor = { DEBUG: true, isLoggingEnabled: true, Plugins: {} };`;

/* 2. androidBridge 桩：让 getPlatformId() 返回 'android'、isNativePlatform() 恒 true */
const bridgeStub = `
window.androidBridge = { postMessage: function(){ /* 无原生侧：消息丢弃 */ } };
window.__regCalls = [];
`;

/* 3. 插件桩：与 JSExport.getPluginJS 生成的形态一致（含 addListener）+ PluginHeaders */
const plugins = {
    Filesystem: ['appendFile','copy','deleteFile','getDirectory','getUri','mkdir','readFile','readdir','rename','rmdir','stat','writeFile'],
    Share: ['share'],
    CapacitorShareTarget: ['addListener','removeListener','getPluginVersion'],
    SaveFile: ['saveFile'],
};
const pluginStubs = [];
const pluginHeaders = [];
for (const [name, methods] of Object.entries(plugins)) {
    const lines = [`(function(w){ var a=(w.Capacitor=w.Capacitor||{}); var p=(a.Plugins=a.Plugins||{}); var t=(p['${name}']={});`];
    lines.push(`t.addListener=function(eventName,callback){ return w.Capacitor.addListener('${name}',eventName,callback); };`);
    const headers = [];
    for (const m of methods) {
        if (m === 'addListener' || m === 'removeListener') continue;
        lines.push(`t['${m}']=function(_options){ return w.Capacitor.nativePromise('${name}','${m}',_options); };`);
        headers.push({ name: m, rtype: 'promise' });
    }
    lines.push('})(window);');
    pluginStubs.push(lines.join('\n'));
    /* addListener/removeListener 是基类 @PluginMethod(returnType = RETURN_NONE)，
       与 JSExport.createPluginHeader 的实际输出一致 */
    pluginHeaders.push({ name, methods: [
        { name: 'addListener', rtype: 'none' },
        { name: 'removeListener', rtype: 'none' },
        ...headers,
    ] });
}
const pluginHeaderJS = `window.Capacitor.PluginHeaders = ${JSON.stringify(pluginHeaders)};`;

const injected = `<script type="text/javascript">\n${globalJS}\n${bridgeStub}\n${bridgeJS}\n${pluginStubs.join('\n')}\n${pluginHeaderJS}\n</script>`;

/* 拦截器：native-bridge 就绪后包一层 nativeCallback，统计 shareReceived 监听注册调用 */
const interceptor = `<script type="text/javascript">
(function () {
    var cap = window.Capacitor;
    if (cap && typeof cap.nativeCallback === 'function') {
        var orig = cap.nativeCallback.bind(cap);
        cap.nativeCallback = function () {
            var a = Array.prototype.slice.call(arguments);
            if (a[0] === 'CapacitorShareTarget' && a[1] === 'addListener') window.__regCalls.push(a);
            return orig.apply(cap, a);
        };
    }
})();
</script>`;

/* 探测脚本：把桥状态写进 DOM（dump-dom 可读），验证原生桥是否就绪 */
const probe = `<script type="text/javascript">
setTimeout(function () {
    var b = window.CapacitorBridge || {};
    var st = { native: typeof b.isNative === 'function' ? b.isNative() : 'n/a', share: !!b.Share, fs: !!b.Filesystem, cst: !!b.CapacitorShareTarget, sf: !!b.SaveFile, cap: !!window.Capacitor, platform: window.Capacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'n/a', regCalls: (window.__regCalls || []).length };
    document.body.setAttribute('data-bridge', JSON.stringify(st));
}, 1500);
</script>`;

const idx = html.indexOf('<head>');
if (idx === -1) throw new Error('no <head>');
const out = html.slice(0, idx + '<head>'.length) + '\n' + injected + '\n' + html.slice(idx + '<head>'.length);

/* 必须放在 dist 根目录（URL 为 /index.sim.html）：
   相对导入 ./vendor/... 才能解析到 /vendor/...，与 APK 中 /index.html 的解析一致 */
const outFile = path.join(DIST, 'index.sim.html');
fs.writeFileSync(outFile, out + interceptor + probe);
console.log('sim page written:', outFile, '(+' + injected.length + ' bytes injected)');
