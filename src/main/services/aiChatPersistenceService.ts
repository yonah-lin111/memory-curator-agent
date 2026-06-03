import type { AgentContextPayloadItem } from '../agent/core/contextMessages'
import type {
  AiAgentRunStatus,
  AiAgentToolCallStatus,
  AiChatMessageItem,
  AiChatMessagePart,
  AiChatMessageRole,
  AiChatMessageRow,
  AiChatSessionItem,
  AiChatSessionRow,
  AiChatSessionStatus,
  AiToolStep
} from '../db/schema'

// 数据库语句最小接口。
export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => unknown
}

// 数据库连接最小接口。
export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
  // 执行事务。
  transaction?: <T>(operation: () => T) => () => T
}

// 创建或更新会话输入。
export type EnsureSessionInput = {
  // 会话唯一标识。
  id: string
  // 会话标题。
  title: string
  // 会话状态。
  status: AiChatSessionStatus
  // 写入时间。
  timestamp: string
}

// 写入消息输入。
export type AppendMessageInput = {
  // 消息唯一标识。
  id: string
  // 所属会话标识。
  sessionId: string
  // 消息角色。
  role: AiChatMessageRole
  // 消息正文。
  content: string
  // 助手最终回答。
  answer?: string
  // 顺序片段。
  parts?: AiChatMessagePart[]
  // 工具步骤。
  toolSteps?: AiToolStep[]
  // 展示时间。
  time: string
  // 写入时间。
  timestamp: string
}

// 更新助手消息输入。
export type UpdateAssistantMessageInput = {
  // 消息唯一标识。
  messageId: string
  // 消息正文。
  content: string
  // 助手最终回答。
  answer: string
  // 顺序片段。
  parts: AiChatMessagePart[]
  // 工具步骤。
  toolSteps: AiToolStep[]
  // 更新时间。
  timestamp: string
}

// 创建 Agent run 输入。
export type StartRunInput = {
  // Agent run 唯一标识。
  id: string
  // 所属会话标识。
  sessionId: string
  // 助手消息标识。
  assistantMessageId: string
  // Provider 标识。
  provider?: string
  // 模型标识。
  model?: string
  // 启动时上下文快照。
  context: AgentContextPayloadItem[]
  // 启动时间。
  timestamp: string
}

// 结束 Agent run 输入。
export type FinishRunInput = {
  // Agent run 唯一标识。
  id: string
  // Agent run 状态。
  status: Exclude<AiAgentRunStatus, 'running'>
  // 错误信息。
  error?: string
  // 结束时间。
  timestamp: string
}

// 写入或更新工具调用输入。
export type UpsertToolCallInput = {
  // 工具调用行唯一标识。
  id: string
  // 所属 Agent run 标识。
  runId: string
  // 所属助手消息标识。
  messageId: string
  // 模型工具调用标识。
  toolCallId: string
  // 工具名称。
  name: string
  // 工具调用状态。
  status: AiAgentToolCallStatus
  // 工具输入。
  input: unknown
  // 工具观察摘要。
  observation: string
  // 工具结构化结果。
  data: unknown
  // 错误信息。
  error?: string
  // 写入时间。
  timestamp: string
}

// AI 会话列表查询输入。
export type ListSessionsInput = {
  // 搜索标题或摘要的关键词。
  query?: string
  // 最大返回数量。
  limit?: number
  // 跳过数量。
  offset?: number
}

// 创建聊天 run 与初始消息输入。
export type CreateRunWithMessagesInput = {
  // 会话写入输入。
  session: EnsureSessionInput
  // 用户消息写入输入。
  userMessage: AppendMessageInput
  // 助手占位消息写入输入。
  assistantMessage: AppendMessageInput
  // Agent run 写入输入。
  run: StartRunInput
}

