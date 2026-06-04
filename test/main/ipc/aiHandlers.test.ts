import { ipcMain } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runReactAgent } from '../../../src/main/agent/core/reactAgent'
import { createModelProvider } from '../../../src/main/agent/providers/providerFactory'
import { getDatabase } from '../../../src/main/db'
import { createModelOptionsResponse, createSystemPrompt, registerAiHandlers } from '../../../src/main/ipc/aiHandlers'
import { createAiChatPersistenceService } from '../../../src/main/services/aiChatPersistenceService'

// 无连接符 UUID 形态。
const UUID_PATTERN = /^[\da-f]{32}$/i

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

vi.mock('../../../src/main/db', () => ({
  getDatabase: vi.fn()
}))

vi.mock('../../../src/main/services/aiChatPersistenceService', () => ({
  createAiChatPersistenceService: vi.fn()
}))

vi.mock('../../../src/main/agent/providers/providerFactory', () => ({
  createModelProvider: vi.fn()
}))

vi.mock('../../../src/main/agent/core/reactAgent', () => ({
  runReactAgent: vi.fn()
}))

vi.mock('../../../src/main/agent/providers/providerConfig', () => ({
  loadProviderConfig: vi.fn(() => ({
    defaultProvider: 'bailian',
    defaultModel: 'MiniMax-M2.5',
    titleSummary: {
      provider: 'bailian',
      model: 'MiniMax-M2.5'
    },
    enabledProviders: ['bailian'],
    agent: {
      context: {
        toolOutputMaxChars: 4096,
        recentToolResultLimit: 3
      }
    },
    providers: {
      bailian: {
        id: 'bailian',
        type: 'openai-compatible',
        name: 'Bailian',
        npm: '@ai-sdk/openai-compatible',
        options: {
          apiKey: 'secret-key',
          baseURL: 'https://example.invalid/v1'
        },
        models: {
          'MiniMax-M2.5': {
            name: 'MiniMax-M2.5',
            limit: {
              context: 204800,
              output: 131072
            },
            modalities: {
              input: ['text'],
              output: ['text']
            }
          }
        }
      }
    }
  }))
}))

