/* 内联模块脚本的全局声明（供 tsc --checkJs 使用）。
   index.html 是单文件应用，既不是 .ts 也没有 npm 包来承载这些声明，故单独放一份最小声明，
   只描述代码真正用到的部分——目的是让类型检查聚焦真实问题，而不是淹没在环境缺口里。 */

/** Capacitor 原生桥（由 index.html 内的加载 IIFE 挂到 globalThis） */
interface CapacitorBridgeShape {
    isNative(): boolean;
    ready: Promise<unknown>;
    Share: any;
    Filesystem: any;
    Directory: any;
    Encoding: any;
    CapacitorShareTarget: any;
    SaveFile: any;
    /** @capacitor/app（可选增强：返回键） */
    App: any;
}
declare var CapacitorBridge: CapacitorBridgeShape;
/** 同名 interface 与上面的 var 声明合并，使 globalThis.CapacitorBridge 也通过类型检查 */
interface CapacitorBridge extends CapacitorBridgeShape {}

interface Window {
    /** KaTeX auto-render（vendor/katex/contrib/auto-render.min.js 注入） */
    renderMathInElement?: (el: Element, opts: Record<string, unknown>) => void;
    /** File System Access API（桌面 Chromium） */
    showSaveFilePicker?: (opts: Record<string, unknown>) => Promise<any>;
}

interface ActiveElement {
    isContentEditable: boolean;
}
