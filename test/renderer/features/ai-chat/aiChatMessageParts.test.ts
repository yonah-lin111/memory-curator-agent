import { describe, expect, it } from "vitest";
import {
  appendAiMessageReasoningPart,
  appendAiMessageTextPart,
  appendAiMessageToolPart,
} from "@renderer/features/ai-chat/core/aiChatMessageParts";
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
        status: "streaming",
      },
    ]);
  });

  it("追加正文时立即结束前一个 reasoning 片段", () => {
    const message: AiChatMessage = {
      id: "a2",
      role: "assistant",
      content: 'Processing: "分析一下"',
      time: "12:01",
      parts: [],
    };

    const nextMessage = appendAiMessageTextPart(
      appendAiMessageReasoningPart(message, "reasoning-1", "先拆问题。"),
      "最终回答。",
    );

    expect(nextMessage.parts).toEqual([
      {
        id: "reasoning-1",
        kind: "reasoning",
        content: "先拆问题。",
        status: "done",
      },
      {
        id: "a2-text-1",
        kind: "text",
        content: "最终回答。",
      },
    ]);
  });

  it("追加工具时立即结束前一个 reasoning 片段", () => {
    const message: AiChatMessage = {
      id: "a3",
      role: "assistant",
      content: 'Processing: "查一下"',
      time: "12:02",
      parts: [],
    };

    const nextMessage = appendAiMessageToolPart(
      appendAiMessageReasoningPart(message, "reasoning-1", "先查库。"),
      "tool-1",
    );

    expect(nextMessage.parts).toEqual([
      {
        id: "reasoning-1",
        kind: "reasoning",
        content: "先查库。",
        status: "done",
      },
      {
        id: "a3-tool-tool-1",
        kind: "tool",
        stepId: "tool-1",
      },
    ]);
  });
});
