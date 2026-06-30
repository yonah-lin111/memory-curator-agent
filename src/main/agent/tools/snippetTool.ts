import type { SnippetCreateInput, SnippetItem, SnippetUpdateInput } from '@/db/schema'
import type { SnippetsService } from '@/services/snippetsService'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'
import type {
  AgentTool,
  SnippetQueryConditions,
  SnippetQueryToolInput,
  SnippetQueryToolItem,
  SnippetQueryToolResult
} from '@/agent/types'

// Snippet 查询工具类型。
type SnippetQueryTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 Snippet 查询。
   */
  execute: (input: unknown) => Promise<SnippetQueryToolResult>
}

// Snippet 写入工具结果。
type SnippetWriteToolResult = {
  // 回灌模型的观察文本。
  observation: string
  // 调试或 UI 可用结构化数据。
  data: unknown
}

// Snippet 写入工具类型。
type SnippetWriteTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 Snippet 写入。
   */
  execute: (input: unknown) => Promise<SnippetWriteToolResult>
}

// Snippet 写入动作。
type SnippetWriteAction = 'add' | 'update' | 'delete'

// Snippet 工具默认返回数量。
const DEFAULT_SNIPPET_LIMIT = 20

// Snippet 工具最大返回数量。
const MAX_SNIPPET_LIMIT = 50

// Snippet SQL 最大长度。
const MAX_SNIPPET_SQL_LENGTH = 1200

// Snippet 查询表名。
const SNIPPET_TABLE_NAME = 'snippets'

// Snippet 查询字段清单。
const SNIPPET_COLUMNS =
  'id, entry_date, title, content, tags, created_at, updated_at'

// 禁止 AI SQL 使用的高风险关键字。
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union|join)\b/i

// SQL 注释片段。
const SQL_COMMENT_PATTERN = /--|\/\*|\*\//

// Snippet 数据库行类型。
type SnippetSqlRow = Record<string, unknown>

/**
 * 将片段映射为工具返回项。
 */
const toToolItem = (snippet: SnippetItem): SnippetQueryToolItem => ({
  id: snippet.id,
  entryDate: snippet.entryDate,
  title: snippet.title,
  content: snippet.content,
  tags: snippet.tags,
  createdAt: snippet.createdAt,
  updatedAt: snippet.updatedAt
})

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 判断 SQL 原始行是否包含完整片段字段。
 */
const isSnippetSqlRow = (value: unknown): value is SnippetSqlRow =>
  isRecord(value) &&
  typeof value.id === 'number' &&
  typeof value.entry_date === 'string' &&
  typeof value.title === 'string' &&
  typeof value.content === 'string' &&
  typeof value.tags === 'string' &&
  typeof value.created_at === 'string' &&
  typeof value.updated_at === 'string'

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
 * 将完整 SQL 片段行映射为工具返回项。
 */
const sqlRowToToolItem = (row: SnippetSqlRow): SnippetQueryToolItem =>
  toToolItem({
    id: row.id as number,
    entryDate: row.entry_date as string,
    title: row.title as string,
    content: row.content as string,
    tags: parseSqlTags(row.tags as string),
    time: typeof row.created_at === 'string' && row.created_at.includes('T') ? new Date(row.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : (typeof row.created_at === 'string' ? row.created_at.slice(11, 16) : ''),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  })

/**
 * 解析字符串字段。
 */
const parseString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/**
 * 读取 Snippet 写入输入中的非空字符串字段。
 */
const getSnippetInputString = (input: unknown, key: string): string | null => {
  if (!isRecord(input)) {
    return null
  }

  const value = parseString(input[key])?.trim()

  return value || null
}

/**
 * 解析 Snippet 条件查询条件入参。
 */
const parseConditions = (value: unknown): SnippetQueryConditions | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  return {
    title: parseString(value.title),
    content: parseString(value.content),
    tag: parseString(value.tag),
    updatedAfter: parseString(value.updatedAfter),
    updatedBefore: parseString(value.updatedBefore)
  }
}

