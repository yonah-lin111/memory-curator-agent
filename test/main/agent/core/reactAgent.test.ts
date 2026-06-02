import { describe, expect, it, vi } from "vitest";
import { runReactAgent } from "../../../../src/main/agent/core/reactAgent";
import type {
  AgentTool,
  ModelProvider,
  ModelTurnInput,
} from "../../../../src/main/agent/types";

describe("reactAgent", () => {
  it("执行模型请求的工具并把观察结果回灌到下一轮", async () => {
    const providerInputs: ModelTurnInput[] = [];
    const provider: ModelProvider = {
      id: "fake",
      type: "openai-compatible",
      streamTurn: async function* (input) {
        providerInputs.push(input);

        if (providerInputs.length === 1) {
          yield {
            type: "tool_call_done",
            id: "call-1",
            name: "people_query",
            argumentsText: '{"query":"阿明"}',
          };
          yield {
            type: "done",
          };
          return;
        }

        yield {
          type: "text_delta",
          delta: "阿明是朋友。",
        };
        yield {
          type: "done",
        };
      },
    };
    const peopleTool: AgentTool = {
      name: "people_query",
      description: "查询 People 表",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => ({
        observation: "找到 1 位关联人物：阿明｜朋友｜技术狂热者",
        data: [
          {
            name: "阿明",
            details: "# 阿明\n完整详情",
          },
        ],
      }),
    };

    const events = await Array.fromAsync(
      runReactAgent({
        provider,
        model: "fake-model",
        messages: [
          {
            role: "user",
            content: "阿明是谁",
          },
        ],
        tools: [peopleTool],
        maxTurns: 3,
      }),
    );

    expect(events.map((event) => event.type)).toEqual([
      "run_started",
      "tool_started",
      "tool_finished",
      "turn_finished",
      "assistant_message_started",
      "text_delta",
      "turn_finished",
      "done",
    ]);
    expect(providerInputs).toHaveLength(2);
    expect(providerInputs[1].messages.at(-1)).toMatchObject({
      role: "tool",
      toolCallId: "call-1",
      name: "people_query",
    });
    expect(providerInputs[1].messages.at(-1)?.content).toContain(
      "找到 1 位关联人物：阿明｜朋友｜技术狂热者",
    );
    expect(providerInputs[1].messages.at(-1)?.content).toContain(
      '"details": "# 阿明\\n完整详情"',
    );
  });

  it("ask 工具等待用户回答后在同一个 run 内继续执行", async () => {
    const providerInputs: ModelTurnInput[] = [];
    const provider: ModelProvider = {
      id: "fake",
      type: "openai-compatible",
      streamTurn: async function* (input) {
        providerInputs.push(input);

        if (providerInputs.length > 1) {
          expect(input.messages.at(-1)).toMatchObject({
            role: "tool",
            toolCallId: "call-ask",
            name: "ask_user",
          });
          expect(input.messages.at(-1)?.content).toContain(
            "User has answered your clarification questions",
          );
          expect(input.messages.at(-1)?.content).toContain("当前项目");
          yield {
            type: "text_delta",
            delta: "继续执行。",
          };
          yield {
            type: "done",
          };
          return;
        }

        yield {
          type: "tool_call_done",
          id: "call-ask",
          name: "ask_user",
          argumentsText: "{}",
        };
        yield {
          type: "done",
        };
      },
    };
    const askTool: AgentTool = {
      name: "ask_user",
      description: "提问",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => ({
        observation: "Ask request created: waiting for the user.",
        data: {
          kind: "ask_request",
          id: "ask-1",
          questions: [
            {
              header: "范围",
              question: "改哪里？",
              options: [
                {
                  label: "当前项目",
                  description: "只改当前项目。",
                },
              ],
            },
          ],
        },
      }),
    };
    const askAnswerProvider = vi.fn(async () => ({
      kind: "ask_answer" as const,
      id: "ask-1",
      answers: [
        {
          question: "改哪里？",
          answers: ["当前项目"],
        },
      ],
    }));

    const events = await Array.fromAsync(
      runReactAgent({
        provider,
        model: "fake-model",
        messages: [
          {
            role: "user",
            content: "帮我做个东西",
          },
        ],
        tools: [askTool],
        askAnswerProvider,
        maxTurns: 3,
      }),
    );

    expect(events.map((event) => event.type)).toEqual([
      "run_started",
      "tool_started",
      "tool_finished",
      "tool_finished",
      "turn_finished",
      "assistant_message_started",
      "text_delta",
      "turn_finished",
      "done",
    ]);
    expect(askAnswerProvider).toHaveBeenCalledTimes(1);
    expect(providerInputs).toHaveLength(2);
  });

  it("当模型流丢失工具名且只有一个授权工具时使用唯一工具兜底", async () => {
    let turnCount = 0;
    const provider: ModelProvider = {
      id: "fake",
      type: "openai-compatible",
      streamTurn: async function* () {
        turnCount += 1;
        if (turnCount > 1) {
          yield {
            type: "text_delta",
            delta: "查询完成。",
          };
          yield {
            type: "done",
          };
          return;
        }

        yield {
          type: "tool_call_done",
          id: "call-1",
          name: "",
          argumentsText: "{}",
        };
        yield {
          type: "done",
        };
      },
    };
    const peopleTool: AgentTool = {
      name: "people_query",
      description: "查询 People 表",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => ({
        observation: "找到 0 位关联人物",
        data: [],
      }),
    };

    const events = await Array.fromAsync(
      runReactAgent({
        provider,
        model: "fake-model",
        messages: [
          {
            role: "user",
            content: "查一下人物",
          },
        ],
        tools: [peopleTool],
        maxTurns: 2,
      }),
    );

    expect(events).toContainEqual({
      type: "tool_started",
      id: "call-1",
      name: "people_query",
      input: {},
    });
  });

  it("透传模型 reasoning 增量且不触发助手正文开始事件", async () => {
    const provider: ModelProvider = {
      id: "fake",
      type: "openai-compatible",
      streamTurn: async function* () {
        yield {
          type: "reasoning_delta",
          id: "reasoning-1",
          delta: "先拆问题。",
        };
        yield {
          type: "text_delta",
          delta: "最终回答。",
        };
        yield {
          type: "done",
        };
      },
    };

    const events = await Array.fromAsync(
      runReactAgent({
        provider,
        model: "fake-model",
        messages: [
          {
            role: "user",
            content: "分析一下",
          },
        ],
        tools: [],
      }),
    );

    expect(events).toEqual([
      {
        type: "run_started",
      },
      {
        type: "reasoning_delta",
        id: "reasoning-1",
        delta: "先拆问题。",
      },
      {
        type: "assistant_message_started",
      },
      {
        type: "text_delta",
        delta: "最终回答。",
      },
      {
        type: "turn_finished",
      },
      {
        type: "done",
      },
    ]);
  });

  it("工具参数为空或 undefined 文本时按空对象处理", async () => {
    const toolInputs: unknown[] = [];
    let turnCount = 0;
    const provider: ModelProvider = {
      id: "fake",
      type: "openai-compatible",
      streamTurn: async function* () {
        turnCount += 1;
        if (turnCount > 1) {
          yield {
            type: "text_delta",
            delta: "查询完成。",
          };
          yield {
            type: "done",
          };
          return;
        }

        yield {
          type: "tool_call_done",
          id: "call-1",
          name: "people_query",
          argumentsText: "undefined",
        };
        yield {
          type: "done",
        };
      },
    };
    const peopleTool: AgentTool = {
      name: "people_query",
      description: "查询 People 表",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async (input) => {
        toolInputs.push(input);

        return {
          observation: "SQL query returned 1 row.",
          data: {
            rows: [{ count: 2 }],
            items: [],
          },
        };
      },
    };

    await Array.fromAsync(
      runReactAgent({
        provider,
        model: "fake-model",
        messages: [
          {
            role: "user",
            content: "查询一下人物有多少个",
          },
        ],
        tools: [peopleTool],
        maxTurns: 2,
      }),
    );

    expect(toolInputs).toEqual([{}]);
  });

  it("工具执行失败时把错误作为工具结果回灌并允许模型再次调用", async () => {
    const providerInputs: ModelTurnInput[] = [];
    let toolAttempts = 0;
    const provider: ModelProvider = {
      id: "fake",
      type: "openai-compatible",
      streamTurn: async function* (input) {
        providerInputs.push(input);

        if (providerInputs.length === 1) {
          yield {
            type: "tool_call_done",
            id: "call-1",
            name: "people_query",
            argumentsText: '{"query":"阿明"}',
          };
          yield {
            type: "done",
          };
          return;
        }

        if (providerInputs.length === 2) {
          expect(input.messages.at(-1)).toMatchObject({
            role: "tool",
            toolCallId: "call-1",
            name: "people_query",
          });
          expect(input.messages.at(-1)?.content).toContain(
            "Tool people_query execution failed",
          );
          expect(input.messages.at(-1)?.content).toContain("数据库暂时不可用");

          yield {
            type: "tool_call_done",
            id: "call-2",
            name: "people_query",
            argumentsText: '{"query":"阿明","retry":true}',
          };
          yield {
            type: "done",
          };
          return;
        }

        yield {
          type: "text_delta",
          delta: "重试后查到了阿明。",
        };
        yield {
          type: "done",
        };
      },
    };
    const peopleTool: AgentTool = {
      name: "people_query",
      description: "查询 People 表",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        toolAttempts += 1;

        if (toolAttempts === 1) {
          throw new Error("数据库暂时不可用");
        }

        return {
          observation: "找到 1 位关联人物：阿明",
          data: [{ name: "阿明" }],
        };
      },
    };

    const events = await Array.fromAsync(
      runReactAgent({
        provider,
        model: "fake-model",
        messages: [
          {
            role: "user",
            content: "阿明是谁",
          },
        ],
        tools: [peopleTool],
        maxTurns: 3,
      }),
    );

    expect(events.map((event) => event.type)).toEqual([
      "run_started",
      "tool_started",
      "tool_failed",
      "turn_finished",
      "tool_started",
      "tool_finished",
      "turn_finished",
      "assistant_message_started",
      "text_delta",
      "turn_finished",
      "done",
    ]);
    expect(toolAttempts).toBe(2);
    expect(providerInputs).toHaveLength(3);
  });

  it("工具失败回灌必须明确要求模型先修正参数并重试", async () => {
    let toolAttempts = 0;
    const provider: ModelProvider = {
      id: "fake",
      type: "openai-compatible",
      streamTurn: async function* (input) {
        if (toolAttempts === 0) {
          yield {
            type: "tool_call_done",
            id: "call-1",
            name: "people_query",
            argumentsText: '{"sql":"SELECT * FROM nonexistent_table"}',
          };
          yield {
            type: "done",
          };
          return;
        }

        const lastMessageContent = input.messages.at(-1)?.content ?? "";
        if (
          lastMessageContent.includes(
            "Fix the arguments and call the tool again first",
          )
        ) {
          yield {
            type: "tool_call_done",
            id: "call-2",
            name: "people_query",
            argumentsText: '{"sql":"SELECT * FROM associated_people LIMIT 5"}',
          };
          yield {
            type: "done",
          };
          return;
        }

        yield {
          type: "text_delta",
          delta: "工具报错后不会重试。",
        };
        yield {
          type: "done",
        };
      },
    };
    const peopleTool: AgentTool = {
      name: "people_query",
      description: "查询 People 表",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        toolAttempts += 1;

        if (toolAttempts === 1) {
          throw new Error(
            "People SQL can only query the associated_people table",
          );
        }

        return {
          observation: "SQL query returned 1 row.",
          data: [{ id: 1, name: "阿明" }],
        };
      },
    };

    const events = await Array.fromAsync(
      runReactAgent({
        provider,
        model: "fake-model",
        messages: [
          {
            role: "user",
            content: "调用你工具，传递错误的参数",
          },
        ],
        tools: [peopleTool],
        maxTurns: 3,
      }),
    );

    expect(events.map((event) => event.type)).toContain("tool_finished");
    expect(toolAttempts).toBe(2);
  });

  it("普通闲聊不会向模型注入不相关工具", async () => {
    const providerInputs: ModelTurnInput[] = [];
    const provider: ModelProvider = {
      id: "fake",
      type: "openai-compatible",
      streamTurn: async function* (input) {
        providerInputs.push(input);
        yield {
          type: "text_delta",
          delta: "你好。",
        };
        yield {
          type: "done",
        };
      },
    };
    const peopleTool: AgentTool = {
      name: "people_query",
      description: "查询 People 表",
      prompt: {
        summary: "查询本地 People 表。",
        intentKeywords: ["人物", "关系"],
        whenToUse: ["用户询问人物关系时使用。"],
      },
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => ({
        observation: "找到 0 位关联人物",
        data: [],
      }),
    };

    await Array.fromAsync(
      runReactAgent({
        provider,
        model: "fake-model",
        messages: [
          {
            role: "user",
            content: "你好",
          },
        ],
        tools: [peopleTool],
        maxTurns: 1,
      }),
    );

    expect(providerInputs[0].tools).toEqual([]);
  });
});
