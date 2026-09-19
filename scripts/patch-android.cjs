/* 平台补丁（`cap add android` 生成模板后执行，幂等）：
   1. android/variables.gradle 的 minSdkVersion → 33。
      应用使用 oklch()/CSS Color 5 与较新 Web API，需较新 WebView；Android 13 (API 33) 起步
      （与迁移前 Cordova config.xml 的 android-minSdkVersion=33 保持一致）。
   2. android/app/src/main/AndroidManifest.xml 的 MainActivity 注入分享目标 intent-filter：
      注册为系统分享目标（@capgo/capacitor-share-target），可接收其他应用「分享」进来的
      .md / .txt / .json 文本与文件（text/*、application/json、application/octet-stream）。
      注意：与 Cordova 时代不同，INTERNET 权限必须保留——Capacitor 通过应用内本地服务器
      （https://localhost）加载页面，去掉会导致白屏。
   3. 国内镜像：默认无条件把 Gradle 发行包改成腾讯镜像、Maven 仓库改成阿里云 google 镜像 +
      腾讯 nexus maven-public（本项目面向外网受限环境）。显式设环境变量
      `CAP_MIRRORS=off` 才保持官方源（CI 若网络正常可设该值以加速/稳定）。
   4. build-tools 兜底：本机 SDK 缺 AGP 默认版本且无法联网自动下载时，
      把全部模块 buildToolsVersion 固定为本机已安装的最高版本。 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* 国内主流镜像 */
const CN_GRADLE_DIST = 'https://mirrors.cloud.tencent.com/gradle/gradle-8.14.3-all.zip';
const CN_MAVEN_GOOGLE = 'https://maven.aliyun.com/repository/google/';
const CN_MAVEN_CENTRAL = 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public/';

const useCnMirror = process.env.CAP_MIRRORS !== 'off';

const patchMinSdk = () => {
    const file = path.join(ROOT, 'android', 'variables.gradle');
    if (!fs.existsSync(file)) { console.error('[patch-android] 未找到 android/variables.gradle，请先执行 cap add android'); process.exit(1); }
    const src = fs.readFileSync(file, 'utf8');
    const next = src.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 33');
    if (next === src) console.log('[patch-android] minSdkVersion 已为 33，跳过');
    else { fs.writeFileSync(file, next); console.log('[patch-android] minSdkVersion → 33'); }
};

const patchManifest = () => {
    const file = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    if (!fs.existsSync(file)) { console.error('[patch-android] 未找到 android/app/src/main/AndroidManifest.xml'); process.exit(1); }
    const manifest = fs.readFileSync(file, 'utf8');
    const MARK = '<!-- patch-android: share-target -->';
    if (manifest.includes(MARK)) {
        console.log('[patch-android] share-target intent-filter 已注入，跳过');
        return;
    }
    const filters = [
        '<intent-filter>',
        '    <action android:name="android.intent.action.SEND" />',
        '    <category android:name="android.intent.category.DEFAULT" />',
        '    <data android:mimeType="text/*" />',
        '    <data android:mimeType="application/json" />',
        '    <data android:mimeType="application/octet-stream" />',
        '</intent-filter>',
        '<intent-filter>',
        '    <action android:name="android.intent.action.SEND_MULTIPLE" />',
        '    <category android:name="android.intent.category.DEFAULT" />',
        '    <data android:mimeType="text/*" />',
        '    <data android:mimeType="application/json" />',
        '</intent-filter>',
    ].join('\n            ');
    const inject = `\n            ${MARK}\n            ${filters}`;
    /* 注入到 MainActivity 的 LAUNCHER intent-filter 之后（第一个 </intent-filter> 后面） */
    const idx = manifest.indexOf('</intent-filter>');
    if (idx === -1) { console.error('[patch-android] AndroidManifest 中未找到 intent-filter'); process.exit(1); }
    const next = manifest.slice(0, idx + '</intent-filter>'.length) + inject + manifest.slice(idx + '</intent-filter>'.length);
    fs.writeFileSync(file, next);
    console.log('[patch-android] 已注入 share-target intent-filter（SEND / SEND_MULTIPLE）');
};

