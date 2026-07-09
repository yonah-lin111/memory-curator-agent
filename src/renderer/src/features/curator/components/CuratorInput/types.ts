import type { CuratorModelProviderOption, CuratorModelSelection, CuratorSession } from "@/features/curator/types";
import type { CuratorSendPayload } from "@/features/curator/curatorAgentMentions";

// 重导出共享类型，并导入到本文件作用域供 CuratorInputProps 使用。
import type { CuratorInputCommandId, CuratorInputCommand, AgentMentionPanelState, SelectedTextFile } from "@/lib/ai-shared/types";
export type { CuratorInputCommandId, CuratorInputCommand, AgentMentionPanelState, SelectedTextFile };

// AI 对话输入框组件属性类型。
export interface CuratorInputProps {
  // 当前激活的会话 ID。
  sessionId?: string;
  // 可切换的 AI provider 与模型列表。
  modelOptions: CuratorModelProviderOption[];
  // 当前选中的 AI provider 与模型。
  selectedModel: CuratorModelSelection | null;
  // 当前模型上下文使用百分比。
  contextUsagePercent: number | null;
  // 当前上下文 token 估算。
  contextTokens: number;
  // 当前模型上下文窗口上限。
  contextLimit?: number;
  // 是否正在生成 AI 输出。
  isGenerating?: boolean;
  // 发送消息回调。
  onSendMessage: (payload: CuratorSendPayload) => void;
  // 执行输入框斜杠命令回调。
  onCommandExecute: (
    command: CuratorInputCommandId,
  ) => string | void | Promise<string | void>;
  // AI 模型切换回调。
  onModelChange: (selection: CuratorModelSelection) => void;
  // AI 会话列表。
  chatSessions?: CuratorSession[];
  // AI 激活会话切换回调。
  onActiveSessionChange?: (sessionId: string) => void;
  // 是否还有更多会话。
  hasMoreChatSessions?: boolean;
  // 是否正在加载更多会话。
  isLoadingMoreChatSessions?: boolean;
  // 加载更多历史会话回调。
  onLoadMoreChatSessions?: () => Promise<void>;
  // 外部注入的输入文本（如取消生成后回显提示词），消费后应调用 onInjectedTextConsumed 清空。
  injectedText?: string;
  // 注入文本消费完成回调。
  onInjectedTextConsumed?: () => void;
}
