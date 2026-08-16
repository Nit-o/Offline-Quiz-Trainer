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
node scripts/patch-android.cjs                # 应用平台补丁（minSdk=33 / 分享目标 / 国内镜像 / build-tools 兜底）
pnpm run cap sync android                     # 同步 web 资源与插件
node scripts/patch-android.cjs                # sync 会重生成插件工程，再跑一次补丁（幂等）

cd android
$env:JAVA_HOME = "D:\JDK\jdk-21.0.2"        # 示例；按本机 JDK 21 路径设置
.gradlew.bat assembleDebug                   # 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

> 镜像：patch-android.cjs 默认将 Gradle 发行包切腾讯镜像、Maven 切阿里云/腾讯镜像；外网正常可设 `CAP_MIRRORS=off` 用官方源。

## Web 环境说明

- **浏览器直开（file:// 或任意静态托管）**：页面主逻辑（题库导入/训练/主题/KaTeX/FSRS）完整可用；
  Capacitor 原生桥按环境自动降级（与 Cordova 时代的 `window.NativeShare` 检测模式一致），原生分享/保存功能自动隐藏。
- **APK（Android WebView，https://localhost）**：额外启用原生能力 —— 系统分享导出备份、系统文档选择器保存、
  接收其他应用「分享」的 .md/.txt/.json 题库直接导入。

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
- FsrsStore.prune
