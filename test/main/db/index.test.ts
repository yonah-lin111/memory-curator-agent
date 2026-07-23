import { describe, expect, it } from "vitest"
import {
  createAiChatPersistenceTables,
  createAssociatedPeopleTable,
  createJournalsTable,
  createNotesTable,
  createSnippetsTable,
  createThemesTable,
  createTodosTable,
  migrateLegacySchema,
} from "@/db/index"

// 内存字段结构。
type MemoryColumn = {
  // SQLite 声明类型。
  type: string
  // 是否为主键字段。
  primaryKey: boolean
}

// 内存表结构。
type MemoryTable = {
  // 字段定义集合。
  columns: Record<string, MemoryColumn>
  // 测试行集合。
  rows: Array<Record<string, unknown>>
  // 模拟创建 SQL。
  sql?: string
}

// 内存迁移数据库。
class MemoryMigrationDatabase {
  // 内存表集合。
  private tables = new Map<string, MemoryTable>()

  // 内存索引集合。
  private indexes = new Set<string>()

  /**
   * 直接写入测试行，避免依赖真实 SQLite native 模块。
   */
  insertRow = (tableName: string, row: Record<string, unknown>): void => {
    const table = this.tables.get(tableName)

    if (!table) {
      throw new Error(`表不存在: ${tableName}`)
    }

    table.rows.push({ ...row })
  }

  /**
   * 读取字段定义。
   */
  getColumn = (tableName: string, columnName: string): MemoryColumn => {
    const column = this.tables.get(tableName)?.columns[columnName]

    if (!column) {
      throw new Error(`字段不存在: ${tableName}.${columnName}`)
    }

    return column
  }

  /**
   * 准备内存 SQL 语句。
   */
  prepare = (sql: string) => {
    if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
      return {
        get: (tableName?: string) =>
          tableName && this.tables.has(tableName) ? { name: tableName } : undefined,
      }
    }

    if (sql.startsWith("SELECT type FROM pragma_table_info('")) {
      const tableName = sql.match(/pragma_table_info\('([^']+)'\)/)?.[1]

      if (!tableName) {
        throw new Error(`未支持的测试 SQL: ${sql}`)
      }

      return {
        get: (columnName?: string) => {
          if (!columnName) {
            return undefined
          }

          const column = this.tables.get(tableName)?.columns[columnName]
          return column ? { type: column.type } : undefined
        },
      }
    }

    const tableLookup = sql.match(
      /^SELECT name FROM sqlite_master WHERE type = 'table' AND name = '(\w+)'$/,
    )

    if (tableLookup) {
      const [, tableName] = tableLookup
      return {
        get: (_?: unknown) => (this.tables.has(tableName) ? { name: tableName } : undefined),
      }
    }

    const schemaLookup = sql.match(
      /^SELECT sql FROM sqlite_schema WHERE type='table' AND name='(\w+)'$/,
    )

    if (schemaLookup) {
      const [, tableName] = schemaLookup
      return {
        get: () => {
          const table = this.tables.get(tableName)
          return table ? { sql: table.sql || "" } : undefined
        },
      }
    }

    const selectMatched = sql.match(/^SELECT ([\w,\s]+) FROM (\w+)/)

    if (selectMatched) {
      const [, columnsText, tableName] = selectMatched
      const columns = columnsText.split(",").map((column) => column.trim())

      return {
        get: (_?: unknown) => {
          const row = this.tables.get(tableName)?.rows[0]

          if (!row) {
            return undefined
          }

          return columns.reduce<Record<string, unknown>>((selectedRow, columnName) => {
            selectedRow[columnName] = row[columnName]
            return selectedRow
          }, {})
        },
      }
    }

