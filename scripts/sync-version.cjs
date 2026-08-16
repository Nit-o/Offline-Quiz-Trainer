/* 版本号同步（CI 打 v* 标签时执行）：把标签版本写入
     - 根 package.json 的 version
     - android/app/build.gradle 的 versionName
   用法：node scripts/sync-version.cjs <version>（如 1.2.3） */
'use strict';
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    console.error('[sync-version] 用法：node scripts/sync-version.cjs <version>（如 1.2.3）');
    process.exit(1);
}

const pkgFile = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');

const gradleFile = path.resolve(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(gradleFile)) { console.error('[sync-version] 未找到 android/app/build.gradle'); process.exit(1); }
const g = fs.readFileSync(gradleFile, 'utf8');
const g2 = g.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
if (g2 === g) { console.error('[sync-version] 未在 build.gradle 中找到 versionName'); process.exit(1); }
fs.writeFileSync(gradleFile, g2);

console.log(`[sync-version] 版本号 → ${version}`);
