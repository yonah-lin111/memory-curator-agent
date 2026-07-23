import { beforeEach, describe, expect, it } from "vitest"
import type { ThemeItemRow, ThemeRow } from "@/db/schema"
import { createThemesService, type DatabaseConnection } from "@/services/themesService"

// 内存主题数据库，用于隔离验证主题服务 SQL 行为。
class MemoryThemesDatabase implements DatabaseConnection {
  // 主题行集合。
  themeRows: ThemeRow[] = []
  // 主题关联行集合。
  itemRows: ThemeItemRow[] = []

  /**
   * 提供 themesService 当前测试覆盖到的 SQL 子集。
   */
  prepare = (sql: string): any => {
    const normalized = sql.trim().replace(/\s+/g, " ")

    if (normalized.startsWith("INSERT INTO themes")) {
      return {
        run: (...values: any[]) => {
          this.themeRows.push({
            id: this.themeRows.length + 1,
            external_id: values[0],
            name: values[1],
            description: values[2],
            color: values[3],
            status: values[4],
            created_at: values[5],
            updated_at: values[6],
            ai_generated: values[7] ?? 0,
          })
          return { lastInsertRowid: this.themeRows.length }
        },
      }
    }

    if (normalized.startsWith("SELECT * FROM themes WHERE external_id = ?")) {
      return {
        get: (...values: any[]) => this.themeRows.find((theme) => theme.external_id === values[0]),
      }
    }

    if (normalized.startsWith("INSERT INTO theme_items")) {
      return {
        run: (...values: any[]) => {
          const exists = this.itemRows.find(
            (item) =>
              item.theme_external_id === values[1] &&
              item.source_type === values[2] &&
              item.source_id === values[3],
          )
          if (!exists) {
            this.itemRows.push({
              id: this.itemRows.length + 1,
              external_id: values[0],
              theme_external_id: values[1],
              source_type: values[2],
              source_id: values[3],
              relevance_note: values[4] ?? "",
              ai_extracted: values[5] ?? 0,
              created_at: values[6],
            })
          }
          return { lastInsertRowid: this.itemRows.length }
        },
      }
    }

    if (
      normalized.startsWith(
        "SELECT * FROM theme_items WHERE theme_external_id = ? AND source_type = ? AND source_id = ?",
      )
    ) {
      return {
        get: (...values: any[]) =>
          this.itemRows.find(
            (item) =>
              item.theme_external_id === values[0] &&
              item.source_type === values[1] &&
              item.source_id === values[2],
          ),
      }
    }

    if (normalized.includes("DELETE FROM themes WHERE ai_generated = 1")) {
      return {
        run: () => {
          const priorCount = this.themeRows.length
          this.themeRows = this.themeRows.filter((theme) => {
            const isAiGenerated = theme.ai_generated === 1
            const hasItems = this.itemRows.some(
              (item) => item.theme_external_id === theme.external_id,
            )
            return !(isAiGenerated && !hasItems)
          })
          return { changes: priorCount - this.themeRows.length }
        },
      }
    }

    throw new Error(`Unhandled Mock SQL: ${sql}`)
  }
}

let sqlite: MemoryThemesDatabase

beforeEach(() => {
  sqlite = new MemoryThemesDatabase()
})

describe("themesService", () => {
  it("清理孤立 AI 主题时保留手动主题和已关联 AI 主题", () => {
    const service = createThemesService(sqlite)

    const manualTheme = service.create({
      name: "理财计划",
      description: "手动规划理财记录",
      aiGenerated: 0,
    })
    const orphanAiTheme = service.create({
      name: "技能提升",
      description: "AI 自动提取",
      aiGenerated: 1,
    })
    const usedAiTheme = service.create({
      name: "健康习惯",
      description: "AI 自动提取",
      aiGenerated: 1,
    })

    service.addItem({
      themeExternalId: usedAiTheme.externalId,
      sourceType: "weekly_summary",
      sourceId: "100",
      aiExtracted: 1,
    })

    expect(manualTheme.aiGenerated).toBe(0)
    expect(orphanAiTheme.aiGenerated).toBe(1)
    expect(usedAiTheme.aiGenerated).toBe(1)

    service.cleanupOrphanedAiThemes()

    expect(sqlite.themeRows.map((theme) => theme.name)).toEqual(["理财计划", "健康习惯"])
  })
})
