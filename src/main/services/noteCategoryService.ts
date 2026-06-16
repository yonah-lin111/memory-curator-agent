import type { NoteCategoryItem, NoteCategoryRow } from '@/db/schema'

/** 数据库语句接口（最小依赖）。 */
type Statement = {
  all: (...values: unknown[]) => unknown[]
  get: (...values: unknown[]) => unknown
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

export type DatabaseConnection = {
  prepare: (sql: string) => Statement
}

/** 分类服务方法集合。 */
export type NoteCategoryService = {
  list: () => NoteCategoryItem[]
  create: (name: string) => NoteCategoryItem
  update: (id: number, name: string) => NoteCategoryItem
  delete: (id: number) => void
  querySql: (sql: string) => unknown[]
}

/** 提取 SQLite 自增主键。 */
const getInsertedRowId = (result: unknown): number => {
  const rowId = (result as { lastInsertRowid?: number | bigint } | undefined)?.lastInsertRowid
  if (typeof rowId === 'bigint') return Number(rowId)
  if (typeof rowId === 'number') return rowId
  throw new Error('无法读取新建分类的主键')
}

/** 数据库行转页面项。 */
const mapRow = (row: NoteCategoryRow): NoteCategoryItem => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sort_order
})

/** 创建分类服务。 */
export const createNoteCategoryService = (database: DatabaseConnection): NoteCategoryService => ({
  list: () => {
    const rows = database
      .prepare('SELECT id, name, sort_order FROM note_categories ORDER BY sort_order ASC, id ASC')
      .all() as NoteCategoryRow[]
    return rows.map(mapRow)
  },
  create: (name) => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('分类名称不能为空')

    const maxResult = database
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM note_categories')
      .get() as { next_order: number }
    const nextOrder = maxResult.next_order

    const inserted = database
      .prepare('INSERT INTO note_categories (name, sort_order) VALUES (?, ?)')
      .run(trimmed, nextOrder)
    const row = database
      .prepare('SELECT id, name, sort_order FROM note_categories WHERE id = ?')
      .get(getInsertedRowId(inserted)) as NoteCategoryRow | undefined
    if (!row) throw new Error('新建分类后读取失败')
    return mapRow(row)
  },
  update: (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('分类名称不能为空')
    database
      .prepare('UPDATE note_categories SET name = ? WHERE id = ?')
      .run(trimmed, id)
    const row = database
      .prepare('SELECT id, name, sort_order FROM note_categories WHERE id = ?')
      .get(id) as NoteCategoryRow | undefined
    if (!row) throw new Error('分类不存在')
    return mapRow(row)
  },
  delete: (id) => {
    database.prepare('UPDATE notes SET category_id = NULL WHERE category_id = ?').run(id)
    database.prepare('DELETE FROM note_categories WHERE id = ?').run(id)
  },
  querySql: (sql) => database.prepare(sql).all()
})
