import type { NoteCategoryService } from '@/services/noteCategoryService'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'
import type {
  AgentTool,
  AgentToolResult,
  NoteCategoryQueryToolInput,
  NoteCategoryQueryToolItem,
  NoteCategoryQueryToolResult
} from '@/agent/types'

type NoteCategoryQueryTool = Omit<AgentTool, 'execute'> & {
  execute: (input: unknown) => Promise<NoteCategoryQueryToolResult>
}

type NoteCategoryWriteTool = Omit<AgentTool, 'execute'> & {
  execute: (input: unknown) => Promise<AgentToolResult>
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const TABLE_NAME = 'note_categories'
const COLUMNS = 'id, name, sort_order'
const MAX_SQL_LENGTH = 800

const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union)\b/i
const SQL_COMMENT_PATTERN = /--|\/\*|\*\//

type CatSqlRow = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const parseString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const isCatSqlRow = (value: unknown): value is CatSqlRow =>
  isRecord(value) &&
  typeof value.id === 'number' &&
  typeof value.name === 'string' &&
  typeof value.sort_order === 'number'

const toToolItem = (row: CatSqlRow): NoteCategoryQueryToolItem => ({
  id: row.id as number,
  name: row.name as string,
  sortOrder: row.sort_order as number
})

const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

const escapeSqlLike = (value: string): string =>
  escapeSqlString(
    value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  )

const buildWhere = (parsed: NoteCategoryQueryToolInput): string => {
  const parts: (string | null)[] = [
    parsed.query
      ? `name LIKE '%${escapeSqlLike(parsed.query.trim())}%'`
      : null
  ]
  const filtered = parts.filter((c): c is string => Boolean(c))
  return filtered.length > 0 ? ` WHERE ${filtered.join(' AND ')}` : ''
}

const buildSql = (parsed: NoteCategoryQueryToolInput): string =>
  `SELECT ${COLUMNS} FROM ${TABLE_NAME}${buildWhere(parsed)} ORDER BY sort_order ASC, id ASC`

const prepareSql = (sql: string, limit: number): string => {
  const normalized = sql.trim()
  if (!normalized) throw new Error('Category SQL cannot be empty')
  if (normalized.length > MAX_SQL_LENGTH) throw new Error('Category SQL is too long')
  if (normalized.includes(';') || SQL_COMMENT_PATTERN.test(normalized))
    throw new Error('Category SQL only allows a single SELECT statement without comments')
  if (!/^select\b/i.test(normalized))
    throw new Error('Category SQL only allows SELECT queries')
  if (FORBIDDEN_SQL_PATTERN.test(normalized))
    throw new Error('Category SQL contains a forbidden keyword')
  if (!new RegExp(`\\bfrom\\s+${TABLE_NAME}\\b`, 'i').test(normalized))
    throw new Error(`Category SQL can only query the ${TABLE_NAME} table`)
  const hasLimit = /\blimit\s+\d+\b/i.test(normalized)
  return hasLimit ? normalized : `${normalized} LIMIT ${limit}`
}

/** 创建分类查询工具。 */
export const createNoteCategoryQueryTool = (
  service: Pick<NoteCategoryService, 'querySql'>
): NoteCategoryQueryTool => ({
  name: 'note_categories_query',
  description: 'Query note categories in the local database. Read-only.',
  prompt: {
    summary: 'Query note categories. Read-only; supports keyword search and controlled SQL.',
    intentKeywords: ['分类', '笔记分类', '类别', 'category', 'categories'],
    whenToUse: [
      'Use when the user asks about note categories.',
      'Use when the user wants to list or search categories.'
    ],
    whenNotToUse: [
      'Do not use for casual chat unrelated to note categories.',
      'Do not use when the user asks to create, update, or delete categories.'
    ],
    safety: [
      'Read only. Never write data.',
      `SQL must be a single SELECT against only the ${TABLE_NAME} table.`,
      'Never invent categories that the tool did not return.'
    ],
    output: 'Return the category facts needed to answer the user.',
    examples: ['{"limit":10}', '{"query":"工作"}']
  },
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search text contains (LIKE matching on name).'
      },
      sql: {
        type: 'string',
        description: `Controlled read-only SQL. Must SELECT FROM ${TABLE_NAME}.`
      },
      limit: {
        type: 'number',
        description: 'Maximum number of rows to return'
      }
    }
  },
  execute: async (input) => {
    const parsed = isRecord(input) ? input : {}
    const limit = Math.max(
      1,
      Math.min(
        typeof parsed.limit === 'number' ? parsed.limit : DEFAULT_LIMIT,
        MAX_LIMIT
      )
    )
    const sql = parseString(parsed.sql)
      ? prepareSql(parseString(parsed.sql)!, limit)
      : buildSql(parsed as NoteCategoryQueryToolInput)
    const rows = service.querySql(sql).slice(0, limit)
    const items = rows.filter(isCatSqlRow).map(toToolItem)
    return {
      observation: rows.length === 0
        ? 'SQL query returned no rows.'
        : `SQL query returned ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}.`,
      data: { rows, items },
      items,
      rows
    }
  }
})

const CATEGORY_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认创建分类',
  question: '确认创建笔记分类',
  confirm: '确认创建',
  cancel: '取消创建',
  renderTarget: (input) =>
    isRecord(input) ? (input.name as string | undefined) ?? null : null,
  renderSummary: (input) => {
    const name = isRecord(input) ? (input.name as string | undefined) : undefined
    return name ? `将创建分类：**${name}**。` : null
  },
  completion: {
    renderMessage: (input) => {
      const name = isRecord(input) ? (input.name as string | undefined) : undefined
      return name ? `已创建分类：${name}。` : '已创建分类。'
    }
  }
}

