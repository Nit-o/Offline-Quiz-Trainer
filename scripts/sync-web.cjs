/* 生成 Capacitor webDir（dist/）：以仓库根目录为唯一数据源，避免手工复制导致 APK 里是旧页面。
   产物：
     dist/index.html
     dist/vendor/katex/            （KaTeX 离线渲染，原样拷贝）
     dist/vendor/capacitor/        （@capacitor/core 及各插件的 ESM 运行库，由 index.html 的 importmap 引用）
   dist/ 由 index.html 中的 <script type="importmap"> 决定解析关系；同步新增依赖时需同步更新 importmap。 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const NM = path.join(ROOT, 'node_modules');
const VC = path.join(DIST, 'vendor', 'capacitor');

const rmrf = p => fs.rmSync(p, { recursive: true, force: true });
const cp = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };
/* dereference: pnpm 的 node_modules 是指向 pnpm store 的符号链接，必须解引用拷贝真实内容，
   否则 dist/ 里会留下指向 store 的坏链接，打进 APK 后无法使用 */
const cpDir = (src, dst) => fs.cpSync(src, dst, { recursive: true, dereference: true });
const exists = p => fs.existsSync(p);
const fail = msg => { console.error('[sync-web] ' + msg); process.exit(1); };

rmrf(DIST);
fs.mkdirSync(VC, { recursive: true });

