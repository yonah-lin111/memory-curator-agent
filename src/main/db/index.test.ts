import { describe, expect, it } from 'vitest'
import {
  createJournalsTable,
  createNotesTable,
  createWorkspaceSnippetsTable,
  createWorkspaceTodosTable,
  migrateLegacyWorkspaceSchema
} from './index'

// 内存表结构。
type MemoryTable = {
  columns: Record<string, string>
  rows: Array<Record<string, unknown>>
}

// 内存迁移数据库。
class MemoryMigrationDatabase {
  // 内存表集合。
  private tables = new Map<string, MemoryTable>()

  // 内存索引集合。
  private indexes = new Set<string>()

  /**
   * 直接写入测试行，避免依赖真实 SQLite。
   */
  insertRow = (tableName: string, row: Record<string, unknown>): void => {
    const table = this.tables.get(tableName)

    if (!table) {
      throw new Error(`表不存在: ${tableName}`)
    }

    table.rows.push({ ...row })
  }

  /**
   * 准备内存 SQL 语句。
   */
  prepare = (sql: string) => {
    if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
      return {
        get: (tableName?: string) => (tableName && this.tables.has(tableName) ? { name: tableName } : undefined)
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

          const columnType = this.tables.get(tableName)?.columns[columnName]
          return columnType ? { type: columnType } : undefined
        }
      }
    }

    if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspace_todos'") {
      return {
        get: (_?: unknown) => (this.tables.has('workspace_todos') ? { name: 'workspace_todos' } : undefined)
      }
    }

    if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snippets'") {
      return {
        get: (_?: unknown) => (this.tables.has('workspace_snippets') ? { name: 'workspace_snippets' } : undefined)
      }
    }

    if (sql === 'SELECT id, title, content, source, tags, time, is_curated, clue FROM notes') {
      return {
        get: (_?: unknown) => this.tables.get('notes')?.rows[0]
      }
    }

    if (sql === 'SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos') {
      return {
        get: (_?: unknown) => this.tables.get('todos')?.rows[0]
      }
    }

    if (sql === 'SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets') {
      return {
        get: (_?: unknown) => this.tables.get('snippets')?.rows[0]
      }
    }

    throw new Error(`未支持的测试 SQL: ${sql}`)
  }

  /**
   * 执行内存迁移 SQL。
   */
  exec = (sql: string): void => {
    sql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
      .forEach((statement) => {
        if (statement.startsWith('CREATE TABLE')) {
          this.createTable(statement)
          return
        }

        if (statement.startsWith('ALTER TABLE')) {
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
          return
        }

        if (statement.startsWith('DROP INDEX IF EXISTS')) {
          this.indexes.delete(statement.replace('DROP INDEX IF EXISTS', '').trim())
          return
        }

        if (statement.startsWith('CREATE INDEX IF NOT EXISTS')) {
          const matched = statement.match(/^CREATE INDEX IF NOT EXISTS (\w+)/)

          if (!matched) {
            throw new Error(`未支持的测试 SQL: ${statement}`)
          }

          this.indexes.add(matched[1])
          return
        }

        if (statement.startsWith('INSERT INTO')) {
          this.copyRows(statement)
          return
        }

        if (statement.startsWith('DROP TABLE')) {
          const tableName = statement.replace('DROP TABLE', '').trim()
          this.tables.delete(tableName)
          return
        }

        throw new Error(`未支持的测试 SQL: ${statement}`)
      })
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
    const columns = columnsDefinition
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((currentColumns, columnDefinition) => {
        const [columnName, columnType] = columnDefinition.split(/\s+/)

        currentColumns[columnName] = columnType.toUpperCase()
        return currentColumns
      }, {})

    this.tables.set(tableName, {
      columns,
      rows: this.tables.get(tableName)?.rows ?? []
    })
  }

  /**
   * 复制旧表数据到新表，同时在整数主键表上自动分配顺序主键。
   */
  private copyRows = (statement: string): void => {
    const matched = statement.match(
      /^INSERT INTO (\w+) \(([\w,\s]+)\)\s+SELECT ([\w,\s]+)\s+FROM (\w+)\s+ORDER BY ([\w,\s]+)$/m
    )

    if (!matched) {
      throw new Error(`未支持的测试 SQL: ${statement}`)
    }

    const [, targetTableName, insertColumnsText, selectColumnsText, sourceTableName, orderByText] = matched
    const targetTable = this.tables.get(targetTableName)
    const sourceTable = this.tables.get(sourceTableName)

    if (!targetTable || !sourceTable) {
      throw new Error(`复制数据失败: ${statement}`)
    }

    const insertColumns = insertColumnsText.split(',').map((column) => column.trim())
    const selectColumns = selectColumnsText.split(',').map((column) => column.trim())
    const orderColumns = orderByText.split(',').map((column) => column.trim().replace(/\s+(ASC|DESC)$/i, ''))
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
      const nextRow = insertColumns.reduce<Record<string, unknown>>((currentRow, columnName, columnIndex) => {
        currentRow[columnName] = sourceRow[selectColumns[columnIndex]]
        return currentRow
      }, {})

      if (targetTable.columns.id === 'INTEGER') {
        nextRow.id = index + 1
      }

      return nextRow
    })
  }
}

