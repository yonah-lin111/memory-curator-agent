import type {
  SnippetCreateInput,
  SnippetItem,
  SnippetRow,
  SnippetUpdateInput
} from '@/db/schema'

// 数据库语句接口。
export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// Snippets 服务依赖的最小数据库接口。
export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
}

// Snippets 服务方法集合。
export type SnippetsService = {
  // 读取指定日期的全部片段。
  listByDate: (entryDate: string) => SnippetItem[]
  // 创建片段。
  create: (input: SnippetCreateInput) => SnippetItem
  // 更新片段。
  update: (id: number, input: SnippetUpdateInput) => SnippetItem
  // 删除片段。
  delete: (id: number) => void
  // 执行只读片段 SQL 查询并返回原始行。
  querySql: (sql: string) => unknown[]
}

/**
 * 提取 SQLite 自增主键。
 */
const getInsertedRowId = (result: unknown, entityName: string): number => {
  const rowId = (result as { lastInsertRowid?: number | bigint } | undefined)?.lastInsertRowid

  if (typeof rowId === 'bigint') {
    return Number(rowId)
  }

  if (typeof rowId === 'number') {
    return rowId
  }

  throw new Error(`无法读取新建${entityName}的主键`)
}

/**
 * 生成当前时间戳。
 */
const createTimestamp = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${date} ${hours}:${minutes}`
}

/**
 * 从时间戳提取列表展示时间。
 */
const toDisplayTime = (timestamp: string): string => timestamp.slice(11, 16)

/**
 * 解析数据库标签字段。
 */
const parseStoredTags = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.filter((tag): tag is string => typeof tag === 'string')
}

/**
 * 校验日期格式。
 */
const validateEntryDate = (entryDate: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    throw new Error('工作台日期格式不正确')
  }
}

/**
 * 校验片段输入。
 */
const validateSnippetInput = (
  input: SnippetCreateInput | SnippetUpdateInput
): void => {
  if ('entryDate' in input) {
    validateEntryDate(input.entryDate)
  }

  if (!input.title.trim() && !input.content.trim()) {
    throw new Error('片段标题或内容至少保留一项')
  }

  if (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error('片段标签格式不正确')
  }
}

/**
 * 将数据库行映射为页面片段。
 */
const mapSnippetRow = (row: SnippetRow): SnippetItem => ({
  id: row.id,
  entryDate: row.entry_date,
  title: row.title,
  content: row.content,
  tags: parseStoredTags(row.tags),
  time: toDisplayTime(row.created_at),
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

/**
 * 创建 Snippets 服务。
 */
export const createSnippetsService = (database: DatabaseConnection): SnippetsService => ({
  listByDate: (entryDate) => {
    validateEntryDate(entryDate)

    const rows = database
      .prepare(
        'SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE entry_date = ? ORDER BY created_at DESC, id DESC'
      )
      .all(entryDate) as SnippetRow[]

    return rows.map(mapSnippetRow)
  },
  create: (input) => {
    validateSnippetInput(input)

    const timestamp = createTimestamp()
    const inserted = database
      .prepare(
        'INSERT INTO snippets (entry_date, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.entryDate,
        input.title.trim(),
        input.content.trim(),
        JSON.stringify(input.tags),
        timestamp,
        timestamp
      )
    const row = database
      .prepare(
        'SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE id = ?'
      )
      .get(getInsertedRowId(inserted, '片段')) as SnippetRow | undefined

    if (!row) {
      throw new Error('新建片段后读取失败')
    }

    return mapSnippetRow(row)
  },
  update: (id, input) => {
    validateSnippetInput(input)

    const existing = database
      .prepare(
        'SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE id = ?'
      )
      .get(id) as SnippetRow | undefined

    if (!existing) {
      throw new Error('片段不存在')
    }

    const updatedAt = createTimestamp()
    database
      .prepare('UPDATE snippets SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?')
      .run(input.title.trim(), input.content.trim(), JSON.stringify(input.tags), updatedAt, id)

    return mapSnippetRow({
      ...existing,
      title: input.title.trim(),
      content: input.content.trim(),
      tags: JSON.stringify(input.tags),
      updated_at: updatedAt
    })
  },
  delete: (id) => {
    database.prepare('DELETE FROM snippets WHERE id = ?').run(id)
  },
  querySql: (sql) => {
    return database.prepare(sql).all()
  }
})
