import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { getDatabaseDir, getDatabasePath } from '@/paths'

// 数据库迁移依赖的最小连接接口。
type MigrationDatabase = Pick<Database.Database, 'exec' | 'prepare'>

// 可迁移表名。
type MigratableTableName =
  | 'notes'
  | 'todos'
  | 'snippets'
  | 'journals'
  | 'associated_people'
  | 'ai_chat_sessions'
  | 'ai_chat_messages'
  | 'ai_agent_runs'
  | 'ai_agent_tool_calls'

// 重建表配置。
type RebuildTableConfig = {
  // 表名。
  tableName: MigratableTableName
  // 建表 SQL，不包含 CREATE TABLE 语句外壳。
  columnsSql: string
  // 写入目标字段。
  insertColumns: string[]
  // 读取旧表字段。
  selectColumns: string[]
  // 排序子句。
  orderByClause: string
  // 需要满足 TIMESTAMP 声明的字段。
  timestampColumns?: string[]
  // 需要存在的字段。
  requiredColumns?: string[]
  // 需要单列唯一约束的字段。
  requiredUniqueColumns?: string[]
}

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
 * 判断指定表列是否存在。
 */
const columnExists = (
  database: MigrationDatabase,
  tableName: string,
  columnName: string
): boolean => getColumnType(database, tableName, columnName) !== null

/**
 * 判断表是否已经使用整数主键。
 */
const usesIntegerPrimaryKey = (database: MigrationDatabase, tableName: string): boolean =>
  getColumnType(database, tableName, 'id') === 'INTEGER'

/**
 * 判断字段是否存在单列唯一索引。
 */
const columnHasUniqueIndex = (
  database: MigrationDatabase,
  tableName: string,
  columnName: string
): boolean => {
  const indexes = database
    .prepare(`PRAGMA index_list('${tableName}')`)
    .all() as Array<{ name?: string; unique?: number }>

  return indexes.some((index) => {
    if (!index.name || index.unique !== 1) {
      return false
    }

    const indexColumns = database
      .prepare(`PRAGMA index_info('${index.name}')`)
      .all() as Array<{ name?: string }>

    return indexColumns.length === 1 && indexColumns[0]?.name === columnName
  })
}

/**
 * 判断表是否需要按目标结构重建。
 */
const shouldRebuildTable = (
  database: MigrationDatabase,
  tableName: MigratableTableName,
  timestampColumns: string[] = [],
  requiredColumns: string[] = [],
  requiredUniqueColumns: string[] = []
): boolean =>
  !usesIntegerPrimaryKey(database, tableName) ||
  timestampColumns.some((columnName) => getColumnType(database, tableName, columnName) !== 'TIMESTAMP') ||
  requiredColumns.some((columnName) => !columnExists(database, tableName, columnName)) ||
  requiredUniqueColumns.some((columnName) => !columnHasUniqueIndex(database, tableName, columnName))

/**
 * 生成旧表读取字段，缺失字段用替代字段兜底。
 */
const resolveSelectColumns = (
  database: MigrationDatabase,
  tableName: string,
  selectColumns: string[]
): string[] =>
  selectColumns.map((columnName) => {
    if (columnExists(database, tableName, columnName)) {
      return columnName
    }

    if (columnName === 'external_id' && columnExists(database, tableName, 'id')) {
      return 'id'
    }

    throw new Error(`无法迁移缺失字段: ${tableName}.${columnName}`)
  })

/**
 * 将旧表重建为目标字段类型。
 */
const rebuildTable = (database: MigrationDatabase, config: RebuildTableConfig): void => {
  if (!tableExists(database, config.tableName)) {
    return
  }

  if (
    !shouldRebuildTable(
      database,
      config.tableName,
      config.timestampColumns,
      config.requiredColumns,
      config.requiredUniqueColumns
    )
  ) {
    return
  }

  const legacyTableName = `${config.tableName}_legacy_schema`
  const insertColumns = usesIntegerPrimaryKey(database, config.tableName)
    ? ['id', ...config.insertColumns]
    : config.insertColumns
  const selectColumns = usesIntegerPrimaryKey(database, config.tableName)
    ? ['id', ...resolveSelectColumns(database, config.tableName, config.selectColumns)]
    : resolveSelectColumns(database, config.tableName, config.selectColumns)

  database.exec(`
    ALTER TABLE ${config.tableName} RENAME TO ${legacyTableName};
    CREATE TABLE ${config.tableName} (
      id INTEGER PRIMARY KEY,
      ${config.columnsSql}
    );
    INSERT INTO ${config.tableName} (${insertColumns.join(', ')})
    SELECT ${selectColumns.join(', ')}
    FROM ${legacyTableName}
    ORDER BY ${config.orderByClause};
    DROP TABLE ${legacyTableName};
  `)
}

