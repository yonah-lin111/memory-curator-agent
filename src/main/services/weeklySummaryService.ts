import type { WeeklySummaryItem, WeeklySummaryRow, WeeklySummarySaveInput } from '@/db/schema'

// 数据库语句接口。
type DatabaseStatement = {
  all: (...values: unknown[]) => unknown[]
  get: (...values: unknown[]) => unknown
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// Weekly summary service 依赖的最小数据库接口。
export type DatabaseConnection = {
  prepare: (sql: string) => DatabaseStatement
}

// Weekly summary service 方法集合。
export type WeeklySummaryService = {
  // 按周起始日期查询总结，不存在返回 null。
  getByWeekStart: (weekStartDate: string) => WeeklySummaryItem | null
  // 保存（upsert）总结，返回保存后的完整记录。
  save: (input: WeeklySummarySaveInput) => WeeklySummaryItem
  // 按周起始日期删除总结。
  delete: (weekStartDate: string) => void
}

/**
 * 将数据库行映射为页面使用的类型。
 */
const rowToItem = (row: WeeklySummaryRow): WeeklySummaryItem => ({
  id: row.id,
  weekStartDate: row.week_start_date,
  title: row.title,
  content: row.content,
  modelUsed: row.model_used,
  generatedAt: row.generated_at
})

/**
 * 创建 WeeklySummary 服务。
 */
export const createWeeklySummaryService = (database: DatabaseConnection): WeeklySummaryService => ({
  getByWeekStart: (weekStartDate) => {
    const row = database
      .prepare('SELECT * FROM weekly_summaries WHERE week_start_date = ?')
      .get(weekStartDate) as WeeklySummaryRow | undefined

    return row ? rowToItem(row) : null
  },

  save: (input) => {
    database
      .prepare(
        `INSERT INTO weekly_summaries (week_start_date, title, content, model_used, generated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(week_start_date) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           model_used = excluded.model_used,
           generated_at = excluded.generated_at`
      )
      .run(
        input.weekStartDate,
        input.title,
        input.content,
        input.modelUsed ?? null,
        input.generatedAt
      )

    const row = database
      .prepare('SELECT * FROM weekly_summaries WHERE week_start_date = ?')
      .get(input.weekStartDate) as WeeklySummaryRow

    return rowToItem(row)
  },

  delete: (weekStartDate) => {
    database
      .prepare('DELETE FROM weekly_summaries WHERE week_start_date = ?')
      .run(weekStartDate)
  }
})
