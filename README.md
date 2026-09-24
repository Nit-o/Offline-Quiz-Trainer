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

- 通过 [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) **v5.4.2**（FSRS-6.0）支持了 FSRS：
  `FsrsEngine` 按该版本上游源码逐行移植（LongTermScheduler 语义），版本号唯一来源是
  `index.html` 的 `FSRS_TS_VERSION` 常量；对拍见 `pnpm run test:fsrs:compare`
- 通过 [KaTeX](https://github.com/KaTeX/KaTeX) **v0.18.9** 支持 LaTeX 公式：题目、选项与解析中的 `$...$` 行内公式、`$$...$$` 独立公式
  （离线资源为 `vendor/katex`，版本号唯一来源是 `vendor/katex/VERSION`，构建时注入 `index.html`）
- 主题切换（黑夜模式）。~~你可以在床上背着舍友偷偷内卷了~~
- 支持触屏：左右滑动切换题目
- 数据统计面板（菜单 → 数据统计）：累计答题/正确率/已掌握、近 7 天答题与复习趋势、未来 3 天复习量预测、近 1 周实际 / 未来 1 周预计（复习/新增/预计颜色区分）
- 复习数据随 FSRS 备份导入导出
  - 分享出去的一律是 `.json` 文件；文件分享不可用时降级为 `.json` 下载，Android WebView 连下载都被拦截时才复制 JSON 文本并提示「请粘贴保存为 .json」
- 快捷键
  - 左右箭头 = 切换题目
  - 1-5 = A-E
  - 复习模式下 1-4 = 四档评分；已评分后 1-4 可**改评价**（从原始卡重算，不会越改越长）
- 右下角按钮显示题目导航
- 随机选项排列（菜单 → 设置）：按题干稳定打乱选项顺序，答案仍按原始字母判定，快捷键 1-5 仍对应 A-E
- 计时自动暂停：切后台、提交答案、评分完成后停表；切到未作答的题自动恢复（见下节）

### 适配格式

[示例](doc/示例.md)

### 导入题库的方式（合并入口）

菜单 → 导入题库：

- **文件选择 / 拖放**：选择或拖入 `.md` 题库（支持多选，导入后自动缓存，下次可一键加载）。
- **从剪贴板导入**：先去剪贴板取文本，再自动判定类型——
  - 以 `{` 开头且能解出卡片表（`cards`，或 `kind === "fsrs-cards"`）→ 按 **FSRS 备份**导入
    （校验、覆盖确认与「导入备份」完全一致，字段缺失/类型错误的卡片会被跳过并计数）；
  - 其余内容 → 按 **Markdown 题库**导入（与文件导入走同一条解析/缓存/应用管线）。
  内容为空、Markdown 里没有可解析的题目、JSON 格式无效都会给出明确提示，不会静默失败。
- **导入 FSRS 备份**（复习数据区 →「导入备份」）：与「从剪贴板导入」共用同一个对话框，
  三个动作（选择题库文件 / 从剪贴板导入 / 导入 FSRS 备份）都在一个 `#importFsrsDialog` 里。
- **手动粘贴兜底**：Android WebView 等环境没有 `navigator.clipboard.readText` 权限（或被拒绝、读取超时）时，
  同一对话框切到「手动粘贴」面板，长按粘贴后点「导入」即可——与一键读取汇入同一个导入函数。

## 计时口径与自动暂停

总用时与单题用时都只累计「前台且正在作答」的时间，其余一律不计入：

| 时机 | 行为 |
|---|---|
| 提交答案（刷题 / FSRS） | 立即停表：解析、犹豫的时间不计入本题与总用时 |
| FSRS 评分 / 改评价完成 | 停止计时，下次复习结果可从容阅读 |
| 切到未作答的题 | 恢复计时，从切题那一刻重新起算该题 |
| 切到已作答 / 已评分的题 | 保持暂停（单题用时冻结在原有值） |
| 切后台（锁屏 / 切应用 / 切标签页） | 暂停；回前台时**仅在**「答题区可见且当前题未完成」时恢复 |
| 考试模式 | 不自动停表（允许改答案，且要统计总用时） |

- 停表时时钟数字会弱化显示，表示「计时已暂停」。
- 原生 `appStateChange`（Capacitor）与 Web `document.visibilitychange` 汇入同一个收敛函数，
  两个来源的 pause/resume 都幂等：重复事件不会重复扣时。
- 自动评分取的是**作答瞬间**的用时，因此停表不会影响自动评分的档位。

## 失效卡片判定规则

复习卡以**题干全文**为键（`FsrsStore`，localStorage `fsrs_cards_v1`），因此“失效”只有两种来源，
两者都不影响题库本身，只影响复习进度：

| 来源 | 触发场景 | 处理方式 | 用户可见提示 |
|---|---|---|---|
| a) 字段无效 | 导入备份时某条记录字段缺失或类型错误 | 导入时跳过该条，其余照常写入 | `已导入 N 张卡，跳过 M 条无效数据` |
| b) 孤儿卡 | 换了题库，旧卡的题干在当前题库中找不到**完全一致**的文本 | `FsrsStore.prune(validTexts)` 自动清理 | `已清理 X 张失效卡：题干与当前题库不完全一致` |

