# Offline-Quiz-Trainer

一个HTML渲染器，用于读取Markdown文件并将其转换为测验。

An HTML renderer that reads Markdown files and converts them into a quiz.

##### Standards baseline：
- HTML Living Standard — Last Updated 20 July 2026
- ECMAScript 2026（ES2026）
- CSS Snapshot 2026（含 CSS Color 5）
- minSdk = 33（Android）

## 它能做什么

最开始的目的是用它刷题度过期末。

如果你的老师也给你了题库，同时你也不愿用市面上的各种过于“重”“花哨”的软件，那么这个网页或许会有帮助。

### 使用说明

- 通过[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)支持了FSRS。
- 通过[KaTeX](https://github.com/KaTeX/KaTeX)支持 LaTeX 公式：题目、选项与解析中的 `$...$` 行内公式、`$$...$$` 独立公式
- 主题切换（黑夜模式）。~~你可以在床上背着舍友偷偷内卷了~~
- 支持触屏：左右滑动切换题目
- 数据统计面板（菜单 → 数据统计）：累计答题/正确率/已掌握、近 7 天答题与复习趋势、未来 3 天复习量预测、近 1 周实际 / 未来 1 周预计（复习/新增/预计颜色区分），复习数据随 FSRS 备份导入导出
- 快捷键
  - 左右箭头 = 切换题目
  - 1-5 = A-E
- 右下角按钮显示题目导航

### 适配格式

[示例](doc/示例.md)

## 项目结构

```
├── index.html                  # Web 应用（单文件：HTML/CSS/JS/内联模块）
├── vendor/katex/               # KaTeX 离线渲染资源（本地依赖，不联网）
├── doc/                        # 文档与示例题库（示例.md / B类题库_origin.md）
├── scripts/
│   ├── sync-web.cjs            # 生成 Capacitor webDir（dist/）：拷贝 index.html + vendor + 插件 ESM
│   ├── patch-android.cjs       # Android 平台补丁（minSdk=33 / 分享目标 intent-filter / 国内镜像）
│   ├── sync-version.cjs        # 版本号同步（CI 打标签时写入 package.json + build.gradle）
│   ├── smoke_test.cjs          # 冒烟测试
│   └── fsrs_*.cjs              # FSRS 逻辑测试/对比
├── native-plugins/save-file/   # 本地 Capacitor 插件（com.quiztrainer.savefile：系统文档选择器保存）
├── capacitor.config.json       # Capacitor 配置（appId / webDir: dist）
├── package.json                # 依赖与脚本（pnpm）
```

## 打包 Android APK

前置：Node ≥ 22、pnpm、JDK 21、Android SDK（ANDROID_HOME 指向 SDK 根目录）。

```powershell
pnpm install                                  # 安装依赖（npmmirror 镜像）
pnpm run sync:web                             # 生成 dist/（index.html + vendor + 插件 ESM，自动补全原生 ESM 扩展名）
pnpm run cap add android                      # 生成 android/ 原生工程（首次）
node scripts/patch-android.cjs                # 应用平台补丁（minSdk=33 / 分享目标 / 签名+R8 / 国内镜像 / build-tools 兜底）
pnpm run cap sync android                     # 同步 web 资源与插件
node scripts/patch-android.cjs                # sync 会重生成插件工程，再跑一次补丁（幂等）

cd android
$env:JAVA_HOME = "D:\JDK\jdk-21.0.2"        # 示例；按本机 JDK 21 路径设置
./gradlew assembleRelease                    # 产物：android/app/build/outputs/apk/release/app-release.apk
```

> 镜像：patch-android.cjs 默认将 Gradle 发行包切腾讯镜像、Maven 切阿里云/腾讯镜像；外网正常可设 `CAP_MIRRORS=off` 用官方源。
>
> build-tools：正常情况下由 AGP 自动解析（`CAP_BUILD_TOOLS` 未设且本机装有 35.x 时不做任何固定）。
> 离线/本机 SDK 缺默认版本时，补丁会把本机已安装的最高版本写入 `android/gradle.properties` 的
> `buildToolsVersion`，再由根 `build.gradle` 的 `subprojects` 块下发到各模块——
> 不再改写 `node_modules` 内插件的 `build.gradle`（那会被 `pnpm install` 覆盖，且结果依赖执行机器）。
> 指定版本：`$env:CAP_BUILD_TOOLS = "36.0.0"`。
>
> 可选增强：`pnpm add @capacitor/app` 后重新 `pnpm run sync:web && pnpm run cap sync android`
> 即启用 Android 返回键分层处理；未安装时该功能自动降级，不影响其他原生能力。

### 正式包签名

`assembleRelease` 开启 R8 混淆 + 资源压缩，并读取以下环境变量做正式签名（未提供时只产出**未签名**包，绝不会退化成 debug 签名）：

| 环境变量 | 说明 |
|---|---|
| `ANDROID_KEYSTORE_PATH` | keystore 文件路径 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 口令 |
| `ANDROID_KEY_ALIAS` | 密钥别名 |
| `ANDROID_KEY_PASSWORD` | 密钥口令 |

本地打包示例：

```powershell
$env:ANDROID_KEYSTORE_PATH = "D:\keys\release.keystore"
$env:ANDROID_KEYSTORE_PASSWORD = "***"
$env:ANDROID_KEY_ALIAS = "quiztrainer"
$env:ANDROID_KEY_PASSWORD = "***"
```

发布到 GitHub Release（推送 `v*` 标签）需在仓库 Secrets 中配置：
`ANDROID_KEYSTORE_B64`（`base64 -w0 release.keystore` 的结果）、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。
缺失 `ANDROID_KEYSTORE_B64` 时发布流程会直接失败——正式包必须签名。

`versionCode` 由 `sync-version.cjs` 自动写入（默认取当前时间戳，递增；可用 `CAP_VERSION_CODE` 覆盖），
`versionName` 取自标签。发布前会自动执行产物门禁：校验 APK **不含 `android:debuggable`**、**未引入敏感权限**、
**不是 debug 签名**（`node scripts/verify-apk.cjs <apk> [apksigner 报告]`，可本地手动运行）。

## 测试与静态检查

```powershell
pnpm test                          # = smoke_test + fsrs_logic_test（CI 应以此为准）
pnpm run typecheck                 # 抽出内联 JS → tsc --checkJs 类型检查
pnpm run test:web                  # DOM 桩冒烟测试：导入/缓存/分享降级/答题/FSRS 全链路
pnpm run test:fsrs                 # FSRS 调度逻辑与统计口径
node scripts/fsrs_compare.cjs      # 与 ts-fsrs 对拍（需联网安装 ts-fsrs）
```

类型检查说明：`index.html` 的 JS 是内联的（单文件应用），`npm run typecheck` 会先用
`scripts/extract-inline-js.cjs` 抽到 `.tmp-lint/`（已 gitignore），再按根 `tsconfig.json`
以 `checkJs` 检查；`types/globals.d.ts` 补齐 `CapacitorBridge`、KaTeX `renderMathInElement`、
File System Access API 等环境声明，使检查聚焦真实缺陷。当前**零错误**，新增代码请保持。

ESLint：配置见 `eslint.config.mjs`（需先 `pnpm add -D eslint globals`，离线环境装不上）：

```powershell
pnpm run extract:js
npx eslint .tmp-lint/inline-module.mjs
```

## Web 环境说明

- **浏览器直开（file:// 或任意静态托管）**：页面主逻辑（题库导入/训练/主题/KaTeX/FSRS）完整可用；
  Capacitor 原生桥按环境自动降级（与 Cordova 时代的 `window.NativeShare` 检测模式一致），原生分享/保存功能自动隐藏。
- **APK（Android WebView，https://localhost）**：额外启用原生能力 —— 系统分享导出备份、系统文档选择器保存、
  接收其他应用「分享」的 .md/.txt/.json 题库直接导入。返回键按层回退（关闭弹窗 → 收起导出面板 →
  练习中二次确认后返回模式选择 → 最小化），需要安装可选依赖 `@capacitor/app`；未安装时保持系统默认行为。

## 也许会有帮助的链接

- [opendatalab/MinerU](https://github.com/opendatalab/MinerU)，[MinerU官网](https://mineru.net/)
  >MinerU 是一款文档解析工具，可将 PDF、图片以及 DOCX、PPTX、XLSX 转化为机器可读格式（如 Markdown、JSON）

  将各种文件转为Markdown，也许会减少一点你的工作量。

- [业余无线电台操作技术能力验证题库（2025年版）](https://www.crac.org.cn/News/Detail?ID=d11def30d20d4d8fb12e08e7160e607d)

  *这是我在假期重新翻出这个网页的主要目的*

  [B类题库](doc/B类题库_origin.md)这是我处理过的题库，官网 Pdf 虽然能直接导出文字但会有些因排版导致的回车。

## 最后的话

因为我不是计算机专业的，所以难免会有些 bug ，还请见谅。

## 最后的最后

搁置
- （暂无）
