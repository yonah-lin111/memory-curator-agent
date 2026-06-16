import type { NoteCreateInput, NoteMaterialItem } from '@/db/schema'
import type { NotesService } from '@/services/notesService'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'
import type {
  AgentTool,
  NoteQueryToolInput,
  NoteQueryToolItem,
  NoteQueryToolResult
} from '@/agent/types'

// Note 查询工具类型。
type NoteQueryTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 Note 查询。
   */
  execute: (input: unknown) => Promise<NoteQueryToolResult>
}

// Note 写入工具结果。
type NoteWriteToolResult = {
  // 回灌模型的观察文本。
  observation: string
  // 调试或 UI 可用结构化数据。
  data: unknown
}

// Note 写入工具类型。
type NoteWriteTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 Note 写入。
   */
  execute: (input: unknown) => Promise<NoteWriteToolResult>
}

// Note 写入动作。
type NoteWriteAction = 'add' | 'update' | 'delete'

// Note 工具默认返回数量。
const DEFAULT_NOTE_LIMIT = 20

// Note 工具最大返回数量。
const MAX_NOTE_LIMIT = 50

// Note SQL 最大长度。
const MAX_NOTE_SQL_LENGTH = 1200

// Note 查询表名。
const NOTE_TABLE_NAME = 'notes'

// Note 查询字段清单。
const NOTE_COLUMNS =
  'n.id, n.title, n.content, n.tags, n.time, n.category_id, nc.name AS category_name'

// Note FROM 子句（含分类 LEFT JOIN）。
const NOTE_FROM_CLAUSE = 'notes n LEFT JOIN note_categories nc ON n.category_id = nc.id'

// 禁止 AI SQL 使用的高风险关键字。
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union)\b/i

// SQL 注释片段。
const SQL_COMMENT_PATTERN = /--|\/\*|\*\//

// Note 数据库行类型。
type NoteSqlRow = Record<string, unknown>

/**
 * 将笔记映射为工具返回项。
 */
const toToolItem = (note: NoteMaterialItem): NoteQueryToolItem => ({
  id: note.id,
  title: note.title,
  content: note.content,
  tags: note.tags,
  time: note.time,
  categoryId: note.categoryId,
  categoryName: note.categoryName
})

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 解析 SQL 行中的标签字段。
 */
const parseSqlTags = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : []
  } catch {
    return []
  }
}

/**
 * 判断 SQL 原始行是否包含完整笔记字段。
 */
const isNoteSqlRow = (value: unknown): value is NoteSqlRow =>
  isRecord(value) &&
  typeof value.id === 'number' &&
  typeof value.title === 'string' &&
  typeof value.content === 'string' &&
  typeof value.tags === 'string' &&
  typeof value.time === 'string'

/**
 * 将完整 SQL 笔记行映射为工具返回项。
 */
const sqlRowToToolItem = (row: NoteSqlRow): NoteQueryToolItem =>
  toToolItem({
    id: row.id as number,
    title: row.title as string,
    content: row.content as string,
    tags: parseSqlTags(row.tags as string),
    time: row.time as string,
    categoryId: (row.category_id as number | null) ?? undefined,
    categoryName: (row.category_name as string | null) ?? undefined
  })

/**
 * 解析字符串字段。
 */
const parseString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/**
 * 读取 Note 写入输入中的非空字符串字段。
 */
const getNoteInputString = (input: unknown, key: string): string | null => {
  if (!isRecord(input)) {
    return null
  }

  const value = parseString(input[key])?.trim()

  return value || null
}

/**
 * 解析 Note 工具入参。
 */
const parseInput = (input: unknown): NoteQueryToolInput => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    query: parseString(input.query),
    tag: parseString(input.tag),
    categoryId: typeof input.categoryId === 'number' ? input.categoryId : undefined,
    sql: parseString(input.sql),
    limit: typeof input.limit === 'number' ? input.limit : undefined
  }
}

/**
 * 转义 SQL 字符串字面量。
 */
const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

/**
 * 转义 LIKE 查询字面量。
 */
const escapeSqlLike = (value: string): string =>
  escapeSqlString(
    value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  )

/**
 * 构造 LIKE 条件。
 */
const buildLikeCondition = (
  column: string,
  value: string | undefined
): string | null => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  return `${column} LIKE '%${escapeSqlLike(trimmed)}%'`
}

/**
 * 构造结构化查询 WHERE 子句。
 */