describe('db schema migration', () => {
  it('会将旧版文本主键表迁移为整数主键并保留数据', () => {
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
    `)

    database.insertRow('notes', {
      id: 'n-legacy-1',
      title: '旧笔记',
      content: '旧内容',
      source: '随手速记',
      tags: '["迁移"]',
      time: '2026-05-27 09:30',
      is_curated: 0,
      clue: '旧线索'
    })
    database.insertRow('workspace_todos', {
      id: 'wt-legacy-1',
      entry_date: '2026-05-27',
      text: '旧待办',
      priority: 'P1',
      completed: 0,
      sort_order: 0,
      created_at: '2026-05-27 09:31',
      updated_at: '2026-05-27 09:31'
    })
    database.insertRow('workspace_snippets', {
      id: 'ws-legacy-1',
      entry_date: '2026-05-27',
      title: '旧片段',
      content: '旧片段内容',
      tags: '["迁移"]',
      created_at: '2026-05-27 09:32',
      updated_at: '2026-05-27 09:32'
    })

    migrateLegacyWorkspaceSchema(database as never)
    createNotesTable(database as never)
    createWorkspaceTodosTable(database as never)
    createWorkspaceSnippetsTable(database as never)
    createJournalsTable(database as never)

    const notesIdType = database.prepare("SELECT type FROM pragma_table_info('notes') WHERE name = 'id'").get('id') as {
      type: string
    }
    const todosIdType = database.prepare("SELECT type FROM pragma_table_info('todos') WHERE name = 'id'").get('id') as {
      type: string
    }
    const snippetsIdType = database
      .prepare("SELECT type FROM pragma_table_info('snippets') WHERE name = 'id'")
      .get('id') as {
      type: string
    }
    const migratedNote = database.prepare('SELECT id, title, content, source, tags, time, is_curated, clue FROM notes').get() as {
      id: number
      title: string
      content: string
      source: string
      tags: string
      time: string
      is_curated: number
      clue: string | null
    }
    const migratedTodo = database
      .prepare('SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos')
      .get() as {
      id: number
      entry_date: string
      text: string
      priority: string
      completed: number
      sort_order: number
      created_at: string
      updated_at: string
    }
    const migratedSnippet = database
      .prepare('SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets')
      .get() as {
      id: number
      entry_date: string
      title: string
      content: string
      tags: string
      created_at: string
      updated_at: string
    }

    expect(notesIdType.type).toBe('INTEGER')
    expect(todosIdType.type).toBe('INTEGER')
    expect(snippetsIdType.type).toBe('INTEGER')
    expect(migratedNote).toMatchObject({
      id: 1,
      title: '旧笔记',
      content: '旧内容',
      source: '随手速记',
      tags: '["迁移"]',
      time: '2026-05-27 09:30',
      is_curated: 0,
      clue: '旧线索'
    })
    expect(migratedTodo).toMatchObject({
      id: 1,
      entry_date: '2026-05-27',
      text: '旧待办',
      priority: 'P1',
      completed: 0,
      sort_order: 0
    })
    expect(migratedSnippet).toMatchObject({
      id: 1,
      entry_date: '2026-05-27',
      title: '旧片段',
      content: '旧片段内容',
      tags: '["迁移"]'
    })
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspace_todos'").get()).toBeUndefined()
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snippets'").get()).toBeUndefined()
  })
})
