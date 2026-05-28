import type {
  JournalItem,
  JournalRow,
  JournalSaveInput
} from '../db/schema'

// 数据库语句接口。
export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// Journals 服务依赖的最小数据库接口。
export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
}

// Journals 服务方法集合。
export type JournalsService = {
  // 读取指定日期的日记。
  get: (entryDate: string) => JournalItem | null
  // 保存日记。
  save: (input: JournalSaveInput) => JournalItem
  // 删除日记。
  delete: (entryDate: string) => void
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
 * 校验日期格式。
 */
const validateEntryDate = (entryDate: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    throw new Error('工作台日期格式不正确')
  }
}

/**
 * 校验日记输入。
 */
const validateJournalSaveInput = (input: JournalSaveInput): void => {
  validateEntryDate(input.entryDate)

  if (!input.content.trim()) {
    throw new Error('日记内容不能为空')
  }
}

/**
 * 将数据库行映射为页面日记。
 */
const mapJournalRow = (row: JournalRow): JournalItem => ({
  entryDate: row.entry_date,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

/**
 * 创建 Journals 服务。
 */
export const createJournalsService = (database: DatabaseConnection): JournalsService => ({
  get: (entryDate) => {
    validateEntryDate(entryDate)

    const row = database
      .prepare('SELECT entry_date, content, created_at, updated_at FROM journals WHERE entry_date = ?')
      .get(entryDate) as JournalRow | undefined

    return row ? mapJournalRow(row) : null
  },
  save: (input) => {
    validateJournalSaveInput(input)

    const content = input.content.trim()
    const existing = database
      .prepare('SELECT entry_date, content, created_at, updated_at FROM journals WHERE entry_date = ?')
      .get(input.entryDate) as JournalRow | undefined
    const timestamp = createTimestamp()

    if (!existing) {
      database
        .prepare('INSERT INTO journals (entry_date, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(input.entryDate, content, timestamp, timestamp)

      return {
        entryDate: input.entryDate,
        content,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    }

    database
      .prepare('UPDATE journals SET content = ?, updated_at = ? WHERE entry_date = ?')
      .run(content, timestamp, input.entryDate)

    return {
      entryDate: input.entryDate,
      content,
      createdAt: existing.created_at,
      updatedAt: timestamp
    }
  },
  delete: (entryDate) => {
    validateEntryDate(entryDate)
    database.prepare('DELETE FROM journals WHERE entry_date = ?').run(entryDate)
  }
})