const buildStructuredWhere = (parsed: NoteQueryToolInput): string => {
  const whereParts: (string | null)[] = [
    buildLikeCondition('tags', parsed.tag),
    typeof parsed.categoryId === 'number'
      ? `n.category_id = ${parsed.categoryId}`
      : null,
    parsed.query
      ? `(n.title LIKE '%${escapeSqlLike(parsed.query.trim())}%' OR n.content LIKE '%${escapeSqlLike(parsed.query.trim())}%')`
      : null
  ]

  const filtered = whereParts.filter((condition): condition is string => Boolean(condition))

  return filtered.length > 0 ? ` WHERE ${filtered.join(' AND ')}` : ''
}

/**
 * 将结构化查询编译为受控 SQL。
 */
const buildStructuredSql = (parsed: NoteQueryToolInput): string =>
  `SELECT ${NOTE_COLUMNS} FROM ${NOTE_FROM_CLAUSE}${buildStructuredWhere(parsed)} ORDER BY n.time DESC, n.id DESC`

/**
 * 校验并限制 AI 生成的 Note SQL。
 */
const prepareNoteSql = (sql: string, limit: number): string => {
  const normalizedSql = sql.trim()

  if (!normalizedSql) {
    throw new Error('Note SQL cannot be empty')
  }

  if (normalizedSql.length > MAX_NOTE_SQL_LENGTH) {
    throw new Error('Note SQL is too long')
  }

  if (normalizedSql.includes(';') || SQL_COMMENT_PATTERN.test(normalizedSql)) {
    throw new Error(
      'Note SQL only allows a single SELECT statement without comments'
    )
  }

  if (!/^select\b/i.test(normalizedSql)) {
    throw new Error('Note SQL only allows SELECT queries')
  }

  if (FORBIDDEN_SQL_PATTERN.test(normalizedSql)) {
    throw new Error('Note SQL contains a forbidden keyword')
  }

  if (
    !/\bfrom\s+notes\b/i.test(normalizedSql) &&
    !/\bfrom\s+notes\s+n\b/i.test(normalizedSql) &&
    !/\bfrom\s+notes\s+n\s+LEFT\s+JOIN\s+note_categories\b/i.test(normalizedSql)
  ) {
    throw new Error(`Note SQL can only query the notes table`)
  }

  if (/\bfrom\s+(?!notes\b|notes\s+n(\s+LEFT\s+JOIN\s+note_categories\s+nc)?)[a-z_][\w]*/i.test(normalizedSql)) {
    throw new Error(`Note SQL can only query the ${NOTE_TABLE_NAME} table`)
  }

  const hasLimit = /\blimit\s+\d+\b/i.test(normalizedSql)
  return hasLimit ? normalizedSql : `${normalizedSql} LIMIT ${limit}`
}

/**
 * 执行受控 Note SQL 查询。
 */
const queryBySql = (
  notesService: Pick<NotesService, 'querySql'>,
  sql: string,
  limit: number
): { items: NoteQueryToolItem[]; rows: unknown[] } => {
  const rows = notesService
    .querySql(prepareNoteSql(sql, limit))
    .slice(0, limit)
  const items = rows.filter(isNoteSqlRow).map(sqlRowToToolItem)

  return { items, rows }
}

/**
 * 渲染 SQL 查询观察文本。
 */
const renderSqlObservation = (rows: unknown[]): string => {
  if (rows.length === 0) {
    return 'SQL query returned no rows.'
  }

  const rowLabel = rows.length === 1 ? 'row' : 'rows'
  return `SQL query returned ${rows.length} ${rowLabel}.`
}

/**
 * 创建 Note 只读查询工具。
 */
