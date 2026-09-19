/* 发布产物门禁：确认 APK 是 release 构建、未被 debug 签名、且未引入敏感权限。
   用法：node scripts/verify-apk.cjs <apk 路径> [signing-report 路径]
   - signing-report：apksigner verify --print-certs 的输出（CI 生成；缺失则跳过 debug 签名判定）
   - 不依赖 aapt2/外部进程：直接从 APK（ZIP）读出 AndroidManifest.xml 后按 UTF-16LE 匹配，
     跨平台、可在受限环境运行。
   退出码非 0 表示门禁不通过，CI 应中断发布。 */
'use strict';
const fs = require('fs');

const apk = process.argv[2];
const report = process.argv[3];
if (!apk || !fs.existsSync(apk)) {
    console.error(`[verify-apk] 未找到 APK：${apk || '(未提供路径)'}`);
    process.exit(1);
}

/* 最小 ZIP 读取：按中央目录定位条目，支持 stored(0) 与 deflate(8) */
const readZipEntry = (buf, name) => {
    const EOCD_SIG = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    const eocd = buf.lastIndexOf(EOCD_SIG);
    if (eocd < 0) throw new Error('不是有效的 ZIP/APK（缺少 EOCD）');
    const count = buf.readUInt16LE(eocd + 10);
    let off = buf.readUInt32LE(eocd + 16);
    const CD_SIG = '504b0102';
    for (let i = 0; i < count; i++) {
        if (off + 46 > buf.length || buf.toString('hex', off, off + 4) !== CD_SIG) throw new Error('中央目录损坏');
        const method = buf.readUInt16LE(off + 10);
        const compSize = buf.readUInt32LE(off + 20);
        const nameLen = buf.readUInt16LE(off + 28);
        const extraLen = buf.readUInt16LE(off + 30);
        const commentLen = buf.readUInt16LE(off + 32);
        const localOff = buf.readUInt32LE(off + 42);
        const entryName = buf.toString('utf8', off + 46, off + 46 + nameLen);
        off += 46 + nameLen + extraLen + commentLen;
        if (entryName !== name) continue;
        if (localOff + 30 > buf.length || buf.toString('hex', localOff, localOff + 4) !== '504b0304') throw new Error('本地文件头损坏');
        const lNameLen = buf.readUInt16LE(localOff + 26);
        const lExtraLen = buf.readUInt16LE(localOff + 28);
        const dataStart = localOff + 30 + lNameLen + lExtraLen;
        const raw = buf.subarray(dataStart, dataStart + compSize);
        if (method === 0) return raw;
        if (method === 8) return require('zlib').inflateRawSync(raw);
        throw new Error(`不支持的压缩方式：${method}`);
    }
    return null;
};

let failed = 0;
const check = (ok, msg) => {
    console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`);
    if (!ok) failed++;
};

/* 1+2. 清单检查：debuggable 与权限白名单 */
let manifest = null;
try {
    manifest = readZipEntry(fs.readFileSync(apk), 'AndroidManifest.xml');
} catch (e) {
    console.error(`[verify-apk] 读取 AndroidManifest.xml 失败：${e.message}`);
    process.exit(1);
}
if (!manifest) {
    console.error('[verify-apk] APK 内未找到 AndroidManifest.xml');
    process.exit(1);
}
/* 二进制清单中的字符串为 UTF-16LE（含长度前缀，子串匹配足够） */
const u16 = manifest.toString('utf16le');
check(!/debuggable/.test(u16), 'APK 清单不含 android:debuggable');

const found = [...new Set([...u16.matchAll(/android\.permission\.[A-Z_]+/g)].map(m => m[0]))].sort();

/* 2a. 硬性红线：离线题库应用不应出现任何敏感权限（合并自依赖库也算失败） */
const SENSITIVE = [
    'CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'ACCESS_BACKGROUND_LOCATION',
    'READ_CONTACTS', 'WRITE_CONTACTS', 'GET_ACCOUNTS', 'READ_PHONE_STATE', 'READ_PHONE_NUMBERS',
    'CALL_PHONE', 'READ_CALL_LOG', 'WRITE_CALL_LOG', 'READ_SMS', 'SEND_SMS', 'RECEIVE_SMS',
    'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'MANAGE_EXTERNAL_STORAGE',
    'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_MEDIA_AUDIO',
    'BODY_SENSORS', 'ACTIVITY_RECOGNITION', 'POST_NOTIFICATIONS', 'SYSTEM_ALERT_WINDOW',
    'QUERY_ALL_PACKAGES', 'REQUEST_INSTALL_PACKAGES', 'READ_CALENDAR', 'WRITE_CALENDAR',
];
const sensitiveFound = found.filter(p => SENSITIVE.some(s => p === `android.permission.${s}`));
check(sensitiveFound.length === 0, `未引入敏感权限${sensitiveFound.length ? `（发现：${sensitiveFound.join(', ')}）` : ''}`);

/* 2b. 白名单提示：仅应声明 INTERNET；依赖库自动注入的权限只告警，不阻断 */
const ALLOWED = new Set(['android.permission.INTERNET']);
const unexpected = found.filter(p => !ALLOWED.has(p));
if (unexpected.length) {
    console.log(`  ! 非白名单权限（可能由依赖库注入，请确认无敏感项）：${unexpected.join(', ')}`);
} else {
    console.log(`  ✓ 权限仅含白名单项（当前：${found.join(', ') || '无'}）`);
}

/* 3. 签名不得是 debug 证书 */
if (report && fs.existsSync(report)) {
    const text = fs.readFileSync(report, 'utf8');
    check(/Signer #1 certificate DN/i.test(text), 'apksigner 报告含签名证书');
    check(!/Android Debug/i.test(text), '签名证书不是 Android Debug 证书');
} else {
    console.warn('[verify-apk] 未提供 apksigner 报告，跳过签名证书检查');
}

if (failed) {
    console.error(`[verify-apk] 门禁不通过：${failed} 项`);
    process.exit(1);
}
console.log(`[verify-apk] 门禁通过：${apk}`);
