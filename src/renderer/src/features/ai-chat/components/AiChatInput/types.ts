import type { AiModelProviderOption, AiModelSelection } from "@/features/ai-chat/types";
import type { AiChatSendPayload } from "@/features/ai-chat/aiChatAgentMentions";

// AI 输入框内置命令标识。
export type AiChatInputCommandId = "clear" | "undo" | "model";

// AI 输入框斜杠命令配置类型。
export interface AiChatInputCommand {
  // 命令唯一标识。
  id: AiChatInputCommandId;
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

// AI 对话输入框组件属性类型。
export interface AiChatInputProps {
  // 可切换的 AI provider 与模型列表。
  modelOptions: AiModelProviderOption[];
  // 当前选中的 AI provider 与模型。
  selectedModel: AiModelSelection | null;
  // 当前模型上下文使用百分比。
  contextUsagePercent: number | null;
  // 当前上下文 token 估算。
  contextTokens: number;
  // 当前模型上下文窗口上限。
  contextLimit?: number;
  // 是否正在生成 AI 输出。
  isGenerating?: boolean;
  // 发送消息回调。
  onSendMessage: (payload: AiChatSendPayload) => void;
  // 执行输入框斜杠命令回调。
  onCommandExecute: (
    command: AiChatInputCommandId,
  ) => string | void | Promise<string | void>;
  // AI 模型切换回调。
  onModelChange: (selection: AiModelSelection) => void;
}
