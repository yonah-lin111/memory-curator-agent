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
  | 'personal_profiles'
  | 'ai_chat_sessions'
  | 'ai_chat_messages'
  | 'ai_agent_runs'
  | 'ai_agent_tool_calls'
  | 'note_categories'
  | 'prompt_design_projects'
  | 'prompt_design_items'
  | 'prompt_ai_chat_sessions'
  | 'prompt_ai_chat_messages'

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
  // 单列唯一约束字段。
  requiredUniqueColumns?: string[]
  // 必须不存在的字段（存在则触发重建以删除）。
  forbiddenColumns?: string[]
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
  requiredUniqueColumns: string[] = [],
  forbiddenColumns: string[] = []
): boolean =>
  !usesIntegerPrimaryKey(database, tableName) ||
  timestampColumns.some((columnName) => getColumnType(database, tableName, columnName) !== 'TIMESTAMP') ||
  requiredColumns.some((columnName) => !columnExists(database, tableName, columnName)) ||
  requiredUniqueColumns.some((columnName) => !columnHasUniqueIndex(database, tableName, columnName)) ||
  forbiddenColumns.some((columnName) => columnExists(database, tableName, columnName))

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

    // 缺失的列用 NULL 填充（兼容新增字段迁移）。
    if (columnName === 'category_id') {
      return 'NULL AS category_id'
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
      config.requiredUniqueColumns,
      config.forbiddenColumns
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

  database.exec('PRAGMA legacy_alter_table = ON;');
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
  database.exec('PRAGMA legacy_alter_table = OFF;');
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
      tags TEXT NOT NULL,
      time TIMESTAMP NOT NULL,
      category_id INTEGER
    `.trim(),
    insertColumns: ['title', 'content', 'tags', 'time', 'category_id'],
    selectColumns: ['title', 'content', 'tags', 'time', 'category_id'],
    orderByClause: 'time ASC, id ASC',
    timestampColumns: ['time'],
    requiredColumns: ['category_id'],
    forbiddenColumns: ['source']
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
    tableName: 'personal_profiles',
    columnsSql: `
      avatar TEXT NOT NULL,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      status TEXT NOT NULL,
      birthday TEXT NOT NULL,
      contact TEXT NOT NULL,
      tags TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    `.trim(),
    insertColumns: [
      'avatar',
      'name',
      'gender',
      'status',
      'birthday',
      'contact',
      'tags',
      'details',
      'created_at',
      'updated_at'
    ],
    selectColumns: [
      'avatar',
      'name',
      'gender',
      'status',
      'birthday',
      'contact',
      'tags',
      'details',
      'created_at',
      'updated_at'
    ],
    orderByClause: 'updated_at ASC, id ASC',
    timestampColumns: ['created_at', 'updated_at']
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
      updated_at TIMESTAMP NOT NULL,
      cancelled INTEGER NOT NULL DEFAULT 0
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
      'updated_at',
      'cancelled'
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
      'updated_at',
      'cancelled'
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
    tableName: 'prompt_design_projects',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'virtual',
      path TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    `.trim(),
    insertColumns: ['external_id', 'name', 'type', 'path', 'created_at', 'updated_at'],
    selectColumns: ['external_id', 'name', 'type', 'path', 'created_at', 'updated_at'],
    orderByClause: 'created_at ASC, id ASC',
    timestampColumns: ['created_at', 'updated_at'],
    requiredColumns: ['external_id']
  })
  rebuildTable(database, {
    tableName: 'prompt_design_items',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      design_data TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      FOREIGN KEY (project_id) REFERENCES prompt_design_projects(external_id) ON DELETE CASCADE
    `.trim(),
    insertColumns: ['external_id', 'project_id', 'name', 'design_data', 'created_at', 'updated_at'],
    selectColumns: ['external_id', 'project_id', 'name', 'design_data', 'created_at', 'updated_at'],
    orderByClause: 'created_at ASC, id ASC',
    timestampColumns: ['created_at', 'updated_at'],
    requiredColumns: ['external_id']
  })
  rebuildTable(database, {
    tableName: 'prompt_ai_chat_sessions',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      design_item_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      last_message_at TIMESTAMP NOT NULL,
      FOREIGN KEY (design_item_id) REFERENCES prompt_design_items(external_id) ON DELETE CASCADE
    `.trim(),
    insertColumns: ['external_id', 'design_item_id', 'title', 'status', 'created_at', 'updated_at', 'last_message_at'],
    selectColumns: ['external_id', 'design_item_id', 'title', 'status', 'created_at', 'updated_at', 'last_message_at'],
    orderByClause: 'updated_at ASC, id ASC',
    timestampColumns: ['created_at', 'updated_at', 'last_message_at'],
    requiredColumns: ['external_id']
  })
  rebuildTable(database, {
    tableName: 'prompt_ai_chat_messages',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      answer TEXT,
      parts_json TEXT NOT NULL,
      tool_steps_json TEXT NOT NULL,
      time TIMESTAMP NOT NULL,
      model TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      cancelled INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES prompt_ai_chat_sessions(external_id) ON DELETE CASCADE
    `.trim(),
    insertColumns: ['external_id', 'session_id', 'role', 'content', 'answer', 'parts_json', 'tool_steps_json', 'time', 'model', 'created_at', 'updated_at', 'cancelled'],
    selectColumns: ['external_id', 'session_id', 'role', 'content', 'answer', 'parts_json', 'tool_steps_json', 'time', 'model', 'created_at', 'updated_at', 'cancelled'],
    orderByClause: 'created_at ASC, id ASC',
    timestampColumns: ['time', 'created_at', 'updated_at'],
    requiredColumns: ['external_id']
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
  rebuildTable(database, {
    tableName: 'prompt_design_items',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      design_data TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      FOREIGN KEY (project_id) REFERENCES prompt_design_projects(external_id) ON DELETE CASCADE
    `.trim(),
    insertColumns: ['external_id', 'project_id', 'name', 'design_data', 'created_at', 'updated_at'],
    selectColumns: ['external_id', 'project_id', 'name', 'design_data', 'created_at', 'updated_at'],
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

  // 为已存在的 ai_chat_messages 表补加 cancelled 列。
  if (tableExists(database, 'ai_chat_messages') && !columnExists(database, 'ai_chat_messages', 'cancelled')) {
    database.exec('ALTER TABLE ai_chat_messages ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0;')
  }

  // 为已存在的 prompt_ai_chat_messages 表补加 model 列。
  if (tableExists(database, 'prompt_ai_chat_messages') && !columnExists(database, 'prompt_ai_chat_messages', 'model')) {
    database.exec('ALTER TABLE prompt_ai_chat_messages ADD COLUMN model TEXT;')
  }

  // 为已存在的 weekly_summaries 表补加 type 列并迁移旧 curator 后缀数据。
  if (tableExists(database, 'weekly_summaries') && !columnExists(database, 'weekly_summaries', 'type')) {
    database.exec(`
      CREATE TABLE weekly_summaries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start_date TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'summary',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        model_used TEXT,
        generated_at TEXT NOT NULL,
        UNIQUE(week_start_date, type)
      );

      INSERT INTO weekly_summaries_new (id, week_start_date, type, title, content, model_used, generated_at)
      SELECT
        id,
        REPLACE(week_start_date, '-curator', ''),
        CASE WHEN week_start_date LIKE '%-curator' THEN 'interpersonal' ELSE 'summary' END,
        title,
        content,
        model_used,
        generated_at
      FROM weekly_summaries;

      DROP TABLE weekly_summaries;
      ALTER TABLE weekly_summaries_new RENAME TO weekly_summaries;
      CREATE INDEX IF NOT EXISTS idx_weekly_summaries_week_start_date_type ON weekly_summaries(week_start_date, type);
    `)
  }

  // 检查已存在的 weekly_summaries 表是否具备 UNIQUE(week_start_date, type) 联合唯一约束。
  // 若只具备旧的单列唯一约束或没有联合唯一约束，必须重建表以防止 ON CONFLICT 报错。
  if (tableExists(database, 'weekly_summaries')) {
    const row = database.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='weekly_summaries'").get() as { sql: string } | undefined
    const sql = row?.sql || ''
    if (!sql.includes('UNIQUE(week_start_date, type)') && !sql.includes('UNIQUE (week_start_date, type)')) {
      database.exec(`
        CREATE TABLE weekly_summaries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          week_start_date TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'summary',
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          model_used TEXT,
          generated_at TEXT NOT NULL,
          UNIQUE(week_start_date, type)
        );

        INSERT INTO weekly_summaries_new (id, week_start_date, type, title, content, model_used, generated_at)
        SELECT id, week_start_date, type, title, content, model_used, generated_at FROM weekly_summaries;

        DROP TABLE weekly_summaries;
        ALTER TABLE weekly_summaries_new RENAME TO weekly_summaries;
        CREATE INDEX IF NOT EXISTS idx_weekly_summaries_week_start_date_type ON weekly_summaries(week_start_date, type);
      `)
    }
  }

  // 清洗可能已存在的历史数据，将 'curator' 统一更新为 'interpersonal'。
  if (tableExists(database, 'weekly_summaries') && columnExists(database, 'weekly_summaries', 'type')) {
    database.exec("UPDATE weekly_summaries SET type = 'interpersonal' WHERE type = 'curator';")
  }

  // 为已存在的 weekly_summaries 表补加 is_meaningful 列（默认 1 = 有意义）。
  if (tableExists(database, 'weekly_summaries') && !columnExists(database, 'weekly_summaries', 'is_meaningful')) {
    database.exec('ALTER TABLE weekly_summaries ADD COLUMN is_meaningful INTEGER NOT NULL DEFAULT 1;')
  }

  // 为已存在的 themes 表补加 AI 生成来源标记。
  if (tableExists(database, 'themes') && !columnExists(database, 'themes', 'ai_generated')) {
    database.exec('ALTER TABLE themes ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0;')
  }

  // 若 theme_items 表中存在已废弃的 source_quote 字段，则进行清理删除。
  if (tableExists(database, 'theme_items') && columnExists(database, 'theme_items', 'source_quote')) {
    database.exec('ALTER TABLE theme_items DROP COLUMN source_quote;')
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
      tags TEXT NOT NULL,
      time TIMESTAMP NOT NULL,
      category_id INTEGER
    );
  `)
}

/**
 * 创建笔记分类表。
 */
export const createNoteCategoriesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS note_categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
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
 * 创建个人信息表。
 */
export const createPersonalProfilesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS personal_profiles (
      id INTEGER PRIMARY KEY,
      avatar TEXT NOT NULL,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      status TEXT NOT NULL,
      birthday TEXT NOT NULL,
      contact TEXT NOT NULL,
      tags TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
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
       updated_at TIMESTAMP NOT NULL,
       cancelled INTEGER NOT NULL DEFAULT 0
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
 * 创建周度总结表。
 */
export const createWeeklySummariesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS weekly_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'summary',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      model_used TEXT,
      generated_at TEXT NOT NULL,
      is_meaningful INTEGER NOT NULL DEFAULT 1,
      UNIQUE(week_start_date, type)
    );
    CREATE INDEX IF NOT EXISTS idx_weekly_summaries_week_start_date_type ON weekly_summaries(week_start_date, type);
  `)
}

