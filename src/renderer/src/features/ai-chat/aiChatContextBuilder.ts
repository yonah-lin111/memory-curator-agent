import type {
  AiChatMessage,
  AiModelOption,
  AiModelProviderOption,
  AiModelSelection
} from "@renderer/features/ai-chat/types";

// 运行级异常 assistant 消息正文集合，用于识别不能进入后续上下文的失败 QA。
const RUN_ERROR_ASSISTANT_CONTENTS = new Set([
  "AI chat execution failed",
  "AI chat failed to start",
  "AI bridge is not ready",
]);

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
 * 判断 assistant 消息是否为运行级异常，而不是普通工具失败。
 */
const isRunErrorAssistantMessage = (message: AiChatMessage): boolean => {
  if (message.role !== "assistant") {
    return false;
  }

  return RUN_ERROR_ASSISTANT_CONTENTS.has(message.content.trim());
};

/**
 * 收集需要从 message 上下文中剔除的异常 QA 消息标识。
 */
const collectErroredQaMessageIds = (messages: AiChatMessage[]): Set<string> => {
  const messageIds = new Set<string>();

  for (const [index, message] of messages.entries()) {
    if (!isRunErrorAssistantMessage(message)) {
      continue;
    }

    messageIds.add(message.id);

    const previousMessage = messages[index - 1];
    if (previousMessage?.role === "user") {
      messageIds.add(previousMessage.id);
    }
  }

  return messageIds;
};

/**
 * 序列化工具输入，失败时保留空对象，避免破坏上下文构造。
 */
const stringifyToolInput = (input: unknown): string => {
  try {
    return JSON.stringify(input ?? {});
  } catch {
    return "{}";
  }
};

/**
 * 序列化工具数据，失败时保留错误占位。
 */
const stringifyToolData = (data: unknown): string => {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return JSON.stringify({
      error: "Tool structured data is not serializable",
    });
  }
};

/**
 * 构造历史工具结果上下文正文。
 */
const buildToolContextContent = (observation: string, data: unknown): string => {
  if (data === undefined) {
    return observation;
  }

  return ["Tool observation:", observation, "Tool data:", stringifyToolData(data)].join("\n");
};

/**
 * 从消息列表派生上下文条目。
 */
export const buildMessageContextItems = (
  sessionId: string,
  messages: AiChatMessage[],
): AiChatContextItem[] => {
  const erroredQaMessageIds = collectErroredQaMessageIds(messages);

  return messages.flatMap((message, index) => {
    const content = getMessageContextContent(message);
    const createdAt = index * 1000;
    const shouldSkipMessageContext = erroredQaMessageIds.has(message.id);
    const items: AiChatContextItem[] = [];

    if (message.role === "user" && content && !shouldSkipMessageContext) {
      items.push({
        key: `message:${message.id}`,
        sessionId,
        kind: "message",
        sourceId: message.id,
        title: message.role === "user" ? "用户消息" : "助手回答",
        summary: summarizeContextContent(content),
        content,
        tokens: estimateAiChatContextTokens(content),
        createdAt,
        meta: {
          role: message.role,
          time: message.time,
        },
      });
    }

    if (message.role !== "assistant") {
      return items;
    }

    for (const [toolIndex, step] of (message.toolSteps ?? []).entries()) {
      const observation = step.observation.trim();
      const toolContent = buildToolContextContent(observation, step.data);
      if (step.status !== "done" || !observation) {
        continue;
      }

      items.push({
        key: `tool:${message.id}:${step.id}`,
        sessionId,
        kind: "tool",
        sourceId: step.id,
        title: `Tool result: ${step.tool}`,
        summary: summarizeContextContent(toolContent),
        content: toolContent,
        tokens: estimateAiChatContextTokens(toolContent),
        createdAt: createdAt + toolIndex + 1,
        meta: {
          tool: step.tool,
          messageId: message.id,
          inputJson: stringifyToolInput(step.input),
        },
      });
    }

    if (content && !shouldSkipMessageContext) {
      items.push({
        key: `message:${message.id}`,
        sessionId,
        kind: "message",
        sourceId: message.id,
        title: "助手回答",
        summary: summarizeContextContent(content),
        content,
        tokens: estimateAiChatContextTokens(content),
        createdAt: createdAt + 500,
        meta: {
          role: message.role,
          time: message.time,
        },
      });
    }

    return items;
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
