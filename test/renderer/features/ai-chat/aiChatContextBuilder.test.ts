import { describe, expect, it } from 'vitest'
import type {
  AiChatMessage,
  AiModelProviderOption,
  AiModelSelection
} from '@renderer/features/ai-chat/types'
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
          title: 'Query local People',
            status: 'done',
            tool: 'people_query',
            observation: '找到 1 位关联人物：阿明｜朋友｜技术狂热者',
            data: [
              {
                name: '阿明',
                details: '# 阿明\n完整详情'
              }
            ]
          },
          {
            id: 'call-2',
            title: '等待执行',
            status: 'running',
            tool: 'people_query',
            observation: 'Reading the local People table.'
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
          title: 'Tool result: people_query',
          content: expect.stringContaining('"details": "# 阿明\\n完整详情"'),
          meta: expect.objectContaining({
            tool: 'people_query',
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

  it('剔除运行级异常的 QA message 上下文，并保留已完成工具上下文', () => {
    const messages: AiChatMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: '帮我整理今天的记忆',
        time: '10:00'
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'AI chat execution failed',
        time: '10:00',
        answer: 'Model request timed out',
        toolSteps: [
          {
            id: 'tool-1',
            title: 'Load snippets',
            status: 'done',
            tool: 'snippets.search',
            observation: 'Found 2 snippets',
            data: {
              count: 2
            }
          }
        ]
      }
    ]

    const items = buildMessageContextItems('session-1', messages)

    expect(items.map((item) => item.key)).toEqual(['tool:assistant-1:tool-1'])
  })

  it('仅工具失败时不剔除 QA message 上下文', () => {
    const messages: AiChatMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: '帮我找联系人',
        time: '10:00'
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Processing: "帮我找联系人"',
        time: '10:00',
        answer: 'The local People query failed, but I can continue with the existing context.',
        toolSteps: [
          {
            id: 'tool-1',
            title: 'Tool failed: people.scan',
            status: 'failed',
            tool: 'people.scan',
            observation: 'Tool execution failed: SQLite connection failed',
            data: {
              error: 'SQLite connection failed'
            }
          }
        ]
      }
    ]

    const items = buildMessageContextItems('session-1', messages)

    expect(items.map((item) => item.key)).toEqual([
      'message:user-1',
      'message:assistant-1'
    ])
  })
})
