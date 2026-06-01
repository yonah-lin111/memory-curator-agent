import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { createAiChatPersistenceTables } from '../../../src/main/db'
import { createAiChatPersistenceService } from '../../../src/main/services/aiChatPersistenceService'

/**
 * 创建内存数据库服务。
 */
const createService = () => {
  const database = new Database(':memory:')
  createAiChatPersistenceTables(database)
  return createAiChatPersistenceService(database as never)
}

describe('aiChatPersistenceService', () => {
  it('creates a session, appends messages, and reads the session detail', () => {
    const service = createService()

    service.ensureSession({
      id: 's1',
      title: '新会话',
      summary: '第一条消息',
      status: '运行中',
      timestamp: '2026-05-31 10:00'
    })
    service.appendMessage({
      id: 'm-user',
      sessionId: 's1',
      role: 'user',
      content: '你好',
      time: '10:00',
      timestamp: '2026-05-31 10:00'
    })
    service.appendMessage({
      id: 'm-ai',
      sessionId: 's1',
      role: 'assistant',
      content: '正在处理',
      answer: '',
      parts: [],
      toolSteps: [],
      time: '10:00',
      timestamp: '2026-05-31 10:00'
    })

    expect(service.listSessions()).toHaveLength(1)
    expect(service.getSession('s1')).toMatchObject({
      id: 's1',
      title: '新会话',
      messages: [
        { id: 'm-user', role: 'user', content: '你好' },
        { id: 'm-ai', role: 'assistant', content: '正在处理', answer: '' }
      ]
    })
  })

  it('updates assistant message text and tool snapshots', () => {
    const service = createService()

    service.ensureSession({
      id: 's1',
      title: '新会话',
      summary: '摘要',
      status: '运行中',
      timestamp: '2026-05-31 10:00'
    })
    service.appendMessage({
      id: 'm-ai',
      sessionId: 's1',
      role: 'assistant',
      content: '正在处理',
      answer: '',
      parts: [],
      toolSteps: [],
      time: '10:00',
      timestamp: '2026-05-31 10:00'
    })
    service.updateAssistantMessage({
      messageId: 'm-ai',
      content: '正在处理',
      answer: '完成',
      parts: [{ id: 'p1', kind: 'text', content: '完成' }],
      toolSteps: [
        {
          id: 'call-1',
          title: '工具结果：people_query',
          status: 'done',
          tool: 'people_query',
          input: { query: '阿明' },
          observation: '找到 1 位关联人物',
          data: [{ name: '阿明' }]
        }
      ],
      timestamp: '2026-05-31 10:01'
    })

    expect(service.getSession('s1')?.messages[0]).toMatchObject({
      answer: '完成',
      parts: [{ id: 'p1', kind: 'text', content: '完成' }],
      toolSteps: [{ id: 'call-1', status: 'done', tool: 'people_query' }]
    })
  })

  it('persists run, tool call, and context snapshots', () => {
    const service = createService()

    service.startRun({
      id: 'run-1',
      sessionId: 's1',
      assistantMessageId: 'm-ai',
      provider: 'bailian',
      model: 'MiniMax-M2.5',
      context: [
        {
          key: 'message:m1',
          kind: 'message',
          title: '用户消息',
          sourceId: 'm1',
          content: '历史消息',
          tokens: 3,
          createdAt: 10,
          meta: { role: 'user' }
        }
      ],
      timestamp: '2026-05-31 10:00'
    })
    service.upsertToolCall({
      id: 'tool-row-1',
      runId: 'run-1',
      messageId: 'm-ai',
      toolCallId: 'call-1',
      name: 'people_query',
      status: 'running',
      input: { query: '阿明' },
      observation: '',
      data: null,
      timestamp: '2026-05-31 10:00'
    })
    service.upsertToolCall({
      id: 'tool-row-1',
      runId: 'run-1',
      messageId: 'm-ai',
      toolCallId: 'call-1',
      name: 'people_query',
      status: 'done',
      input: { query: '阿明' },
      observation: '找到 1 位关联人物',
      data: [{ name: '阿明' }],
      timestamp: '2026-05-31 10:01'
    })
    service.finishRun({
      id: 'run-1',
      status: 'completed',
      timestamp: '2026-05-31 10:02'
    })

    expect(service.getRun('run-1')).toMatchObject({
      id: 'run-1',
      status: 'completed'
    })
    expect(service.listToolCalls('run-1')).toMatchObject([
      {
        toolCallId: 'call-1',
        status: 'done',
        observation: '找到 1 位关联人物'
      }
    ])
    expect(service.listContextSnapshots('run-1')).toMatchObject([
      {
        contextKey: 'message:m1',
        kind: 'message',
        content: '历史消息'
      }
    ])
  })
})