export const createNoteQueryTool = (
  notesService: Pick<NotesService, 'querySql'>
): NoteQueryTool => ({
  name: 'notes_tool_query',
  description:
    'Query notes in the local Notes table. Read-only; never modifies data.',
  prompt: {
    summary:
      'Query notes in the local Notes table. Read-only; supports structured filters and controlled SQL.',
    intentKeywords: [
      '笔记',
      '速记',
      '随手记',
      '记录',
      '素材',
      'note',
      'notes',
      'query notes'
    ],
    whenToUse: [
      'Use when the user asks about notes, quick notes, jottings, or captured materials.',
      'Use when the user asks what notes exist by source, tags, category, or content keywords.',
      'Use read-only SQL against notes when the user needs combined filters, sorting, or more precise filtering.'
    ],
    whenNotToUse: [
      'Do not use for casual chat, writing, translation, or questions unrelated to local notes.',
      'Do not use when the user asks to create, update, or delete notes.'
    ],
    safety: [
      'Read only from the local Notes table. Never write data.',
      `SQL must be a single SELECT against only the ${NOTE_TABLE_NAME} table. JOIN, UNION, comments, multiple statements, and write keywords are forbidden.`,
      'Default to querying all notes (no date restriction).',
      'Never invent note items that the tool did not return.',
      'If tool results are insufficient, say the available information is insufficient.'
    ],
    output:
      'Return the note facts needed to answer the user. Do not repeat irrelevant fields.',
    examples: [
      `{"limit":10}`,
      `{"query":"React"}`,
      `{"tag":"前端","categoryId":1}`,
      `{"sql":"SELECT ${NOTE_COLUMNS} FROM ${NOTE_FROM_CLAUSE} ORDER BY n.time DESC","limit":5}`
    ]
  },
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search text contains (LIKE matching on title or content).'
      },
      tag: {
        type: 'string',
        description: 'Tag filter (LIKE matching on tags JSON string).'
      },
      categoryId: {
        type: 'number',
        description: 'Filter by category ID'
      },
      sql: {
        type: 'string',
        description: `Controlled read-only SQL. Must SELECT FROM ${NOTE_TABLE_NAME} (with optional LEFT JOIN note_categories nc); WHERE, ORDER BY, LIMIT, and COUNT(*) AS count are allowed.`
      },
      limit: {
        type: 'number',
        description: 'Maximum number of rows to return'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseInput(input)
    const limit = Math.max(
      1,
      Math.min(parsed.limit ?? DEFAULT_NOTE_LIMIT, MAX_NOTE_LIMIT)
    )

    const queryResult = parsed.sql
      ? queryBySql(notesService, parsed.sql, limit)
      : queryBySql(notesService, buildStructuredSql(parsed), limit)

    const { items, rows } = queryResult
    const observation = renderSqlObservation(rows)

    return {
      observation,
      data: { rows, items },
      items,
      rows
    }
  }
})

// Note 完整资料字段 Schema。
const NOTE_PROFILE_PROPERTIES = {
  confirmationSummary: {
    type: 'string',
    description:
      'Concise Markdown Chinese explanation shown above the internal confirmation. Include key add/update/delete facts: target title and important fields or facts being created, changed, or removed.'
  },
  title: {
    type: 'string',
    description: 'Note title'
  },
  content: {
    type: 'string',
    description: 'Note content'
  },
  tags: {
    type: 'array',
    items: {
      type: 'string'
    },
    description: 'Note tags'
  }
}

/**
 * 生成 Note 写入目标名称。
 */
const renderNoteMutationTarget = (input: unknown): string | null =>
  getNoteInputString(input, 'title') ??
  (typeof (input as Record<string, unknown> | null)?.id === 'number'
    ? `#${(input as Record<string, unknown>).id as number}`
    : null)

/**
 * 生成 Note 写入前确认说明。
 */
const renderNoteMutationSummary = (
  action: NoteWriteAction,
  input: unknown
): string | null => {
  const aiSummary = getNoteInputString(input, 'confirmationSummary')
  const title = getNoteInputString(input, 'title')
  const id = typeof (input as Record<string, unknown> | null)?.id === 'number'
    ? String((input as Record<string, unknown>).id)
    : null
  const target = title ?? id

  if (aiSummary) {
    return aiSummary
  }

  if (!target) {
    return null
  }

  if (action === 'add') {
    return `将创建笔记：${target}。`
  }

  if (action === 'update') {
    return `将更新笔记：${target}。`
  }

  return `将删除笔记：${target}。`
}

/**
 * 生成 Note 写入完成提示。
 */
const renderNoteMutationCompletion = (
  action: NoteWriteAction,
  input: unknown,
  result: { data: unknown }
): string | null => {
  const prefixes: Record<NoteWriteAction, string> = {
    add: '已添加笔记',
    update: '已更新笔记',
    delete: '已删除笔记'
  }
  const target =
    getNoteInputString(
      isRecord(result.data) && isRecord(result.data.item) ? result.data.item : null,
      'title'
    ) ?? getNoteInputString(input, 'title')

  return target ? `${prefixes[action]}：${target}。` : `${prefixes[action]}。`
}

