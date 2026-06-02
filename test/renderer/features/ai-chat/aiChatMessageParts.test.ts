import { describe, expect, it } from "vitest";
import { appendAiMessageReasoningPart } from "@renderer/features/ai-chat/core/aiChatMessageParts";
import type { AiChatMessage } from "@renderer/features/ai-chat/types";

describe("aiChatMessageParts", () => {
  it("追加 reasoning 片段时合并连续同 ID 增量且不污染 answer", () => {
    const message: AiChatMessage = {
      id: "a1",
      role: "assistant",
      content: 'Processing: "分析一下"',
      time: "12:00",
      answer: "已有正文",
      parts: [],
    };

    const nextMessage = appendAiMessageReasoningPart(
      appendAiMessageReasoningPart(message, "reasoning-1", "先拆"),
      "reasoning-1",
      "问题。",
    );

    expect(nextMessage.answer).toBe("已有正文");
    expect(nextMessage.parts).toEqual([
      {
        id: "reasoning-1",
        kind: "reasoning",
        content: "先拆问题。",
      },
    ]);
  });
});
