export interface SaveFileOptions {
  /** 系统文档选择器标题（Android ACTION_CREATE_DOCUMENT 的 UI 标题） */
  title?: string;
  /** 建议文件名，如 backup-2026-08-07.json */
  fileName: string;
  /** 文件内容（UTF-8 文本） */
  content: string;
}

export interface SaveFileResult {
  success: boolean;
  /** 成功时返回 content:// URI（Android） */
  uri?: string;
  /** 用户取消保存时为 true */
  cancelled?: boolean;
}

export interface SaveFilePlugin {
  /** 调起系统文档选择器，将 content 保存为用户选择的文件 */
  saveFile(options: SaveFileOptions): Promise<SaveFileResult>;
}
