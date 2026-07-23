import { ipcMain } from "electron"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { runReactAgent } from "@/agent/core/reactAgent"
import { createModelProvider } from "@/agent/providers/providerFactory"
import { getDatabase } from "@/db"
import {
  createModelOptionsResponse,
  createSystemPrompt,
  parseSuggestedQuestions,
  registerAiHandlers,
  trimSuggestedQuestionContext,
} from "@/ipc/aiHandlers"
import { createAiChatPersistenceService } from "@/services/aiChatPersistenceService"

// 无连接符 UUID 形态。
const UUID_PATTERN = /^[\da-f]{32}$/i

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}))

vi.mock("../../../src/main/db", () => ({
  getDatabase: vi.fn(),
}))

vi.mock("../../../src/main/services/aiChatPersistenceService", () => ({
  createAiChatPersistenceService: vi.fn(),
}))

vi.mock("../../../src/main/agent/providers/providerFactory", () => ({
  createModelProvider: vi.fn(),
}))

vi.mock("../../../src/main/agent/core/reactAgent", () => ({
  runReactAgent: vi.fn(),
}))

vi.mock("../../../src/main/agent/providers/providerConfig", async (importOriginal) => ({
  ...(await importOriginal()),
  loadProviderConfig: vi.fn(() => ({
    defaultProvider: "bailian",
    defaultModel: "MiniMax-M2.5",
    titleSummary: {
      provider: "bailian",
      model: "MiniMax-M2.5",
    },
    weeklySummary: {
      provider: "bailian",
      model: "MiniMax-M2.5",
    },
    enabledProviders: ["bailian"],
    agent: {
      context: {
        toolOutputMaxChars: 4096,
        recentToolResultLimit: 3,
      },
    },
    providers: {
      bailian: {
        id: "bailian",
        type: "openai-compatible",
        name: "Bailian",
        options: {
          apiKey: "secret-key",
          baseURL: "https://example.invalid/v1",
        },
        models: {
          "MiniMax-M2.5": {
            name: "MiniMax-M2.5",
            limit: {
              context: 204800,
              output: 131072,
            },
            modalities: {
              input: ["text"],
              output: ["text"],
            },
          },
        },
      },
    },
  })),
}))

