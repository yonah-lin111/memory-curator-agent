import type { WeeklySummaryItem, WeeklySummaryRow, WeeklySummarySaveInput } from "@/db/schema"

// 数据库语句接口。
type DatabaseStatement = {
  all: (...values: unknown[]) => unknown[]
  get: (...values: unknown[]) => unknown
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// 周报服务依赖的最小数据库接口。
export type DatabaseConnection = {
  prepare: (sql: string) => DatabaseStatement
}

// 周报服务方法集合。
export type WeeklySummaryService = {
  // 按周起始日期查询总结，不存在返回 null，可选按 type 过滤。
  getByWeekStart: (weekStartDate: string, type?: string) => WeeklySummaryItem | null
  // 保存（upsert）总结，返回保存后的完整记录。
  save: (input: WeeklySummarySaveInput) => WeeklySummaryItem
  // 按周起始日期删除总结，可选按 type 过滤。
  delete: (weekStartDate: string, type?: string) => void
}

/**
 * 将数据库行映射为页面使用的类型。
 */
const rowToItem = (row: WeeklySummaryRow): WeeklySummaryItem => ({
  id: row.id,
  weekStartDate: row.week_start_date,
  type: row.type,
  title: row.title,
  content: row.content,
  modelUsed: row.model_used,
  generatedAt: row.generated_at,
  isMeaningful: row.is_meaningful ?? 1,
})

/**
 * 创建 WeeklySummary 服务。
 */
export const createWeeklySummaryService = (database: DatabaseConnection): WeeklySummaryService => ({
  getByWeekStart: (weekStartDate, type) => {
    const sql = type
      ? "SELECT * FROM weekly_summaries WHERE week_start_date = ? AND type = ?"
      : "SELECT * FROM weekly_summaries WHERE week_start_date = ?"
    const params = type ? [weekStartDate, type] : [weekStartDate]
    const row = database.prepare(sql).get(...params) as WeeklySummaryRow | undefined

    return row ? rowToItem(row) : null
  },

  save: (input) => {
    const resolvedType = input.type ?? "summary"
    const isMeaningful = input.isMeaningful ?? 1
    database
      .prepare(
        `INSERT INTO weekly_summaries (week_start_date, type, title, content, model_used, generated_at, is_meaningful)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(week_start_date, type) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           model_used = excluded.model_used,
           generated_at = excluded.generated_at,
           is_meaningful = excluded.is_meaningful`,
      )
      .run(
        input.weekStartDate,
        resolvedType,
        input.title,
        input.content,
        input.modelUsed ?? null,
        input.generatedAt,
        isMeaningful,
      )

    const row = database
      .prepare("SELECT * FROM weekly_summaries WHERE week_start_date = ? AND type = ?")
      .get(input.weekStartDate, resolvedType) as WeeklySummaryRow

    return rowToItem(row)
  },

  delete: (weekStartDate, type) => {
    const sql = type
      ? "DELETE FROM weekly_summaries WHERE week_start_date = ? AND type = ?"
      : "DELETE FROM weekly_summaries WHERE week_start_date = ?"
    const params = type ? [weekStartDate, type] : [weekStartDate]
    database.prepare(sql).run(...params)
  },
})