describe('aiHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDatabase).mockReturnValue({} as never)
    vi.mocked(createModelProvider).mockResolvedValue({
      id: 'bailian',
      type: 'openai-compatible',
      streamTurn: async function* () {
        yield { type: 'text_delta', delta: '用户询问AI身份' }
        yield { type: 'done' }
      }
    } as never)
    vi.mocked(runReactAgent).mockImplementation(async function* () {})
  })

  it('system prompt 不硬编码具体工具名，避免工具被筛掉时诱导伪调用', () => {
    const systemPrompt = createSystemPrompt().content

    expect(systemPrompt).not.toContain('people_tool.query')
    expect(systemPrompt).toContain('已授权工具')
    expect(systemPrompt).toContain('工具边界：')
    expect(systemPrompt).toContain('事实边界：')
    expect(systemPrompt).toContain('图片输出：')
    expect(systemPrompt).toContain('![](...)')
  })

  it('模型选项返回上下文限制和模态，但不泄漏 provider 连接配置', () => {
    const response = createModelOptionsResponse()

    expect(response.providers[0].models[0]).toMatchObject({
      id: 'MiniMax-M2.5',
      name: 'MiniMax-M2.5',
      limit: {
        context: 204800,
        output: 131072
      },
      modalities: {
        input: ['text'],
        output: ['text']
      }
    })
    expect(response.agent.context).toEqual({
      toolOutputMaxChars: 4096,
      recentToolResultLimit: 3
    })
    expect(JSON.stringify(response)).not.toContain('secret-key')
    expect(JSON.stringify(response)).not.toContain('baseURL')
    expect(JSON.stringify(response)).not.toContain('options')
  })

  it('registers AI history handlers through persistence service', async () => {
    const service = {
      listSessions: vi.fn((_input?: { limit?: number; offset?: number; query?: string }) => [
        { id: 's1', title: '历史', time: '10:00', status: 'completed', messages: [] }
      ]),
      getSession: vi.fn((sessionId: string) => ({
        id: sessionId,
        title: '历史',
        time: '10:00',
        status: 'completed',
        messages: []
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
      upsertToolCall: vi.fn()
    }
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)

    registerAiHandlers()

    const calls = vi.mocked(ipcMain.handle).mock.calls
    const listHandler = calls.find(([channel]) => channel === 'ai:sessions:list')?.[1]
    const getHandler = calls.find(([channel]) => channel === 'ai:session:get')?.[1]
    const updateTitleHandler = calls.find(([channel]) => channel === 'ai:session:title:update')?.[1]
    const deleteHandler = calls.find(([channel]) => channel === 'ai:session:delete')?.[1]

    expect(await listHandler?.({} as never, { limit: 20, offset: 10, query: '历史' })).toEqual(
      service.listSessions({ limit: 20, offset: 10, query: '历史' })
    )
    expect(await getHandler?.({} as never, 's1')).toEqual(service.getSession('s1'))
    await updateTitleHandler?.({} as never, 's1', '新标题')
    await deleteHandler?.({} as never, 's1')
    expect(service.updateSessionTitle).toHaveBeenCalledWith('s1', '新标题', expect.any(String))
    expect(service.deleteSession).toHaveBeenCalledWith('s1')
  })

  it('persists chat start lifecycle and stream updates', async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValue({
          id: 's1',
          title: '找阿明',
          time: '10:00',
          status: 'running',
          messages: []
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
      upsertToolCall: vi.fn()
    }
    const send = vi.fn()
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)
    vi.mocked(runReactAgent).mockImplementation(async function* () {
      yield { type: 'text_delta', delta: '你好' } as never
      yield { type: 'tool_started', id: 'call-1', name: 'people_tool.query', input: { query: '阿明' } } as never
      yield {
        type: 'tool_finished',
        id: 'call-1',
        name: 'people_tool.query',
        observation: '找到 1 位关联人物',
        data: [{ name: '阿明' }]
      } as never
      yield { type: 'done' } as never
    })

    registerAiHandlers()

    const startHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === 'ai:chat:start')?.[1]
    const result = await startHandler?.(
      { sender: { send } } as never,
      {
        runId: 'run-1',
        userMessageId: '11111111111141118111111111111111',
        assistantMessageId: '22222222222242228222222222222222',
        sessionId: 's1',
        message: '找阿明',
        provider: 'bailian',
        model: 'MiniMax-M2.5',
        context: []
      }
    )

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(result).toEqual({ runId: 'run-1' })
    expect(service.createRunWithMessages).toHaveBeenCalledWith({
      session: expect.objectContaining({ id: 's1', title: '找阿明', status: 'running' }),
      userMessage: expect.objectContaining({ id: '11111111111141118111111111111111', role: 'user' }),
      assistantMessage: expect.objectContaining({ id: '22222222222242228222222222222222', role: 'assistant' }),
      run: expect.objectContaining({ id: 'run-1', sessionId: 's1' })
    })
    expect(service.updateSessionTitle).toHaveBeenCalledWith('s1', '用户询问AI身份', expect.any(String))
    expect(send).toHaveBeenCalledWith(
      'ai:chat:event',
      expect.objectContaining({
        type: 'session_title_updated',
        runId: 'run-1',
        sessionId: 's1',
        title: '用户询问AI身份'
      })
    )
    const persistedToolCallIds = vi.mocked(service.upsertToolCall).mock.calls.map(([input]) => input.toolCallId)
    expect(persistedToolCallIds[0]).toMatch(UUID_PATTERN)
    expect(persistedToolCallIds[1]).toBe(persistedToolCallIds[0])
    expect(service.upsertToolCall).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: persistedToolCallIds[0], status: 'running' }))
    expect(service.upsertToolCall).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: persistedToolCallIds[0], status: 'done' }))
    expect(service.updateAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: '22222222222242228222222222222222',
        answer: '你好',
        toolSteps: [expect.objectContaining({ id: 'call-1', status: 'done' })]
      })
    )
    expect(service.finishRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'run-1', status: 'completed' }))
    expect(send).toHaveBeenCalledWith('ai:chat:event', expect.objectContaining({ type: 'done', runId: 'run-1', sessionId: 's1' }))
  })

  it('已有标题的会话继续使用第一次标题，不重新总结', async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi.fn(() => ({
        id: 's1',
        title: '第一次标题',
        time: '10:00',
        status: 'completed',
        messages: [{ id: 'm1' }]
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
      upsertToolCall: vi.fn()
    }
    const send = vi.fn()
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)

    registerAiHandlers()

    const startHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === 'ai:chat:start')?.[1]
    const result = await startHandler?.(
      { sender: { send } } as never,
      {
        runId: 'run-2',
        sessionId: 's1',
        message: '第二次问题',
        provider: 'bailian',
        model: 'MiniMax-M2.5',
        context: []
      }
    )

    expect(result).toEqual({ runId: 'run-2' })
    expect(service.createRunWithMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ id: 's1', title: '第一次标题' })
      })
    )
    expect(service.updateSessionTitle).not.toHaveBeenCalled()
  })

  it('persists common_tool.ask tool state like other tools', async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi.fn(() => ({
        id: 's1',
        title: '已有标题',
        time: '10:00',
        status: 'completed',
        messages: [{ id: 'm1' }]
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
      upsertToolCall: vi.fn()
    }
    const send = vi.fn()
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)
    vi.mocked(runReactAgent).mockImplementation(async function* () {
      yield { type: 'text_delta', delta: '需要确认范围。' } as never
      yield { type: 'tool_started', id: 'call-ask', name: 'common_tool.ask', input: {} } as never
      yield {
        type: 'tool_finished',
        id: 'call-ask',
        name: 'common_tool.ask',
        observation: 'Ask request created: waiting for the user.',
        data: {
          kind: 'ask_request',
          id: 'ask-1',
          questions: [
            {
              header: 'Scope',
              question: 'Which scope should I use?',
              options: [{ label: 'Current project', description: 'Use current workspace.' }]
            }
          ]
        }
      } as never
      yield {
        type: 'tool_failed',
        id: 'call-ask',
        name: 'common_tool.ask',
        input: {},
        error: 'Ask request was cancelled.'
      } as never
      yield { type: 'done' } as never
    })

    registerAiHandlers()

    const startHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === 'ai:chat:start')?.[1]
    await startHandler?.(
      { sender: { send } } as never,
      {
        runId: 'run-ask',
        userMessageId: '33333333333343338333333333333333',
        assistantMessageId: '44444444444444448444444444444444',
        sessionId: 's1',
        message: '需要澄清',
        provider: 'bailian',
        model: 'MiniMax-M2.5',
        context: []
      }
    )

    await new Promise((resolve) => setTimeout(resolve, 0))

    const askToolCallIds = vi.mocked(service.upsertToolCall).mock.calls.map(([input]) => input.toolCallId)
    expect(askToolCallIds[0]).toMatch(UUID_PATTERN)
    expect(new Set(askToolCallIds).size).toBe(1)
    expect(service.upsertToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: askToolCallIds[0],
        name: 'common_tool.ask',
        status: 'running',
        observation: 'Ask request created: waiting for the user.'
      })
    )
    expect(service.upsertToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: askToolCallIds[0],
        name: 'common_tool.ask',
        status: 'failed',
        observation: 'Ask was cancelled.',
        error: 'Ask request was cancelled.'
      })
    )
    expect(service.updateAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: '44444444444444448444444444444444',
        answer: '需要确认范围。',
        parts: [
          expect.objectContaining({ kind: 'text', content: '需要确认范围。' }),
          expect.objectContaining({ kind: 'tool', stepId: 'call-ask' })
        ],
        toolSteps: [
          expect.objectContaining({
            id: 'call-ask',
            tool: 'common_tool.ask',
            status: 'cancelled',
            observation: 'Ask was cancelled.'
          })
        ]
      })
    )
  })
})