/**
 * 创建 themes 表。
 */
export const createThemesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      ai_generated INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_themes_status
    ON themes(status);

    CREATE INDEX IF NOT EXISTS idx_themes_updated_at
    ON themes(updated_at DESC);
  `)
}

/**
 * 创建 theme_items 表。
 */
export const createThemeItemsTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS theme_items (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      theme_external_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      relevance_note TEXT NOT NULL DEFAULT '',
      ai_extracted INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL,
      UNIQUE(theme_external_id, source_type, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_theme_items_theme
    ON theme_items(theme_external_id);

    CREATE INDEX IF NOT EXISTS idx_theme_items_source
    ON theme_items(source_type, source_id);
  `)
}

/**
 * 创建账单表与索引。
 */
export const createBillsTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY,
      amount INTEGER NOT NULL,
      category TEXT NOT NULL,
      bill_type TEXT NOT NULL,
      bill_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bills_bill_date
    ON bills(bill_date);

    CREATE INDEX IF NOT EXISTS idx_bills_bill_type
    ON bills(bill_type);

    CREATE INDEX IF NOT EXISTS idx_bills_category
    ON bills(category);
  `)
}

/**
 * 创建提示词设计项目表。
 */
export const createPromptDesignTables = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS prompt_design_projects (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'virtual',
      path TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_design_modules (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      FOREIGN KEY (project_id) REFERENCES prompt_design_projects(external_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_design_modules_project_id
    ON prompt_design_modules(project_id);

    CREATE TABLE IF NOT EXISTS prompt_design_items (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      module_id TEXT,
      name TEXT NOT NULL,
      design_data TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      FOREIGN KEY (project_id) REFERENCES prompt_design_projects(external_id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES prompt_design_modules(external_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_design_items_project_id
    ON prompt_design_items(project_id);

    CREATE INDEX IF NOT EXISTS idx_prompt_design_items_module_id
    ON prompt_design_items(module_id);
  `)
}

