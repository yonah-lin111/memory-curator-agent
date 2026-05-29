import { describe, expect, it } from 'vitest'
import type {
  AiChatMessage,
  AiModelProviderOption,
  AiModelSelection
} from '@renderer/features/ai-chat/aiChatMock'
import {
  buildMessageContextItems,
  estimateAiChatContextTokens,
  getAiChatContextBudget,
  resolveAiChatSelectedModelOption
} from '@renderer/features/ai-chat/aiChatContextBuilder'

describe('aiChatContextBuilder', () => {
  it('从用户与助手消息派生稳定上下文条目', () => {
    const messages: AiChatMessage[] = [
      { id: 'u1', role: 'user', content: '帮我整理今天的记录', time: '10:00' },
      {
        id: 'a1',
        role: 'assistant',
        content: '正在处理',
        answer: '今天的核心线索是测试优先。',
        time: '10:01'
      }
    ]

    const items = buildMessageContextItems('s1', messages)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      key: 'message:u1',
      sessionId: 's1',
      kind: 'message',
      sourceId: 'u1',
      title: '用户消息',
      content: '帮我整理今天的记录',
      meta: { role: 'user' }
    })
    expect(items[1]).toMatchObject({
      key: 'message:a1',
      title: '助手回答',
      content: '今天的核心线索是测试优先。',
      meta: { role: 'assistant' }
    })
  })

  it('过滤空内容并使用 answer 优先于 assistant content', () => {
    const messages: AiChatMessage[] = [
      { id: 'empty', role: 'user', content: '   ', time: '10:00' },
      {
        id: 'a1',
        role: 'assistant',
        content: '处理中',
        answer: '最终回答',
        time: '10:01'
      }
    ]

    const items = buildMessageContextItems('s1', messages)

    expect(items).toHaveLength(1)
    expect(items[0].content).toBe('最终回答')
  })

  it('估算 tokens 并根据当前模型 limit 计算预算', () => {
    expect(estimateAiChatContextTokens('12345678')).toBe(2)

    const modelOptions: AiModelProviderOption[] = [
      {
        id: 'bailian',
        name: 'Bailian',
        models: [
          {
            id: 'MiniMax-M2.5',
            name: 'MiniMax-M2.5',
            limit: { context: 204800, output: 131072 },
            modalities: { input: ['text'], output: ['text'] }
          }
        ]
      }
    ]
    const selected: AiModelSelection = { provider: 'bailian', model: 'MiniMax-M2.5' }

    expect(resolveAiChatSelectedModelOption(modelOptions, selected)?.limit?.context).toBe(204800)
    expect(
      getAiChatContextBudget({
        items: [
          {
            key: 'x',
            sessionId: 's1',
            kind: 'message',
            sourceId: 'x',
            title: 'T',
            summary: 'S',
            content: '12345678',
            tokens: 2,
            createdAt: 0,
            meta: {}
          }
        ],
        modelOptions,
        selectedModel: selected
      })
    ).toMatchObject({ totalTokens: 2, contextLimit: 204800, usagePercent: 0 })
  })
})
