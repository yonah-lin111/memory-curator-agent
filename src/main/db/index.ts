import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { getDatabaseDir, getDatabasePath } from '../paths'

// 数据库迁移依赖的最小连接接口。
type MigrationDatabase = Pick<Database.Database, 'exec' | 'prepare'>

// SQLite 数据库连接。
let sqlite: Database.Database | null = null

/**
 * 判断指定表是否存在。
 */
const tableExists = (database: MigrationDatabase, tableName: string): boolean =>
  Boolean(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName)
  )

/**
 * 读取指定列的声明类型。
 */
const getColumnType = (
  database: MigrationDatabase,
  tableName: string,
  columnName: string
): string | null => {
  const column = database
    .prepare(`SELECT type FROM pragma_table_info('${tableName}') WHERE name = ?`)
    .get(columnName) as { type?: string } | undefined

  return column?.type?.toUpperCase() ?? null
}

/**
 * 判断表是否已经使用整数主键。
 */
const usesIntegerPrimaryKey = (database: MigrationDatabase, tableName: string): boolean =>
  getColumnType(database, tableName, 'id') === 'INTEGER'

/**
 * 将文本主键表重建为整数主键表。
 */
const rebuildTableWithIntegerPrimaryKey = (
  database: MigrationDatabase,
  tableName: 'notes' | 'todos' | 'snippets',
  tableColumnsSql: string,
  copyColumns: string[],
  orderByClause: string
): void => {
  if (!tableExists(database, tableName) || usesIntegerPrimaryKey(database, tableName)) {
    return
  }

  const legacyTableName = `${tableName}_legacy_text_id`

  database.exec(`
    ALTER TABLE ${tableName} RENAME TO ${legacyTableName};
    CREATE TABLE ${tableName} (
      id INTEGER PRIMARY KEY,
      ${tableColumnsSql}
    );
    INSERT INTO ${tableName} (${copyColumns.join(', ')})
    SELECT ${copyColumns.join(', ')}
    FROM ${legacyTableName}
    ORDER BY ${orderByClause};
    DROP TABLE ${legacyTableName};
  `)
}

/**
 * 迁移旧版 Workspace 表名与文本主键结构。
 */
export const migrateLegacyWorkspaceSchema = (database: MigrationDatabase): void => {
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

  rebuildTableWithIntegerPrimaryKey(
    database,
    'notes',
    `
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      tags TEXT NOT NULL,
      time TEXT NOT NULL,
      is_curated INTEGER NOT NULL DEFAULT 0,
      clue TEXT
    `.trim(),
    ['title', 'content', 'source', 'tags', 'time', 'is_curated', 'clue'],
    'time ASC, id ASC'
  )
  rebuildTableWithIntegerPrimaryKey(
    database,
    'todos',
    `
      entry_date TEXT NOT NULL,
      text TEXT NOT NULL,
      priority TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    `.trim(),
    ['entry_date', 'text', 'priority', 'completed', 'sort_order', 'created_at', 'updated_at'],
    'entry_date ASC, sort_order ASC, created_at ASC, id ASC'
  )
  rebuildTableWithIntegerPrimaryKey(
    database,
    'snippets',
    `
      entry_date TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    `.trim(),
    ['entry_date', 'title', 'content', 'tags', 'created_at', 'updated_at'],
    'entry_date ASC, created_at ASC, id ASC'
  )
}

/**
 * 创建 Notes 表。
 */
export const createNotesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
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
      id INTEGER PRIMARY KEY,
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
      id INTEGER PRIMARY KEY,
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
  migrateLegacyWorkspaceSchema(sqlite)
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