判定口径集中在一个函数里（`isValidFsrsCardRecord`），导入与文档共用：

```js
// 有效 = 非数组对象，且 due / stability / state 三者都是 number
const isValidFsrsCardRecord = v =>
    !!v && typeof v === "object" && !Array.isArray(v) &&
    typeof v.due === "number" && typeof v.stability === "number" && typeof v.state === "number";
```

注意几点：

- **只校验类型，不校验取值范围**：`NaN` 也是 `number`，会通过校验（避免把历史遗留数据误判为损坏）。
- **空白字符算不同题干**：键是精确匹配，`心脏位于？` 与 `心脏位于？ `（尾随空格）是两张不同的卡，
  后者会被 prune 当作孤儿清理；所以改题库时不要顺手改动题干里的空格/标点。
- **prune 只按当前题库比对**：`#applyQuestions`（文件导入与缓存加载共用）在应用题库后立即执行，
  比对基准是**过滤后的题集**。因此开启「隐藏已掌握」再导入题库时，被隐藏题目的复习卡也会被当作孤儿清理；
  想保留它们的复习进度，请在关闭「隐藏已掌握」的状态下导入。
- 想彻底清空复习数据，用「重置数据」；想保留但排查问题，先「导出备份」再导入核对跳过条数。
- 规则有单测覆盖：`scripts/fsrs_logic_test.cjs` 的第 3、9 节（判定函数 + prune 语义）。

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
pnpm run test:web                  # DOM 桩冒烟测试：导入/缓存/剪贴板与合并入口/改评价/选项洗牌/计时暂停/分享降级/答题/FSRS 全链路
pnpm run test:fsrs                 # FSRS 调度逻辑与统计口径（含版本号一致性校验）
pnpm run test:fsrs:compare         # 与官方 ts-fsrs 对拍（首次需联网安装到 .tmp-fsrs，仅用于对拍）
```

### 第三方依赖版本

README 里显示的版本号不是手写的装饰，而是由测试守住的单一来源：

| 依赖 | 当前版本 | 唯一来源（改版本只改这里） | 一致性由谁校验 |
|---|---|---|---|
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | **v5.4.2** | `index.html` 的 `FSRS_TS_VERSION` 常量 | `fsrs_logic_test.cjs` 第 10 节（比对 README）；`fsrs_compare.cjs` 第 6 节（比对官方包版本） |
| [KaTeX](https://github.com/KaTeX/KaTeX) | **v0.18.9** | `vendor/katex/VERSION` | `fsrs_logic_test.cjs` 第 10 节（比对 README）；`sync-web.cjs` 注入 `__KATEX_VERSION__` 时校验格式 |
| [Capacitor](https://capacitorjs.com/) | **8.5.2** | `package.json`（`capacitor.config.json` 不写版本） | `sync-web.cjs` 自检 importmap 指向的产物是否齐全 |

Capacitor 是按包各自发版的，`package.json` 里当前声明的版本为：
`@capacitor/core`/`cli`/`android` **8.5.2**、`@capacitor/filesystem` **8.1.3**、`@capacitor/share` **8.0.2**、
`@capacitor/synapse` **1.0.4**、`@capgo/capacitor-share-target` **8.0.54**。
表格里的 8.5.2 指 Capacitor 平台主线（core/cli/android）版本。

`ts-fsrs` 只用于对拍：`FsrsEngine` 是**离线移植**（不含任何 npm 运行时依赖），
对拍脚本会把官方包装进 `.tmp-fsrs/`（已 gitignore），永远不会进 `dist/` 或 APK。

升级步骤：

```powershell
# 1) ts-fsrs：改 index.html 的 FSRS_TS_VERSION → 核对公式/W 常量 → 与官方包对拍
pnpm run test:fsrs:compare

# 2) KaTeX：解压新版 npm 包，把 dist/ 覆盖到 vendor/katex/，并按新版本改写 vendor/katex/VERSION
pnpm run sync:web                  # 剔除未压缩源码 + 注入 __KATEX_VERSION__ → dist/

# 3) Capacitor：改 package.json 里的版本 → 重装 → 重新生成 dist 与原生工程
pnpm install
pnpm run sync:web
```

> npm 缓存不在工作目录时（受限/沙箱环境），对拍安装需显式指定缓存位置：
> `$env:npm_config_cache = "$PWD\.tmp-npm-cache"; pnpm run test:fsrs:compare`

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
