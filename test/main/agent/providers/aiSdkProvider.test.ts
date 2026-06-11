import { describe, expect, it } from 'vitest'
import { createAiSdkModelProvider } from '@/agent/providers/aiSdkProvider'
import type { NormalizedProviderConfig } from '@/agent/types'

describe('aiSdkProvider', () => {
  it('加载 type 映射的 provider 包并转发 AI SDK 流式事件', async () => {
    const loadedPackages: string[] = []
    const config: NormalizedProviderConfig = {
      id: 'bailian',
      type: 'openai-compatible',
      name: 'Bailian',
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
            toolName: 'people_tool_query',
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
            name: 'people_tool_query',
            description: 'Query the People table',
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
        name: 'people_tool_query',
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

  it('透传 AI SDK reasoning 增量', async () => {
    const config: NormalizedProviderConfig = {
      id: 'bailian',
      type: 'openai-compatible',
      name: 'Bailian',
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
            type: 'reasoning-delta',
            id: 'reasoning-1',
            text: '先判断上下文。'
          }
          yield {
            type: 'text-delta',
            text: '结论。'
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
            content: '分析一下'
          }
        ],
        tools: []
      })
    )

    expect(events).toEqual([
      {
        type: 'reasoning_delta',
        id: 'reasoning-1',
        delta: '先判断上下文。'
      },
      {
        type: 'text_delta',
        delta: '结论。'
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
            name: 'people_tool_query',
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
    expect(Object.keys(tools)).toContain('people_tool_query')
    expect(tools['people_tool_query'].description).toContain('provide arguments strictly according to the parameter schema')
  })
})
