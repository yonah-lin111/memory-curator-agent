import type {
  AiChatMessagePart,
  AiChatSession,
} from "@renderer/features/ai-chat/types";

// AI 对话消息类型。
type AiChatMessage = AiChatSession["messages"][number];

/**
 * appendAiMessageTextPart - 追加流式文本，并同步保留 answer 兼容上下文构造。
 */
export const appendAiMessageTextPart = (
  message: AiChatMessage,
  chunk: string,
): AiChatMessage => {
  const parts = message.parts ?? [];
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
    ...message,
    answer: `${message.answer ?? ""}${chunk}`,
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
  const nextParts: AiChatMessagePart[] =
    lastPart?.kind === "reasoning" && lastPart.id === reasoningId
      ? parts.map((part) =>
          part.id === reasoningId && part.kind === "reasoning"
            ? { ...part, content: `${part.content}${chunk}` }
            : part,
        )
      : [
          ...parts,
          {
            id: reasoningId,
            kind: "reasoning",
            content: chunk,
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
  if (
    message.parts?.some((part) => part.kind === "tool" && part.stepId === stepId)
  ) {
    return message;
  }

  return {
    ...message,
    parts: [
      ...(message.parts ?? []),
      {
        id: `${message.id}-tool-${stepId}`,
        kind: "tool",
        stepId,
      },
    ],
  };
};
