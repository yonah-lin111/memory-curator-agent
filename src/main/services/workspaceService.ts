import type {
  WorkspaceDayData,
  WorkspaceJournalItem,
  WorkspaceJournalRow,
  WorkspaceJournalSaveInput,
  WorkspaceMonthEntryOverview,
  WorkspaceMonthOverview,
  WorkspaceSnippetCreateInput,
  WorkspaceSnippetItem,
  WorkspaceSnippetRow,
  WorkspaceSnippetUpdateInput,
  WorkspaceTodoCreateInput,
  WorkspaceTodoItem,
  WorkspaceTodoPriority,
  WorkspaceTodoReorderInput,
  WorkspaceTodoRow,
  WorkspaceTodoUpdateInput
} from '../db/schema'

// 数据库语句接口。
export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// Workspace 服务依赖的最小数据库接口。
export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
}

// Workspace 服务方法集合。
export type WorkspaceService = {
  // 读取单日工作台数据。
  listDay: (entryDate: string) => WorkspaceDayData
  // 读取指定月份的工作台概览。
  listMonthOverview: (month: string) => WorkspaceMonthOverview
  // 保存日记。
  saveJournal: (input: WorkspaceJournalSaveInput) => WorkspaceJournalItem
  // 删除日记。
  deleteJournal: (entryDate: string) => void
  // 创建待办。
  createTodo: (input: WorkspaceTodoCreateInput) => WorkspaceTodoItem
  // 更新待办。
  updateTodo: (id: number, input: WorkspaceTodoUpdateInput) => WorkspaceTodoItem
  // 删除待办。
  deleteTodo: (id: number) => void
  // 重新排序待办。
  reorderTodos: (input: WorkspaceTodoReorderInput) => WorkspaceTodoItem[]
  // 创建片段。
  createSnippet: (input: WorkspaceSnippetCreateInput) => WorkspaceSnippetItem
  // 更新片段。
  updateSnippet: (id: number, input: WorkspaceSnippetUpdateInput) => WorkspaceSnippetItem
  // 删除片段。
  deleteSnippet: (id: number) => void
}

// 合法待办优先级集合。
const TODO_PRIORITIES: WorkspaceTodoPriority[] = ['P0', 'P1', 'P2', 'P3']

/**
 * 提取 SQLite 自增主键。
 */
const getInsertedRowId = (result: unknown, entityName: string): number => {
  const rowId = (result as { lastInsertRowid?: number | bigint } | undefined)?.lastInsertRowid

  if (typeof rowId === 'bigint') {
    return Number(rowId)
  }

  if (typeof rowId === 'number') {
    return rowId
  }

  throw new Error(`无法读取新建${entityName}的主键`)
}

/**
 * 生成当前时间戳。
 */
