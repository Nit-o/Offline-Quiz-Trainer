import type { FolderBankFile, FolderImportPlugin, PickFolderOptions, PickFolderResult } from './definitions';

const BANK_RE = /\.(md|markdown|txt)$/i;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Web 端实现：隐藏 <input webkitdirectory> 选择文件夹并读取题库文本。
    应用主流程在 Web 端直接使用页面上的 folderInput（同一管线），
    本实现供插件被独立调用时兜底，行为与 Android 原生端一致。 */
export class FolderImportWeb implements FolderImportPlugin {
  pickFolder(options: PickFolderOptions = {}): Promise<PickFolderResult> {
    const maxFiles = Math.min(Math.max(options.maxFiles ?? 200, 1), 1000);
    return new Promise<PickFolderResult>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.setAttribute('webkitdirectory', '');
      input.style.display = 'none';
      const done = (r: PickFolderResult) => { input.remove(); resolve(r); };
      /* 现代浏览器支持 input 的 cancel 事件；不支持时取消会静默挂起，
         与原生 file input 的普遍行为一致（应用主流程不依赖本实现） */
      input.addEventListener('cancel', () => done({ success: false, cancelled: true }));
      input.addEventListener('change', async () => {
        const all = Array.from(input.files ?? []).filter(f => BANK_RE.test(f.name));
        const files: FolderBankFile[] = [];
        let skipped = 0;
        for (const f of all.slice(0, maxFiles)) {
          if (f.size > MAX_FILE_BYTES) { skipped++; continue; }
          try {
            files.push({ name: f.name, path: f.webkitRelativePath || f.name, text: await f.text() });
          } catch {
            skipped++;
          }
        }
        done({ success: true, files, skipped, truncated: all.length > maxFiles });
      });
      document.body.appendChild(input);
      input.click();
    });
  }
}