/**
 * 解析 Snippet 工具入参。
 */
const parseInput = (input: unknown): SnippetQueryToolInput => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    entryDate: parseString(input.entryDate),
    query: parseString(input.query),
    conditions: parseConditions(input.conditions),
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
const buildStructuredWhere = (parsed: SnippetQueryToolInput): string => {
  const entryDate = parsed.entryDate?.trim() || 'all'
  const isCrossDate = entryDate === 'all'
  const conditions = parsed.conditions

  const whereParts: (string | null)[] = [
    isCrossDate ? null : `entry_date = '${escapeSqlString(entryDate)}'`,
    buildLikeCondition('title', conditions?.title),
    buildLikeCondition('content', conditions?.content),
    buildLikeCondition('tags', conditions?.tag),
    conditions?.updatedAfter
      ? `updated_at >= '${escapeSqlString(conditions.updatedAfter.trim())}'`
      : null,
    conditions?.updatedBefore
      ? `updated_at <= '${escapeSqlString(conditions.updatedBefore.trim())}'`
      : null,
    parsed.query
      ? `(title LIKE '%${escapeSqlLike(parsed.query.trim())}%' OR content LIKE '%${escapeSqlLike(parsed.query.trim())}%')`
      : null
  ]

  const filtered = whereParts.filter((condition): condition is string => Boolean(condition))

  return filtered.length > 0 ? ` WHERE ${filtered.join(' AND ')}` : ''
}

/**
 * 将结构化查询编译为受控 SQL。
 */
const buildStructuredSql = (parsed: SnippetQueryToolInput): string =>
  `SELECT ${SNIPPET_COLUMNS} FROM ${SNIPPET_TABLE_NAME}${buildStructuredWhere(parsed)} ORDER BY updated_at DESC, created_at DESC`

/**
 * 校验并限制 AI 生成的 Snippet SQL。
 */
const prepareSnippetSql = (sql: string, limit: number): string => {
  const normalizedSql = sql.trim()

  if (!normalizedSql) {
    throw new Error('Snippet SQL cannot be empty')
  }

  if (normalizedSql.length > MAX_SNIPPET_SQL_LENGTH) {
    throw new Error('Snippet SQL is too long')
  }

  if (normalizedSql.includes(';') || SQL_COMMENT_PATTERN.test(normalizedSql)) {
    throw new Error(
      'Snippet SQL only allows a single SELECT statement without comments'
    )
  }

  if (!/^select\b/i.test(normalizedSql)) {
    throw new Error('Snippet SQL only allows SELECT queries')
  }

  if (FORBIDDEN_SQL_PATTERN.test(normalizedSql)) {
    throw new Error('Snippet SQL contains a forbidden keyword')
  }

  if (
    !new RegExp(`\\bfrom\\s+${SNIPPET_TABLE_NAME}\\b`, 'i').test(normalizedSql)
  ) {
    throw new Error(`Snippet SQL can only query the ${SNIPPET_TABLE_NAME} table`)
  }

  if (/\bfrom\s+(?!snippets\b)[a-z_][\w]*/i.test(normalizedSql)) {
    throw new Error(`Snippet SQL can only query the ${SNIPPET_TABLE_NAME} table`)
  }

  const hasLimit = /\blimit\s+\d+\b/i.test(normalizedSql)
  return hasLimit ? normalizedSql : `${normalizedSql} LIMIT ${limit}`
}

/**
 * 执行受控 Snippet SQL 查询。
 */
