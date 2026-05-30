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

  it('从助手消息的 toolSteps 派生工具上下文条目', () => {
    const items = buildMessageContextItems('s1', [
      {
        id: 'a1',
        role: 'assistant',
        content: '处理中',
        answer: '阿明是朋友。',
        time: '10:01',
        toolSteps: [
          {
            id: 'call-1',
            title: '查询本地 People',
            status: 'done',
            tool: 'people_list',
            observation: '找到 1 位关联人物：阿明｜朋友｜技术狂热者'
          },
          {
            id: 'call-2',
            title: '等待执行',
            status: 'running',
            tool: 'people_list',
            observation: '正在读取本地 People 表。'
          }
        ]
      }
    ])

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'tool:a1:call-1',
          sessionId: 's1',
          kind: 'tool',
          sourceId: 'call-1',
          title: '工具结果：people_list',
          content: '找到 1 位关联人物：阿明｜朋友｜技术狂热者',
          meta: expect.objectContaining({
            tool: 'people_list',
            messageId: 'a1'
          })
        })
      ])
    )
    expect(items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'tool:a1:call-2'
        })
      ])
    )
  })
})