// 失败 run 收尾输入。
export type FailRunWithAssistantMessageInput = {
  // 会话状态写入输入。
  session: EnsureSessionInput
  // Agent run 失败写入输入。
  run: FinishRunInput & {
    // 失败状态。
    status: 'failed'
  }
  // 助手错误消息写入输入。
  assistantMessage: UpdateAssistantMessageInput
}

// 持久化 Agent run。
export type PersistedRun = {
  // Agent run 唯一标识。
  id: string
  // 所属会话标识。
  sessionId: string
  // 助手消息标识。
  assistantMessageId: string
  // Provider 标识。
  provider?: string
  // 模型标识。
  model?: string
  // Agent run 状态。
  status: AiAgentRunStatus
  // 错误信息。
  error?: string
  // 启动时间。
  startedAt: string
  // 结束时间。
  finishedAt?: string
}

// 持久化工具调用。
export type PersistedToolCall = {
  // 工具调用行唯一标识。
  id: string
  // 所属 Agent run 标识。
  runId: string
  // 所属助手消息标识。
  messageId: string
  // 模型工具调用标识。
  toolCallId: string
  // 工具名称。
  name: string
  // 工具调用状态。
  status: AiAgentToolCallStatus
  // 工具输入。
  input: unknown
  // 工具观察摘要。
  observation: string
  // 工具结构化结果。
  data: unknown
  // 错误信息。
  error?: string
}

// 持久化上下文快照。
export type PersistedContextSnapshot = {
  // 上下文稳定去重键。
  contextKey: string
  // 上下文来源类型。
  kind: AgentContextPayloadItem['kind']
  // 展示标题。
  title: string
  // 来源对象标识。
  sourceId?: string
  // 快照正文。
  content: string
  // token 估算。
  tokens?: number
  // 创建顺序。
  createdOrder: number
  // 来源元信息。
  meta: unknown
}

// AI 对话持久化服务。
export type AiChatPersistenceService = {
  // 读取最近 AI 会话。
  listSessions: (input?: ListSessionsInput) => AiChatSessionItem[]
  // 读取单个 AI 会话详情。
  getSession: (sessionId: string) => AiChatSessionItem | null
  // 更新 AI 会话标题。
  updateSessionTitle: (sessionId: string, title: string, timestamp: string) => void
  // 删除 AI 会话及关联运行记录。
  deleteSession: (sessionId: string) => void
  // 撤销指定会话最后一轮对话。
  undoLastTurn: (sessionId: string, timestamp: string) => AiChatSessionItem | null
  // 删除指定消息所属的一轮 QA。
  deleteTurnByMessageId: (sessionId: string, messageId: string, timestamp: string) => AiChatSessionItem | null
  // 创建或更新 AI 会话。
  ensureSession: (input: EnsureSessionInput) => void
  // 写入 AI 消息。
  appendMessage: (input: AppendMessageInput) => void
  // 更新助手消息展示快照。
  updateAssistantMessage: (input: UpdateAssistantMessageInput) => void
  // 创建 Agent run。
  startRun: (input: StartRunInput) => void
  // 原子创建会话、初始消息和 Agent run。
  createRunWithMessages: (input: CreateRunWithMessagesInput) => void
  // 结束 Agent run。
  finishRun: (input: FinishRunInput) => void
  // 原子标记失败 run、会话状态和助手错误消息。
  failRunWithAssistantMessage: (input: FailRunWithAssistantMessageInput) => void
  // 读取 Agent run，供测试和审计使用。
  getRun: (runId: string) => PersistedRun | null
  // 写入或更新工具调用。
  upsertToolCall: (input: UpsertToolCallInput) => void
  // 读取 run 的工具调用。
  listToolCalls: (runId: string) => PersistedToolCall[]
  // 读取 run 的上下文快照。
  listContextSnapshots: (runId: string) => PersistedContextSnapshot[]
}

