import { describe, expect, it, vi } from 'vitest'
import { createModelOptionsResponse, createSystemPrompt } from '../../../src/main/ipc/aiHandlers'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

vi.mock('../../../src/main/db', () => ({
  getDatabase: vi.fn()
}))

vi.mock('../../../src/main/agent/providerConfig', () => ({
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
})