// Note 创建确认配置。
const NOTE_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认创建',
  question: '确认创建笔记',
  confirm: '确认创建',
  cancel: '取消创建',
  renderTarget: renderNoteMutationTarget,
  renderSummary: (input) => renderNoteMutationSummary('add', input),
  completion: {
    renderMessage: (input, result) =>
      renderNoteMutationCompletion('add', input, result)
  }
}

// Note 更新确认配置。
const NOTE_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认更新',
  question: '确认更新笔记',
  confirm: '确认更新',
  cancel: '取消更新',
  renderTarget: renderNoteMutationTarget,
  renderSummary: (input) => renderNoteMutationSummary('update', input),
  completion: {
    renderMessage: (input, result) =>
      renderNoteMutationCompletion('update', input, result)
  }
}

// Note 删除确认配置。
const NOTE_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认删除',
  question: '确认永久删除笔记',
  confirm: '确认删除',
  cancel: '取消删除',
  renderTarget: renderNoteMutationTarget,
  renderSummary: (input) => renderNoteMutationSummary('delete', input),
  completion: {
    renderMessage: (input, result) =>
      renderNoteMutationCompletion('delete', input, result)
  }
}

/**
 * 解析字符串数组。
 */
const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

/**
 * 解析 Note 新建入参。
 */
const parseCreateInput = (input: unknown): NoteCreateInput => {
  if (!isRecord(input)) {
    throw new Error('Note create input must be an object')
  }

  const title = parseString(input.title)?.trim()
  const content = parseString(input.content)?.trim() ?? ''
  const tags = parseStringArray(input.tags)

  if (!title) {
    throw new Error('Note create requires title')
  }

  if (!content) {
    throw new Error('Note create requires content')
  }

  return { title, content, tags }
}

/**
 * 解析 Note 更新入参。
 */
const parseUpdateInput = (
  input: unknown
): { id: number; profile: NoteCreateInput } => {
  if (!isRecord(input)) {
    throw new Error('Note update input must be an object')
  }

  if (typeof input.id !== 'number') {
    throw new Error('Note update requires numeric id')
  }

  const title = parseString(input.title)?.trim()
  const content = parseString(input.content)?.trim() ?? ''
  const tags = parseStringArray(input.tags)

  if (!title) {
    throw new Error('Note update requires title')
  }

  if (!content) {
    throw new Error('Note update requires content')
  }

  return {
    id: input.id,
    profile: { title, content, tags }
  }
}

/**
 * 解析 Note 删除入参。
 */
const parseDeleteInput = (input: unknown): { id: number } => {
  if (!isRecord(input)) {
    throw new Error('Note delete input must be an object')
  }

  if (typeof input.id !== 'number') {
    throw new Error('Note delete requires numeric id')
  }

  return { id: input.id }
}

/**
 * 创建 Note 新建工具。
 */
