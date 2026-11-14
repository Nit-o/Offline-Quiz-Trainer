export interface FolderBankFile {
  /** 文件名（含扩展名） */
  name: string;
  /** 相对所选文件夹根目录的路径（POSIX 分隔），用于区分不同子文件夹里的同名文件 */
  path: string;
  /** UTF-8 文本内容 */
  text: string;
}

export interface PickFolderOptions {
  /** 最多返回的题库文件数（默认 200；原生端上限 1000） */
  maxFiles?: number;
}

export interface PickFolderResult {
  success: boolean;
  /** 用户在系统文件夹选择器中取消时为 true */
  cancelled?: boolean;
  /** 所选文件夹的显示名（用于缓存命名前缀） */
  folderName?: string;
  /** 读到的题库文件（.md / .markdown / .txt），按路径排序由调用方负责 */
  files?: FolderBankFile[];
  /** 因超大（>2MB）或读取失败而被跳过的文件数 */
  skipped?: number;
  /** 题库文件数超出 maxFiles 被截断时为 true */
  truncated?: boolean;
}

export interface FolderImportPlugin {
  /** 调起系统文件夹选择器，递归读取其中的题库文本文件 */
  pickFolder(options?: PickFolderOptions): Promise<PickFolderResult>;
}