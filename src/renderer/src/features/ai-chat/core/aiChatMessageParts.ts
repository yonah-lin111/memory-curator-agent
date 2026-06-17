import type {
  AiChatMessagePart,
  AiChatSession,
} from "@/features/ai-chat/types";

// AI 对话消息类型。
type AiChatMessage = AiChatSession["messages"][number];

/**
 * resolveReasoningSourceId - 获取 reasoning 片段对应的上游事件标识。
 */
const resolveReasoningSourceId = (
  part: Extract<AiChatMessagePart, { kind: "reasoning" }>,
): string => part.sourceId ?? part.id;

/**
 * resolveNextReasoningPartId - 生成不会与历史片段冲突的 UI 片段标识。
 */
const resolveNextReasoningPartId = (
  message: AiChatMessage,
  parts: AiChatMessagePart[],
  reasoningId: string,
): string => {
  const scopedId = `${message.id}-${reasoningId}`;

  if (!parts.some((part) => part.id === scopedId)) {
    return scopedId;
  }

  return `${message.id}-reasoning-${parts.length}`;
};

/**
 * completeAiMessageReasoningParts - 将仍在流式输出的思考片段标记为完成。
 */
export const completeAiMessageReasoningParts = (
  message: AiChatMessage,
): AiChatMessage => {
  if (!message.parts?.some((part) => part.kind === "reasoning")) {
    return message;
  }

  return {
    ...message,
    parts: message.parts.map((part) =>
      part.kind === "reasoning" && part.status !== "done"
        ? { ...part, status: "done" }
        : part,
    ),
  };
};

/**
 * appendAiMessageTextPart - 追加流式文本，并同步保留 answer 兼容上下文构造。
 */
export const appendAiMessageTextPart = (
  message: AiChatMessage,
  chunk: string,
): AiChatMessage => {
  const completedMessage = completeAiMessageReasoningParts(message);
  const parts = completedMessage.parts ?? [];
  const lastPart = parts[parts.length - 1];
  const nextParts: AiChatMessagePart[] =
    lastPart?.kind === "text"
      ? parts.map((part) =>
          part.id === lastPart.id && part.kind === "text"
            ? { ...part, content: `${part.content}${chunk}` }
            : part,
        )
      : [
          ...parts,
          {
            id: `${message.id}-text-${parts.length}`,
            kind: "text",
            content: chunk,
          },
        ];

  return {
    ...completedMessage,
    answer: `${completedMessage.answer ?? ""}${chunk}`,
    parts: nextParts,
  };
};

/**
 * appendAiMessageReasoningPart - 追加流式思考内容，并避免污染最终回答。
 */
export const appendAiMessageReasoningPart = (
  message: AiChatMessage,
  reasoningId: string,
  chunk: string,
): AiChatMessage => {
  const parts = message.parts ?? [];
  const lastPart = parts[parts.length - 1];
  const isContinuingLastReasoning =
    lastPart?.kind === "reasoning" &&
    resolveReasoningSourceId(lastPart) === reasoningId;
  const nextPartId = isContinuingLastReasoning
    ? lastPart.id
    : resolveNextReasoningPartId(message, parts, reasoningId);
  const nextParts: AiChatMessagePart[] = isContinuingLastReasoning
    ? parts.map((part) =>
        part.kind === "reasoning"
          ? part.id === nextPartId
            ? {
                ...part,
                content: `${part.content}${chunk}`,
                status: "streaming",
              }
            : { ...part, status: "done" }
          : part,
      )
    : [
        ...parts.map((part) =>
          part.kind === "reasoning" ? { ...part, status: "done" as const } : part,
        ),
        {
          id: nextPartId,
          sourceId: nextPartId === reasoningId ? undefined : reasoningId,
          kind: "reasoning",
          content: chunk,
          status: "streaming",
        },
      ];

  return {
    ...message,
    parts: nextParts,
  };
};

/**
 * appendAiMessageToolPart - 追加工具片段，避免重试时工具块被整体前置。
 */
export const appendAiMessageToolPart = (
  message: AiChatMessage,
  stepId: string,
): AiChatMessage => {
  const completedMessage = completeAiMessageReasoningParts(message);

  if (
    completedMessage.parts?.some(
      (part) => part.kind === "tool" && part.stepId === stepId,
    )
  ) {
    return completedMessage;
  }

  return {
    ...completedMessage,
    parts: [
      ...(completedMessage.parts ?? []),
      {
        id: `${message.id}-tool-${stepId}`,
        kind: "tool",
        stepId,
      },
    ],
  };
};