describe("aiHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDatabase).mockReturnValue({} as never)
    vi.mocked(createModelProvider).mockResolvedValue({
      id: "bailian",
      type: "openai-compatible",
      streamTurn: async function* () {
        yield { type: "text_delta", delta: "用户询问AI身份" }
        yield { type: "done" }
      },
    } as never)
    vi.mocked(runReactAgent).mockImplementation(async function* () {})
  })

  it("保留超长最新 AI 回复的尾部，避免推荐问题上下文变为空", () => {
    const context = trimSuggestedQuestionContext(
      [
        { role: "user", content: "请分析这段内容" },
        { role: "assistant", content: "a".repeat(12_000) },
      ],
      4_000,
    )

    expect(context).toEqual([{ role: "assistant", content: "a".repeat(4_000) }])
  })

  it("兼容模型返回的 JSON 对象与编号问题列表", () => {
    expect(parseSuggestedQuestions('{"questions":["下一步怎么做？","有哪些风险？"]}')).toEqual([
      "下一步怎么做？",
      "有哪些风险？",
    ])
    expect(parseSuggestedQuestions("1. 下一步怎么做？\n2. 有哪些风险？")).toEqual([
      "下一步怎么做？",
      "有哪些风险？",
    ])
  })

  it("system prompt 不硬编码具体工具名，避免工具被筛掉时诱导伪调用", () => {
    const systemPrompt = createSystemPrompt().content

    expect(systemPrompt).not.toContain("people_tool_query")
    expect(systemPrompt).toContain("<system>")
    expect(systemPrompt).toContain("<tool-boundary>")
    expect(systemPrompt).toContain("<fact-boundary>")
    expect(systemPrompt).toContain("<output-format>")
    expect(systemPrompt).toContain("![](...)")
  })

  it("模型选项返回上下文限制和模态，但不泄漏 provider 连接配置", () => {
    const response = createModelOptionsResponse()

    expect(response.providers[0].models[0]).toMatchObject({
      id: "MiniMax-M2.5",
      name: "MiniMax-M2.5",
      limit: {
        context: 204800,
        output: 131072,
      },
      modalities: {
        input: ["text"],
        output: ["text"],
      },
    })
    expect(response.agent.context).toEqual({
      toolOutputMaxChars: 4096,
      recentToolResultLimit: 3,
    })
    expect(JSON.stringify(response)).not.toContain("secret-key")
    expect(JSON.stringify(response)).not.toContain("baseURL")
    expect(JSON.stringify(response)).not.toContain("options")
  })

  it("registers AI history handlers through persistence service", async () => {
    const service = {
      listSessions: vi.fn((_input?: { limit?: number; offset?: number; query?: string }) => [
        { id: "s1", title: "历史", time: "10:00", status: "completed", messages: [] },
      ]),
      getSession: vi.fn((sessionId: string) => ({
        id: sessionId,
        title: "历史",
        time: "10:00",
        status: "completed",
        messages: [],
      })),
      updateSessionTitle: vi.fn(),
      deleteSession: vi.fn(),
      ensureSession: vi.fn(),
      appendMessage: vi.fn(),
      startRun: vi.fn(),
      createRunWithMessages: vi.fn(),
      finishRun: vi.fn(),
      failRunWithAssistantMessage: vi.fn(),
      updateAssistantMessage: vi.fn(),
      upsertToolCall: vi.fn(),
    }
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)

    registerAiHandlers()

    const calls = vi.mocked(ipcMain.handle).mock.calls
    const listHandler = calls.find(([channel]) => channel === "ai:sessions:list")?.[1]
    const getHandler = calls.find(([channel]) => channel === "ai:session:get")?.[1]
    const updateTitleHandler = calls.find(([channel]) => channel === "ai:session:title:update")?.[1]
    const deleteHandler = calls.find(([channel]) => channel === "ai:session:delete")?.[1]

    expect(await listHandler?.({} as never, { limit: 20, offset: 10, query: "历史" })).toEqual(
      service.listSessions({ limit: 20, offset: 10, query: "历史" }),
    )
    expect(await getHandler?.({} as never, "s1")).toEqual(service.getSession("s1"))
    await updateTitleHandler?.({} as never, "s1", "新标题")
    await deleteHandler?.({} as never, "s1")
    expect(service.updateSessionTitle).toHaveBeenCalledWith("s1", "新标题", expect.any(String))
    expect(service.deleteSession).toHaveBeenCalledWith("s1")
  })

  it("persists chat start lifecycle and stream updates", async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi.fn().mockReturnValueOnce(undefined).mockReturnValue({
        id: "s1",
        title: "找阿明",
        time: "10:00",
        status: "running",
        messages: [],
      }),
      updateSessionTitle: vi.fn(),
      deleteSession: vi.fn(),
      ensureSession: vi.fn(),
      appendMessage: vi.fn(),
      startRun: vi.fn(),
      createRunWithMessages: vi.fn(),
      finishRun: vi.fn(),
      failRunWithAssistantMessage: vi.fn(),
      updateAssistantMessage: vi.fn(),
      upsertToolCall: vi.fn(),
    }
    const send = vi.fn()
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)
    vi.mocked(runReactAgent).mockImplementation(async function* () {
      yield { type: "text_delta", delta: "你好" } as never
      yield {
        type: "tool_started",
        id: "call-1",
        name: "people_tool_query",
        input: { query: "阿明" },
      } as never
      yield {
        type: "tool_finished",
        id: "call-1",
        name: "people_tool_query",
        observation: "找到 1 位关联人物",
        data: [{ name: "阿明" }],
      } as never
      yield { type: "done" } as never
    })

    registerAiHandlers()

    const startHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "ai:chat:start")?.[1]
    const result = await startHandler?.({ sender: { send } } as never, {
      runId: "run-1",
      userMessageId: "11111111111141118111111111111111",
      assistantMessageId: "22222222222242228222222222222222",
      sessionId: "s1",
      message: "找阿明",
      provider: "bailian",
      model: "MiniMax-M2.5",
      context: [],
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(result).toEqual({ runId: "run-1" })
    expect(service.createRunWithMessages).toHaveBeenCalledWith({
      session: expect.objectContaining({ id: "s1", title: "找阿明", status: "running" }),
      userMessage: expect.objectContaining({
        id: "11111111111141118111111111111111",
        role: "user",
      }),
      assistantMessage: expect.objectContaining({
        id: "22222222222242228222222222222222",
        role: "assistant",
      }),
      run: expect.objectContaining({ id: "run-1", sessionId: "s1" }),
    })
    expect(service.updateSessionTitle).toHaveBeenCalledWith(
      "s1",
      "用户询问AI身份",
      expect.any(String),
    )
    expect(send).toHaveBeenCalledWith(
      "ai:chat:event",
      expect.objectContaining({
        type: "session_title_updated",
        runId: "run-1",
        sessionId: "s1",
        title: "用户询问AI身份",
      }),
    )
    const persistedToolCallIds = vi
      .mocked(service.upsertToolCall)
      .mock.calls.map(([input]) => input.toolCallId)
    expect(persistedToolCallIds[0]).toMatch(UUID_PATTERN)
    expect(persistedToolCallIds[1]).toBe(persistedToolCallIds[0])
    expect(service.upsertToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ toolCallId: persistedToolCallIds[0], status: "running" }),
    )
    expect(service.upsertToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ toolCallId: persistedToolCallIds[0], status: "done" }),
    )
    expect(service.updateAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "22222222222242228222222222222222",
        answer: "你好",
        toolSteps: [expect.objectContaining({ id: "call-1", status: "done" })],
      }),
    )
    expect(service.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ id: "run-1", status: "completed" }),
    )
    expect(send).toHaveBeenCalledWith(
      "ai:chat:event",
      expect.objectContaining({ type: "done", runId: "run-1", sessionId: "s1" }),
    )
  })

  it("passes selected agents as trusted system directive without persisting tokens", async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi.fn(() => ({
        id: "s1",
        title: "已有标题",
        time: "10:00",
        status: "completed",
        messages: [],
      })),
      updateSessionTitle: vi.fn(),
      deleteSession: vi.fn(),
      ensureSession: vi.fn(),
      appendMessage: vi.fn(),
      startRun: vi.fn(),
      createRunWithMessages: vi.fn(),
      finishRun: vi.fn(),
      failRunWithAssistantMessage: vi.fn(),
      updateAssistantMessage: vi.fn(),
      upsertToolCall: vi.fn(),
    }
    const send = vi.fn()
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)

    registerAiHandlers()

    const startHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "ai:chat:start")?.[1]
    await startHandler?.(
      { sender: { send } } as never,
      {
        runId: "run-agent",
        userMessageId: "55555555555545558555555555555555",
        assistantMessageId: "66666666666646668666666666666666",
        sessionId: "s1",
        message: "查阿明",
        provider: "bailian",
        model: "MiniMax-M2.5",
        context: [],
        agents: [
          { id: "todo", priority: 2 },
          { id: "people", priority: 1 },
          { id: "unknown", priority: 3 },
        ],
      } as never,
    )

    await new Promise((resolve) => setTimeout(resolve, 0))

    const runInput = vi.mocked(runReactAgent).mock.calls[0][0]
    const systemMessage = runInput.messages[0]

    expect(systemMessage.role).toBe("system")
    expect(systemMessage.content).toContain("Agent selection directive")
    expect(systemMessage.content).toContain("1. people_agent")
    expect(systemMessage.content).toContain("people_tool_query")
    expect(systemMessage.content).toContain("2. todo_agent")
    expect(systemMessage.content).not.toContain("unknown")
    expect(service.createRunWithMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.objectContaining({
          content: "查阿明",
        }),
      }),
    )
  })

  it("已有标题的会话继续使用第一次标题，不重新总结", async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi.fn(() => ({
        id: "s1",
        title: "第一次标题",
        time: "10:00",
        status: "completed",
        messages: [{ id: "m1" }],
      })),
      updateSessionTitle: vi.fn(),
      deleteSession: vi.fn(),
      ensureSession: vi.fn(),
      appendMessage: vi.fn(),
      startRun: vi.fn(),
      createRunWithMessages: vi.fn(),
      finishRun: vi.fn(),
      failRunWithAssistantMessage: vi.fn(),
      updateAssistantMessage: vi.fn(),
      upsertToolCall: vi.fn(),
    }
    const send = vi.fn()
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)

    registerAiHandlers()

    const startHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "ai:chat:start")?.[1]
    const result = await startHandler?.({ sender: { send } } as never, {
      runId: "run-2",
      sessionId: "s1",
      message: "第二次问题",
      provider: "bailian",
      model: "MiniMax-M2.5",
      context: [],
    })

    expect(result).toEqual({ runId: "run-2" })
    expect(service.createRunWithMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ id: "s1", title: "第一次标题" }),
      }),
    )
    expect(service.updateSessionTitle).not.toHaveBeenCalled()
  })

  it("persists common_tool_ask tool state like other tools", async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi.fn(() => ({
        id: "s1",
        title: "已有标题",
        time: "10:00",
        status: "completed",
        messages: [{ id: "m1" }],
      })),
      updateSessionTitle: vi.fn(),
      deleteSession: vi.fn(),
      ensureSession: vi.fn(),
      appendMessage: vi.fn(),
      startRun: vi.fn(),
      createRunWithMessages: vi.fn(),
      finishRun: vi.fn(),
      failRunWithAssistantMessage: vi.fn(),
      updateAssistantMessage: vi.fn(),
      upsertToolCall: vi.fn(),
    }
    const send = vi.fn()
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)
    vi.mocked(runReactAgent).mockImplementation(async function* () {
      yield { type: "text_delta", delta: "需要确认范围。" } as never
      yield { type: "tool_started", id: "call-ask", name: "common_tool_ask", input: {} } as never
      yield {
        type: "tool_finished",
        id: "call-ask",
        name: "common_tool_ask",
        observation: "Ask request created: waiting for the user.",
        data: {
          kind: "ask_request",
          id: "ask-1",
          questions: [
            {
              header: "Scope",
              question: "Which scope should I use?",
              options: [{ label: "Current project", description: "Use current workspace." }],
            },
          ],
        },
      } as never
      yield {
        type: "tool_failed",
        id: "call-ask",
        name: "common_tool_ask",
        input: {},
        error: "Ask request was cancelled.",
      } as never
      yield { type: "done" } as never
    })

    registerAiHandlers()

    const startHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "ai:chat:start")?.[1]
    await startHandler?.({ sender: { send } } as never, {
      runId: "run-ask",
      userMessageId: "33333333333343338333333333333333",
      assistantMessageId: "44444444444444448444444444444444",
      sessionId: "s1",
      message: "需要澄清",
      provider: "bailian",
      model: "MiniMax-M2.5",
      context: [],
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    const askToolCallIds = vi
      .mocked(service.upsertToolCall)
      .mock.calls.map(([input]) => input.toolCallId)
    expect(askToolCallIds[0]).toMatch(UUID_PATTERN)
    expect(new Set(askToolCallIds).size).toBe(1)
    expect(service.upsertToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: askToolCallIds[0],
        name: "common_tool_ask",
        status: "running",
        observation: "Ask request created: waiting for the user.",
      }),
    )
    expect(service.upsertToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: askToolCallIds[0],
        name: "common_tool_ask",
        status: "failed",
        observation: "Ask was cancelled.",
        error: "Ask request was cancelled.",
      }),
    )
    expect(service.updateAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "44444444444444448444444444444444",
        answer: "需要确认范围。",
        parts: [
          expect.objectContaining({ kind: "text", content: "需要确认范围。" }),
          expect.objectContaining({ kind: "tool", stepId: "call-ask" }),
        ],
        toolSteps: [
          expect.objectContaining({
            id: "call-ask",
            tool: "common_tool_ask",
            status: "cancelled",
            observation: "Ask was cancelled.",
          }),
        ],
      }),
    )
  })

  it("cancels pending tool confirmation when ask cancel is requested", async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi.fn(() => ({
        id: "s1",
        title: "已有标题",
        time: "10:00",
        status: "completed",
        messages: [{ id: "m1" }],
      })),
      updateSessionTitle: vi.fn(),
      deleteSession: vi.fn(),
      ensureSession: vi.fn(),
      appendMessage: vi.fn(),
      startRun: vi.fn(),
      createRunWithMessages: vi.fn(),
      finishRun: vi.fn(),
      failRunWithAssistantMessage: vi.fn(),
      updateAssistantMessage: vi.fn(),
      upsertToolCall: vi.fn(),
    }
    const send = vi.fn()
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)
    vi.mocked(runReactAgent).mockImplementation(async function* ({ toolConfirmationProvider }) {
      const request = {
        kind: "tool_confirmation_request",
        id: "confirm-1",
        tool: "people_tool_delete",
        input: { id: "p1" },
        questions: [
          {
            header: "确认删除",
            question: "确认删除人物档案？",
            options: [
              { label: "确认删除", description: "执行删除。" },
              { label: "取消删除", description: "不执行删除。" },
            ],
          },
        ],
      }

      yield {
        type: "tool_started",
        id: "call-delete",
        name: "people_tool_delete",
        input: { id: "p1" },
      } as never
      yield {
        type: "tool_finished",
        id: "call-delete",
        name: "people_tool_delete",
        observation: "Tool confirmation required before executing people_tool_delete.",
        data: request,
      } as never

      try {
        await toolConfirmationProvider?.(request as never)
      } catch (error) {
        yield {
          type: "tool_failed",
          id: "call-delete",
          name: "people_tool_delete",
          input: { id: "p1" },
          error: error instanceof Error ? error.message : String(error),
        } as never
      }
    })

    registerAiHandlers()

    const startHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "ai:chat:start")?.[1]
    const askCancelHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "ai:chat:ask-cancel")?.[1]

    await startHandler?.({ sender: { send, once: vi.fn(), removeListener: vi.fn() } } as never, {
      runId: "run-confirm-cancel",
      userMessageId: "55555555555545558555555555555555",
      assistantMessageId: "66666666666646668666666666666666",
      sessionId: "s1",
      message: "删除这个人",
      provider: "bailian",
      model: "MiniMax-M2.5",
      context: [],
    })

    await vi.waitFor(() =>
      expect(service.upsertToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "people_tool_delete",
          status: "running",
          observation: "Tool confirmation required before executing people_tool_delete.",
        }),
      ),
    )
    await askCancelHandler?.({} as never, "run-confirm-cancel")
    await vi.waitFor(() =>
      expect(service.upsertToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "people_tool_delete",
          status: "failed",
          observation: "Tool confirmation was cancelled.",
          error: "Tool confirmation request was cancelled.",
        }),
      ),
    )
    expect(service.updateAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "66666666666646668666666666666666",
        toolSteps: [
          expect.objectContaining({
            id: "call-delete",
            tool: "people_tool_delete",
            status: "cancelled",
            observation: "Tool confirmation was cancelled.",
          }),
        ],
      }),
    )
  })
})