const queryBySql = (
  snippetsService: Pick<SnippetsService, 'querySql'>,
  sql: string,
  limit: number
): { items: SnippetQueryToolItem[]; rows: unknown[] } => {
  const rows = snippetsService
    .querySql(prepareSnippetSql(sql, limit))
    .slice(0, limit)
  const items = rows.filter(isSnippetSqlRow).map(sqlRowToToolItem)

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
 * 创建 Snippet 只读查询工具。
 */
export const createSnippetQueryTool = (
  snippetsService: Pick<SnippetsService, 'querySql'>
): SnippetQueryTool => ({
  name: 'snippets_tool_query',
  description:
    'Query snippets in the local Snippets table. Read-only; never modifies data.',
  prompt: {
    summary:
      'Query snippets in the local Snippets table. Read-only; supports structured filters and controlled SQL.',
    intentKeywords: [
      '片段',
      '代码片段',
      '片段查询',
      '笔记片段',
      'snippets',
      'snippet',
      'query snippets'
    ],
    whenToUse: [
      'Use when the user asks about snippets, code snippets, saved clips, or notebooks.',
      'Use when the user asks what snippets exist on a specific date or across all dates.',
      'Use when the user queries snippets with specific tags, content keywords, or titles.',
      'Use read-only SQL against snippets when the user needs combined filters, sorting, or more precise filtering.'
    ],
    whenNotToUse: [
      'Do not use for casual chat, writing, translation, or questions unrelated to local snippets.',
      'Do not use when the user asks to create, update, or delete snippets.'
    ],
    safety: [
      'Read only from the local Snippets table. Never write data.',
      `SQL must be a single SELECT against only the ${SNIPPET_TABLE_NAME} table. JOIN, UNION, comments, multiple statements, and write keywords are forbidden.`,
      'Default to "all" to query across all dates when entryDate is not specified.',
      'Never invent snippet items that the tool did not return.',
      'If tool results are insufficient, say the available information is insufficient.'
    ],
    output:
      'Return the snippet facts needed to answer the user. Do not repeat irrelevant fields.',
    examples: [
      `{"limit":10}`,
      `{"query":"React","entryDate":"all"}`,
      `{"sql":"SELECT ${SNIPPET_COLUMNS} FROM ${SNIPPET_TABLE_NAME} WHERE tags LIKE '%React%' ORDER BY updated_at DESC","limit":5}`
    ]
  },
  parameters: {
    type: 'object',
    properties: {
      entryDate: {
        type: 'string',
        description:
          'Target date in YYYY-MM-DD format. Defaults to "all" to query across all dates.'
      },
      query: {
        type: 'string',
        description: 'Search text contains (LIKE matching on title or content).'
      },
      conditions: {
        type: 'object',
        description: 'Structured filters.',
        properties: {
          title: {
            type: 'string',
            description: 'Title contains'
          },
          content: {
            type: 'string',
            description: 'Content contains'
          },
          tag: {
            type: 'string',
            description: 'Any tag contains'
          },
          updatedAfter: {
            type: 'string',
            description: 'Updated-at lower bound, in the same format as updated_at'
          },
          updatedBefore: {
            type: 'string',
            description: 'Updated-at upper bound, in the same format as updated_at'
          }
        }
      },
      sql: {
        type: 'string',
        description: `Controlled read-only SQL. Must SELECT FROM ${SNIPPET_TABLE_NAME}; WHERE, ORDER BY, LIMIT, and COUNT(*) AS count are allowed.`
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
      Math.min(parsed.limit ?? DEFAULT_SNIPPET_LIMIT, MAX_SNIPPET_LIMIT)
    )

    const queryResult = parsed.sql
      ? queryBySql(snippetsService, parsed.sql, limit)
      : queryBySql(snippetsService, buildStructuredSql(parsed), limit)

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

// Snippet 完整资料字段 Schema。
const SNIPPET_PROFILE_PROPERTIES = {
  confirmationSummary: {
    type: 'string',
    description:
      'Concise Markdown Chinese explanation shown above the internal confirmation. Include key add/update/delete facts: target title and important fields or facts being created, changed, or removed.'
  },
  entryDate: {
    type: 'string',
    description: 'Target date in YYYY-MM-DD format. Default to today when not explicitly specified.'
  },
  title: {
    type: 'string',
    description: 'Snippet title'
  },
  content: {
    type: 'string',
    description: 'Snippet content'
  },
  tags: {
    type: 'array',
    items: {
      type: 'string'
    },
    description: 'Snippet tags'
  }
}

/**
 * 生成 Snippet 写入目标名称。
 */
const renderSnippetMutationTarget = (input: unknown): string | null =>
  getSnippetInputString(input, 'title') ??
  (typeof (input as Record<string, unknown> | null)?.id === 'number'
    ? `#${(input as Record<string, unknown>).id as number}`
    : null)

/**
 * 生成 Snippet 写入前确认说明。
 */
const renderSnippetMutationSummary = (
  action: SnippetWriteAction,
  input: unknown
): string | null => {
  const aiSummary = getSnippetInputString(input, 'confirmationSummary')
  const title = getSnippetInputString(input, 'title')
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
    return `将创建片段：${target}。`
  }

  if (action === 'update') {
    return `将更新片段：${target}。`
  }

  return `将删除片段：${target}。`
}

/**
 * 生成 Snippet 写入完成提示。
 */
const renderSnippetMutationCompletion = (
  action: SnippetWriteAction,
  input: unknown,
  result: { data: unknown }
): string | null => {
  const prefixes: Record<SnippetWriteAction, string> = {
    add: '已添加片段',
    update: '已更新片段',
    delete: '已删除片段'
  }
  const target =
    getSnippetInputString(
      isRecord(result.data) && isRecord(result.data.item) ? result.data.item : null,
      'title'
    ) ?? getSnippetInputString(input, 'title')

  return target ? `${prefixes[action]}：${target}。` : `${prefixes[action]}。`
}

// Snippet 创建确认配置。
const SNIPPET_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认创建',
  question: '确认创建片段',
  confirm: '确认创建',
  cancel: '取消创建',
  renderTarget: renderSnippetMutationTarget,
  renderSummary: (input) => renderSnippetMutationSummary('add', input),
  completion: {
    renderMessage: (input, result) =>
      renderSnippetMutationCompletion('add', input, result)
  }
}

// Snippet 更新确认配置。
const SNIPPET_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认更新',
  question: '确认更新片段',
  confirm: '确认更新',
  cancel: '取消更新',
  renderTarget: renderSnippetMutationTarget,
  renderSummary: (input) => renderSnippetMutationSummary('update', input),
  completion: {
    renderMessage: (input, result) =>
      renderSnippetMutationCompletion('update', input, result)
  }
}

// Snippet 删除确认配置。
const SNIPPET_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认删除',
  question: '确认永久删除片段',
  confirm: '确认删除',
  cancel: '取消删除',
  renderTarget: renderSnippetMutationTarget,
  renderSummary: (input) => renderSnippetMutationSummary('delete', input),
  completion: {
    renderMessage: (input, result) =>
      renderSnippetMutationCompletion('delete', input, result)
  }
}

/**
 * 解析 Snippet 新建入参。
 */
const parseCreateInput = (input: unknown): SnippetCreateInput => {
  if (!isRecord(input)) {
    throw new Error('Snippet create input must be an object')
  }

  const entryDate = parseString(input.entryDate)?.trim()
  const title = parseString(input.title) ?? ''
  const content = parseString(input.content) ?? ''
  const tags = parseStringArray(input.tags)

  if (!entryDate) {
    throw new Error('Snippet create requires entryDate')
  }

  return { entryDate, title, content, tags }
}

/**
 * 解析 Snippet 更新入参。
 */
const parseUpdateInput = (
  input: unknown
): { id: number; profile: SnippetUpdateInput } => {
  if (!isRecord(input)) {
    throw new Error('Snippet update input must be an object')
  }

  if (typeof input.id !== 'number') {
    throw new Error('Snippet update requires numeric id')
  }

  const title = parseString(input.title) ?? ''
  const content = parseString(input.content) ?? ''
  const tags = parseStringArray(input.tags)

  return {
    id: input.id,
    profile: { title, content, tags }
  }
}

/**
 * 解析 Snippet 删除入参。
 */
const parseDeleteInput = (input: unknown): { id: number } => {
  if (!isRecord(input)) {
    throw new Error('Snippet delete input must be an object')
  }

  if (typeof input.id !== 'number') {
    throw new Error('Snippet delete requires numeric id')
  }

  return { id: input.id }
}

/**
 * 解析字符串数组。
 */
const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

/**
 * 创建 Snippet 新建工具。
 */
export const createSnippetAddTool = (
  snippetsService: Pick<SnippetsService, 'create'>
): SnippetWriteTool => ({
  name: 'snippets_tool_add',
  description: 'Create a snippet item in the local Snippets table.',
  confirmation: SNIPPET_ADD_CONFIRMATION,
  prompt: {
    summary: 'Create a new snippet item in the local Snippets table.',
    intentKeywords: [
      '添加片段',
      '新增片段',
      '创建片段',
      '记录片段',
      'add snippet',
      'create snippet'
    ],
    whenToUse: [
      'Use when the user explicitly asks to create a new snippet item.',
      'Use common_tool_ask to ask for missing required facts when the create request is underspecified.'
    ],
    whenNotToUse: [
      'Do not use for read-only questions about existing snippets.',
      'Do not use when the user has not asked to create a snippet.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For creation, confirmationSummary must include the snippet title and tags.',
      'entryDate defaults to today when not explicitly specified by the user.',
      'Never invent snippet content the user did not provide or confirm.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return the created snippet facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将创建代码片段：**React Hook**（前端）。","entryDate":"2026-06-10","title":"React Hook","content":"const a = 1;","tags":["前端"]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['entryDate', 'title', 'content', 'tags', 'confirmationSummary'],
    properties: {
      ...SNIPPET_PROFILE_PROPERTIES
    }
  },
  execute: async (input) => {
    const created = snippetsService.create(parseCreateInput(input))

    return {
      observation: `Created snippet: ${created.title}.`,
      data: { item: toToolItem(created) }
    }
  }
})

/**
 * 创建 Snippet 更新工具。
 */
export const createSnippetUpdateTool = (
  snippetsService: Pick<SnippetsService, 'update'>
): SnippetWriteTool => ({
  name: 'snippets_tool_update',
  description: 'Update an existing snippet item in the local Snippets table by id.',
  confirmation: SNIPPET_UPDATE_CONFIRMATION,
  prompt: {
    summary: 'Update an existing snippet item in the local Snippets table by id.',
    intentKeywords: [
      '修改片段',
      '更新片段',
      '纠正片段',
      'update snippet',
      'edit snippet'
    ],
    whenToUse: [
      'Use when the user explicitly asks to update an existing snippet.',
      'Use after snippets_tool_query when the user identifies a snippet by title instead of id, then update the resolved snippet id.'
    ],
    whenNotToUse: [
      'Do not use for creating new snippets.',
      'Do not use when the user only mentions a snippet without explicitly asking to update it.',
      'Do not use when the target snippet id is unknown.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm updates; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For updates, confirmationSummary must name the snippet title and list the key fields that will change.',
      'Require the snippet id and the complete replacement fields.',
      'Query first when the user only provides a title, then merge unchanged fields before updating.',
      'Never overwrite fields with guesses.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return the updated snippet facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将更新代码片段：**React Hook**。\\n- 标签：前端、极客","id":1,"title":"React Hook","content":"const a = 2;","tags":["前端","极客"]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'title', 'content', 'tags', 'confirmationSummary'],
    properties: {
      id: {
        type: 'number',
        description: 'Snippet item id'
      },
      ...SNIPPET_PROFILE_PROPERTIES
    }
  },
  execute: async (input) => {
    const parsed = parseUpdateInput(input)
    const updated = snippetsService.update(parsed.id, parsed.profile)

    return {
      observation: `Updated snippet: ${updated.title}.`,
      data: { item: toToolItem(updated) }
    }
  }
})

/**
 * 创建 Snippet 删除工具。
 */
export const createSnippetDeleteTool = (
  snippetsService: Pick<SnippetsService, 'delete'>
): SnippetWriteTool => ({
  name: 'snippets_tool_delete',
  description: 'Delete an existing snippet item from the local Snippets table by id.',
  confirmation: SNIPPET_DELETE_CONFIRMATION,
  prompt: {
    summary: 'Delete an existing snippet item from the local Snippets table by id.',
    intentKeywords: [
      '删除片段',
      '移除片段',
      '删掉片段',
      'delete snippet',
      'remove snippet'
    ],
    whenToUse: [
      'Use when the user explicitly asks to delete a snippet.',
      'Use after snippets_tool_query when the user identifies a snippet by title instead of id, then delete the resolved snippet id.'
    ],
    whenNotToUse: [
      'Do not use for temporary filtering or hiding.',
      'Do not use when the target snippet id is unknown or ambiguous.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For deletion, confirmationSummary must identify the snippet title and any key facts known from query results.',
      'Require the exact numeric snippet id.',
      'Ask the user for clarification before deleting when multiple snippets may match.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return a concise deletion confirmation.',
    examples: [
      '{"confirmationSummary":"将删除代码片段：**React Hook**。","id":1}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. Include the snippet title.'
      },
      id: {
        type: 'number',
        description: 'Snippet item id'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseDeleteInput(input)
    snippetsService.delete(parsed.id)

    return {
      observation: `Deleted snippet: ${parsed.id}.`,
      data: { id: parsed.id }
    }
  }
})

// Snippet 批量创建确认配置。
const SNIPPET_BATCH_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: '批量确认创建',
  question: '确认批量创建片段',
  confirm: '确认创建',
  cancel: '取消创建',
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const items = Array.isArray(input.items) ? input.items : []
    return `${items.length} 项片段`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getSnippetInputString(input, 'confirmationSummary')
    if (aiSummary) return aiSummary
    const items = Array.isArray(input.items) ? input.items : []
    if (items.length === 0) return null
    const previews = (items as unknown[]).slice(0, 3).map((item) => {
      if (!isRecord(item)) return null
      return getSnippetInputString(item, 'title')
    }).filter((p): p is string => Boolean(p))
    const suffix = items.length > 3 ? ` 等 ${items.length} 项` : ''
    return `将批量创建片段：${previews.join('、')}${suffix}。`
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === 'number' ? `已批量创建 ${count} 项片段。` : '已批量创建片段。'
    }
  }
}

// Snippet 批量更新确认配置。
const SNIPPET_BATCH_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: '批量确认更新',
  question: '确认批量更新片段',
  confirm: '确认更新',
  cancel: '取消更新',
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const items = Array.isArray(input.items) ? input.items : []
    return `${items.length} 项片段`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getSnippetInputString(input, 'confirmationSummary')
    if (aiSummary) return aiSummary
    const items = Array.isArray(input.items) ? input.items : []
    if (items.length === 0) return null
    const previews = (items as unknown[]).slice(0, 3).map((item) => {
      if (!isRecord(item)) return null
      const title = getSnippetInputString(item, 'title')
      const id = getSnippetInputString(item, 'id')
      return title ?? id ?? null
    }).filter((p): p is string => Boolean(p))
    const suffix = items.length > 3 ? ` 等 ${items.length} 项` : ''
    return `将批量更新片段：${previews.join('、')}${suffix}。`
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === 'number' ? `已批量更新 ${count} 项片段。` : '已批量更新片段。'
    }
  }
}