export const createNoteAddTool = (
  notesService: Pick<NotesService, 'create'>
): NoteWriteTool => ({
  name: 'notes_tool_add',
  description: 'Create a note item in the local Notes table.',
  confirmation: NOTE_ADD_CONFIRMATION,
  prompt: {
    summary: 'Create a new note item in the local Notes table.',
    intentKeywords: [
      '添加笔记',
      '新增笔记',
      '创建笔记',
      '记录笔记',
      'add note',
      'create note'
    ],
    whenToUse: [
      'Use when the user explicitly asks to create a new note.',
      'Use common_tool_ask to ask for missing required facts when the create request is underspecified.'
    ],
    whenNotToUse: [
      'Do not use for read-only questions about existing notes.',
      'Do not use when the user has not asked to create a note.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For creation, confirmationSummary must include the note title and source.',
      'Never invent note content the user did not provide or confirm.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return the created note facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将创建笔记：**React 学习笔记**。","title":"React 学习笔记","content":"React 的核心概念包括组件、状态和属性…","tags":["前端","学习"]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['title', 'content', 'tags', 'confirmationSummary'],
    properties: {
      ...NOTE_PROFILE_PROPERTIES
    }
  },
  execute: async (input) => {
    const created = notesService.create(parseCreateInput(input))

    return {
      observation: `Created note: ${created.title}.`,
      data: { item: toToolItem(created) }
    }
  }
})

/**
 * 创建 Note 更新工具。
 */
export const createNoteUpdateTool = (
  notesService: Pick<NotesService, 'update'>
): NoteWriteTool => ({
  name: 'notes_tool_update',
  description: 'Update an existing note item in the local Notes table by id.',
  confirmation: NOTE_UPDATE_CONFIRMATION,
  prompt: {
    summary: 'Update an existing note item in the local Notes table by id.',
    intentKeywords: [
      '修改笔记',
      '更新笔记',
      '纠正笔记',
      'update note',
      'edit note'
    ],
    whenToUse: [
      'Use when the user explicitly asks to update an existing note.',
      'Use after notes_tool_query when the user identifies a note by title instead of id, then update the resolved note id.'
    ],
    whenNotToUse: [
      'Do not use for creating new notes.',
      'Do not use when the user only mentions a note without explicitly asking to update it.',
      'Do not use when the target note id is unknown.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm updates; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For updates, confirmationSummary must name the note title and list the key fields that will change.',
      'Require the note id and the complete replacement fields (title, content, tags).',
      'Query first when the user only provides a title, then merge unchanged fields before updating.',
      'Never overwrite fields with guesses.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return the updated note facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将更新笔记：**React 学习笔记**。\\n- 标签：前端","id":1,"title":"React 学习笔记","content":"React 的核心概念包括组件、状态和属性…","tags":["前端"]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'title', 'content', 'tags', 'confirmationSummary'],
    properties: {
      id: {
        type: 'number',
        description: 'Note item id'
      },
      ...NOTE_PROFILE_PROPERTIES
    }
  },
  execute: async (input) => {
    const parsed = parseUpdateInput(input)
    const updated = notesService.update(parsed.id, parsed.profile)

    return {
      observation: `Updated note: ${updated.title}.`,
      data: { item: toToolItem(updated) }
    }
  }
})

/**
 * 创建 Note 删除工具。
 */
export const createNoteDeleteTool = (
  notesService: Pick<NotesService, 'delete'>
): NoteWriteTool => ({
  name: 'notes_tool_delete',
  description: 'Delete an existing note item from the local Notes table by id.',
  confirmation: NOTE_DELETE_CONFIRMATION,
  prompt: {
    summary: 'Delete an existing note item from the local Notes table by id.',
    intentKeywords: [
      '删除笔记',
      '移除笔记',
      '删掉笔记',
      'delete note',
      'remove note'
    ],
    whenToUse: [
      'Use when the user explicitly asks to delete a note.',
      'Use after notes_tool_query when the user identifies a note by title instead of id, then delete the resolved note id.'
    ],
    whenNotToUse: [
      'Do not use for temporary filtering or hiding.',
      'Do not use when the target note id is unknown or ambiguous.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For deletion, confirmationSummary must identify the note title and any key facts known from query results.',
      'Require the exact numeric note id.',
      'Ask the user for clarification before deleting when multiple notes may match.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return a concise deletion confirmation.',
    examples: [
      '{"confirmationSummary":"将删除笔记：**React 学习笔记**（聊天粘贴）。","id":1}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. Include the note title and key distinguishing facts.'
      },
      id: {
        type: 'number',
        description: 'Note item id'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseDeleteInput(input)
    notesService.delete(parsed.id)

    return {
      observation: `Deleted note: ${parsed.id}.`,
      data: { id: parsed.id }
    }
  }
})

// Note 批量创建确认配置。
const NOTE_BATCH_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: '批量确认创建',
  question: '确认批量创建笔记',
  confirm: '确认创建',
  cancel: '取消创建',
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const items = Array.isArray(input.items) ? input.items : []
    return `${items.length} 项笔记`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getNoteInputString(input, 'confirmationSummary')
    if (aiSummary) return aiSummary
    const items = Array.isArray(input.items) ? input.items : []
    if (items.length === 0) return null
    const previews = (items as unknown[]).slice(0, 3).map((item) => {
      if (!isRecord(item)) return null
      return getNoteInputString(item, 'title')
    }).filter((p): p is string => Boolean(p))
    const suffix = items.length > 3 ? ` 等 ${items.length} 项` : ''
    return `将批量创建笔记：${previews.join('、')}${suffix}。`
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === 'number' ? `已批量创建 ${count} 项笔记。` : '已批量创建笔记。'
    }
  }
}

// Note 批量更新确认配置。
const NOTE_BATCH_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: '批量确认更新',
  question: '确认批量更新笔记',
  confirm: '确认更新',
  cancel: '取消更新',
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const items = Array.isArray(input.items) ? input.items : []
    return `${items.length} 项笔记`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getNoteInputString(input, 'confirmationSummary')
    if (aiSummary) return aiSummary
    const items = Array.isArray(input.items) ? input.items : []
    if (items.length === 0) return null
    const previews = (items as unknown[]).slice(0, 3).map((item) => {
      if (!isRecord(item)) return null
      const title = getNoteInputString(item, 'title')
      const id = getNoteInputString(item, 'id')
      return title ?? id ?? null
    }).filter((p): p is string => Boolean(p))
    const suffix = items.length > 3 ? ` 等 ${items.length} 项` : ''
    return `将批量更新笔记：${previews.join('、')}${suffix}。`
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === 'number' ? `已批量更新 ${count} 项笔记。` : '已批量更新笔记。'
    }
  }
}