/* 外网受限 → Gradle 发行包与 Maven 仓库切国内镜像（CI 探测通过则跳过） */
const patchMirrors = () => {
    const buildFile = path.join(ROOT, 'android', 'build.gradle');
    if (!fs.existsSync(buildFile)) { console.error('[patch-android] 未找到 android/build.gradle'); process.exit(1); }
    const MARK = '// patch-android: cn-mirrors';
    let src = fs.readFileSync(buildFile, 'utf8');
    if (!src.includes(MARK)) {
        const repos = [
            "        maven { url '" + CN_MAVEN_CENTRAL + "' }",
            "        maven { url '" + CN_MAVEN_GOOGLE + "' }",
        ].join('\n');
        src = src
            .replace(/google\(\)\s*\r?\n\s*mavenCentral\(\)/g, repos)
            .replace(/(^|\n)(\/\/ Top-level build file)/, `$1${MARK}\n$2`);
        fs.writeFileSync(buildFile, src);
        console.log('[patch-android] build.gradle 仓库 → 阿里云 google + 腾讯 nexus maven-public');
    } else {
        console.log('[patch-android] build.gradle 已是国内镜像，跳过');
    }
    const wpFile = path.join(ROOT, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');
    if (!fs.existsSync(wpFile)) { console.error('[patch-android] 未找到 gradle-wrapper.properties'); process.exit(1); }
    const wp = fs.readFileSync(wpFile, 'utf8');
    const esc = CN_GRADLE_DIST.replace(/:/g, '\\:');
    const wpNext = wp.replace(/^distributionUrl=.*$/m, `distributionUrl=${esc}`);
    if (wpNext !== wp) { fs.writeFileSync(wpFile, wpNext); console.log('[patch-android] Gradle 发行包 → 腾讯镜像'); }
    else console.log('[patch-android] Gradle 发行包已是腾讯镜像，跳过');
};

/* 正式签名 + R8：`cap add android` 生成的模板是 `minifyEnabled false` 且无 signingConfig，
   而 CI 每次都重新生成 android/，故必须在补丁里注入（幂等）。
   签名凭据经环境变量注入（CI 用 GitHub Secrets）；未提供时不配置 signingConfig，
   assembleRelease 只产出未签名包，绝不退化成 debug 签名。 */
const patchReleaseBuild = () => {
    const file = path.join(ROOT, 'android', 'app', 'build.gradle');
    if (!fs.existsSync(file)) { console.error('[patch-android] 未找到 android/app/build.gradle'); process.exit(1); }
    const src = fs.readFileSync(file, 'utf8');
    if (src.includes('signingConfigs') || src.includes('minifyEnabled true')) {
        console.log('[patch-android] release 签名/R8 已应用，跳过');
        return;
    }

    const signing = `    /* patch-android: release-signing
       正式签名凭据经环境变量注入（CI 用 GitHub Secrets，本地可用环境变量或 gradle.properties）；
       未提供凭据时不配置 signingConfig → assembleRelease 产出未签名包（不会退化成 debug 签名）。 */
    signingConfigs {
        release {
            def storePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (storePath) {
                storeFile file(storePath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
`;

    const newBuildTypes = `    buildTypes {
        release {
            signingConfig System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : null
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }`;

    const withBuildTypes = src.replace(/    buildTypes \{\r?\n[\s\S]*?\r?\n    \}/, newBuildTypes);
    if (withBuildTypes === src) {
        console.error('[patch-android] 未能替换 buildTypes 块，请检查 app/build.gradle 模板是否变化');
        process.exit(1);
    }
    const next = withBuildTypes.replace(/    defaultConfig \{/, `${signing}    defaultConfig {`);
    if (next === withBuildTypes) {
        console.error('[patch-android] 未找到 defaultConfig 块，无法注入 signingConfigs');
        process.exit(1);
    }
    fs.writeFileSync(file, next);
    console.log('[patch-android] release 构建已配置：release 签名 + minifyEnabled + shrinkResources');
};

/* R8 开启后必须保留按类名反射加载的插件（见 assets/capacitor.plugins.json） */
const PROGUARD_RULES = `# patch-android: capacitor keep rules（R8 开启后必须保留，插件按类名反射加载）
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.quiztrainer.savefile.** { *; }
-keep class app.capgo.sharetarget.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.quiztrainer.app.MainActivity { *; }

# 保留异常行号，便于定位线上崩溃
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
`;

const patchProguard = () => {
    const file = path.join(ROOT, 'android', 'app', 'proguard-rules.pro');
    if (!fs.existsSync(file)) { console.error('[patch-android] 未找到 android/app/proguard-rules.pro'); process.exit(1); }
    const src = fs.readFileSync(file, 'utf8');
    if (src.includes('patch-android: capacitor keep rules')) { console.log('[patch-android] proguard 插件保留规则已存在，跳过'); return; }
    fs.writeFileSync(file, src.trimEnd() + '\n\n' + PROGUARD_RULES);
    console.log('[patch-android] 已追加 Capacitor/插件 proguard 保留规则');
};

/* 本机 SDK 缺 AGP 默认 build-tools 且无法联网自动下载 → 固定为已安装的最高版本 */
const patchBuildTools = () => {
    const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (!sdkRoot) { console.log('[patch-android] 未设置 ANDROID_HOME/ANDROID_SDK_ROOT，跳过 build-tools 兜底'); return; }
    let installed = [];
    try { installed = fs.readdirSync(path.join(sdkRoot, 'build-tools')).filter(d => /^\d+\.\d+\.\d+$/.test(d)); } catch { /* SDK 缺失 */ }
    if (!installed.length) { console.log('[patch-android] 未找到 Android SDK build-tools，跳过 build-tools 兜底'); return; }
    if (installed.some(v => v.startsWith('35.'))) { console.log('[patch-android] build-tools 35.x 已安装，无需兜底'); return; }
    const chosen = installed.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
    const gradleFiles = [
        path.join(ROOT, 'android', 'app', 'build.gradle'),
        path.join(ROOT, 'android', 'capacitor-cordova-android-plugins', 'build.gradle'),
        path.join(ROOT, 'node_modules', '@capacitor', 'android', 'capacitor', 'build.gradle'),
        path.join(ROOT, 'node_modules', '@capgo', 'capacitor-share-target', 'android', 'build.gradle'),
        path.join(ROOT, 'node_modules', '@capacitor', 'share', 'android', 'build.gradle'),
        path.join(ROOT, 'node_modules', '@capacitor', 'filesystem', 'android', 'build.gradle'),
        path.join(ROOT, 'native-plugins', 'save-file', 'android', 'build.gradle'),
    ];
    let patched = 0;
    for (const gf of gradleFiles) {
        if (!fs.existsSync(gf)) continue;
        let c = fs.readFileSync(gf, 'utf8');
        if (/buildToolsVersion\s*=\s*"\d+\.\d+\.\d+"/.test(c)) continue;
        if (!/android \{\s*\r?\n/.test(c)) continue;
        c = c.replace(/android \{\s*\r?\n/, `android {\n    buildToolsVersion = "${chosen}"\n`);
        fs.writeFileSync(gf, c);
        patched++;
    }
    console.log(`[patch-android] 本机 SDK 缺 build-tools 35.x，已将 ${patched} 个模块的 buildToolsVersion 固定为 ${chosen}`);
};

(async () => {
    console.log(useCnMirror
        ? '[patch-android] 启用国内镜像（腾讯 Gradle + 阿里云/腾讯 Maven）'
        : '[patch-android] CAP_MIRRORS=off → 保持官方仓库');
    patchMinSdk();
    patchManifest();
    patchReleaseBuild();
    patchProguard();
    if (useCnMirror) patchMirrors();
    patchBuildTools();
    console.log('[patch-android] 完成');
})();