/* 1. 网页本体 */
cp(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
if (!exists(path.join(ROOT, 'vendor', 'katex'))) fail('缺少 vendor/katex（KaTeX 离线渲染资源）');
cpDir(path.join(ROOT, 'vendor', 'katex'), path.join(DIST, 'vendor', 'katex'));

/* 1.5 KaTeX 白名单：index.html 只加载 min 版，未压缩源码（katex.js / katex.mjs /
   katex.css / katex-swap.css 等）约 1.3MB 纯属包体浪费 → 按白名单剔除；
   必需文件缺失则构建失败，不静默降级。 */
const katexDist = path.join(DIST, 'vendor', 'katex');
const KATEX_KEEP = new Set(['katex.min.css', 'katex.min.js', 'LICENSE', 'README.md', 'fonts', 'contrib']);
const KATEX_CONTRIB_KEEP = new Set(['auto-render.min.js']);
const contribDir = path.join(katexDist, 'contrib');
if (exists(contribDir)) {
    for (const f of fs.readdirSync(contribDir)) {
        if (!KATEX_CONTRIB_KEEP.has(f)) rmrf(path.join(contribDir, f));
    }
}
let katexRemoved = 0;
for (const f of fs.readdirSync(katexDist)) {
    if (KATEX_KEEP.has(f)) continue;
    rmrf(path.join(katexDist, f));
    katexRemoved++;
}
for (const rel of ['katex.min.css', 'katex.min.js', path.join('contrib', 'auto-render.min.js')]) {
    if (!exists(path.join(katexDist, rel))) fail(`vendor/katex 缺少 ${rel}（KaTeX 资源不完整）`);
}
console.log(`[sync-web] KaTeX 白名单：保留 min 版 + 字体，剔除 ${katexRemoved} 个未引用文件`);

/* 2. Capacitor ESM 运行库（importmap 键 → 文件）：
     "@capacitor/core"                → core/index.js（dist/index.js，单文件自包含 ESM）
     "@capacitor/share"               → share/index.js（dist/esm/*，含相对动态 import ./web）
     "@capacitor/filesystem"          → filesystem/index.js（dist/esm/*）
     "@capacitor/synapse"             → synapse.mjs（filesystem 的 ESM 依赖）
     "@capgo/capacitor-share-target"  → share-target/index.js（dist/esm/*）
     "com.quiztrainer.savefile"       → save-file/index.js（本地插件 dist/esm/*） */
const entries = [
    ['@capacitor/core', 'dist/index.js', 'core/index.js'],
    ['@capacitor/share', null, 'share'],
    ['@capacitor/filesystem', null, 'filesystem'],
    ['@capacitor/synapse', 'dist/synapse.mjs', 'synapse.mjs'],
    ['@capgo/capacitor-share-target', null, 'share-target'],
    ['com.quiztrainer.savefile', null, 'save-file'],
];
/* 本地插件（package.json 里 file: 协议）解析到仓库原目录：
   pnpm 会把 file: 依赖复制进 node_modules/.pnpm 虚拟存储且不随源码更新，
   构建产物 dist/esm 是 build:plugin 现场生成的，必须从原目录读取（CI 同理） */
const localDeps = (() => {
    const map = {};
    try {
        const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
        for (const [k, v] of Object.entries(pkgJson.dependencies || {})) {
            if (typeof v === 'string' && v.startsWith('file:')) map[k] = path.resolve(ROOT, v.slice(5));
        }
    } catch { /* 读取失败则全部走 node_modules */ }
    return map;
})();
for (const [pkg, file, dst] of entries) {
    const srcDir = localDeps[pkg] || path.join(NM, pkg);
    if (!exists(srcDir)) fail(`缺少依赖 ${pkg}，请先执行 npm install`);
    if (file) {
        if (!exists(path.join(srcDir, file))) fail(`${pkg} 缺少 ${file}`);
        cp(path.join(srcDir, file), path.join(VC, dst));
    } else {
        const esm = path.join(srcDir, 'dist', 'esm');
        if (!exists(esm)) fail(`${pkg} 缺少 dist/esm`);
        cpDir(esm, path.join(VC, dst));
    }
}

/* 2.5 原生 ESM 兼容：npm 包的 dist/esm 是 bundler 格式（import './web' 无扩展名），
   浏览器原生 ESM 不会自动补扩展名，会 404 导致整个 <script type="module"> 失效。
   此处把 vendor/capacitor/ 下所有相对导入补上 .js 扩展名（缺文件时保持原样并警告）。 */
const fixEsmSpecifiers = (dir) => {
    const RE = /(\bfrom\s*|import\(\s*)(['"])(\.{1,2}\/[^'"]*?)\2/g;
    let fixed = 0, warned = 0;
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) { walk(p); continue; }
            if (!/\.(js|mjs)$/.test(e.name)) continue;
            let src = fs.readFileSync(p, 'utf8');
            let changed = false;
            src = src.replace(RE, (m, pre, quote, spec) => {
                const resolved = path.resolve(path.dirname(p), spec);
                if (exists(resolved)) return m;                       /* 已是完整文件路径 */
                let next = null;
                if (exists(resolved + '.js')) next = spec + '.js';
                else if (exists(path.join(resolved, 'index.js'))) next = spec + '/index.js';
                else { warned++; return m; }                          /* 无法解析，保持原样 */
                changed = true; fixed++;
                return pre + quote + next + quote;
            });
            if (changed) fs.writeFileSync(p, src);
        }
    };
    walk(dir);
    console.log(`[sync-web] ESM 相对导入补全：${fixed} 处修改${warned ? `，${warned} 处无法解析（保持原样）` : ''}`);
};
fixEsmSpecifiers(VC);

/* 3. 自检：index.html 的 importmap 与产物一一对应 */
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const mapMatch = html.match(/<script type="importmap">\s*(\{[\s\S]*?\})\s*<\/script>/);
if (!mapMatch) fail('index.html 缺少 importmap');
let map;
try { map = JSON.parse(mapMatch[1]); } catch (e) { fail('importmap 不是合法 JSON: ' + e.message); }
const missing = [];
for (const [spec, rel] of Object.entries(map.imports || {})) {
    const p = path.join(DIST, rel);
    if (!exists(p)) missing.push(`${spec} → ${rel}`);
}
if (missing.length) fail('importmap 指向缺失文件：' + missing.join('、'));
console.log(`[sync-web] dist/ 已生成：index.html + vendor/katex + ${Object.keys(map.imports).length} 个 Capacitor 模块`);
