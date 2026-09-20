/* 从 index.html 抽出内联模块脚本，供静态检查工具链使用：
     - tsc --checkJs  类型检查（单文件应用没有 .js 源文件，必须抽取）
     - eslint         语法/规则检查
   用法：node scripts/extract-inline-js.cjs [输出路径]
   默认输出 .tmp-lint/inline-module.mjs（已加入 .gitignore）；输出目录由脚本创建。 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!match) {
    console.error('[extract-inline-js] 未在 index.html 中找到 <script type="module"> 块');
    process.exit(1);
}
const out = path.resolve(ROOT, process.argv[2] || path.join('.tmp-lint', 'inline-module.mjs'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, match[1]);
console.log(`[extract-inline-js] 已抽出内联模块 → ${path.relative(ROOT, out)}（${match[1].split('\n').length} 行）`);
