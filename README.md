# Offline-Quiz-Trainer
一个HTML渲染器，用于读取Markdown文件并将其转换为测验。

An HTML renderer that reads Markdown files and converts them into a quiz.

## 它能做什么

最开始的目的是用它刷题度过期末。

如果你的老师也给你了题库，同时你也不愿用市面上的各种过于“重”“花哨”的软件，那么这个网页或许会有帮助。

### 使用说明

- 通过[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)支持了FSRS。

- 通过[KaTeX](https://github.com/KaTeX/KaTeX)支持 LaTeX 公式：题目、选项与解析中的 `$...$` 行内公式、`$$...$$` 独立公式

主题切换（黑夜模式）。~~你可以在床上背着舍友偷偷内卷了~~

- 支持触屏：左右滑动切换题目

- 数据统计面板（菜单 → 数据统计）：累计答题/正确率/已掌握、近 7 天答题与复习趋势、未来 3 天复习量预测、近 1 周实际 / 未来 1 周预计（复习/新增/预计颜色区分），复习数据随 FSRS 备份导入导出

- 快捷键
  - 左右箭头 = 切换题目
  - 1-5 = A-E

- 右下角按钮显示题目导航

### 适配格式

[示例](doc/示例.md)

## 也许会有帮助的链接

- [opendatalab/MinerU](https://github.com/opendatalab/MinerU)，[MinerU官网](https://mineru.net/)
  >MinerU 是一款文档解析工具，可将 PDF、图片以及 DOCX、PPTX、XLSX 转化为机器可读格式（如 Markdown、JSON）

  将各种文件转为Markdown，也许会减少一点你的工作量。

- [业余无线电台操作技术能力验证题库（2025年版）](https://www.crac.org.cn/News/Detail?ID=d11def30d20d4d8fb12e08e7160e607d)

  *这是我在假期重新翻出这个网页的主要目的*

  [B类题库](doc/B类题库_origin.md)这是我处理过的题库，官网 Pdf 虽然能直接导出文字但会有些因排版导致的回车。

## 最后的话

因为我不是计算机专业的，所以难免会有些 bug ，还请见谅。

apk由cordova打包。

## 最后的最后

搁置
- FsrsStore.prune