/**
 * 重建旧版表结构。
 */
const rebuildLegacyTables = (database: MigrationDatabase): void => {
  rebuildTable(database, {
    tableName: 'notes',
    columnsSql: `
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      tags TEXT NOT NULL,
      time TIMESTAMP NOT NULL,
      is_curated INTEGER NOT NULL DEFAULT 0,
      clue TEXT
    `.trim(),
    insertColumns: ['title', 'content', 'source', 'tags', 'time', 'is_curated', 'clue'],
    selectColumns: ['title', 'content', 'source', 'tags', 'time', 'is_curated', 'clue'],
    orderByClause: 'time ASC, id ASC',
    timestampColumns: ['time']
  })
  rebuildTable(database, {
    tableName: 'todos',
    columnsSql: `
      entry_date TEXT NOT NULL,
      text TEXT NOT NULL,
      priority TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    `.trim(),
    insertColumns: ['entry_date', 'text', 'priority', 'completed', 'sort_order', 'created_at', 'updated_at'],
    selectColumns: ['entry_date', 'text', 'priority', 'completed', 'sort_order', 'created_at', 'updated_at'],
    orderByClause: 'entry_date ASC, sort_order ASC, created_at ASC, id ASC',
    timestampColumns: ['created_at', 'updated_at']
  })
  rebuildTable(database, {
    tableName: 'snippets',
    columnsSql: `
      entry_date TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    `.trim(),
    insertColumns: ['entry_date', 'title', 'content', 'tags', 'created_at', 'updated_at'],
    selectColumns: ['entry_date', 'title', 'content', 'tags', 'created_at', 'updated_at'],
    orderByClause: 'entry_date ASC, created_at ASC, id ASC',
    timestampColumns: ['created_at', 'updated_at']
  })
  rebuildTable(database, {
    tableName: 'journals',
    columnsSql: `
      entry_date TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    `.trim(),
    insertColumns: ['entry_date', 'content', 'created_at', 'updated_at'],
    selectColumns: ['entry_date', 'content', 'created_at', 'updated_at'],
    orderByClause: 'entry_date ASC',
    timestampColumns: ['created_at', 'updated_at']
  })
  rebuildTable(database, {
    tableName: 'associated_people',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      avatar TEXT NOT NULL,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      relationship TEXT NOT NULL,
      status TEXT NOT NULL,
      birthday TEXT NOT NULL,
      contact TEXT NOT NULL,
      tags TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    `.trim(),
    insertColumns: [
      'external_id',
      'avatar',
      'name',
      'gender',
      'relationship',
      'status',
      'birthday',
      'contact',
      'tags',
      'details',
      'created_at',
      'updated_at'
    ],
    selectColumns: [
      'external_id',
      'avatar',
      'name',
      'gender',
      'relationship',
      'status',
      'birthday',
      'contact',
      'tags',
      'details',
      'created_at',
      'updated_at'
    ],
    orderByClause: 'updated_at ASC, id ASC',
    timestampColumns: ['created_at', 'updated_at'],
    requiredColumns: ['external_id']
  })
  rebuildTable(database, {
    tableName: 'ai_chat_sessions',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      last_message_at TIMESTAMP NOT NULL
    `.trim(),
    insertColumns: ['external_id', 'title', 'status', 'created_at', 'updated_at', 'last_message_at'],
    selectColumns: ['external_id', 'title', 'status', 'created_at', 'updated_at', 'last_message_at'],
    orderByClause: 'updated_at ASC, id ASC',
    timestampColumns: ['created_at', 'updated_at', 'last_message_at'],
    requiredColumns: ['external_id']
  })
  rebuildTable(database, {
    tableName: 'ai_chat_messages',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      answer TEXT,
      parts_json TEXT NOT NULL,
      tool_steps_json TEXT NOT NULL,
      time TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    `.trim(),
    insertColumns: [
      'external_id',
      'session_id',
      'role',
      'content',
      'answer',
      'parts_json',
      'tool_steps_json',
      'time',
      'created_at',
      'updated_at'
    ],
    selectColumns: [
      'external_id',
      'session_id',
      'role',
      'content',
      'answer',
      'parts_json',
      'tool_steps_json',
      'time',
      'created_at',
      'updated_at'
    ],
    orderByClause: 'created_at ASC, id ASC',
    timestampColumns: ['time', 'created_at', 'updated_at'],
    requiredColumns: ['external_id']
  })
  rebuildTable(database, {
    tableName: 'ai_agent_runs',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL,
      assistant_message_id TEXT NOT NULL UNIQUE,
      provider TEXT,
      model TEXT,
      status TEXT NOT NULL,
      error TEXT,
      started_at TIMESTAMP NOT NULL,
      finished_at TIMESTAMP
    `.trim(),
    insertColumns: [
      'external_id',
      'session_id',
      'assistant_message_id',
      'provider',
      'model',
      'status',
      'error',
      'started_at',
      'finished_at'
    ],
    selectColumns: [
      'external_id',
      'session_id',
      'assistant_message_id',
      'provider',
      'model',
      'status',
      'error',
      'started_at',
      'finished_at'
    ],
    orderByClause: 'started_at ASC, id ASC',
    timestampColumns: ['started_at', 'finished_at'],
    requiredColumns: ['external_id'],
    requiredUniqueColumns: ['assistant_message_id']
  })
  rebuildTable(database, {
    tableName: 'ai_agent_tool_calls',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      run_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      observation TEXT NOT NULL,
      data_json TEXT NOT NULL,
      error TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      UNIQUE(run_id, tool_call_id)
    `.trim(),
    insertColumns: [
      'external_id',
      'run_id',
      'message_id',
      'tool_call_id',
      'name',
      'status',
      'input_json',
      'observation',
      'data_json',
      'error',
      'created_at',
      'updated_at'
    ],
    selectColumns: [
      'external_id',
      'run_id',
      'message_id',
      'tool_call_id',
      'name',
      'status',
      'input_json',
      'observation',
      'data_json',
      'error',
      'created_at',
      'updated_at'
    ],
    orderByClause: 'created_at ASC, id ASC',
    timestampColumns: ['created_at', 'updated_at'],
    requiredColumns: ['external_id']
  })
}

/**
 * 迁移旧版表名与字段结构。
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
    DROP INDEX IF EXISTS idx_ai_chat_sessions_last_message_at;
    DROP INDEX IF EXISTS idx_ai_chat_sessions_updated_at;
    DROP INDEX IF EXISTS idx_ai_chat_messages_session_created_at;
    DROP INDEX IF EXISTS idx_ai_agent_runs_session_started_at;
    DROP INDEX IF EXISTS idx_ai_agent_runs_assistant_message_id;
    DROP INDEX IF EXISTS idx_ai_agent_tool_calls_run_created_at;
    DROP INDEX IF EXISTS idx_ai_agent_tool_calls_message_id;
  `)

  rebuildLegacyTables(database)
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
      time TIMESTAMP NOT NULL,
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
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
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
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
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
      id INTEGER PRIMARY KEY,
      entry_date TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
  `)
}

/**
 * 创建关联人物表与索引。
 */
export const createAssociatedPeopleTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS associated_people (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      avatar TEXT NOT NULL,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      relationship TEXT NOT NULL,
      status TEXT NOT NULL,
      birthday TEXT NOT NULL,
      contact TEXT NOT NULL,
      tags TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
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
    DROP INDEX IF EXISTS idx_ai_chat_sessions_last_message_at;
    DROP INDEX IF EXISTS idx_ai_chat_sessions_updated_at;
    DROP INDEX IF EXISTS idx_ai_chat_messages_session_created_at;
    DROP INDEX IF EXISTS idx_ai_agent_runs_session_started_at;
    DROP INDEX IF EXISTS idx_ai_agent_runs_assistant_message_id;
    DROP INDEX IF EXISTS idx_ai_agent_tool_calls_run_created_at;
    DROP INDEX IF EXISTS idx_ai_agent_tool_calls_message_id;
  `)
  rebuildLegacyTables(database)

  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      last_message_at TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_updated_at
    ON ai_chat_sessions(updated_at DESC);

    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      answer TEXT,
      parts_json TEXT NOT NULL,
      tool_steps_json TEXT NOT NULL,
      time TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_created_at
    ON ai_chat_messages(session_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS ai_agent_runs (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL,
      assistant_message_id TEXT NOT NULL UNIQUE,
      provider TEXT,
      model TEXT,
      status TEXT NOT NULL,
      error TEXT,
      started_at TIMESTAMP NOT NULL,
      finished_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_session_started_at
    ON ai_agent_runs(session_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS ai_agent_tool_calls (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      run_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      observation TEXT NOT NULL,
      data_json TEXT NOT NULL,
      error TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
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