    throw new Error(`未支持的测试 SQL: ${sql}`)
  }

  /**
   * 执行内存迁移 SQL。
   */
  exec = (sql: string): void => {
    sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .forEach((statement) => {
        if (statement.startsWith("CREATE TABLE")) {
          this.createTable(statement)
          return
        }

        if (statement.startsWith("PRAGMA")) {
          return
        }

        if (statement.startsWith("ALTER TABLE")) {
          this.alterTable(statement)
          return
        }

        if (statement.startsWith("DROP INDEX IF EXISTS")) {
          this.indexes.delete(statement.replace("DROP INDEX IF EXISTS", "").trim())
          return
        }

        if (statement.startsWith("CREATE INDEX IF NOT EXISTS")) {
          const matched = statement.match(/^CREATE INDEX IF NOT EXISTS (\w+)/)

          if (!matched) {
            throw new Error(`未支持的测试 SQL: ${statement}`)
          }

          this.indexes.add(matched[1])
          return
        }

        if (statement.startsWith("INSERT INTO")) {
          this.copyRows(statement)
          return
        }

        if (statement.startsWith("UPDATE ai_chat_sessions")) {
          this.normalizeAiChatSessionStatuses()
          return
        }

        if (statement.startsWith("UPDATE weekly_summaries")) {
          this.normalizeWeeklySummariesTypes()
          return
        }

        if (statement.startsWith("DROP TABLE")) {
          const tableName = statement.replace("DROP TABLE", "").trim()
          this.tables.delete(tableName)
          return
        }

        throw new Error(`未支持的测试 SQL: ${statement}`)
      })
  }

  /**
   * 按顶层逗号拆分字段定义。
   */
  private splitTopLevel = (value: string): string[] => {
    const parts: string[] = []
    let depth = 0
    let current = ""

    for (const char of value) {
      if (char === "(") {
        depth += 1
      }

      if (char === ")") {
        depth -= 1
      }

      if (char === "," && depth === 0) {
        parts.push(current.trim())
        current = ""
        continue
      }

      current += char
    }

    if (current.trim()) {
      parts.push(current.trim())
    }

    return parts
  }

  /**
   * 创建内存表。
   */
  private createTable = (statement: string): void => {
    const matched = statement.match(/^CREATE TABLE(?: IF NOT EXISTS)? (\w+) \(([\s\S]+)\)$/)

    if (!matched) {
      throw new Error(`未支持的测试 SQL: ${statement}`)
    }

    const [, tableName, columnsDefinition] = matched

    if (statement.startsWith("CREATE TABLE IF NOT EXISTS") && this.tables.has(tableName)) {
      return
    }

    const columns = this.splitTopLevel(columnsDefinition).reduce<Record<string, MemoryColumn>>(
      (currentColumns, columnDefinition) => {
        if (/^(UNIQUE|PRIMARY|FOREIGN|CHECK)\b/i.test(columnDefinition)) {
          return currentColumns
        }

        const [columnName, columnType] = columnDefinition.split(/\s+/)
        if (!columnType) {
          return currentColumns
        }

        currentColumns[columnName] = {
          type: columnType.toUpperCase(),
          primaryKey: /\bPRIMARY\s+KEY\b/i.test(columnDefinition),
        }
        return currentColumns
      },
      {},
    )

    this.tables.set(tableName, {
      columns,
      rows: this.tables.get(tableName)?.rows ?? [],
      sql: statement,
    })
  }

  /**
   * 重命名内存表。
   */
  private alterTable = (statement: string): void => {
    const addColumnMatched = statement.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+) ([\w\s]+)$/)

    if (addColumnMatched) {
      const [, tableName, columnName, columnDefinition] = addColumnMatched
      const table = this.tables.get(tableName)

      if (!table) {
        throw new Error(`表不存在: ${tableName}`)
      }

      const [columnType] = columnDefinition.split(/\s+/)
      table.columns[columnName] = {
        type: columnType.toUpperCase(),
        primaryKey: /\bPRIMARY\s+KEY\b/i.test(columnDefinition),
      }
      table.rows = table.rows.map((row) => ({ ...row, [columnName]: 0 }))
      return
    }

    const matched = statement.match(/^ALTER TABLE (\w+) RENAME TO (\w+)$/)

    if (!matched) {
      throw new Error(`未支持的测试 SQL: ${statement}`)
    }

    const [, fromTable, toTable] = matched
    const table = this.tables.get(fromTable)

    if (!table) {
      throw new Error(`表不存在: ${fromTable}`)
    }

    this.tables.set(toTable, table)
    this.tables.delete(fromTable)
  }

  /**
   * 复制旧表数据到新表，同时给整型主键自动分配顺序 id。
   */
  private copyRows = (statement: string): void => {
    if (statement.includes("weekly_summaries_new")) {
      const sourceTable = this.tables.get("weekly_summaries")
      const targetTable = this.tables.get("weekly_summaries_new")
      if (sourceTable && targetTable) {
        targetTable.rows = sourceTable.rows.map((row) => {
          const week_start_date = String(row.week_start_date || "")
          const type =
            row.type ?? (week_start_date.endsWith("-curator") ? "interpersonal" : "summary")
          const clean_week_start_date = week_start_date.replace("-curator", "")
          return {
            id: row.id,
            week_start_date: clean_week_start_date,
            type,
            title: row.title,
            content: row.content,
            model_used: row.model_used,
            generated_at: row.generated_at,
          }
        })
      }
      return
    }

    const matched = statement.match(
      /^INSERT INTO (\w+) \(([\w,\s]+)\)\s+SELECT ([\w,\s]+)\s+FROM (\w+)\s+ORDER BY ([\w,\s]+)$/m,
    )

    if (!matched) {
      throw new Error(`未支持的测试 SQL: ${statement}`)
    }

    const [, targetTableName, insertColumnsText, selectColumnsText, sourceTableName, orderByText] =
      matched
    const targetTable = this.tables.get(targetTableName)
    const sourceTable = this.tables.get(sourceTableName)

    if (!targetTable || !sourceTable) {
      throw new Error(`复制数据失败: ${statement}`)
    }

    const insertColumns = insertColumnsText.split(",").map((column) => column.trim())
    const selectColumns = selectColumnsText.split(",").map((column) => column.trim())
    const orderColumns = orderByText
      .split(",")
      .map((column) => column.trim().replace(/\s+(ASC|DESC)$/i, ""))
    const sortedRows = [...sourceTable.rows].sort((left, right) => {
      for (const column of orderColumns) {
        const leftValue = left[column]
        const rightValue = right[column]

        if (leftValue === rightValue) {
          continue
        }

        return String(leftValue).localeCompare(String(rightValue))
      }

      return 0
    })

    targetTable.rows = sortedRows.map((sourceRow, index) => {
      const nextRow = insertColumns.reduce<Record<string, unknown>>(
        (currentRow, columnName, columnIndex) => {
          currentRow[columnName] = sourceRow[selectColumns[columnIndex]]
          return currentRow
        },
        {},
      )

      if (targetTable.columns.id?.type === "INTEGER") {
        nextRow.id = index + 1
      }

      return nextRow
    })
  }

  /**
   * 模拟会话状态历史值迁移。
   */
  private normalizeAiChatSessionStatuses = (): void => {
    const table = this.tables.get("ai_chat_sessions")

    if (!table) {
      return
    }

    const statusMap: Record<string, string> = {
      运行中: "running",
      运行完成: "completed",
      已完成: "completed",
      运行失败: "failed",
      失败: "failed",
    }

    table.rows = table.rows.map((row) => {
      const status = typeof row.status === "string" ? statusMap[row.status] : undefined
      return status ? { ...row, status } : row
    })
  }

  /**
   * 模拟周度总结类型值清洗迁移。
   */
  private normalizeWeeklySummariesTypes = (): void => {
    const table = this.tables.get("weekly_summaries")

    if (!table) {
      return
    }

    table.rows = table.rows.map((row) => {
      if (row.type === "curator") {
        return { ...row, type: "interpersonal" }
      }
      return row
    })
  }
}

