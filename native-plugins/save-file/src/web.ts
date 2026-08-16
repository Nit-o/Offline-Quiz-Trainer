import type { SaveFileOptions, SaveFilePlugin, SaveFileResult } from './definitions';

/** Web 端实现：触发浏览器下载（非原生环境兜底，与 Android 行为等价） */
export class SaveFileWeb implements SaveFilePlugin {
  async saveFile(options: SaveFileOptions): Promise<SaveFileResult> {
    const blob = new Blob([options.content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return { success: true };
  }
}
