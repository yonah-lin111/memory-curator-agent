import type { BillCategory, BillCreateInput, BillItem, BillListFilters, BillRow, BillTodaySummary, BillType, BillUpdateInput } from '@/db/schema'
import { BILL_CATEGORIES } from '@/db/schema'

/** 数据库语句接口 */
type Statement = {
  all: (...values: unknown[]) => unknown[]
  get: (...values: unknown[]) => unknown
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

/** Bills 服务依赖的最小数据库接口 */
export type DatabaseConnection = {
  prepare: (sql: string) => Statement
}

/** Bills 服务方法集合 */
export type BillsService = {
  list: (filters?: BillListFilters) => BillItem[]
  create: (input: BillCreateInput) => BillItem
  update: (id: number, input: BillUpdateInput) => BillItem
  delete: (id: number) => void
  todaySummary: (date?: string) => BillTodaySummary
}

/** 提取 SQLite 自增主键 */
const getInsertedRowId = (result: unknown): number => {
  const rowId = (result as { lastInsertRowid?: number | bigint } | undefined)?.lastInsertRowid
  if (typeof rowId === 'bigint') return Number(rowId)
  if (typeof rowId === 'number') return rowId
  throw new Error('无法读取新建账单的主键')
}

/** 生成当前时间戳 */
const createTimestamp = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${date} ${hours}:${minutes}`
}

/** 生成今日日期 */
const getTodayDate = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

/** 解析数据库标签字段 */
const parseStoredTags = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((tag): tag is string => typeof tag === 'string')
  } catch {
    return []
  }
}

/** 数据库行转页面项 */
const mapRow = (row: BillRow): BillItem => ({
  id: row.id,
  amount: row.amount,
  category: row.category as BillCategory,
  billType: row.bill_type as BillType,
  billDate: row.bill_date,
  note: row.note,
  tags: parseStoredTags(row.tags),
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

/**
 * 校验账单输入。
 */
const validateBillInput = (input: BillCreateInput | BillUpdateInput): void => {
  if ('amount' in input && input.amount !== undefined && input.amount <= 0) {
    throw new Error('金额必须大于0')
  }
  if ('category' in input && input.category && !BILL_CATEGORIES.includes(input.category)) {
    throw new Error('账单分类不正确')
  }
  if ('billType' in input && input.billType && !['expense', 'income'].includes(input.billType)) {
    throw new Error('收支类型不正确')
  }
  if ('billDate' in input && input.billDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.billDate)) {
    throw new Error('账单日期格式不正确')
  }
}

/**
 * 创建 Bills 服务。
 */
export const createBillsService = (database: DatabaseConnection): BillsService => ({
  list: (filters) => {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filters?.billDate) {
      clauses.push('bill_date = ?')
      params.push(filters.billDate)
    }
    if (filters?.category) {
      clauses.push('category = ?')
      params.push(filters.category)
    }
    if (filters?.billType) {
      clauses.push('bill_type = ?')
      params.push(filters.billType)
    }

    const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''
    const rows = database
      .prepare(`SELECT * FROM bills${whereClause} ORDER BY bill_date DESC, id DESC`)
      .all(...params) as BillRow[]

    return rows.map(mapRow)
  },
  create: (input) => {
    if (input.amount <= 0) throw new Error('金额必须大于0')
    if (!BILL_CATEGORIES.includes(input.category)) throw new Error('账单分类不正确')

    const timestamp = createTimestamp()
    const inserted = database
      .prepare(
        'INSERT INTO bills (amount, category, bill_type, bill_date, note, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(input.amount, input.category, input.billType, input.billDate, input.note, JSON.stringify(input.tags), timestamp, timestamp)

    const row = database
      .prepare('SELECT * FROM bills WHERE id = ?')
      .get(getInsertedRowId(inserted)) as BillRow | undefined

    if (!row) throw new Error('新建账单后读取失败')
    return mapRow(row)
  },
  update: (id, input) => {
    validateBillInput(input)

    const existing = database.prepare('SELECT * FROM bills WHERE id = ?').get(id) as BillRow | undefined
    if (!existing) throw new Error('账单不存在')

    const updatedAt = createTimestamp()
    database
      .prepare(
        'UPDATE bills SET amount = ?, category = ?, bill_type = ?, bill_date = ?, note = ?, tags = ?, updated_at = ? WHERE id = ?'
      )
      .run(
        input.amount ?? existing.amount,
        input.category ?? existing.category,
        input.billType ?? existing.bill_type,
        input.billDate ?? existing.bill_date,
        input.note ?? existing.note,
        input.tags ? JSON.stringify(input.tags) : existing.tags,
        updatedAt,
        id
      )

    return mapRow({ ...existing, updated_at: updatedAt })
  },
  delete: (id) => {
    database.prepare('DELETE FROM bills WHERE id = ?').run(id)
  },
  todaySummary: (date) => {
    const billDate = date ?? getTodayDate()

    const expenseRow = database
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM bills WHERE bill_date = ? AND bill_type = 'expense'")
      .get(billDate) as { total: number }
    const incomeRow = database
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM bills WHERE bill_date = ? AND bill_type = 'income'")
      .get(billDate) as { total: number }

    const recentRows = database
      .prepare("SELECT * FROM bills WHERE bill_date = ? ORDER BY id DESC LIMIT 5")
      .all(billDate) as BillRow[]

    return {
      expenseTotal: expenseRow.total,
      incomeTotal: incomeRow.total,
      recentItems: recentRows.map(mapRow)
    }
  }
})