// Agent run 数据库行。
type AiAgentRunRow = {
  // Agent run 唯一标识。
  id: string
  // 所属会话标识。
  session_id: string
  // 助手消息标识。
  assistant_message_id: string
  // Provider 标识。
  provider: string | null
  // 模型标识。
  model: string | null
  // Agent run 状态。
  status: AiAgentRunStatus
  // 错误信息。
  error: string | null
  // 启动时间。
  started_at: string
  // 结束时间。
  finished_at: string | null
}

// 工具调用数据库行。
type AiAgentToolCallRow = {
  // 工具调用行唯一标识。
  id: string
  // 所属 Agent run 标识。
  run_id: string
  // 所属助手消息标识。
  message_id: string
  // 模型工具调用标识。
  tool_call_id: string
  // 工具名称。
  name: string
  // 工具调用状态。
  status: AiAgentToolCallStatus
  // 工具输入 JSON。
  input_json: string
  // 工具观察摘要。
  observation: string
  // 工具结构化结果 JSON。
  data_json: string
  // 错误信息。
  error: string | null
}

// 上下文快照数据库行。
type AiAgentContextSnapshotRow = {
  // 上下文稳定去重键。
  context_key: string
  // 上下文来源类型。
  kind: AgentContextPayloadItem['kind']
  // 展示标题。
  title: string
  // 来源对象标识。
  source_id: string | null
  // 快照正文。
  content: string
  // token 估算。
  tokens: number | null
  // 创建顺序。
  created_order: number
  // 来源元信息 JSON。
  meta_json: string
}

// 用于定位最后一轮对话的消息行。
type AiChatTurnMessageRow = Pick<AiChatMessageRow, 'id' | 'role' | 'content' | 'created_at'> & {
  // SQLite 插入顺序，用于同分钟消息的稳定排序。
  row_order: number
}

/**
 * 安全序列化 JSON，避免坏对象污染数据库。
 */
const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    return JSON.stringify({ error: '数据无法序列化' })
  }
}

/**
 * 安全解析数组 JSON。
 */
const parseArray = <T>(value: string): T[] => {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

/**
 * 安全解析任意 JSON。
 */
const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return { error: '数据解析失败' }
  }
}

/**
 * 归一化历史会话状态，数据库内部只保留英文枚举。
 */
const normalizeSessionStatus = (status: string): AiChatSessionStatus => {
  if (
    status === 'idle' ||
    status === 'running' ||
    status === 'completed' ||
    status === 'failed'
  ) {
    return status
  }

  if (status === '运行中') {
    return 'running'
  }

  if (status === '运行完成' || status === '已完成') {
    return 'completed'
  }

  if (status === '运行失败' || status === '失败') {
    return 'failed'
  }

  return 'idle'
}

/**
 * 映射消息数据库行。
 */
const mapMessageRow = (row: AiChatMessageRow): AiChatMessageItem => ({
  id: row.id,
  role: row.role,
  content: row.content,
  time: row.time,
  answer: row.answer ?? undefined,
  parts: parseArray<AiChatMessagePart>(row.parts_json),
  toolSteps: parseArray<AiToolStep>(row.tool_steps_json)
})

/**
 * 映射会话数据库行。
 */
const mapSessionRow = (
  row: AiChatSessionRow,
  messages: AiChatMessageItem[] = []
): AiChatSessionItem => ({
  id: row.id,
  title: row.title,
  status: normalizeSessionStatus(row.status),
  time: row.updated_at.slice(0, 16) || row.updated_at,
  messages
})

/**
 * 映射 Agent run 数据库行。
 */
const mapRunRow = (row: AiAgentRunRow): PersistedRun => ({
  id: row.id,
  sessionId: row.session_id,
  assistantMessageId: row.assistant_message_id,
  provider: row.provider ?? undefined,
  model: row.model ?? undefined,
  status: row.status,
  error: row.error ?? undefined,
  startedAt: row.started_at,
  finishedAt: row.finished_at ?? undefined
})

/**
 * 映射工具调用数据库行。
 */