/**
 * 创建全部业务表。
 */
const createAllTables = (database: MemoryMigrationDatabase): void => {
  createNotesTable(database as never)
  createTodosTable(database as never)
  createSnippetsTable(database as never)
  createJournalsTable(database as never)
  createAssociatedPeopleTable(database as never)
  createAiChatPersistenceTables(database as never)
  createThemesTable(database as never)
}

/**
 * 断言表存在整型 id 主键。
 */
const expectIntegerPrimaryKeyId = (database: MemoryMigrationDatabase, tableName: string): void => {
  const column = database.getColumn(tableName, "id")

  expect(column.type).toBe("INTEGER")
  expect(column.primaryKey).toBe(true)
}

/**
 * 断言字段使用时间戳声明。
 */
const expectTimestampColumn = (
  database: MemoryMigrationDatabase,
  tableName: string,
  columnName: string,
): void => {
  expect(database.getColumn(tableName, columnName).type).toBe("TIMESTAMP")
}

describe("db schema migration", () => {
  it("创建的新表统一使用整型 id 主键和时间戳字段", () => {
    const database = new MemoryMigrationDatabase()

    createAllTables(database)

    ;[
      "notes",
      "todos",
      "snippets",
      "journals",
      "associated_people",
      "ai_chat_sessions",
      "ai_chat_messages",
      "ai_agent_runs",
      "ai_agent_tool_calls",
      "ai_agent_context_snapshots",
      "themes",
    ].forEach((tableName) => expectIntegerPrimaryKeyId(database, tableName))

    ;[
      ["notes", "time"],
      ["todos", "created_at"],
      ["todos", "updated_at"],
      ["snippets", "created_at"],
      ["snippets", "updated_at"],
      ["journals", "created_at"],
      ["journals", "updated_at"],
      ["associated_people", "created_at"],
      ["associated_people", "updated_at"],
      ["ai_chat_sessions", "created_at"],
      ["ai_chat_sessions", "updated_at"],
      ["ai_chat_sessions", "last_message_at"],
      ["ai_chat_messages", "time"],
      ["ai_chat_messages", "created_at"],
      ["ai_chat_messages", "updated_at"],
      ["ai_agent_runs", "started_at"],
      ["ai_agent_runs", "finished_at"],
      ["ai_agent_tool_calls", "created_at"],
      ["ai_agent_tool_calls", "updated_at"],
      ["themes", "created_at"],
      ["themes", "updated_at"],
    ].forEach(([tableName, columnName]) => expectTimestampColumn(database, tableName, columnName))

    expect(database.getColumn("themes", "ai_generated")).toMatchObject({ type: "INTEGER" })
  })

  it("迁移旧版 themes 表时补加 AI 生成来源标记字段", () => {
    const database = new MemoryMigrationDatabase()

    database.exec(`
      CREATE TABLE themes (
        id INTEGER PRIMARY KEY,
        external_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        color TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      );
    `)
    database.insertRow("themes", {
      id: 1,
      external_id: "theme-1",
      name: "旧主题",
      description: "",
      color: null,
      status: "active",
      created_at: "2026-06-22 09:00",
      updated_at: "2026-06-22 09:00",
    })

    migrateLegacySchema(database as never)

    expect(database.getColumn("themes", "ai_generated")).toMatchObject({ type: "INTEGER" })
    expect(database.prepare("SELECT id, name, ai_generated FROM themes").get()).toMatchObject({
      id: 1,
      name: "旧主题",
      ai_generated: 0,
    })
  })

  it("迁移旧版文本主键表为整型 id 主键并保留业务数据", () => {
    const database = new MemoryMigrationDatabase()

    database.exec(`
      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        tags TEXT NOT NULL,
        time TEXT NOT NULL,
        is_curated INTEGER NOT NULL DEFAULT 0,
        clue TEXT
      );

      CREATE TABLE workspace_todos (
        id TEXT PRIMARY KEY,
        entry_date TEXT NOT NULL,
        text TEXT NOT NULL,
        priority TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE workspace_snippets (
        id TEXT PRIMARY KEY,
        entry_date TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE journals (
        entry_date TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE associated_people (
        id TEXT PRIMARY KEY,
        avatar TEXT NOT NULL,
        name TEXT NOT NULL,
        gender TEXT NOT NULL,
        relationship TEXT NOT NULL,
        status TEXT NOT NULL,
        birthday TEXT NOT NULL,
        contact TEXT NOT NULL,
        tags TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE ai_chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL
      );
    `)

    database.insertRow("notes", {
      id: "n-legacy-1",
      title: "旧笔记",
      content: "旧内容",
      source: "随手速记",
      tags: '["迁移"]',
      time: "2026-05-27 09:30",
      is_curated: 0,
      clue: "旧线索",
    })
    database.insertRow("workspace_todos", {
      id: "wt-legacy-1",
      entry_date: "2026-05-27",
      text: "旧待办",
      priority: "P1",
      completed: 0,
      sort_order: 0,
      created_at: "2026-05-27 09:31",
      updated_at: "2026-05-27 09:31",
    })
    database.insertRow("workspace_snippets", {
      id: "ws-legacy-1",
      entry_date: "2026-05-27",
      title: "旧片段",
      content: "旧片段内容",
      tags: '["迁移"]',
      created_at: "2026-05-27 09:32",
      updated_at: "2026-05-27 09:32",
    })
    database.insertRow("journals", {
      entry_date: "2026-05-27",
      content: "旧日记",
      created_at: "2026-05-27 09:33",
      updated_at: "2026-05-27 09:33",
    })
    database.insertRow("associated_people", {
      id: "person-legacy-1",
      avatar: "",
      name: "阿明",
      gender: "男",
      relationship: "朋友",
      status: "在线",
      birthday: "2000-01-01",
      contact: "",
      tags: '["老友"]',
      details: "旧档案",
      created_at: "2026-05-27 09:34",
      updated_at: "2026-05-27 09:34",
    })
    database.insertRow("ai_chat_sessions", {
      id: "session-legacy-1",
      title: "旧对话",
      status: "运行完成",
      created_at: "2026-05-27 09:35",
      updated_at: "2026-05-27 09:35",
      last_message_at: "2026-05-27 09:35",
    })

    migrateLegacySchema(database as never)
    createAllTables(database)

    ;["notes", "todos", "snippets", "journals", "associated_people", "ai_chat_sessions"].forEach(
      (tableName) => expectIntegerPrimaryKeyId(database, tableName),
    )

    expectTimestampColumn(database, "notes", "time")
    expectTimestampColumn(database, "todos", "created_at")
    expectTimestampColumn(database, "snippets", "created_at")
    expectTimestampColumn(database, "journals", "created_at")
    expectTimestampColumn(database, "associated_people", "created_at")
    expectTimestampColumn(database, "ai_chat_sessions", "created_at")

    expect(database.prepare("SELECT id, title FROM notes").get()).toMatchObject({
      id: 1,
      title: "旧笔记",
    })
    // 迁移后 source 列应被删除。
    expect(() => database.getColumn("notes", "source")).toThrow()
    expect(database.prepare("SELECT id, text FROM todos").get()).toMatchObject({
      id: 1,
      text: "旧待办",
    })
    expect(database.prepare("SELECT id, title FROM snippets").get()).toMatchObject({
      id: 1,
      title: "旧片段",
    })
    expect(database.prepare("SELECT id, entry_date, content FROM journals").get()).toMatchObject({
      id: 1,
      entry_date: "2026-05-27",
      content: "旧日记",
    })
    expect(
      database.prepare("SELECT id, external_id, name FROM associated_people").get(),
    ).toMatchObject({
      id: 1,
      external_id: "person-legacy-1",
      name: "阿明",
    })
    expect(
      database.prepare("SELECT id, external_id, status FROM ai_chat_sessions").get(),
    ).toMatchObject({
      id: 1,
      external_id: "session-legacy-1",
      status: "completed",
    })
    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspace_todos'")
        .get(),
    ).toBeUndefined()
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snippets'",
        )
        .get(),
    ).toBeUndefined()
  })

  it("迁移已存在的 notes 表时删除 source 列并保留业务数据", () => {
    const database = new MemoryMigrationDatabase()

    // 模拟带有 source 列的旧版 notes 表（已有整型主键）。
    database.exec(`
      CREATE TABLE notes (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        tags TEXT NOT NULL,
        time TIMESTAMP NOT NULL,
        category_id INTEGER
      );
    `)
    database.insertRow("notes", {
      id: 1,
      title: "保留笔记",
      content: "保留内容",
      source: "随手速记",
      tags: '["测试"]',
      time: "2026-06-16 10:00",
      category_id: null,
    })

    migrateLegacySchema(database as never)
    createNotesTable(database as never)

    // source 列应被删除。
    expect(() => database.getColumn("notes", "source")).toThrow()
    // 其他数据应保留。
    expect(database.prepare("SELECT id, title, content FROM notes").get()).toMatchObject({
      id: 1,
      title: "保留笔记",
      content: "保留内容",
    })
  })

  it("迁移旧版没有 type 列的 weekly_summaries 表为包含 type 列且带有 UNIQUE(week_start_date, type) 联合唯一约束的表", () => {
    const database = new MemoryMigrationDatabase()

    database.exec(`
      CREATE TABLE weekly_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start_date TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        model_used TEXT,
        generated_at TEXT NOT NULL
      );
    `)

    database.insertRow("weekly_summaries", {
      id: 1,
      week_start_date: "2026-06-08",
      title: "本周总结",
      content: "周度总结内容",
      model_used: "gpt-4o",
      generated_at: "2026-06-15 00:00:00",
    })

    database.insertRow("weekly_summaries", {
      id: 2,
      week_start_date: "2026-06-08-curator",
      title: "本周人际",
      content: "人际分析内容",
      model_used: "gpt-4o",
      generated_at: "2026-06-15 00:01:00",
    })

    migrateLegacySchema(database as never)

    // 重建后应该是包含 type 的新表，并且具有 UNIQUE(week_start_date, type) 联合唯一约束
    const row = database
      .prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='weekly_summaries'")
      .get() as { sql: string } | undefined
    expect(row?.sql).toContain("UNIQUE(week_start_date, type)")

    // 两个数据行应该被合并
    expect(database.getColumn("weekly_summaries", "type")).toMatchObject({ type: "TEXT" })
    const table = (database as any).tables.get("weekly_summaries")
    expect(table.rows[1]).toMatchObject({
      type: "interpersonal",
    })
  })

  it("当 weekly_summaries 已经有 type 列，但依然只有旧的 week_start_date UNIQUE 约束时，应能自动重建为带有 UNIQUE(week_start_date, type) 联合唯一约束的表", () => {
    const database = new MemoryMigrationDatabase()

    database.exec(`
      CREATE TABLE weekly_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start_date TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        model_used TEXT,
        generated_at TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'summary'
      );
    `)

    database.insertRow("weekly_summaries", {
      id: 1,
      week_start_date: "2026-06-08",
      title: "本周总结",
      content: "周度总结内容",
      model_used: "gpt-4o",
      generated_at: "2026-06-15 00:00:00",
      type: "summary",
    })

    migrateLegacySchema(database as never)

    // 重建后应该有正确的 UNIQUE(week_start_date, type) 约束
    const row = database
      .prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='weekly_summaries'")
      .get() as { sql: string } | undefined
    expect(row?.sql).toContain("UNIQUE(week_start_date, type)")
  })

  it('若存在已是 type 列，但带有旧 "curator" 数据，在迁移中应能将 type 全量更新为 "interpersonal"', () => {
    const database = new MemoryMigrationDatabase()

    database.exec(`
      CREATE TABLE weekly_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start_date TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        model_used TEXT,
        generated_at TEXT NOT NULL,
        UNIQUE(week_start_date, type)
      );
    `)

    database.insertRow("weekly_summaries", {
      id: 1,
      week_start_date: "2026-06-08",
      type: "curator",
      title: "本周总结",
      content: "周度总结内容",
      model_used: "gpt-4o",
      generated_at: "2026-06-15 00:00:00",
    })

    migrateLegacySchema(database as never)

    // type 应该被清洗更新为 interpersonal
    expect(database.prepare("SELECT type FROM weekly_summaries WHERE id = 1").get()).toMatchObject({
      type: "interpersonal",
    })
  })
})
