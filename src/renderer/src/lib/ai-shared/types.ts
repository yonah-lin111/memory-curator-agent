// AI 输入框内置命令标识。
export type CuratorInputCommandId = "clear" | "undo" | "model" | "session";

// AI 输入框斜杠命令配置类型。
export interface CuratorInputCommand {
  // 命令唯一标识。
  id: CuratorInputCommandId;
  // 主命令文本。
  name: string;
  // 可匹配的命令别名。
  aliases: string[];
  // 命令显示描述。
  description: string;
  // 是否把命令本身写入对话上下文。
  addToContext: boolean;
}

// Agent mention 面板状态。
export interface AgentMentionPanelState {
  // 触发 @ 在输入文本中的位置。
  start: number;
  // @ 后的查询文本。
  query: string;
}

// @ 文件提及删除范围。
export interface FileMentionDeletionRange {
  start: number;
  end: number;
}

// 已选文本文件条目。
export interface SelectedTextFile {
  // 落盘文件名。
  fileName: string;
  // 协议 URL。
  url: string;
  // 原始文件名。
  originalName: string;
  // 文件大小（字节）。
  sizeBytes: number;
}
