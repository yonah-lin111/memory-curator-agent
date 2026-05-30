import { describe, expect, it } from 'vitest'
import { createAiSdkModelProvider } from '../../../src/main/agent/aiSdkProvider'
import type { NormalizedProviderConfig } from '../../../src/main/agent/types'

describe('aiSdkProvider', () => {
  it('通过配置 npm 字段加载 provider 工厂并转发 AI SDK 流式事件', async () => {
    const loadedPackages: string[] = []
    const config: NormalizedProviderConfig = {
      id: 'bailian',
      type: 'openai-compatible',
      name: 'Bailian',
      npm: '@ai-sdk/openai-compatible',
      options: {
        apiKey: 'test-key',
        baseURL: 'https://example.com/v1'
      },
      models: {}
    }
    const provider = await createAiSdkModelProvider(config, {
      loadPackage: async (packageName) => {
        loadedPackages.push(packageName)
        return {
          createOpenAICompatible: () => (model: string) => ({
            model
          })
        }
      },
      streamText: () => ({
        stream: (async function* () {
          yield {
            type: 'text-delta',
            text: '你好'
          }
          yield {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'people_query',
            input: {
              query: '阿明'
            }
          }
          yield {
            type: 'finish'
          }
        })()
      })
    })

    const events = await Array.fromAsync(
      provider.streamTurn({
        model: 'MiniMax-M2.5',
        messages: [
          {
            role: 'user',
            content: '阿明是谁'
          }
        ],
        tools: [
          {
            name: 'people_query',
            description: '查询 People 表',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string'
                }
              }
            },
            execute: async () => ({
              observation: '',
              data: []
            })
          }
        ]
      })
    )

    expect(loadedPackages).toEqual(['@ai-sdk/openai-compatible'])
    expect(events).toEqual([
      {
        type: 'text_delta',
        delta: '你好'
      },
      {
        type: 'tool_call_done',
        id: 'call-1',
        name: 'people_query',
        argumentsText: '{"query":"阿明"}'
      },
      {
        type: 'done'
      }
    ])
  })

  it('兼容 AI SDK 6 返回的 fullStream', async () => {
    const config: NormalizedProviderConfig = {
      id: 'bailian',
      type: 'openai-compatible',
      name: 'Bailian',
      npm: '@ai-sdk/openai-compatible',
      options: {
        apiKey: 'test-key',
        baseURL: 'https://example.com/v1'
      },
      models: {}
    }
    const provider = await createAiSdkModelProvider(config, {
      loadPackage: async () => ({
        createOpenAICompatible: () => (model: string) => ({
          model
        })
      }),
      streamText: () => ({
        fullStream: (async function* () {
          yield {
            type: 'text-delta',
            text: 'fullStream 可用'
          }
          yield {
            type: 'finish'
          }
        })()
      })
    })

    const events = await Array.fromAsync(
      provider.streamTurn({
        model: 'MiniMax-M2.5',
        messages: [
          {
            role: 'user',
            content: '你好'
          }
        ],
        tools: []
      })
    )

    expect(events).toEqual([
      {
        type: 'text_delta',
        delta: 'fullStream 可用'
      },
      {
        type: 'done'
      }
    ])
  })

  it('发送给 AI SDK 前统一准备工具定义', async () => {
    let capturedInput: Record<string, unknown> | undefined
    const config: NormalizedProviderConfig = {
      id: 'bailian',
      type: 'openai-compatible',
      name: 'Bailian',
      npm: '@ai-sdk/openai-compatible',
      options: {
        apiKey: 'test-key',
        baseURL: 'https://example.com/v1'
      },
      models: {}
    }
    const provider = await createAiSdkModelProvider(config, {
      loadPackage: async () => ({
        createOpenAICompatible: () => (model: string) => ({
          model
        })
      }),
      streamText: (input) => {
        capturedInput = input
        return {
          stream: (async function* () {
            yield {
              type: 'finish'
            }
          })()
        }
      }
    })

    await Array.fromAsync(
      provider.streamTurn({
        model: 'MiniMax-M2.5',
        messages: [
          {
            role: 'user',
            content: '查一下'
          }
        ],
        tools: [
          {
            name: 'people_query',
            description: '查询 People 表',
            parameters: {
              type: 'object',
              properties: {}
            },
            execute: async () => ({
              observation: '',
              data: []
            })
          }
        ]
      })
    )

    const tools = capturedInput?.tools as Record<string, { description?: string }>
    expect(tools.people_query.description).toContain('严格按参数 Schema 提供参数')
  })
})