// Snippet 批量删除确认配置。
const SNIPPET_BATCH_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: '批量确认删除',
  question: '确认批量永久删除片段',
  confirm: '确认删除',
  cancel: '取消删除',
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const ids = Array.isArray(input.ids) ? input.ids : []
    return `${ids.length} 项片段`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getSnippetInputString(input, 'confirmationSummary')
    if (aiSummary) return aiSummary
    const ids = Array.isArray(input.ids) ? input.ids : []
    return ids.length > 0 ? `将批量删除 ${ids.length} 项片段。` : null
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === 'number' ? `已批量删除 ${count} 项片段。` : '已批量删除片段。'
    }
  }
}

/**
 * 创建 Snippet 批量新建工具。
 */
const createSnippetBatchAddTool = (
  snippetsService: Pick<SnippetsService, 'create'>
): SnippetWriteTool => ({
  name: 'snippets_tool_batch_add',
  description: 'Create multiple snippet items at once in the local Snippets table.',
  confirmation: SNIPPET_BATCH_ADD_CONFIRMATION,
  prompt: {
    summary: 'Batch create multiple snippet items in the local Snippets table.',
    intentKeywords: [
      '批量添加片段',
      '批量创建片段',
      '批量新增片段',
      'batch add snippets',
      'batch create snippets'
    ],
    whenToUse: [
      'Use when the user explicitly asks to create multiple snippets at once.',
      'Use when the user lists several snippets separated by newlines, commas, or bullet points.',
      'Use when batch creation is more efficient than calling the single-add tool multiple times.',
      'Use common_tool_ask to ask for missing required facts when any batch item is underspecified.'
    ],
    whenNotToUse: [
      'Do not use for creating a single snippet item — use snippets_tool_add instead.',
      'Do not use for read-only questions about existing snippets.',
      'Do not use when the user has not asked to create snippets.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For batch creation, confirmationSummary must summarize the items being created (count and key titles).',
      'entryDate defaults to today when not explicitly specified for each item.',
      'Never invent snippet content the user did not provide or confirm.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return count and created snippet facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将批量创建 2 项代码片段。\\n- React Hook\\n- Vue 3 组件","items":[{"entryDate":"2026-06-10","title":"React Hook","content":"const a = 1;","tags":["前端"]},{"entryDate":"2026-06-10","title":"Vue 3 组件","content":"defineComponent","tags":["前端"]}]}'
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
        description: 'Array of snippet items to create',
        items: {
          type: 'object',
          required: ['entryDate', 'title', 'content', 'tags'],
          properties: {
            entryDate: {
              type: 'string',
              description: 'Target date in YYYY-MM-DD format. Default to today when not explicitly specified.'
            },
            title: {
              type: 'string',
              description: 'Snippet title'
            },
            content: {
              type: 'string',
              description: 'Snippet content'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Snippet tags'
            }
          }
        }
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.items)) {
      throw new Error('Snippet batch create requires items array')
    }

    const results = (input.items as unknown[]).map((item) => {
      const created = snippetsService.create(parseCreateInput(item))
      return toToolItem(created)
    })

    return {
      observation: `Batch created ${results.length} snippets.`,
      data: { items: results, count: results.length }
    }
  }
})

