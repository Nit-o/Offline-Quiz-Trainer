/* 版本号同步（CI 打 v* 标签时执行）：把标签版本写入
     - 根 package.json 的 version
     - android/app/build.gradle 的 versionName + versionCode
   versionCode 必须单调递增（Android 覆盖安装与商店上传的硬要求），取值优先级：
     1. 环境变量 CAP_VERSION_CODE（CI 可传 GITHUB_RUN_NUMBER 等确定性序号）
     2. 当前 Unix 时间戳（秒）——天然递增，无需维护计数器
   用法：node scripts/sync-version.cjs <version>（如 1.2.3） */
'use strict';
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    console.error('[sync-version] 用法：node scripts/sync-version.cjs <version>（如 1.2.3）');
    process.exit(1);
}

const versionCode = (() => {
    const raw = process.env.CAP_VERSION_CODE;
    if (raw !== undefined && raw !== '') {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) {
            console.error(`[sync-version] CAP_VERSION_CODE 非法（需为正整数）：${raw}`);
            process.exit(1);
        }
        return n;
    }
    return Math.floor(Date.now() / 1000);
})();

const pkgFile = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');

const gradleFile = path.resolve(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(gradleFile)) { console.error('[sync-version] 未找到 android/app/build.gradle'); process.exit(1); }
const g = fs.readFileSync(gradleFile, 'utf8');
const g2 = g.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
if (g2 === g) { console.error('[sync-version] 未在 build.gradle 中找到 versionName'); process.exit(1); }
const g3 = g2.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
if (g3 === g2) { console.error('[sync-version] 未在 build.gradle 中找到 versionCode'); process.exit(1); }
fs.writeFileSync(gradleFile, g3);

console.log(`[sync-version] 版本号 → ${version}（versionCode ${versionCode}）`);