/**
 * 创建提示词 AI Agent 持久化表与索引。
 */
export const createPromptAiPersistenceTables = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS prompt_ai_chat_sessions (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      design_item_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      last_message_at TIMESTAMP NOT NULL,
      FOREIGN KEY (design_item_id) REFERENCES prompt_design_items(external_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_ai_chat_sessions_item_id
    ON prompt_ai_chat_sessions(design_item_id);

    CREATE INDEX IF NOT EXISTS idx_prompt_ai_chat_sessions_updated_at
    ON prompt_ai_chat_sessions(updated_at DESC);

    CREATE TABLE IF NOT EXISTS prompt_ai_chat_messages (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      answer TEXT,
      parts_json TEXT NOT NULL,
      tool_steps_json TEXT NOT NULL,
      time TIMESTAMP NOT NULL,
      model TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      cancelled INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES prompt_ai_chat_sessions(external_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_ai_chat_messages_session_created_at
    ON prompt_ai_chat_messages(session_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS prompt_ai_agent_runs (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL,
      assistant_message_id TEXT NOT NULL UNIQUE,
      provider TEXT,
      model TEXT,
      status TEXT NOT NULL,
      error TEXT,
      started_at TIMESTAMP NOT NULL,
      finished_at TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES prompt_ai_chat_sessions(external_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_ai_agent_runs_session_started_at
    ON prompt_ai_agent_runs(session_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS prompt_ai_agent_tool_calls (
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
      UNIQUE(run_id, tool_call_id),
      FOREIGN KEY (run_id) REFERENCES prompt_ai_agent_runs(external_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_ai_agent_tool_calls_run_created_at
    ON prompt_ai_agent_tool_calls(run_id, created_at ASC);

    CREATE INDEX IF NOT EXISTS idx_prompt_ai_agent_tool_calls_message_id
    ON prompt_ai_agent_tool_calls(message_id);

    CREATE TABLE IF NOT EXISTS prompt_ai_agent_context_snapshots (
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
      UNIQUE(run_id, context_key),
      FOREIGN KEY (run_id) REFERENCES prompt_ai_agent_runs(external_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_ai_agent_context_snapshots_run_order
    ON prompt_ai_agent_context_snapshots(run_id, created_order ASC);
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
  createNoteCategoriesTable(sqlite)
  createTodosTable(sqlite)
  createSnippetsTable(sqlite)
  createJournalsTable(sqlite)
  createAssociatedPeopleTable(sqlite)
  createPersonalProfilesTable(sqlite)
  createAiChatPersistenceTables(sqlite)
  createWeeklySummariesTable(sqlite)
  createThemesTable(sqlite)
  createThemeItemsTable(sqlite)
  createBillsTable(sqlite)

  // 提示词设计数据库结构版本。
  const currentVersion = sqlite.pragma('user_version', { simple: true }) as number
  if (currentVersion < 1) {
    const tablesToDrop = [
      'prompt_ai_agent_context_snapshots',
      'prompt_ai_agent_tool_calls',
      'prompt_ai_agent_runs',
      'prompt_ai_chat_messages',
      'prompt_ai_chat_sessions',
      'prompt_active_nodes', // 历史残留
      'prompt_design_items',
      'prompt_design_projects'
    ]
    sqlite.exec('PRAGMA foreign_keys = OFF;')
    for (const table of tablesToDrop) {
      try {
        sqlite.exec(`DROP TABLE IF EXISTS ${table};`)
      } catch (e) {
        console.warn(`Failed to drop table ${table} during migration:`, e)
      }
    }
    sqlite.pragma('user_version = 1')
  }

  if (currentVersion < 2) {
    // 升级模块层级时按产品要求清空提示词设计及其关联 AI 数据，保留项目配置。
    sqlite.exec('PRAGMA foreign_keys = OFF;')
    sqlite.exec(`
      DROP TABLE IF EXISTS prompt_ai_agent_context_snapshots;
      DROP TABLE IF EXISTS prompt_ai_agent_tool_calls;
      DROP TABLE IF EXISTS prompt_ai_agent_runs;
      DROP TABLE IF EXISTS prompt_ai_chat_messages;
      DROP TABLE IF EXISTS prompt_ai_chat_sessions;
      DROP TABLE IF EXISTS prompt_design_items;
      DROP TABLE IF EXISTS prompt_design_modules;
      DROP TABLE IF EXISTS prompt_active_nodes;
    `)
    sqlite.pragma('user_version = 2')
  }

  if (currentVersion === 2) {
    // 允许提示词设计直接归属项目，不要求关联模块，并保留既有设计与 AI 会话。
    sqlite.exec('PRAGMA foreign_keys = OFF;')
    sqlite.exec(`
      CREATE TABLE prompt_design_items_new (
        id INTEGER PRIMARY KEY,
        external_id TEXT NOT NULL UNIQUE,
        project_id TEXT NOT NULL,
        module_id TEXT,
        name TEXT NOT NULL,
        design_data TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        FOREIGN KEY (project_id) REFERENCES prompt_design_projects(external_id) ON DELETE CASCADE,
        FOREIGN KEY (module_id) REFERENCES prompt_design_modules(external_id) ON DELETE CASCADE
      );

      INSERT INTO prompt_design_items_new (id, external_id, project_id, module_id, name, design_data, created_at, updated_at)
      SELECT id, external_id, project_id, module_id, name, design_data, created_at, updated_at
      FROM prompt_design_items;

      DROP TABLE prompt_design_items;
      ALTER TABLE prompt_design_items_new RENAME TO prompt_design_items;
    `)
    sqlite.pragma('user_version = 3')
  }

  createPromptDesignTables(sqlite)
  createPromptAiPersistenceTables(sqlite)

  // 启用 SQLite 外键约束，以支持级联删除
  sqlite.exec('PRAGMA foreign_keys = ON;')

  return sqlite
}

/**
 * 获取 SQLite 数据库连接。
 */
export const getDatabase = (): Database.Database => sqlite ?? initDatabase()
