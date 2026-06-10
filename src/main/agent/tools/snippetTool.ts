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
    time: typeof row.created_at === 'string' && row.created_at.length >= 16 ? row.created_at.slice(11, 16) : '',
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