/**
 * 创建 Snippet 批量更新工具。
 */
const createSnippetBatchUpdateTool = (
  snippetsService: Pick<SnippetsService, 'update'>
): SnippetWriteTool => ({
  name: 'snippets_tool_batch_update',
  description: 'Update multiple snippet items at once in the local Snippets table by id.',
  confirmation: SNIPPET_BATCH_UPDATE_CONFIRMATION,
  prompt: {
    summary: 'Batch update multiple snippet items in the local Snippets table by id.',
    intentKeywords: [
      '批量修改片段',
      '批量更新片段',
      'batch update snippets',
      'batch edit snippets'
    ],
    whenToUse: [
      'Use when the user explicitly asks to update multiple snippet items at once.',
      'Use after snippets_tool_query when the user identifies multiple snippets to update.'
    ],
    whenNotToUse: [
      'Do not use for updating a single snippet item — use snippets_tool_update instead.',
      'Do not use for creating new snippets.',
      'Do not use when target snippet ids are unknown or ambiguous.'
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
      'Include confirmationSummary in the tool arguments; return count and updated snippet facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将批量更新 2 项代码片段的标签。","items":[{"id":1,"title":"React Hook","content":"const a = 1;","tags":["前端","极客"]},{"id":2,"title":"Vue 3 组件","content":"defineComponent","tags":["前端","极客"]}]}'
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
        description: 'Array of snippet items to update, each with id and replacement fields',
        items: {
          type: 'object',
          required: ['id', 'title', 'content', 'tags'],
          properties: {
            id: {
              type: 'number',
              description: 'Snippet item id'
            },
            title: {
              type: 'string',
              description: 'Snippet title'
            },
            content: {
              type: 'string',
              description: 'Snippet content'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Snippet tags'
            }
          }
        }
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.items)) {
      throw new Error('Snippet batch update requires items array')
    }

    const results = (input.items as unknown[]).map((item) => {
      const parsed = parseUpdateInput(item)
      const updated = snippetsService.update(parsed.id, parsed.profile)
      return toToolItem(updated)
    })

    return {
      observation: `Batch updated ${results.length} snippets.`,
      data: { items: results, count: results.length }
    }
  }
})

