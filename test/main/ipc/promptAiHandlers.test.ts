import { describe, expect, it } from "vitest";
import { buildPromptAiAgentMessages } from "@/ipc/promptAiHandlers";
import type { PromptAiChatMessageItem } from "@/services/promptAiPersistenceService";

describe("buildPromptAiAgentMessages", () => {
  it("重建工具历史时保持 tool_use/tool_result 配对并排除当前空 assistant", () => {
    const messages: PromptAiChatMessageItem[] = [
      {
        id: "user-1",
        sessionId: "session-1",
        role: "user",
        content: "读取提示词",
        createdAt: "2026-07-15T10:00:00.000Z",
      },
      {
        id: "assistant-1",
        sessionId: "session-1",
        role: "assistant",
        content: "已读取",
        createdAt: "2026-07-15T10:00:00.000Z",
        toolSteps: [
          {
            id: "tool-1",
            title: "Read",
            tool: "prompt_file_read",
            status: "done",
            input: { path: "prompt.md" },
            observation: "读取成功",
            data: { content: "旧提示词" },
          },
        ],
      },
      {
        id: "user-2",
        sessionId: "session-1",
        role: "user",
        content: "继续优化",
        createdAt: "2026-07-15T10:01:00.000Z",
      },
      {
        id: "assistant-2",
        sessionId: "session-1",
        role: "assistant",
        content: "",
        createdAt: "2026-07-15T10:01:00.000Z",
      },
    ];

    const rebuilt = buildPromptAiAgentMessages(messages, "assistant-2");
    const assistantWithTools = rebuilt.find(
      (message) => message.role === "assistant" && message.toolCalls,
    );
    const toolResults = rebuilt.filter((message) => message.role === "tool");

    expect(rebuilt.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "user",
    ]);
    expect(assistantWithTools?.toolCalls?.map((call) => call.id)).toEqual([
      "tool-1",
    ]);
    expect(toolResults.map((message) => message.toolCallId)).toEqual([
      "tool-1",
    ]);
    expect(rebuilt.some((message) => message.content === "")).toBe(false);
  });

  it("丢弃无效和重复工具步骤，避免孤立 tool 结果", () => {
    const messages: PromptAiChatMessageItem[] = [
      {
        id: "assistant-1",
        sessionId: "session-1",
        role: "assistant",
        content: "结果",
        createdAt: "2026-07-15T10:00:00.000Z",
        toolSteps: [
          {
            id: "tool-1",
            title: "Read",
            tool: "prompt_file_read",
            status: "done",
            input: {},
            observation: "成功",
            data: null,
          },
          {
            id: "tool-1",
            title: "Duplicate",
            tool: "prompt_file_read",
            status: "done",
            input: {},
            observation: "重复",
            data: null,
          },
          {
            id: "",
            title: "Invalid",
            tool: "prompt_file_read",
            status: "done",
            input: {},
            observation: "无效",
            data: null,
          },
        ],
      },
    ];

    const rebuilt = buildPromptAiAgentMessages(messages, "current-assistant");

    expect(rebuilt.filter((message) => message.role === "tool")).toHaveLength(1);
    expect(rebuilt.find((message) => message.role === "assistant")?.toolCalls).toHaveLength(1);
  });
});
