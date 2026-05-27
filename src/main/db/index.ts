import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { getDatabaseDir, getDatabasePath } from '../paths'

// SQLite 数据库连接。
let sqlite: Database.Database | null = null

/**
 * 判断指定表是否存在。
 */
const tableExists = (database: Database.Database, tableName: string): boolean =>
  Boolean(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName)
  )

/**
 * 迁移旧版 Workspace 表名。
 */
const migrateLegacyWorkspaceTables = (database: Database.Database): void => {
  if (tableExists(database, 'workspace_todos') && !tableExists(database, 'todos')) {
    database.exec('ALTER TABLE workspace_todos RENAME TO todos;')
  }

  if (tableExists(database, 'workspace_snippets') && !tableExists(database, 'snippets')) {
    database.exec('ALTER TABLE workspace_snippets RENAME TO snippets;')
  }

  database.exec(`
    DROP INDEX IF EXISTS idx_workspace_todos_entry_date;
    DROP INDEX IF EXISTS idx_workspace_todos_entry_date_completed_sort_order;
    DROP INDEX IF EXISTS idx_workspace_snippets_entry_date;
  `)
}

/**
 * 创建 Notes 表。
 */
export const createNotesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      tags TEXT NOT NULL,
      time TEXT NOT NULL,
      is_curated INTEGER NOT NULL DEFAULT 0,
      clue TEXT
    );
  `)
}

/**
 * 创建待办表与索引。
 */
export const createWorkspaceTodosTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL,
      text TEXT NOT NULL,
      priority TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_todos_entry_date
    ON todos(entry_date);

    CREATE INDEX IF NOT EXISTS idx_todos_entry_date_completed_sort_order
    ON todos(entry_date, completed, sort_order);
  `)
}

/**
 * 创建片段表与索引。
 */
export const createWorkspaceSnippetsTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snippets_entry_date
    ON snippets(entry_date);
  `)
}

/**
 * 创建日记表。
 */
export const createJournalsTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS journals (
      entry_date TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

/**
 * 初始化本地 SQLite 数据库。
 */
export const initDatabase = (): Database.Database => {
  if (sqlite) {
    return sqlite
  }

  mkdirSync(getDatabaseDir(), { recursive: true })
  sqlite = new Database(getDatabasePath())
  migrateLegacyWorkspaceTables(sqlite)
  createNotesTable(sqlite)
  createWorkspaceTodosTable(sqlite)
  createWorkspaceSnippetsTable(sqlite)
  createJournalsTable(sqlite)

  return sqlite
}

/**
 * 获取 SQLite 数据库连接。
 */
export const getDatabase = (): Database.Database => sqlite ?? initDatabase()
