import type {
  TodoCreateInput,
  TodoItem,
  TodoPriority,
  TodoReorderInput,
  TodoRow,
  TodoUpdateInput
} from '@/db/schema'

// 数据库语句接口。
export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// Todos 服务依赖的最小数据库接口。
export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
}

// Todos 服务方法集合。
export type TodosService = {
  // 读取指定日期的全部待办。
  listByDate: (entryDate: string) => TodoItem[]
  // 创建待办。
  create: (input: TodoCreateInput) => TodoItem
  // 更新待办。
  update: (id: number, input: TodoUpdateInput) => TodoItem
  // 删除待办。
  delete: (id: number) => void
  // 重新排序待办。
  reorder: (input: TodoReorderInput) => TodoItem[]
}

// 合法待办优先级集合。
const TODO_PRIORITIES: TodoPriority[] = ['P0', 'P1', 'P2', 'P3']

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
 * 校验日期格式。
 */
const validateEntryDate = (entryDate: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    throw new Error('工作台日期格式不正确')
  }
}

/**
 * 校验待办优先级。
 */
const validateTodoPriority = (priority: TodoPriority): void => {
  if (!TODO_PRIORITIES.includes(priority)) {
    throw new Error('待办优先级不正确')
  }
}

/**
 * 校验待办创建输入。
 */
const validateTodoCreateInput = (input: TodoCreateInput): void => {
  validateEntryDate(input.entryDate)
  validateTodoPriority(input.priority)

  if (!input.text.trim()) {
    throw new Error('待办内容不能为空')
  }
}

/**
 * 校验待办更新输入。
 */
const validateTodoUpdateInput = (input: TodoUpdateInput): void => {
  validateTodoPriority(input.priority)

  if (!input.text.trim()) {
    throw new Error('待办内容不能为空')
  }
}

/**
 * 将数据库行映射为页面待办。
 */
const mapTodoRow = (row: TodoRow): TodoItem => ({
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
 * 创建 Todos 服务。
 */
export const createTodosService = (database: DatabaseConnection): TodosService => ({
  listByDate: (entryDate) => {
    validateEntryDate(entryDate)

    const rows = database
      .prepare(
        'SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos WHERE entry_date = ? ORDER BY completed ASC, sort_order ASC, created_at ASC'
      )
      .all(entryDate) as TodoRow[]

    return rows.map(mapTodoRow)
  },
  create: (input) => {
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
      .get(getInsertedRowId(inserted, '待办')) as TodoRow | undefined

    if (!row) {
      throw new Error('新建待办后读取失败')
    }

    return mapTodoRow(row)
  },
  update: (id, input) => {
    validateTodoUpdateInput(input)

    const existing = database
      .prepare(
        'SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos WHERE id = ?'
      )
      .get(id) as TodoRow | undefined

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
  delete: (id) => {
    database.prepare('DELETE FROM todos WHERE id = ?').run(id)
  },
  reorder: (input) => {
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
      .all(input.entryDate) as TodoRow[]

    return rows.map(mapTodoRow)
  }
})