const mapToolCallRow = (row: AiAgentToolCallRow): PersistedToolCall => ({
  id: row.id,
  runId: row.run_id,
  messageId: row.message_id,
  toolCallId: row.tool_call_id,
  name: row.name,
  status: row.status,
  input: parseJson(row.input_json),
  observation: row.observation,
  data: parseJson(row.data_json),
  error: row.error ?? undefined
})

/**
 * 映射上下文快照数据库行。
 */
const mapContextSnapshotRow = (row: AiAgentContextSnapshotRow): PersistedContextSnapshot => ({
  contextKey: row.context_key,
  kind: row.kind,
  title: row.title,
  sourceId: row.source_id ?? undefined,
  content: row.content,
  tokens: row.tokens ?? undefined,
  createdOrder: row.created_order,
  meta: parseJson(row.meta_json)
})

/**
 * 使用数据库事务执行操作；测试替身没有事务时退化为直接执行。
 */
const runTransaction = <T>(database: DatabaseConnection, operation: () => T): T => {
  const transaction = database.transaction?.(operation)

  return transaction ? transaction() : operation()
}

/**
 * 创建 AI 对话持久化服务。
 */
export const createAiChatPersistenceService = (
  database: DatabaseConnection
): AiChatPersistenceService => {
  const listSessions = (input: ListSessionsInput = {}): AiChatSessionItem[] => {
    const query = input.query?.trim()
    const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 100) : undefined
    const offset = input.offset && input.offset > 0 ? input.offset : 0
    const whereClause = query
      ? `
        WHERE title LIKE ?
          OR EXISTS (
            SELECT 1
            FROM ai_chat_messages
            WHERE ai_chat_messages.session_id = ai_chat_sessions.id
              AND ai_chat_messages.content LIKE ?
          )
      `
      : ''
    const limitClause = limit ? 'LIMIT ? OFFSET ?' : ''
    const values: unknown[] = []

    if (query) {
      const fuzzyQuery = `%${query}%`
      values.push(fuzzyQuery, fuzzyQuery)
    }

    if (limit) {
      values.push(limit, offset)
    }

    return (
      database
        .prepare(
          `
            SELECT id, title, status, created_at, updated_at, last_message_at
            FROM ai_chat_sessions
            ${whereClause}
            ORDER BY updated_at DESC
            ${limitClause}
          `
        )
        .all(...values) as AiChatSessionRow[]
    ).map((row) => mapSessionRow(row))
  }

  const getSession = (sessionId: string): AiChatSessionItem | null => {
    const session = database
      .prepare(
        `
          SELECT id, title, status, created_at, updated_at, last_message_at
          FROM ai_chat_sessions
          WHERE id = ?
        `
      )
      .get(sessionId) as AiChatSessionRow | undefined

    if (!session) {
      return null
    }

    const messages = database
      .prepare(
        `
          SELECT id, session_id, role, content, answer, parts_json, tool_steps_json, time, created_at, updated_at
          FROM ai_chat_messages
          WHERE session_id = ?
          ORDER BY created_at ASC, rowid ASC
        `
      )
      .all(sessionId) as AiChatMessageRow[]

    return mapSessionRow(session, messages.map((row) => mapMessageRow(row)))
  }

  const updateSessionTitle = (sessionId: string, title: string, timestamp: string): void => {
    database
      .prepare(
        `
          UPDATE ai_chat_sessions
          SET title = ?,
              updated_at = ?
          WHERE id = ?
        `
      )
      .run(title, timestamp, sessionId)
  }

  const deleteSession = (sessionId: string): void => {
    runTransaction(database, () => {
      const runs = database
        .prepare(
          `
            SELECT id
            FROM ai_agent_runs
            WHERE session_id = ?
          `
        )
        .all(sessionId) as { id: string }[]

      for (const run of runs) {
        database.prepare('DELETE FROM ai_agent_context_snapshots WHERE run_id = ?').run(run.id)
        database.prepare('DELETE FROM ai_agent_tool_calls WHERE run_id = ?').run(run.id)
      }

      database.prepare('DELETE FROM ai_agent_runs WHERE session_id = ?').run(sessionId)
      database.prepare('DELETE FROM ai_chat_messages WHERE session_id = ?').run(sessionId)
      database.prepare('DELETE FROM ai_chat_sessions WHERE id = ?').run(sessionId)
    })
  }

  /**
   * 读取会话消息的稳定顺序快照。
   */
  const listTurnMessages = (sessionId: string): AiChatTurnMessageRow[] =>
    database
      .prepare(
        `
          SELECT rowid AS row_order, id, role, content, created_at
          FROM ai_chat_messages
          WHERE session_id = ?
          ORDER BY created_at ASC, rowid ASC
        `
      )
      .all(sessionId) as AiChatTurnMessageRow[]

  /**
   * 删除一组助手消息对应的 run、工具调用和上下文快照。
   */
  const deleteRunsByAssistantMessageIds = (
    sessionId: string,
    assistantMessageIds: string[]
  ): void => {
    if (assistantMessageIds.length === 0) {
      return
    }

    const assistantPlaceholders = assistantMessageIds.map(() => '?').join(', ')
    const runs = database
      .prepare(
        `
          SELECT id
          FROM ai_agent_runs
          WHERE session_id = ? AND assistant_message_id IN (${assistantPlaceholders})
        `
      )
      .all(sessionId, ...assistantMessageIds) as { id: string }[]

    for (const run of runs) {
      database.prepare('DELETE FROM ai_agent_context_snapshots WHERE run_id = ?').run(run.id)
      database.prepare('DELETE FROM ai_agent_tool_calls WHERE run_id = ?').run(run.id)
    }

    if (runs.length === 0) {
      return
    }

    const runPlaceholders = runs.map(() => '?').join(', ')
    database.prepare(`DELETE FROM ai_agent_runs WHERE id IN (${runPlaceholders})`).run(
      ...runs.map((run) => run.id)
    )
  }

  /**
   * 删除指定范围内的 QA 消息，并重算会话摘要和时间。
   */
  const deleteTurnByRange = (
    sessionId: string,
    messages: AiChatTurnMessageRow[],
    turnStartIndex: number,
    turnEndIndex: number,
    timestamp: string
  ): void => {
    const removedMessages = messages.slice(turnStartIndex, turnEndIndex)
    const removedMessageIds = removedMessages.map((message) => message.id)
    const removedAssistantMessageIds = removedMessages
      .filter((message) => message.role === 'assistant')
      .map((message) => message.id)

    deleteRunsByAssistantMessageIds(sessionId, removedAssistantMessageIds)

    if (removedMessageIds.length > 0) {
      const messagePlaceholders = removedMessageIds.map(() => '?').join(', ')
      database.prepare(`DELETE FROM ai_chat_messages WHERE id IN (${messagePlaceholders})`).run(
        ...removedMessageIds
      )
    }

    const remainingMessages = [
      ...messages.slice(0, turnStartIndex),
      ...messages.slice(turnEndIndex)
    ]
    const latestRemainingMessage = remainingMessages[remainingMessages.length - 1]
    database
      .prepare(
        `
          UPDATE ai_chat_sessions
          SET title = CASE
                WHEN ? = 0 THEN '新建对话'
                ELSE title
              END,
              status = ?,
              updated_at = ?,
              last_message_at = ?
          WHERE id = ?
        `
      )
      .run(
        remainingMessages.length,
        remainingMessages.length === 0 ? 'idle' : 'completed',
        timestamp,
        latestRemainingMessage?.created_at ?? timestamp,
        sessionId
      )
  }

  const undoLastTurn = (sessionId: string, timestamp: string): AiChatSessionItem | null => {
    runTransaction(database, () => {
      const messages = listTurnMessages(sessionId)
      const turnStartIndex = [...messages]
        .reverse()
        .findIndex((message) => message.role === 'user')

      if (turnStartIndex < 0) {
        return
      }

      const resolvedTurnStartIndex = messages.length - 1 - turnStartIndex
      deleteTurnByRange(sessionId, messages, resolvedTurnStartIndex, messages.length, timestamp)
    })

    return getSession(sessionId)
  }

  const deleteTurnByMessageId = (
    sessionId: string,
    messageId: string,
    timestamp: string
  ): AiChatSessionItem | null => {
    runTransaction(database, () => {
      const messages = listTurnMessages(sessionId)
      const messageIndex = messages.findIndex((message) => message.id === messageId)

      if (messageIndex < 0) {
        return
      }

      let turnStartIndex = messageIndex

      while (turnStartIndex > 0 && messages[turnStartIndex].role !== 'user') {
        turnStartIndex -= 1
      }

      if (messages[turnStartIndex]?.role !== 'user') {
        return
      }

      let turnEndIndex = turnStartIndex + 1

      while (turnEndIndex < messages.length && messages[turnEndIndex].role !== 'user') {
        turnEndIndex += 1
      }

      deleteTurnByRange(sessionId, messages, turnStartIndex, turnEndIndex, timestamp)
    })

    return getSession(sessionId)
  }

  const ensureSession = (input: EnsureSessionInput): void => {
    database
      .prepare(
        `
          INSERT INTO ai_chat_sessions (id, title, status, created_at, updated_at, last_message_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = CASE
              WHEN ai_chat_sessions.title = '新建对话' THEN excluded.title
              ELSE ai_chat_sessions.title
            END,
            status = excluded.status,
            updated_at = excluded.updated_at
        `
      )
      .run(
        input.id,
        input.title,
        normalizeSessionStatus(input.status),
        input.timestamp,
        input.timestamp,
        input.timestamp
      )
  }

  const appendMessage = (input: AppendMessageInput): void => {
    database
      .prepare(
        `
          INSERT INTO ai_chat_messages (
            id,
            session_id,
            role,
            content,
            answer,
            parts_json,
            tool_steps_json,
            time,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.id,
        input.sessionId,
        input.role,
        input.content,
        input.answer ?? null,
        safeStringify(input.parts ?? []),
        safeStringify(input.toolSteps ?? []),
        input.time,
        input.timestamp,
        input.timestamp
      )

    database
      .prepare(
        `
          UPDATE ai_chat_sessions
          SET updated_at = ?, last_message_at = ?
          WHERE id = ?
        `
      )
      .run(input.timestamp, input.timestamp, input.sessionId)
  }

  const updateAssistantMessage = (input: UpdateAssistantMessageInput): void => {
    database
      .prepare(
        `
          UPDATE ai_chat_messages
          SET content = ?,
              answer = ?,
              parts_json = ?,
              tool_steps_json = ?,
              updated_at = ?
          WHERE id = ? AND role = 'assistant'
        `
      )
      .run(
        input.content,
        input.answer,
        safeStringify(input.parts),
        safeStringify(input.toolSteps),
        input.timestamp,
        input.messageId
      )
  }

  const startRun = (input: StartRunInput): void => {
    database
      .prepare(
        `
          INSERT INTO ai_agent_runs (
            id,
            session_id,
            assistant_message_id,
            provider,
            model,
            status,
            error,
            started_at,
            finished_at
          )
          VALUES (?, ?, ?, ?, ?, 'running', NULL, ?, NULL)
        `
      )
      .run(
        input.id,
        input.sessionId,
        input.assistantMessageId,
        input.provider ?? null,
        input.model ?? null,
        input.timestamp
      )

    const insertContextSnapshot = database.prepare(
      `
        INSERT INTO ai_agent_context_snapshots (
          run_id,
          context_key,
          kind,
          title,
          source_id,
          content,
          tokens,
          created_order,
          meta_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_id, context_key) DO UPDATE SET
          kind = excluded.kind,
          title = excluded.title,
          source_id = excluded.source_id,
          content = excluded.content,
          tokens = excluded.tokens,
          created_order = excluded.created_order,
          meta_json = excluded.meta_json
      `
    )

    input.context.forEach((item, index) => {
      insertContextSnapshot.run(
        input.id,
        item.key,
        item.kind,
        item.title,
        item.sourceId ?? null,
        item.content,
        item.tokens ?? null,
        item.createdAt ?? index,
        safeStringify(item.meta ?? {})
      )
    })
  }

  const finishRun = (input: FinishRunInput): void => {
    database
      .prepare(
        `
          UPDATE ai_agent_runs
          SET status = ?,
              error = ?,
              finished_at = ?
          WHERE id = ?
        `
      )
      .run(input.status, input.error ?? null, input.timestamp, input.id)
  }

  const createRunWithMessages = (input: CreateRunWithMessagesInput): void => {
    runTransaction(database, () => {
      ensureSession(input.session)
      appendMessage(input.userMessage)
      appendMessage(input.assistantMessage)
      startRun(input.run)
    })
  }

  const failRunWithAssistantMessage = (input: FailRunWithAssistantMessageInput): void => {
    runTransaction(database, () => {
      finishRun(input.run)
      ensureSession(input.session)
      updateAssistantMessage(input.assistantMessage)
    })
  }

  const getRun = (runId: string): PersistedRun | null => {
    const row = database
      .prepare(
        `
          SELECT id, session_id, assistant_message_id, provider, model, status, error, started_at, finished_at
          FROM ai_agent_runs
          WHERE id = ?
        `
      )
      .get(runId) as AiAgentRunRow | undefined

    return row ? mapRunRow(row) : null
  }

  const upsertToolCall = (input: UpsertToolCallInput): void => {
    database
      .prepare(
        `
          INSERT INTO ai_agent_tool_calls (
            id,
            run_id,
            message_id,
            tool_call_id,
            name,
            status,
            input_json,
            observation,
            data_json,
            error,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(run_id, tool_call_id) DO UPDATE SET
            message_id = excluded.message_id,
            name = excluded.name,
            status = excluded.status,
            input_json = excluded.input_json,
            observation = excluded.observation,
            data_json = excluded.data_json,
            error = excluded.error,
            updated_at = excluded.updated_at
        `
      )
      .run(
        input.id,
        input.runId,
        input.messageId,
        input.toolCallId,
        input.name,
        input.status,
        safeStringify(input.input),
        input.observation,
        safeStringify(input.data),
        input.error ?? null,
        input.timestamp,
        input.timestamp
      )
  }

  const listToolCalls = (runId: string): PersistedToolCall[] =>
    (
      database
        .prepare(
          `
            SELECT id, run_id, message_id, tool_call_id, name, status, input_json, observation, data_json, error
            FROM ai_agent_tool_calls
            WHERE run_id = ?
            ORDER BY created_at ASC
          `
        )
        .all(runId) as AiAgentToolCallRow[]
    ).map((row) => mapToolCallRow(row))

  const listContextSnapshots = (runId: string): PersistedContextSnapshot[] =>
    (
      database
        .prepare(
          `
            SELECT context_key, kind, title, source_id, content, tokens, created_order, meta_json
            FROM ai_agent_context_snapshots
            WHERE run_id = ?
            ORDER BY created_order ASC
          `
        )
        .all(runId) as AiAgentContextSnapshotRow[]
    ).map((row) => mapContextSnapshotRow(row))

  return {
    listSessions,
    getSession,
    updateSessionTitle,
    deleteSession,
    undoLastTurn,
    deleteTurnByMessageId,
    ensureSession,
    appendMessage,
    updateAssistantMessage,
    startRun,
    createRunWithMessages,
    finishRun,
    failRunWithAssistantMessage,
    getRun,
    upsertToolCall,
    listToolCalls,
    listContextSnapshots
  }
}
