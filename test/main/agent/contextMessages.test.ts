import { describe, expect, it } from 'vitest'
import {
  buildContextAgentMessages,
  type AgentContextPayloadItem
} from '../../../src/main/agent/contextMessages'
import type { AgentMessage } from '../../../src/main/agent/types'

// 系统消息基线。
const systemMessage: AgentMessage = {
  role: 'system',
  content: '系统提示'
}

/**
 * 构造上下文载荷条目。
 */
const createContextItem = (
  override: Partial<AgentContextPayloadItem> = {}
): AgentContextPayloadItem => ({
  key: override.key ?? 'message:u1',
  kind: override.kind ?? 'message',
  title: override.title ?? '用户消息',
  sourceId: override.sourceId,
  content: override.content ?? '第一轮问题是什么',
  tokens: override.tokens ?? 5,
  createdAt: override.createdAt ?? 1,
  meta: override.meta ?? {
    role: 'user'
  }
})

describe('contextMessages', () => {
  it('把历史消息上下文转成真实 AgentMessage 并追加当前用户消息', () => {
    const messages = buildContextAgentMessages({
      systemMessage,
      userMessage: '上一个问题是什么',
      contextItems: [
        createContextItem({
          key: 'message:u1',
          content: '帮我整理今天的记录',
          createdAt: 1,
          meta: { role: 'user' }
        }),
        createContextItem({
          key: 'message:a1',
          title: '助手回答',
          content: '今天的核心线索是测试优先。',
          createdAt: 2,
          meta: { role: 'assistant' }
        })
      ]
    })

    expect(messages).toEqual([
      systemMessage,
      {
        role: 'user',
        content: '帮我整理今天的记录'
      },
      {
        role: 'assistant',
        content: '今天的核心线索是测试优先。'
      },
      {
        role: 'user',
        content: '上一个问题是什么'
      }
    ])
  })

  it('按上下文窗口预算保留最新上下文并压缩超长条目', () => {
    const messages = buildContextAgentMessages({
      systemMessage,
      userMessage: '继续',
      contextItems: [
        createContextItem({
          key: 'message:old',
          content: '旧消息',
          tokens: 80,
          createdAt: 1
        }),
        createContextItem({
          key: 'message:new',
          content: '新消息'.repeat(120),
          tokens: 120,
          createdAt: 2
        })
      ],
      contextLimit: 96,
      outputLimit: 16
    })

    expect(messages).toHaveLength(3)
    expect(messages[1]).toMatchObject({
      role: 'user'
    })
    expect(messages[1].content).toContain('新消息')
    expect(messages[1].content.length).toBeLessThan('新消息'.repeat(120).length)
    expect(messages[2]).toEqual({
      role: 'user',
      content: '继续'
    })
  })

  it('预算紧张时按最近问答轮次裁剪，不拆散问题和回答', () => {
    const messages = buildContextAgentMessages({
      systemMessage,
      userMessage: '上一个问题是什么',
      contextItems: [
        createContextItem({
          key: 'message:old-user',
          content: '旧问题'.repeat(80),
          tokens: 80,
          createdAt: 1,
          meta: { role: 'user' }
        }),
        createContextItem({
          key: 'message:old-assistant',
          content: '旧回答'.repeat(80),
          tokens: 80,
          createdAt: 2,
          meta: { role: 'assistant' }
        }),
        createContextItem({
          key: 'message:new-user',
          content: '第一个问题是什么',
          tokens: 5,
          createdAt: 3,
          meta: { role: 'user' }
        }),
        createContextItem({
          key: 'message:new-assistant',
          content: '第一个问题是关于上下文。',
          tokens: 6,
          createdAt: 4,
          meta: { role: 'assistant' }
        })
      ],
      contextLimit: 54,
      outputLimit: 8
    })

    expect(messages).toEqual([
      systemMessage,
      {
        role: 'user',
        content: '第一个问题是什么'
      },
      {
        role: 'assistant',
        content: '第一个问题是关于上下文。'
      },
      {
        role: 'user',
        content: '上一个问题是什么'
      }
    ])
  })

  it('工具上下文只保留最近结果全文，旧结果替换为占位摘要', () => {
    const messages = buildContextAgentMessages({
      systemMessage,
      userMessage: '继续',
      contextItems: [
        createContextItem({
          key: 'tool:old',
          kind: 'tool',
          title: '工具结果：people_list',
          content: '旧工具结果'.repeat(80),
          createdAt: 1,
          meta: { tool: 'people_list' }
        }),
        createContextItem({
          key: 'tool:new',
          kind: 'tool',
          title: '工具结果：people_list',
          content: '新工具结果',
          createdAt: 2,
          meta: { tool: 'people_list' }
        })
      ],
      recentToolResultLimit: 1
    })

    expect(messages[1]).toMatchObject({
      role: 'assistant',
      toolCalls: [
        expect.objectContaining({
          name: 'people_list'
        })
      ]
    })
    expect(messages[2]).toMatchObject({
      role: 'tool',
      name: 'people_list'
    })
    expect(messages[2].content).toContain('[旧工具结果已省略，仅保留摘要]')
    expect(messages[2].content.length).toBeLessThan('旧工具结果'.repeat(80).length)
    expect(messages[4].content).toContain('新工具结果')
  })

  it('单条工具 observation 按 toolOutputMaxChars 截断', () => {
    const messages = buildContextAgentMessages({
      systemMessage,
      userMessage: '继续',
      contextItems: [
        createContextItem({
          key: 'tool:long',
          kind: 'tool',
          title: '工具结果：people_list',
          content: `${'头部'.repeat(40)}中间${'尾部'.repeat(40)}`,
          createdAt: 1,
          meta: { tool: 'people_list' }
        })
      ],
      toolOutputMaxChars: 80
    })

    expect(messages[1]).toMatchObject({
      role: 'assistant',
      toolCalls: [
        expect.objectContaining({
          name: 'people_list'
        })
      ]
    })
    expect(messages[2]).toMatchObject({
      role: 'tool',
      name: 'people_list'
    })
    expect(messages[2].content).toContain('[工具结果已截断]')
    expect(messages[2].content).toContain('头部')
    expect(messages[2].content).toContain('尾部')
    expect(messages[2].content.length).toBeLessThan(`${'头部'.repeat(40)}中间${'尾部'.repeat(40)}`.length)
  })

  it('把多次历史工具结果还原为 assistant/tool 消息对', () => {
    const messages = buildContextAgentMessages({
      systemMessage,
      userMessage: '你调用了几次工具了？',
      contextItems: [
        createContextItem({
          key: 'tool:a1:call-1',
          kind: 'tool',
          title: '工具结果：people_list',
          sourceId: 'call-1',
          content: '第一次查询结果',
          createdAt: 1,
          meta: {
            tool: 'people_list',
            messageId: 'a1',
            inputJson: '{"relationship":"女朋友"}'
          }
        }),
        createContextItem({
          key: 'tool:a2:call-1',
          kind: 'tool',
          title: '工具结果：people_list',
          sourceId: 'call-1',
          content: '第二次查询结果',
          createdAt: 2,
          meta: {
            tool: 'people_list',
            messageId: 'a2',
            inputJson: '{"relationship":"女朋友"}'
          }
        })
      ]
    })

    const assistantToolMessages = messages.filter((message) => message.role === 'assistant' && message.toolCalls?.length)
    const toolResultMessages = messages.filter((message) => message.role === 'tool')

    expect(assistantToolMessages).toHaveLength(2)
    expect(toolResultMessages).toHaveLength(2)
    expect(assistantToolMessages[0].toolCalls?.[0]).toMatchObject({
      id: 'history-a1-call-1',
      name: 'people_list',
      argumentsText: '{"relationship":"女朋友"}'
    })
    expect(toolResultMessages[0]).toMatchObject({
      toolCallId: 'history-a1-call-1',
      name: 'people_list',
      content: '第一次查询结果'
    })
    expect(assistantToolMessages[1].toolCalls?.[0].id).toBe('history-a2-call-1')
    expect(toolResultMessages[1].toolCallId).toBe('history-a2-call-1')
  })
})