/**
 * 创建 Snippet 批量删除工具。
 */
const createSnippetBatchDeleteTool = (
  snippetsService: Pick<SnippetsService, 'delete'>
): SnippetWriteTool => ({
  name: 'snippets_tool_batch_delete',
  description: 'Delete multiple snippet items at once from the local Snippets table by id.',
  confirmation: SNIPPET_BATCH_DELETE_CONFIRMATION,
  prompt: {
    summary: 'Batch delete multiple snippet items from the local Snippets table by id.',
    intentKeywords: [
      '批量删除片段',
      '批量移除片段',
      '清空片段',
      '全部删除片段',
      'batch delete snippets',
      'remove all snippets'
    ],
    whenToUse: [
      'Use when the user explicitly asks to delete multiple snippet items at once.',
      'Use when the user asks to "clear all snippets" or "delete all snippets".',
      'Use after snippets_tool_query when the user identifies multiple snippets to delete.'
    ],
    whenNotToUse: [
      'Do not use for deleting a single snippet item — use snippets_tool_delete instead.',
      'Do not use for temporary filtering or hiding.',
      'Do not use when target snippet ids are unknown or ambiguous.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For batch deletion, confirmationSummary must identify the count and distinguishing facts of snippets being deleted.',
      'Require exact numeric ids.',
      'Ask the user for clarification before deleting when the set of snippets is ambiguous.',
      'Batch deletion is permanent and cannot be undone — be conservative.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return count and concise deletion confirmation.',
    examples: [
      '{"confirmationSummary":"将批量删除 3 项代码片段。\\n- #1 React Hook\\n- #2 Vue 3 组件\\n- #3 TypeScript util","ids":[1,2,3]}'
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
        description: 'Array of snippet ids to delete',
        items: {
          type: 'number',
          description: 'Snippet item id'
        }
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.ids) || input.ids.some((id: unknown) => typeof id !== 'number')) {
      throw new Error('Snippet batch delete requires ids array of numbers')
    }

    const ids = input.ids as number[]
    ids.forEach((id) => {
      snippetsService.delete(id)
    })

    return {
      observation: `Batch deleted ${ids.length} snippets.`,
      data: { ids, count: ids.length }
    }
  }
})

/**
 * 创建完整 Snippet 工具组。
 */
export const createSnippetTools = (
  snippetsService: Pick<
    SnippetsService,
    'querySql' | 'create' | 'update' | 'delete'
  >
): AgentTool[] => [
  createSnippetQueryTool(snippetsService),
  createSnippetAddTool(snippetsService),
  createSnippetUpdateTool(snippetsService),
  createSnippetDeleteTool(snippetsService),
  createSnippetBatchAddTool(snippetsService),
  createSnippetBatchUpdateTool(snippetsService),
  createSnippetBatchDeleteTool(snippetsService)
]
