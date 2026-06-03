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
  it('migrates legacy Chinese session status values to English', () => {
    const database = new Database(':memory:')

    database.exec(`
      CREATE TABLE ai_chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL
      );

      INSERT INTO ai_chat_sessions (id, title, summary, status, created_at, updated_at, last_message_at)
      VALUES
        ('s-running', '运行会话', '摘要', '运行中', '2026-05-31 10:00', '2026-05-31 10:00', '2026-05-31 10:00'),
        ('s-completed', '完成会话', '摘要', '运行完成', '2026-05-31 10:01', '2026-05-31 10:01', '2026-05-31 10:01'),
        ('s-failed', '失败会话', '摘要', '运行失败', '2026-05-31 10:02', '2026-05-31 10:02', '2026-05-31 10:02');
    `)

    createAiChatPersistenceTables(database)

    expect(
      database
        .prepare('SELECT id, status FROM ai_chat_sessions ORDER BY id ASC')
        .all()
    ).toEqual([
      { id: 's-completed', status: 'completed' },
      { id: 's-failed', status: 'failed' },
      { id: 's-running', status: 'running' }
    ])
  })

  it('creates a session, appends messages, and reads the session detail', () => {
    const service = createService()

    service.ensureSession({
      id: 's1',
      title: '新会话',
      summary: '第一条消息',
      status: 'running',
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

  it('按时间分页读取会话并支持标题与摘要搜索', () => {
    const service = createService()

    for (const session of [
      { id: 's-old', title: '旧会话', summary: '普通摘要', timestamp: '2026-05-31 09:00' },
      { id: 's-middle', title: 'Alpha 标题', summary: '普通摘要', timestamp: '2026-05-31 10:00' },
      { id: 's-new', title: '新会话', summary: '包含 alpha 摘要', timestamp: '2026-05-31 11:00' }
    ]) {
      service.ensureSession({
        id: session.id,
        title: session.title,
        summary: session.summary,
        status: 'completed',
        timestamp: session.timestamp
      })
    }

    expect(service.listSessions({ limit: 2, offset: 0 }).map((session) => session.id)).toEqual([
      's-new',
      's-middle'
    ])
    expect(service.listSessions({ limit: 2, offset: 2 }).map((session) => session.id)).toEqual([
      's-old'
    ])
    expect(service.listSessions({ query: 'alpha' }).map((session) => session.id)).toEqual([
      's-new',
      's-middle'
    ])
  })

  it('ensureSession 不覆盖已经生成的首个会话标题', () => {
    const service = createService()

    service.ensureSession({
      id: 's1',
      title: '第一次标题',
      summary: '第一条消息',
      status: 'running',
      timestamp: '2026-05-31 10:00'
    })
    service.ensureSession({
      id: 's1',
      title: '第二次标题',
      summary: '第二条消息',
      status: 'completed',
      timestamp: '2026-05-31 10:01'
    })

    expect(service.getSession('s1')).toMatchObject({
      id: 's1',
      title: '第一次标题',
      summary: '第二条消息',
      status: 'completed'
    })
  })

  it('ensureSession 可以替换默认的新建对话标题', () => {
    const service = createService()

    service.ensureSession({
      id: 's1',
      title: '新建对话',
      summary: '',
      status: 'idle',
      timestamp: '2026-05-31 10:00'
    })
    service.ensureSession({
      id: 's1',
      title: '用户询问AI身份',
      summary: '你是谁',
      status: 'running',
      timestamp: '2026-05-31 10:01'
    })

    expect(service.getSession('s1')).toMatchObject({
      id: 's1',
      title: '用户询问AI身份'
    })
  })

  it('updates assistant message text and tool snapshots', () => {
    const service = createService()

    service.ensureSession({
      id: 's1',
      title: '新会话',
      summary: '摘要',
      status: 'running',
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
          title: 'Tool result: people_query',
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

  it('updates session title without touching messages', () => {
    const service = createService()

    service.ensureSession({
      id: 's-title',
      title: '旧标题',
      summary: '摘要',
      status: 'idle',
      timestamp: '2026-05-31 10:00'
    })
    service.appendMessage({
      id: 'm-user',
      sessionId: 's-title',
      role: 'user',
      content: '原消息',
      time: '10:00',
      timestamp: '2026-05-31 10:00'
    })

    service.updateSessionTitle('s-title', '新标题', '2026-05-31 10:01')

    expect(service.getSession('s-title')).toMatchObject({
      id: 's-title',
      title: '新标题',
      messages: [{ id: 'm-user', content: '原消息' }]
    })
  })

  it('deletes session and related chat run data', () => {
    const service = createService()

    service.ensureSession({
      id: 's-delete',
      title: '待删除',
      summary: '摘要',
      status: 'running',
      timestamp: '2026-05-31 10:00'
    })
    service.appendMessage({
      id: 'm-ai',
      sessionId: 's-delete',
      role: 'assistant',
      content: '正在处理',
      answer: '',
      parts: [],
      toolSteps: [],
      time: '10:00',
      timestamp: '2026-05-31 10:00'
    })
    service.startRun({
      id: 'run-delete',
      sessionId: 's-delete',
      assistantMessageId: 'm-ai',
      provider: 'bailian',
      model: 'MiniMax-M2.5',
      context: [
        {
          key: 'message:m-ai',
          kind: 'message',
          title: '助手回答',
          sourceId: 'm-ai',
          content: '正在处理'
        }
      ],
      timestamp: '2026-05-31 10:00'
    })
    service.upsertToolCall({
      id: 'tool-delete',
      runId: 'run-delete',
      messageId: 'm-ai',
      toolCallId: 'call-delete',
      name: 'people_query',
      status: 'done',
      input: {},
      observation: '完成',
      data: null,
      timestamp: '2026-05-31 10:01'
    })

    service.deleteSession('s-delete')

    expect(service.listSessions()).toHaveLength(0)
    expect(service.getSession('s-delete')).toBeNull()
    expect(service.getRun('run-delete')).toBeNull()
    expect(service.listToolCalls('run-delete')).toEqual([])
    expect(service.listContextSnapshots('run-delete')).toEqual([])
  })

  it('undoes the last turn and deletes related run data', () => {
    const service = createService()

    service.createRunWithMessages({
      session: {
        id: 's-undo',
        title: '保留标题',
        summary: '第一轮',
        status: 'running',
        timestamp: '2026-05-31 10:00'
      },
      userMessage: {
        id: 'm1-user',
        sessionId: 's-undo',
        role: 'user',
        content: '第一轮',
        time: '10:00',
        timestamp: '2026-05-31 10:00'
      },
      assistantMessage: {
        id: 'm1-ai',
        sessionId: 's-undo',
        role: 'assistant',
        content: '第一轮回答',
        answer: '第一轮回答',
        parts: [],
        toolSteps: [],
        time: '10:00',
        timestamp: '2026-05-31 10:00'
      },
      run: {
        id: 'run-1',
        sessionId: 's-undo',
        assistantMessageId: 'm1-ai',
        provider: 'bailian',
        model: 'MiniMax-M2.5',
        context: [],
        timestamp: '2026-05-31 10:00'
      }
    })
    service.createRunWithMessages({
      session: {
        id: 's-undo',
        title: '第二轮标题不会覆盖',
        summary: '第二轮',
        status: 'running',
        timestamp: '2026-05-31 10:01'
      },
      userMessage: {
        id: 'm2-user',
        sessionId: 's-undo',
        role: 'user',
        content: '第二轮',
        time: '10:01',
        timestamp: '2026-05-31 10:01'
      },
      assistantMessage: {
        id: 'm2-ai',
        sessionId: 's-undo',
        role: 'assistant',
        content: '第二轮回答',
        answer: '第二轮回答',
        parts: [],
        toolSteps: [],
        time: '10:01',
        timestamp: '2026-05-31 10:01'
      },
      run: {
        id: 'run-2',
        sessionId: 's-undo',
        assistantMessageId: 'm2-ai',
        provider: 'bailian',
        model: 'MiniMax-M2.5',
        context: [
          {
            key: 'message:m1-user',
            kind: 'message',
            title: '用户消息',
            sourceId: 'm1-user',
            content: '第一轮'
          }
        ],
        timestamp: '2026-05-31 10:01'
      }
    })
    service.upsertToolCall({
      id: 'tool-undo',
      runId: 'run-2',
      messageId: 'm2-ai',
      toolCallId: 'call-undo',
      name: 'people_query',
      status: 'done',
      input: {},
      observation: '完成',
      data: null,
      timestamp: '2026-05-31 10:02'
    })

    const session = service.undoLastTurn('s-undo', '2026-05-31 10:03')

    expect(session).toMatchObject({
      id: 's-undo',
      title: '保留标题',
      summary: '第一轮',
      status: 'completed',
      messages: [
        { id: 'm1-user', role: 'user', content: '第一轮' },
        { id: 'm1-ai', role: 'assistant', content: '第一轮回答' }
      ]
    })
    expect(service.getRun('run-1')).toMatchObject({ id: 'run-1' })
    expect(service.getRun('run-2')).toBeNull()
    expect(service.listToolCalls('run-2')).toEqual([])
    expect(service.listContextSnapshots('run-2')).toEqual([])
  })

  it('deletes the selected QA turn and related run data', () => {
    const service = createService()
    const createTurn = (turn: number, userContent: string): void => {
      service.createRunWithMessages({
        session: {
          id: 's-delete-turn',
          title: '删除中间 QA',
          summary: userContent,
          status: 'completed',
          timestamp: `2026-05-31 10:0${turn}`
        },
        userMessage: {
          id: `m${turn}-user`,
          sessionId: 's-delete-turn',
          role: 'user',
          content: userContent,
          time: `10:0${turn}`,
          timestamp: `2026-05-31 10:0${turn}`
        },
        assistantMessage: {
          id: `m${turn}-ai`,
          sessionId: 's-delete-turn',
          role: 'assistant',
          content: `${userContent}回答`,
          answer: `${userContent}回答`,
          parts: [],
          toolSteps: [],
          time: `10:0${turn}`,
          timestamp: `2026-05-31 10:0${turn}`
        },
        run: {
          id: `run-${turn}`,
          sessionId: 's-delete-turn',
          assistantMessageId: `m${turn}-ai`,
          provider: 'bailian',
          model: 'MiniMax-M2.5',
          context: [
            {
              key: `message:m${turn}-user`,
              kind: 'message',
              title: '用户消息',
              sourceId: `m${turn}-user`,
              content: userContent
            }
          ],
          timestamp: `2026-05-31 10:0${turn}`
        }
      })
    }

    createTurn(1, '第一轮')
    createTurn(2, '第二轮')
    createTurn(3, '第三轮')
    service.upsertToolCall({
      id: 'tool-delete',
      runId: 'run-2',
      messageId: 'm2-ai',
      toolCallId: 'call-delete',
      name: 'people_query',
      status: 'done',
      input: {},
      observation: '完成',
      data: null,
      timestamp: '2026-05-31 10:04'
    })

    const session = service.deleteTurnByMessageId('s-delete-turn', 'm2-ai', '2026-05-31 10:05')

    expect(session).toMatchObject({
      id: 's-delete-turn',
      title: '删除中间 QA',
      summary: '第三轮',
      status: 'completed',
      messages: [
        { id: 'm1-user', role: 'user', content: '第一轮' },
        { id: 'm1-ai', role: 'assistant', content: '第一轮回答' },
        { id: 'm3-user', role: 'user', content: '第三轮' },
        { id: 'm3-ai', role: 'assistant', content: '第三轮回答' }
      ]
    })
    expect(service.getRun('run-1')).toMatchObject({ id: 'run-1' })
    expect(service.getRun('run-2')).toBeNull()
    expect(service.getRun('run-3')).toMatchObject({ id: 'run-3' })
    expect(service.listToolCalls('run-2')).toEqual([])
    expect(service.listContextSnapshots('run-2')).toEqual([])
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

  it('rolls back chat run creation when any startup write fails', () => {
    const service = createService()

    expect(() =>
      service.createRunWithMessages({
        session: {
          id: 's-rollback',
          title: '回滚会话',
          summary: '测试回滚',
          status: 'running',
          timestamp: '2026-05-31 10:00'
        },
        userMessage: {
          id: 'duplicate-message',
          sessionId: 's-rollback',
          role: 'user',
          content: '触发失败',
          time: '10:00',
          timestamp: '2026-05-31 10:00'
        },
        assistantMessage: {
          id: 'duplicate-message',
          sessionId: 's-rollback',
          role: 'assistant',
          content: '这条写入会失败',
          answer: '',
          parts: [],
          toolSteps: [],
          time: '10:00',
          timestamp: '2026-05-31 10:00'
        },
        run: {
          id: 'run-rollback',
          sessionId: 's-rollback',
          assistantMessageId: 'duplicate-message',
          provider: 'bailian',
          model: 'MiniMax-M2.5',
          context: [],
          timestamp: '2026-05-31 10:00'
        }
      })
    ).toThrow(/UNIQUE|constraint/i)

    expect(service.listSessions()).toHaveLength(0)
    expect(service.getRun('run-rollback')).toBeNull()
  })

  it('finishes failed run and assistant error message in one service call', () => {
    const service = createService()

    service.createRunWithMessages({
      session: {
        id: 's-fail',
        title: '失败会话',
        summary: '测试失败',
        status: 'running',
        timestamp: '2026-05-31 10:00'
      },
      userMessage: {
        id: 'm-user',
        sessionId: 's-fail',
        role: 'user',
        content: '触发失败',
        time: '10:00',
        timestamp: '2026-05-31 10:00'
      },
      assistantMessage: {
        id: 'm-ai',
        sessionId: 's-fail',
        role: 'assistant',
        content: '正在处理',
        answer: '',
        parts: [],
        toolSteps: [],
        time: '10:00',
        timestamp: '2026-05-31 10:00'
      },
      run: {
        id: 'run-fail',
        sessionId: 's-fail',
        assistantMessageId: 'm-ai',
        provider: 'bailian',
        model: 'MiniMax-M2.5',
        context: [],
        timestamp: '2026-05-31 10:00'
      }
    })

    service.failRunWithAssistantMessage({
      session: {
        id: 's-fail',
        title: '失败会话',
        summary: '测试失败',
        status: 'failed',
        timestamp: '2026-05-31 10:01'
      },
      run: {
        id: 'run-fail',
        status: 'failed',
        error: '模型失败',
        timestamp: '2026-05-31 10:01'
      },
      assistantMessage: {
        messageId: 'm-ai',
        content: 'AI chat execution failed',
        answer: '模型失败',
        parts: [],
        toolSteps: [],
        timestamp: '2026-05-31 10:01'
      }
    })

    expect(service.getRun('run-fail')).toMatchObject({
      status: 'failed',
      error: '模型失败'
    })
    expect(service.getSession('s-fail')).toMatchObject({
      status: 'failed',
      messages: [
        { id: 'm-user', role: 'user' },
        { id: 'm-ai', role: 'assistant', content: 'AI chat execution failed', answer: '模型失败' }
      ]
    })
  })
})