// Note 批量删除确认配置。
const NOTE_BATCH_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: '批量确认删除',
  question: '确认批量永久删除笔记',
  confirm: '确认删除',
  cancel: '取消删除',
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const ids = Array.isArray(input.ids) ? input.ids : []
    return `${ids.length} 项笔记`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getNoteInputString(input, 'confirmationSummary')
    if (aiSummary) return aiSummary
    const ids = Array.isArray(input.ids) ? input.ids : []
    return ids.length > 0 ? `将批量删除 ${ids.length} 项笔记。` : null
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === 'number' ? `已批量删除 ${count} 项笔记。` : '已批量删除笔记。'
    }
  }
}

/**
 * 创建 Note 批量新建工具。
 */
const createNoteBatchAddTool = (
  notesService: Pick<NotesService, 'create'>
): NoteWriteTool => ({
  name: 'notes_tool_batch_add',
  description: 'Create multiple note items at once in the local Notes table.',
  confirmation: NOTE_BATCH_ADD_CONFIRMATION,
  prompt: {
    summary: 'Batch create multiple note items in the local Notes table.',
    intentKeywords: [
      '批量添加笔记',
      '批量创建笔记',
      '批量新增笔记',
      'batch add notes',
      'batch create notes'
    ],
    whenToUse: [
      'Use when the user explicitly asks to create multiple notes at once.',
      'Use when the user lists several notes separated by newlines, commas, or bullet points.',
      'Use when batch creation is more efficient than calling the single-add tool multiple times.',
      'Use common_tool_ask to ask for missing required facts when any batch item is underspecified.'
    ],
    whenNotToUse: [
      'Do not use for creating a single note — use notes_tool_add instead.',
      'Do not use for read-only questions about existing notes.',
      'Do not use when the user has not asked to create notes.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For batch creation, confirmationSummary must summarize the items being created (count and key titles).',
      'Never invent note content the user did not provide or confirm.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return count and created note facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将批量创建 2 项笔记。\\n- React 学习笔记\\n- Vue 3 速记","items":[{"title":"React 学习笔记","content":"React 的核心概念…","tags":["前端","学习"]},{"title":"Vue 3 速记","content":"Vue 3 的 Composition API…","tags":["前端","学习"]}]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['items', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. List all items or summarize with count and key titles.'
      },
      items: {
        type: 'array',
        description: 'Array of note items to create',
        items: {
          type: 'object',
          required: ['title', 'content', 'tags'],
          properties: {
            title: {
              type: 'string',
              description: 'Note title'
            },
            content: {
              type: 'string',
              description: 'Note content'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Note tags'
            }
          }
        }
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.items)) {
      throw new Error('Note batch create requires items array')
    }

    const results = (input.items as unknown[]).map((item) => {
      const created = notesService.create(parseCreateInput(item))
      return toToolItem(created)
    })

    return {
      observation: `Batch created ${results.length} notes.`,
      data: { items: results, count: results.length }
    }
  }
})

/**
 * 创建 Note 批量更新工具。
 */
