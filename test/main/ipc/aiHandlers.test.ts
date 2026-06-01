import { ipcMain } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runReactAgent } from '../../../src/main/agent/core/reactAgent'
import { createModelProvider } from '../../../src/main/agent/providers/providerFactory'
import { getDatabase } from '../../../src/main/db'
import { createModelOptionsResponse, createSystemPrompt, registerAiHandlers } from '../../../src/main/ipc/aiHandlers'
import { createAiChatPersistenceService } from '../../../src/main/services/aiChatPersistenceService'

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
    vi.mocked(createModelProvider).mockResolvedValue({} as never)
    vi.mocked(runReactAgent).mockImplementation(async function* () {})
  })

  it('system prompt 不硬编码具体工具名，避免工具被筛掉时诱导伪调用', () => {
    expect(createSystemPrompt().content).not.toContain('people_query')
    expect(createSystemPrompt().content).toContain('已授权工具')
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
      listSessions: vi.fn(() => [
        { id: 's1', title: '历史', summary: '摘要', time: '10:00', status: 'completed', messages: [] }
      ]),
      getSession: vi.fn((sessionId: string) => ({
        id: sessionId,
        title: '历史',
        summary: '摘要',
        time: '10:00',
        status: 'completed',
        messages: []
      })),
      updateSessionTitle: vi.fn(),
      deleteSession: vi.fn()
    }
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)

    registerAiHandlers()

    const calls = vi.mocked(ipcMain.handle).mock.calls
    const listHandler = calls.find(([channel]) => channel === 'ai:sessions:list')?.[1]
    const getHandler = calls.find(([channel]) => channel === 'ai:session:get')?.[1]
    const updateTitleHandler = calls.find(([channel]) => channel === 'ai:session:title:update')?.[1]
    const deleteHandler = calls.find(([channel]) => channel === 'ai:session:delete')?.[1]

    expect(await listHandler?.({} as never)).toEqual(service.listSessions())
    expect(await getHandler?.({} as never, 's1')).toEqual(service.getSession('s1'))
    await updateTitleHandler?.({} as never, 's1', '新标题')
    await deleteHandler?.({} as never, 's1')
    expect(service.updateSessionTitle).toHaveBeenCalledWith('s1', '新标题', expect.any(String))
    expect(service.deleteSession).toHaveBeenCalledWith('s1')
  })

  it('persists chat start lifecycle and stream updates', async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi.fn(),
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
      yield { type: 'tool_started', id: 'call-1', name: 'people_query', input: { query: '阿明' } } as never
      yield {
        type: 'tool_finished',
        id: 'call-1',
        name: 'people_query',
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
      session: expect.objectContaining({ id: 's1', status: 'running' }),
      userMessage: expect.objectContaining({ id: 'run-1-user', role: 'user' }),
      assistantMessage: expect.objectContaining({ id: 'run-1-assistant', role: 'assistant' }),
      run: expect.objectContaining({ id: 'run-1', sessionId: 's1' })
    })
    expect(service.upsertToolCall).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: 'call-1', status: 'running' }))
    expect(service.upsertToolCall).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: 'call-1', status: 'done' }))
    expect(service.updateAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'run-1-assistant',
        answer: '你好',
        toolSteps: [expect.objectContaining({ id: 'call-1', status: 'done' })]
      })
    )
    expect(service.finishRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'run-1', status: 'completed' }))
    expect(send).toHaveBeenCalledWith('ai:chat:event', expect.objectContaining({ type: 'done', runId: 'run-1', sessionId: 's1' }))
  })
})
