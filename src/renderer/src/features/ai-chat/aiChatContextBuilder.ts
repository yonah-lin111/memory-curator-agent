import type {
  AiChatMessage,
  AiModelOption,
  AiModelProviderOption,
  AiModelSelection
} from "@renderer/features/ai-chat/aiChatMock";

// AI 对话上下文来源类型。
export type AiChatContextKind = "message" | "memory" | "page" | "file" | "tool" | "agent";

// AI 对话上下文元信息类型。
export type AiChatContextMeta = Record<string, string | number | boolean | undefined>;

// AI 对话上下文条目类型。
export type AiChatContextItem = {
  // 上下文稳定去重键。
  key: string;
  // 所属 AI 会话标识。
  sessionId: string;
  // 上下文来源类型。
  kind: AiChatContextKind;
  // 来源对象标识。
  sourceId: string;
  // 展示标题。
  title: string;
  // 展示摘要。
  summary: string;
  // 参与后续 Agent 请求构造的正文。
  content: string;
  // 估算 token 数。
  tokens: number;
  // 创建时间戳。
  createdAt: number;
  // 来源相关补充信息。
  meta: AiChatContextMeta;
};

// AI 对话上下文预算输入类型。
type AiChatContextBudgetInput = {
  // 当前上下文条目列表。
  items: AiChatContextItem[];
  // 可用模型选项。
  modelOptions: AiModelProviderOption[];
  // 当前模型选择。
  selectedModel: AiModelSelection | null;
};

// AI 对话上下文预算类型。
export type AiChatContextBudget = {
  // 上下文总 token 估算。
  totalTokens: number;
  // 当前模型上下文窗口上限。
  contextLimit?: number;
  // 当前模型输出上限。
  outputLimit?: number;
  // 上下文窗口占比。
  usagePercent: number | null;
};

/**
 * 估算 AI 对话上下文 token 数。
 */
export const estimateAiChatContextTokens = (content: string): number => {
  const trimmed = content.trim();
  if (!trimmed) {
    return 0;
  }

  return Math.ceil(trimmed.length / 4);
};

/**
 * 截断上下文摘要，避免 UI 被长文本撑开。
 */
const summarizeContextContent = (content: string): string => {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length <= 80) {
    return normalized;
  }

  return `${normalized.slice(0, 80)}...`;
};

/**
 * 从单条消息中提取可进入上下文的正文。
 */
const getMessageContextContent = (message: AiChatMessage): string => {
  if (message.role === "assistant" && message.answer?.trim()) {
    return message.answer.trim();
  }

  return message.content.trim();
};

/**
 * 从消息列表派生上下文条目。
 */
export const buildMessageContextItems = (
  sessionId: string,
  messages: AiChatMessage[],
): AiChatContextItem[] => {
  return messages.flatMap((message, index) => {
    const content = getMessageContextContent(message);
    if (!content) {
      return [];
    }

    return [
      {
        key: `message:${message.id}`,
        sessionId,
        kind: "message",
        sourceId: message.id,
        title: message.role === "user" ? "用户消息" : "助手回答",
        summary: summarizeContextContent(content),
        content,
        tokens: estimateAiChatContextTokens(content),
        createdAt: index,
        meta: {
          role: message.role,
          time: message.time,
        },
      },
    ];
  });
};

/**
 * 查找当前选中模型的完整配置。
 */
export const resolveAiChatSelectedModelOption = (
  modelOptions: AiModelProviderOption[],
  selectedModel: AiModelSelection | null,
): AiModelOption | undefined => {
  if (!selectedModel) {
    return undefined;
  }

  return modelOptions
    .find((provider) => provider.id === selectedModel.provider)
    ?.models.find((model) => model.id === selectedModel.model);
};

/**
 * 计算当前上下文预算。
 */
export const getAiChatContextBudget = ({
  items,
  modelOptions,
  selectedModel,
}: AiChatContextBudgetInput): AiChatContextBudget => {
  const totalTokens = items.reduce((sum, item) => sum + item.tokens, 0);
  const model = resolveAiChatSelectedModelOption(modelOptions, selectedModel);
  const contextLimit = model?.limit?.context;

  return {
    totalTokens,
    contextLimit,
    outputLimit: model?.limit?.output,
    usagePercent: contextLimit ? Math.round((totalTokens / contextLimit) * 100) : null,
  };
};