const CATEGORY_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认更新分类',
  question: '确认更新笔记分类名称',
  confirm: '确认更新',
  cancel: '取消更新',
  renderTarget: (input) => {
    if (!isRecord(input)) return null
    return typeof input.id === 'number' ? `#${input.id}` : null
  },
  renderSummary: (input) => {
    if (!isRecord(input)) return null
    const name = parseString(input.name)
    return name ? `将重命名为：**${name}**。` : null
  },
  completion: {
    renderMessage: (input) => {
      const name = isRecord(input) ? (input.name as string | undefined) : undefined
      return name ? `已更新分类：${name}。` : '已更新分类。'
    }
  }
}

const CATEGORY_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认删除分类',
  question: '确认永久删除笔记分类',
  confirm: '确认删除',
  cancel: '取消删除',
  renderTarget: (input) => {
    if (!isRecord(input)) return null
    return typeof input.id === 'number' ? `#${input.id}` : null
  },
  renderSummary: () => '删除分类后，关联笔记的分类将被清空。',
  completion: {
    renderMessage: () => '已删除分类。'
  }
}

/** 创建分类添加工具。 */
export const createNoteCategoryAddTool = (
  service: Pick<NoteCategoryService, 'create'>
): NoteCategoryWriteTool => ({
  name: 'note_categories_add',
  description: 'Create a new note category.',
  confirmation: CATEGORY_ADD_CONFIRMATION,
  prompt: {
    summary: 'Create a new note category.',
    intentKeywords: ['新建分类', '创建分类', '添加分类', 'add category', 'create category'],
    whenToUse: ['Use when the user asks to create a note category.'],
    whenNotToUse: ['Do not use for read-only category queries.'],
    safety: [
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'confirmationSummary must include the category name.'
    ],
    output: 'Include confirmationSummary in the tool arguments.',
    examples: [
      '{"confirmationSummary":"将创建分类：**工作笔记**。","name":"工作笔记"}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['name', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description: 'Concise Markdown Chinese explanation shown above the internal confirmation.'
      },
      name: {
        type: 'string',
        description: 'Category name'
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || typeof input.name !== 'string') {
      throw new Error('Category create requires name string')
    }
    const created = service.create(input.name)
    return {
      observation: `Created category: ${created.name}.`,
      data: { item: created }
    }
  }
})

/** 创建分类更新工具。 */
export const createNoteCategoryUpdateTool = (
  service: Pick<NoteCategoryService, 'update'>
): NoteCategoryWriteTool => ({
  name: 'note_categories_update',
  description: 'Update an existing note category name.',
  confirmation: CATEGORY_UPDATE_CONFIRMATION,
  prompt: {
    summary: 'Update an existing note category name.',
    intentKeywords: ['重命名分类', '修改分类', '更新分类', 'rename category', 'update category'],
    whenToUse: [
      'Use when the user asks to rename a note category.',
      'Use after note_categories_query to resolve the category id.'
    ],
    whenNotToUse: ['Do not use for creating new categories.'],
    safety: [
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'Require the numeric category id.'
    ],
    output: 'Include confirmationSummary in the tool arguments.',
    examples: [
      '{"confirmationSummary":"将重命名分类为：**工作笔记**。","id":1,"name":"工作笔记"}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'name', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description: 'Concise Markdown Chinese explanation.'
      },
      id: {
        type: 'number',
        description: 'Category id'
      },
      name: {
        type: 'string',
        description: 'New category name'
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || typeof input.id !== 'number' || typeof input.name !== 'string') {
      throw new Error('Category update requires id and name')
    }
    const updated = service.update(input.id, input.name)
    return {
      observation: `Updated category: ${updated.name}.`,
      data: { item: updated }
    }
  }
})

/** 创建分类删除工具。 */
export const createNoteCategoryDeleteTool = (
  service: Pick<NoteCategoryService, 'delete'>
): NoteCategoryWriteTool => ({
  name: 'note_categories_delete',
  description: 'Delete a note category.',
  confirmation: CATEGORY_DELETE_CONFIRMATION,
  prompt: {
    summary: 'Delete a note category. Associated notes will have their category cleared.',
    intentKeywords: ['删除分类', '移除分类', 'delete category', 'remove category'],
    whenToUse: ['Use when the user asks to delete a note category.'],
    whenNotToUse: ['Do not use for temporary filtering.'],
    safety: [
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'Require the exact numeric category id.',
      'Deletion clears the category on associated notes — it is NOT reversible.'
    ],
    output: 'Include confirmationSummary in the tool arguments.',
    examples: [
      '{"confirmationSummary":"将删除分类 #1，关联笔记的分类将被清空。","id":1}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description: 'Concise Markdown Chinese explanation.'
      },
      id: {
        type: 'number',
        description: 'Category id'
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || typeof input.id !== 'number') {
      throw new Error('Category delete requires numeric id')
    }
    service.delete(input.id)
    return {
      observation: `Deleted category: ${input.id}.`,
      data: { id: input.id }
    }
  }
})

/** 创建完整分类工具组。 */
export const createNoteCategoryTools = (
  service: Pick<NoteCategoryService, 'querySql' | 'create' | 'update' | 'delete'>
): AgentTool[] => [
  createNoteCategoryQueryTool(service),
  createNoteCategoryAddTool(service),
  createNoteCategoryUpdateTool(service),
  createNoteCategoryDeleteTool(service)
]
