import type {
  ThemeCreateInput,
  ThemeItem,
  ThemeItemRow,
  ThemeItemsCreateInput,
  ThemeItemsItem,
  ThemeRow,
  ThemeTimelineItem,
  ThemeUpdateInput,
} from "@/db/schema"
import { createCompactUuid } from "@/id"

/** 数据库语句接口 */
type Statement = {
  all: (...values: unknown[]) => unknown[]
  get: (...values: unknown[]) => unknown
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

export type DatabaseConnection = {
  prepare: (sql: string) => Statement
}

/** 主题服务方法集合 */
export type ThemesService = {
  list: (status?: string) => ThemeItem[]
  getByExternalId: (id: string) => ThemeItem | null
  create: (input: ThemeCreateInput) => ThemeItem
  update: (id: string, input: ThemeUpdateInput) => ThemeItem
  delete: (id: string) => void

  addItem: (input: ThemeItemsCreateInput) => ThemeItemsItem
  removeItem: (themeExternalId: string, sourceType: string, sourceId: string) => void
  listItems: (themeExternalId: string) => ThemeItemsItem[]
  getItemCount: (themeExternalId: string) => number

  /** 批量从片段标签创建主题 */
  batchCreateFromTags: (tags: string[]) => ThemeItem[]
  /** 从周度总结全文解析并 upsert 主题建议 */
  extractThemesFromSummary: (summaryContent: string, summaryId: number) => number
  /** 获取某主题的跨周分布时间线 */
  getTimeline: (themeExternalId: string) => ThemeTimelineItem[]
  /** 清理无关联的 AI 自动生成主题 */
  cleanupOrphanedAiThemes: () => void

  querySql: (sql: string) => unknown[]
}

/** 生成当前时间戳 */
const createTimestamp = (): string => {
  return new Date().toISOString()
}

/** 数据库行 -> 页面主题 */
const mapThemeRow = (row: ThemeRow): ThemeItem => ({
  id: row.id,
  externalId: row.external_id,
  name: row.name,
  description: row.description,
  color: row.color,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  aiGenerated: row.ai_generated ?? 0,
})

/** 数据库行 -> 页面关联项 */
const mapThemeItemRow = (
  row: ThemeItemRow & {
    source_title?: string
    source_content?: string
    source_entry_date?: string
  },
): ThemeItemsItem => ({
  id: row.id,
  externalId: row.external_id,
  themeExternalId: row.theme_external_id,
  sourceType: row.source_type,
  sourceId: row.source_id,
  relevanceNote: row.relevance_note,
  aiExtracted: row.ai_extracted,
  createdAt: row.created_at,
  sourceTitle: row.source_title,
  sourceContent: row.source_content,
  sourceEntryDate: row.source_entry_date,
})

/**
 * 创建 Themes 服务。
 */
export const createThemesService = (database: DatabaseConnection): ThemesService => ({
  list: (status) => {
    const sql = status
      ? `SELECT t.*, (SELECT COUNT(*) FROM theme_items ti WHERE ti.theme_external_id = t.external_id) AS item_count FROM themes t WHERE t.status = ? ORDER BY t.updated_at DESC`
      : `SELECT t.*, (SELECT COUNT(*) FROM theme_items ti WHERE ti.theme_external_id = t.external_id) AS item_count FROM themes t ORDER BY t.updated_at DESC`
    const rows = database.prepare(sql).all(...(status ? [status] : [])) as (ThemeRow & {
      item_count?: number
    })[]
    return rows.map((row) => {
      const item = mapThemeRow(row as ThemeRow)
      item.itemCount = row.item_count ?? 0
      return item
    })
  },

  getByExternalId: (id) => {
    const row = database.prepare("SELECT * FROM themes WHERE external_id = ?").get(id) as
      | ThemeRow
      | undefined
    return row ? mapThemeRow(row) : null
  },

  create: (input) => {
    if (!input.name.trim()) throw new Error("主题名称不能为空")
    const timestamp = createTimestamp()
    const externalId = createCompactUuid()
    database
      .prepare(
        `INSERT INTO themes (external_id, name, description, color, status, created_at, updated_at, ai_generated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        externalId,
        input.name.trim(),
        input.description?.trim() ?? "",
        input.color ?? null,
        input.status ?? "active",
        timestamp,
        timestamp,
        input.aiGenerated ?? 0,
      )
    const row = database
      .prepare("SELECT * FROM themes WHERE external_id = ?")
      .get(externalId) as ThemeRow
    return mapThemeRow(row)
  },

  update: (id, input) => {
    const existing = database.prepare("SELECT * FROM themes WHERE external_id = ?").get(id) as
      | ThemeRow
      | undefined
    if (!existing) throw new Error("主题不存在")
    const timestamp = createTimestamp()
    database
      .prepare(
        `UPDATE themes SET name = ?, description = ?, color = ?, status = ?, updated_at = ? WHERE external_id = ?`,
      )
      .run(
        input.name?.trim() ?? existing.name,
        input.description?.trim() ?? existing.description,
        input.color !== undefined ? input.color : existing.color,
        input.status ?? existing.status,
        timestamp,
        id,
      )
    const row = database.prepare("SELECT * FROM themes WHERE external_id = ?").get(id) as ThemeRow
    return mapThemeRow(row)
  },

  delete: (id) => {
    database.prepare("DELETE FROM theme_items WHERE theme_external_id = ?").run(id)
    database.prepare("DELETE FROM themes WHERE external_id = ?").run(id)
  },

  addItem: (input) => {
    const timestamp = createTimestamp()
    const externalId = createCompactUuid()
    database
      .prepare(
        `INSERT INTO theme_items (external_id, theme_external_id, source_type, source_id, relevance_note, ai_extracted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(theme_external_id, source_type, source_id) DO UPDATE SET
           relevance_note = excluded.relevance_note,
           ai_extracted = excluded.ai_extracted`,
      )
      .run(
        externalId,
        input.themeExternalId,
        input.sourceType,
        input.sourceId,
        input.relevanceNote ?? "",
        input.aiExtracted ?? 0,
        timestamp,
      )
    // ON CONFLICT 时 external_id 保持旧值，需按唯一约束列回查
    const row = database
      .prepare(
        "SELECT * FROM theme_items WHERE theme_external_id = ? AND source_type = ? AND source_id = ?",
      )
      .get(input.themeExternalId, input.sourceType, input.sourceId) as ThemeItemRow
    return mapThemeItemRow(row)
  },

  removeItem: (themeExternalId, sourceType, sourceId) => {
    database
      .prepare(
        "DELETE FROM theme_items WHERE theme_external_id = ? AND source_type = ? AND source_id = ?",
      )
      .run(themeExternalId, sourceType, sourceId)
  },

  listItems: (themeExternalId) => {
    const sql = `
      SELECT ti.*,
        CASE ti.source_type
          WHEN 'snippet' THEN (SELECT title FROM snippets WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'journal' THEN (SELECT '日记 ' || entry_date FROM journals WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'note' THEN (SELECT title FROM notes WHERE id = CAST(ti.source_id AS INTEGER))
          ELSE NULL
        END AS source_title,
        CASE ti.source_type
          WHEN 'snippet' THEN (SELECT content FROM snippets WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'journal' THEN (SELECT content FROM journals WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'note' THEN (SELECT content FROM notes WHERE id = CAST(ti.source_id AS INTEGER))
          ELSE NULL
        END AS source_content,
        CASE ti.source_type
          WHEN 'snippet' THEN (SELECT entry_date FROM snippets WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'journal' THEN (SELECT entry_date FROM journals WHERE id = CAST(ti.source_id AS INTEGER))
          ELSE NULL
        END AS source_entry_date
      FROM theme_items ti
      WHERE ti.theme_external_id = ?
      ORDER BY ti.created_at DESC
    `
    const rows = database.prepare(sql).all(themeExternalId) as (ThemeItemRow & {
      source_title?: string
      source_content?: string
      source_entry_date?: string
    })[]
    return rows.map(mapThemeItemRow)
  },

  getItemCount: (themeExternalId) => {
    const row = database
      .prepare("SELECT COUNT(*) AS cnt FROM theme_items WHERE theme_external_id = ?")
      .get(themeExternalId) as { cnt?: number } | undefined
    return row?.cnt ?? 0
  },

  batchCreateFromTags: (tags) => {
    const created: ThemeItem[] = []
    const timestamp = createTimestamp()
    for (const tag of tags) {
      const trimmed = tag.trim()
      if (!trimmed) continue
      const exists = database
        .prepare("SELECT external_id FROM themes WHERE name = ?")
        .get(trimmed) as { external_id?: string } | undefined
      if (exists?.external_id) continue
      const externalId = createCompactUuid()
      database
        .prepare(
          `INSERT INTO themes (external_id, name, description, color, status, created_at, updated_at, ai_generated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          externalId,
          trimmed,
          `从 #${trimmed} 标签导入`,
          null,
          "active",
          timestamp,
          timestamp,
          0,
        )
      const row = database
        .prepare("SELECT * FROM themes WHERE external_id = ?")
        .get(externalId) as ThemeRow
      created.push(mapThemeRow(row))
    }
    return created
  },

  extractThemesFromSummary: (summaryContent, summaryId) => {
    // 正则匹配 "## 主题建议" 后的 JSON 区块
    const sectionMatch = summaryContent.match(/##\s*主题建议\s*\n+([\s\S]*?)$/)
    if (!sectionMatch) return 0

    const jsonBlock = sectionMatch[1].trim()
    let themes: Array<{
      name: string
      confidence: number
      evidence: string
      relatedSection: string
    }> = []
    try {
      const parsed = JSON.parse(jsonBlock)
      themes = Array.isArray(parsed) ? parsed : []
    } catch {
      // 尝试逐行解析
      const lines = jsonBlock.split("\n").filter(Boolean)
      for (const line of lines) {
        try {
          const obj = JSON.parse(line.trim())
          if (obj.name) themes.push(obj)
        } catch {
          /* skip */
        }
      }
    }
    if (!themes.length) return 0

    const timestamp = createTimestamp()
    let count = 0
    for (const theme of themes) {
      if (!theme.name?.trim()) continue
      // 模糊匹配已有主题
      const existing = database
        .prepare("SELECT external_id FROM themes WHERE name LIKE ?")
        .get(`%${theme.name.trim()}%`) as { external_id?: string } | undefined

      let themeExternalId: string
      if (existing?.external_id) {
        // 更新已有主题时间
        database
          .prepare("UPDATE themes SET updated_at = ? WHERE external_id = ?")
          .run(timestamp, existing.external_id)
        themeExternalId = existing.external_id
      } else {
        // 创建新主题
        themeExternalId = createCompactUuid()
        database
          .prepare(
            `INSERT INTO themes (external_id, name, description, color, status, created_at, updated_at, ai_generated)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            themeExternalId,
            theme.name.trim(),
            theme.evidence?.slice(0, 200) ?? "",
            null,
            "active",
            timestamp,
            timestamp,
            1,
          )
      }

      // 创建关联到本周总结
      const itemExternalId = createCompactUuid()
      database
        .prepare(
          `INSERT INTO theme_items (external_id, theme_external_id, source_type, source_id, relevance_note, ai_extracted, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(theme_external_id, source_type, source_id) DO NOTHING`,
        )
        .run(
          itemExternalId,
          themeExternalId,
          "weekly_summary",
          String(summaryId),
          theme.evidence?.slice(0, 200) ?? "",
          1,
          timestamp,
        )
      count++
    }
    return count
  },

  getTimeline: (themeExternalId) => {
    const sql = `
      SELECT
        strftime('%Y-%m-%d', ti.created_at, 'weekday 1', '-6 days') AS week_start_date,
        COUNT(*) AS item_count,
        MAX(CASE WHEN ti.source_type = 'weekly_summary' THEN 1 ELSE 0 END) AS mentioned_in_summary
      FROM theme_items ti
      WHERE ti.theme_external_id = ?
      GROUP BY week_start_date
      ORDER BY week_start_date ASC
    `
    const rows = database.prepare(sql).all(themeExternalId) as Array<{
      week_start_date: string
      item_count: number
      mentioned_in_summary: number
    }>
    return rows.map((r) => ({
      weekStartDate: r.week_start_date,
      itemCount: r.item_count,
      mentionedInSummary: r.mentioned_in_summary === 1,
    }))
  },

  cleanupOrphanedAiThemes: () => {
    database
      .prepare(
        `DELETE FROM themes
         WHERE ai_generated = 1
           AND NOT EXISTS (
             SELECT 1 FROM theme_items WHERE theme_external_id = themes.external_id
           )`,
      )
      .run()
  },

  querySql: (sql) => database.prepare(sql).all(),
})