const createTimestamp = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${date} ${hours}:${minutes}`
}

/**
 * 从时间戳提取列表展示时间。
 */
const toDisplayTime = (timestamp: string): string => timestamp.slice(11, 16)

/**
 * 解析数据库标签字段。
 */
const parseStoredTags = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.filter((tag): tag is string => typeof tag === 'string')
}

/**
 * 校验日期格式。
 */
const validateEntryDate = (entryDate: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    throw new Error('工作台日期格式不正确')
  }
}

/**
 * 校验月份格式。
 */
const validateEntryMonth = (month: string): void => {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('工作台月份格式不正确')
  }
}

/**
 * 校验待办优先级。
 */
const validateTodoPriority = (priority: WorkspaceTodoPriority): void => {
  if (!TODO_PRIORITIES.includes(priority)) {
    throw new Error('待办优先级不正确')
  }
}

/**
 * 校验待办创建输入。
 */
const validateTodoCreateInput = (input: WorkspaceTodoCreateInput): void => {
  validateEntryDate(input.entryDate)
  validateTodoPriority(input.priority)

  if (!input.text.trim()) {
    throw new Error('待办内容不能为空')
  }
}

/**
 * 校验待办更新输入。
 */
const validateTodoUpdateInput = (input: WorkspaceTodoUpdateInput): void => {
  validateTodoPriority(input.priority)

  if (!input.text.trim()) {
    throw new Error('待办内容不能为空')
  }
}

/**
 * 校验片段输入。
 */
const validateSnippetInput = (
  input: WorkspaceSnippetCreateInput | WorkspaceSnippetUpdateInput
): void => {
  if ('entryDate' in input) {
    validateEntryDate(input.entryDate)
  }

  if (!input.title.trim() && !input.content.trim()) {
    throw new Error('片段标题或内容至少保留一项')
  }

  if (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error('片段标签格式不正确')
  }
}

/**
 * 校验日记输入。
 */
const validateJournalSaveInput = (input: WorkspaceJournalSaveInput): void => {
  validateEntryDate(input.entryDate)

  if (!input.content.trim()) {
    throw new Error('日记内容不能为空')
  }
}

/**
 * 将数据库行映射为页面待办。
 */
const mapTodoRow = (row: WorkspaceTodoRow): WorkspaceTodoItem => ({
  id: row.id,
  entryDate: row.entry_date,
  text: row.text,
  priority: row.priority,
  completed: row.completed === 1,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

/**
 * 将数据库行映射为页面片段。
 */
const mapSnippetRow = (row: WorkspaceSnippetRow): WorkspaceSnippetItem => ({
  id: row.id,
  entryDate: row.entry_date,
  title: row.title,
  content: row.content,
  tags: parseStoredTags(row.tags),
  time: toDisplayTime(row.created_at),
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

/**
 * 将数据库行映射为页面日记。
 */
const mapJournalRow = (row: WorkspaceJournalRow): WorkspaceJournalItem => ({
  entryDate: row.entry_date,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

// SQL 聚合行类型。
type WorkspaceCountRow = {
  // 聚合所属日期。
  entry_date: string
  // 聚合数量。
  item_count: number
}

/**
 * 创建 Workspace 服务。
 */
export const createWorkspaceService = (database: DatabaseConnection): WorkspaceService => ({
  listDay: (entryDate) => {
    validateEntryDate(entryDate)

    const todos = database
      .prepare(
        'SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos WHERE entry_date = ? ORDER BY completed ASC, sort_order ASC, created_at ASC'
      )
      .all(entryDate) as WorkspaceTodoRow[]
    const snippets = database
      .prepare(
        'SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE entry_date = ? ORDER BY created_at DESC, id DESC'
      )
      .all(entryDate) as WorkspaceSnippetRow[]
    const journal =
      (database
        .prepare('SELECT entry_date, content, created_at, updated_at FROM journals WHERE entry_date = ?')
        .get(entryDate) as WorkspaceJournalRow | undefined) ?? null

    return {
      todos: todos.map(mapTodoRow),
      snippets: snippets.map(mapSnippetRow),
      journal: journal ? mapJournalRow(journal) : null
    }
  },
  listMonthOverview: (month) => {
    validateEntryMonth(month)

    // 月份前缀查询条件。
    const monthPattern = `${month}-%`
    // 按日期聚合的概览映射。
    const overviewMap = new Map<string, WorkspaceMonthEntryOverview>()
    // 统一写入聚合计数，避免三类记录合并逻辑重复。
    const applyCountRows = (
      rows: WorkspaceCountRow[],
      field: 'todoCount' | 'snippetCount' | 'journalCount'
    ): void => {
      rows.forEach((row) => {
        const currentItem = overviewMap.get(row.entry_date) ?? {
          entryDate: row.entry_date,
          todoCount: 0,
          snippetCount: 0,
          journalCount: 0
        }
        overviewMap.set(row.entry_date, {
          ...currentItem,
          [field]: row.item_count
        })
      })
    }

    applyCountRows(
      database
        .prepare(
          'SELECT entry_date, COUNT(*) AS item_count FROM todos WHERE entry_date LIKE ? GROUP BY entry_date'
        )
        .all(monthPattern) as WorkspaceCountRow[],
      'todoCount'
    )
    applyCountRows(
      database
        .prepare(
          'SELECT entry_date, COUNT(*) AS item_count FROM snippets WHERE entry_date LIKE ? GROUP BY entry_date'
        )
        .all(monthPattern) as WorkspaceCountRow[],
      'snippetCount'
    )
    applyCountRows(
      database
        .prepare(
          'SELECT entry_date, COUNT(*) AS item_count FROM journals WHERE entry_date LIKE ? GROUP BY entry_date'
        )
        .all(monthPattern) as WorkspaceCountRow[],
      'journalCount'
    )

    return {
      month,
      entries: [...overviewMap.values()].sort((left, right) => left.entryDate.localeCompare(right.entryDate))
    }
  },
  saveJournal: (input) => {
    validateJournalSaveInput(input)

    const content = input.content.trim()
    const existing = database
      .prepare('SELECT entry_date, content, created_at, updated_at FROM journals WHERE entry_date = ?')
      .get(input.entryDate) as WorkspaceJournalRow | undefined
    const timestamp = createTimestamp()

    if (!existing) {
      database
        .prepare('INSERT INTO journals (entry_date, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(input.entryDate, content, timestamp, timestamp)

      return {
        entryDate: input.entryDate,
        content,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    }

    database
      .prepare('UPDATE journals SET content = ?, updated_at = ? WHERE entry_date = ?')
      .run(content, timestamp, input.entryDate)

    return {
      entryDate: input.entryDate,
      content,
      createdAt: existing.created_at,
      updatedAt: timestamp
    }
  },
  deleteJournal: (entryDate) => {
    validateEntryDate(entryDate)
    database.prepare('DELETE FROM journals WHERE entry_date = ?').run(entryDate)
  },
  createTodo: (input) => {
    validateTodoCreateInput(input)

    const maxSortOrder =
      (database
        .prepare('SELECT MAX(sort_order) AS max_sort_order FROM todos WHERE entry_date = ?')
        .get(input.entryDate) as { max_sort_order: number | null } | undefined)?.max_sort_order ?? -1
    const timestamp = createTimestamp()
    const inserted = database
      .prepare(
        'INSERT INTO todos (entry_date, text, priority, completed, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.entryDate,
        input.text.trim(),
        input.priority,
        0,
        maxSortOrder + 1,
        timestamp,
        timestamp
      )
    const row = database
      .prepare(
        'SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos WHERE id = ?'
      )
      .get(getInsertedRowId(inserted, '待办')) as WorkspaceTodoRow | undefined

    if (!row) {
      throw new Error('新建待办后读取失败')
    }

    return mapTodoRow(row)
  },
  updateTodo: (id, input) => {
    validateTodoUpdateInput(input)

    const existing = database
      .prepare(
        'SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos WHERE id = ?'
      )
      .get(id) as WorkspaceTodoRow | undefined

    if (!existing) {
      throw new Error('待办不存在')
    }

    const updatedAt = createTimestamp()
    database
      .prepare('UPDATE todos SET text = ?, priority = ?, completed = ?, updated_at = ? WHERE id = ?')
      .run(input.text.trim(), input.priority, input.completed ? 1 : 0, updatedAt, id)

    return mapTodoRow({
      ...existing,
      text: input.text.trim(),
      priority: input.priority,
      completed: input.completed ? 1 : 0,
      updated_at: updatedAt
    })
  },
  deleteTodo: (id) => {
    database.prepare('DELETE FROM todos WHERE id = ?').run(id)
  },
  reorderTodos: (input) => {
    validateEntryDate(input.entryDate)

    if (!Array.isArray(input.ids) || input.ids.length === 0) {
      return []
    }

    input.ids.forEach((id, index) => {
      database
        .prepare('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ? AND entry_date = ?')
        .run(index, createTimestamp(), id, input.entryDate)
    })

    const rows = database
      .prepare(
        'SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos WHERE entry_date = ? ORDER BY completed ASC, sort_order ASC, created_at ASC'
      )
      .all(input.entryDate) as WorkspaceTodoRow[]

    return rows.map(mapTodoRow)
  },
  createSnippet: (input) => {
    validateSnippetInput(input)

    const timestamp = createTimestamp()
    const inserted = database
      .prepare(
        'INSERT INTO snippets (entry_date, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.entryDate,
        input.title.trim(),
        input.content.trim(),
        JSON.stringify(input.tags),
        timestamp,
        timestamp
      )
    const row = database
      .prepare(
        'SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE id = ?'
      )
      .get(getInsertedRowId(inserted, '片段')) as WorkspaceSnippetRow | undefined

    if (!row) {
      throw new Error('新建片段后读取失败')
    }

    return mapSnippetRow(row)
  },
  updateSnippet: (id, input) => {
    validateSnippetInput(input)

    const existing = database
      .prepare(
        'SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE id = ?'
      )
      .get(id) as WorkspaceSnippetRow | undefined

    if (!existing) {
      throw new Error('片段不存在')
    }

    const updatedAt = createTimestamp()
    database
      .prepare('UPDATE snippets SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?')
      .run(input.title.trim(), input.content.trim(), JSON.stringify(input.tags), updatedAt, id)

    return mapSnippetRow({
      ...existing,
      title: input.title.trim(),
      content: input.content.trim(),
      tags: JSON.stringify(input.tags),
      updated_at: updatedAt
    })
  },
  deleteSnippet: (id) => {
    database.prepare('DELETE FROM snippets WHERE id = ?').run(id)
  }
})
