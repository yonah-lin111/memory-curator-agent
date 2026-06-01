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
 * 迁移旧版表名与文本主键结构。
 */
export const migrateLegacySchema = (database: MigrationDatabase): void => {
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
export const createTodosTable = (database: Database.Database): void => {
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
export const createSnippetsTable = (database: Database.Database): void => {
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
 * 创建关联人物表与索引。
 */
export const createAssociatedPeopleTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS associated_people (
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

    CREATE INDEX IF NOT EXISTS idx_associated_people_relationship
    ON associated_people(relationship);

    CREATE INDEX IF NOT EXISTS idx_associated_people_updated_at
    ON associated_people(updated_at);
  `)
}

/**
 * 创建 AI Agent 持久化表与索引。
 */
export const createAiChatPersistenceTables = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_message_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_last_message_at
    ON ai_chat_sessions(last_message_at DESC);

    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      answer TEXT,
      parts_json TEXT NOT NULL,
      tool_steps_json TEXT NOT NULL,
      time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_created_at
    ON ai_chat_messages(session_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS ai_agent_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      assistant_message_id TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      status TEXT NOT NULL,
      error TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_session_started_at
    ON ai_agent_runs(session_id, started_at DESC);

    CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_assistant_message_id
    ON ai_agent_runs(assistant_message_id);

    CREATE TABLE IF NOT EXISTS ai_agent_tool_calls (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      observation TEXT NOT NULL,
      data_json TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(run_id, tool_call_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_agent_tool_calls_run_created_at
    ON ai_agent_tool_calls(run_id, created_at ASC);

    CREATE INDEX IF NOT EXISTS idx_ai_agent_tool_calls_message_id
    ON ai_agent_tool_calls(message_id);

    CREATE TABLE IF NOT EXISTS ai_agent_context_snapshots (
      id INTEGER PRIMARY KEY,
      run_id TEXT NOT NULL,
      context_key TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      source_id TEXT,
      content TEXT NOT NULL,
      tokens INTEGER,
      created_order INTEGER NOT NULL,
      meta_json TEXT NOT NULL,
      UNIQUE(run_id, context_key)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_agent_context_snapshots_run_order
    ON ai_agent_context_snapshots(run_id, created_order ASC);
  `)

  database.exec(`
    UPDATE ai_chat_sessions
    SET status = CASE status
      WHEN '运行中' THEN 'running'
      WHEN '运行完成' THEN 'completed'
      WHEN '已完成' THEN 'completed'
      WHEN '运行失败' THEN 'failed'
      WHEN '失败' THEN 'failed'
      ELSE status
    END
    WHERE status IN ('运行中', '运行完成', '已完成', '运行失败', '失败');
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
  migrateLegacySchema(sqlite)
  createNotesTable(sqlite)
  createTodosTable(sqlite)
  createSnippetsTable(sqlite)
  createJournalsTable(sqlite)
  createAssociatedPeopleTable(sqlite)
  createAiChatPersistenceTables(sqlite)

  return sqlite
}

/**
 * 获取 SQLite 数据库连接。
 */
export const getDatabase = (): Database.Database => sqlite ?? initDatabase()