const createNoteBatchUpdateTool = (
  notesService: Pick<NotesService, 'update'>
): NoteWriteTool => ({
  name: 'notes_tool_batch_update',
  description: 'Update multiple note items at once in the local Notes table by id.',
  confirmation: NOTE_BATCH_UPDATE_CONFIRMATION,
  prompt: {
    summary: 'Batch update multiple note items in the local Notes table by id.',
    intentKeywords: [
      '批量修改笔记',
      '批量更新笔记',
      'batch update notes',
      'batch edit notes'
    ],
    whenToUse: [
      'Use when the user explicitly asks to update multiple note items at once.',
      'Use after notes_tool_query when the user identifies multiple notes to update.'
    ],
    whenNotToUse: [
      'Do not use for updating a single note — use notes_tool_update instead.',
      'Do not use for creating new notes.',
      'Do not use when target note ids are unknown or ambiguous.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm updates; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For batch updates, confirmationSummary must summarize the changes (count, key fields being modified).',
      'Each item must include its numeric id and complete replacement fields.',
      'Query first when the user provides descriptions instead of ids.',
      'Never overwrite fields with guesses.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return count and updated note facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将批量更新 2 项笔记的标签。","items":[{"id":1,"title":"React 学习笔记","content":"React 的核心概念…","tags":["前端","极客"]},{"id":2,"title":"Vue 3 速记","content":"Vue 3 的 Composition API…","tags":["前端","极客"]}]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['items', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. Summarize all items and key changed fields.'
      },
      items: {
        type: 'array',
        description: 'Array of note items to update, each with id and replacement fields',
        items: {
          type: 'object',
          required: ['id', 'title', 'content', 'tags'],
          properties: {
            id: {
              type: 'number',
              description: 'Note item id'
            },
            title: {
              type: 'string',
              description: 'Note title'
            },
            content: {
              type: 'string',
              description: 'Note content'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Note tags'
            }
          }
        }
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.items)) {
      throw new Error('Note batch update requires items array')
    }

    const results = (input.items as unknown[]).map((item) => {
      const parsed = parseUpdateInput(item)
      const updated = notesService.update(parsed.id, parsed.profile)
      return toToolItem(updated)
    })

    return {
      observation: `Batch updated ${results.length} notes.`,
      data: { items: results, count: results.length }
    }
  }
})

/**
 * 创建 Note 批量删除工具。
 */
const createNoteBatchDeleteTool = (
  notesService: Pick<NotesService, 'delete'>
): NoteWriteTool => ({
  name: 'notes_tool_batch_delete',
  description: 'Delete multiple note items at once from the local Notes table by id.',
  confirmation: NOTE_BATCH_DELETE_CONFIRMATION,
  prompt: {
    summary: 'Batch delete multiple note items from the local Notes table by id.',
    intentKeywords: [
      '批量删除笔记',
      '批量移除笔记',
      '清空笔记',
      '全部删除笔记',
      'batch delete notes',
      'remove all notes'
    ],
    whenToUse: [
      'Use when the user explicitly asks to delete multiple note items at once.',
      'Use when the user asks to "clear all notes" or "delete all notes".',
      'Use after notes_tool_query when the user identifies multiple notes to delete.'
    ],
    whenNotToUse: [
      'Do not use for deleting a single note — use notes_tool_delete instead.',
      'Do not use for temporary filtering or hiding.',
      'Do not use when target note ids are unknown or ambiguous.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For batch deletion, confirmationSummary must identify the count and distinguishing facts of notes being deleted.',
      'Require exact numeric ids.',
      'Ask the user for clarification before deleting when the set of notes is ambiguous.',
      'Batch deletion is permanent and cannot be undone — be conservative.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return count and concise deletion confirmation.',
    examples: [
      '{"confirmationSummary":"将批量删除 3 项笔记。\\n- #1 React 学习笔记\\n- #2 Vue 3 速记\\n- #3 TypeScript 技巧","ids":[1,2,3]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['ids', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. Include the count and key distinguishing facts.'
      },
      ids: {
        type: 'array',
        description: 'Array of note ids to delete',
        items: {
          type: 'number',
          description: 'Note item id'
        }
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.ids) || input.ids.some((id: unknown) => typeof id !== 'number')) {
      throw new Error('Note batch delete requires ids array of numbers')
    }

    const ids = input.ids as number[]
    ids.forEach((id) => {
      notesService.delete(id)
    })

    return {
      observation: `Batch deleted ${ids.length} notes.`,
      data: { ids, count: ids.length }
    }
  }
})

/**
 * 创建完整 Note 工具组。
 */
export const createNoteTools = (
  notesService: Pick<
    NotesService,
    'querySql' | 'create' | 'update' | 'delete'
  >
): AgentTool[] => [
  createNoteQueryTool(notesService),
  createNoteAddTool(notesService),
  createNoteUpdateTool(notesService),
  createNoteDeleteTool(notesService),
  createNoteBatchAddTool(notesService),
  createNoteBatchUpdateTool(notesService),
  createNoteBatchDeleteTool(notesService)
]
