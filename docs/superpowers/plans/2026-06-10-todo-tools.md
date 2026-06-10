# Todos Agent 工具集成 — 实现计划

> **For agentic workers:** 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现。步骤使用 checkbox（`- [ ]`）跟踪。

**目标：** 为 Agent 系统集成待办查询/新增/更新/删除四工具，完全镜像 peopleTool 的设计模式。

**架构：** 在 `types.ts` 新增 todo 工具类型，在 `todosService.ts` 增加透传 `querySql`，创建独立的 `todoTool.ts` 文件定义四工具，通过 `toolRegistry.ts` 注册并在 `aiHandlers.ts` 中注入 `todosService` 依赖。

**技术栈：** TypeScript, SQLite (better-sqlite3), Drizzle ORM

---

## 文件清单

| 文件 | 动作 |
|---|---|
| `src/main/agent/types.ts` | 修改 — 新增 Todo 工具类型 |
| `src/main/services/todosService.ts` | 修改 — 增加 `querySql` 方法 |
| `src/main/agent/tools/todoTool.ts` | 新建 — 四工具完整实现 |
| `src/main/agent/tools/toolRegistry.ts` | 修改 — 扩展上下文、注册工厂 |
| `src/main/ipc/aiHandlers.ts` | 修改 — 注入 `todosService` |

---

### Task 1: 新增 Todo 工具类型定义

**Files:**
- Modify: `src/main/agent/types.ts`

- [ ] **Step 1: 在 `types.ts` 末尾追加 Todo 查询工具类型**

在文件末尾追加以下内容（不修改现有类型）：

```ts
// Todo 查询工具入参。
export type TodoQueryToolInput = {
  // 待办所属日期。默认今天；传 "all" 跨日期查询。
  entryDate?: string
  // 搜索关键字（LIKE 匹配 text 字段）。
  query?: string
  // 优先级精确过滤。
  priority?: TodoPriority
  // 完成状态过滤。
  completed?: boolean
  // 只读 SQL 查询。
  sql?: string
  // 返回数量上限。
  limit?: number
}

// Todo 查询工具返回项。
export type TodoQueryToolItem = Pick<
  TodoItem,
  'id' | 'entryDate' | 'text' | 'priority' | 'completed' | 'sortOrder' | 'createdAt' | 'updatedAt'
>

// Todo 查询工具返回结果。
export type TodoQueryToolResult = AgentToolResult & {
  // 命中的待办条目。
  items: TodoQueryToolItem[]
  // SQL 查询返回的原始行。
  rows?: unknown[]
}
```

**注意**：`TodoPriority` 和 `TodoItem` 已从 `@/db/schema` 导出，顶部需补充 `TodoPriority` 的 import（目前仅 `import type { AssociatedPersonItem, PersonRelationship } from '@/db/schema'`，需改为同时导入 `TodoPriority`）。

- [ ] **Step 2: 验证类型编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit --pretty 2>&1 | head -30
```

预期：仅报已存在的错误，无新增类型错误。

---

### Task 2: 为 todosService 添加 querySql 方法

**Files:**
- Modify: `src/main/services/todosService.ts`

- [ ] **Step 1: 在 `TodosService` 类型中添加 `querySql` 签名**

找到 `TodosService` 类型定义（约第 27 行），在 `reorder` 之后追加：

```ts
  // 执行只读待办 SQL 查询并返回原始行。
  querySql: (sql: string) => unknown[]
```

完整改动后 `TodosService` 类型：

```ts
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
  // 执行只读待办 SQL 查询并返回原始行。
  querySql: (sql: string) => unknown[]
}
```

- [ ] **Step 2: 在 `createTodosService` 工厂中添加 `querySql` 实现**

在 `createTodosService` 返回对象中，`reorder` 方法之后追加：

```ts
  querySql: (sql) => {
    return database.prepare(sql).all()
  }
```

- [ ] **Step 3: 验证 service 层编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit --pretty 2>&1 | head -30
```

预期：无新增类型错误。

---

### Task 3: 创建 todoTool.ts 四工具实现

**Files:**
- Create: `src/main/agent/tools/todoTool.ts`

- [ ] **Step 1: 创建文件头部 — 导入与类型定义**

```ts
import type { TodoCreateInput, TodoItem, TodoPriority, TodoUpdateInput } from '@/db/schema'
import type { TodosService } from '@/services/todosService'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'
import type {
  AgentTool,
  TodoQueryToolInput,
  TodoQueryToolItem,
  TodoQueryToolResult
} from '@/agent/types'

// Todo 查询工具类型。
type TodoQueryTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 Todo 查询。
   */
  execute: (input: unknown) => Promise<TodoQueryToolResult>
}

// Todo 写入工具结果。
type TodoWriteToolResult = {
  // 回灌模型的观察文本。
  observation: string
  // 调试或 UI 可用结构化数据。
  data: unknown
}

// Todo 写入工具类型。
type TodoWriteTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 Todo 写入。
   */
  execute: (input: unknown) => Promise<TodoWriteToolResult>
}

// Todo 写入动作。
type TodoWriteAction = 'add' | 'update' | 'delete'
```

- [ ] **Step 2: 常量定义**

```ts
// Todo 工具默认返回数量。
const DEFAULT_TODO_LIMIT = 20

// Todo 工具最大返回数量。
const MAX_TODO_LIMIT = 50

// Todo SQL 最大长度。
const MAX_TODO_SQL_LENGTH = 1200

// Todo 查询表名。
const TODO_TABLE_NAME = 'todos'

// Todo 查询字段清单。
const TODO_COLUMNS =
  'id, entry_date, text, priority, completed, sort_order, created_at, updated_at'

// Todo 优先级枚举 Schema。
const TODO_PRIORITY_SCHEMA = {
  type: 'string',
  enum: ['P0', 'P1', 'P2', 'P3'],
  description: 'Todo priority level'
}

// 禁止 AI SQL 使用的高风险关键字。
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union|join)\b/i

// SQL 注释片段。
const SQL_COMMENT_PATTERN = /--|\/\*|\*\//
```

- [ ] **Step 3: 工具转换与解析辅助函数**

```ts
// Todo 数据库行类型。
type TodoSqlRow = Record<string, unknown>

/**
 * 将待办映射为工具返回项。
 */
const toToolItem = (todo: TodoItem): TodoQueryToolItem => ({
  id: todo.id,
  entryDate: todo.entryDate,
  text: todo.text,
  priority: todo.priority,
  completed: todo.completed,
  sortOrder: todo.sortOrder,
  createdAt: todo.createdAt,
  updatedAt: todo.updatedAt
})

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 判断 SQL 原始行是否包含完整待办字段。
 */
const isTodoSqlRow = (value: unknown): value is TodoSqlRow =>
  isRecord(value) &&
  typeof value.id === 'number' &&
  typeof value.entry_date === 'string' &&
  typeof value.text === 'string' &&
  typeof value.priority === 'string' &&
  typeof value.completed === 'number' &&
  typeof value.sort_order === 'number' &&
  typeof value.created_at === 'string' &&
  typeof value.updated_at === 'string'

/**
 * 将完整 SQL 待办行映射为工具返回项。
 */
const sqlRowToToolItem = (row: TodoSqlRow): TodoQueryToolItem =>
  toToolItem({
    id: row.id as number,
    entryDate: row.entry_date as string,
    text: row.text as string,
    priority: row.priority as TodoPriority,
    completed: (row.completed as number) === 1,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  })
```

- [ ] **Step 4: 解析与确认辅助函数**

```ts
/**
 * 解析字符串字段。
 */
const parseString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/**
 * 读取 Todo 写入输入中的非空字符串字段。
 */
const getTodoInputString = (input: unknown, key: string): string | null => {
  if (!isRecord(input)) {
    return null
  }

  const value = parseString(input[key])?.trim()

  return value || null
}

/**
 * 生成 Todo 写入目标名称。
 */
const renderTodoMutationTarget = (input: unknown): string | null =>
  getTodoInputString(input, 'text') ?? (typeof (input as Record<string, unknown> | null)?.id === 'number' ? `#${(input as Record<string, unknown>).id as number}` : null)

/**
 * 生成 Todo 写入前确认说明。
 */
const renderTodoMutationSummary = (
  action: TodoWriteAction,
  input: unknown
): string | null => {
  const aiSummary = getTodoInputString(input, 'confirmationSummary')
  const text = getTodoInputString(input, 'text')
  const priority = getTodoInputString(input, 'priority')
  const id = typeof (input as Record<string, unknown> | null)?.id === 'number'
    ? String((input as Record<string, unknown>).id)
    : null
  const target = text ?? id

  if (aiSummary) {
    return aiSummary
  }

  if (!target) {
    return null
  }

  if (action === 'add') {
    const prioritySuffix = priority ? `（P${priority}）` : ''
    return `将创建待办：${target}${prioritySuffix}。`
  }

  if (action === 'update') {
    return `将更新待办：${target}。`
  }

  return `将删除待办：${target}。`
}

/**
 * 生成 Todo 写入完成提示。
 */
const renderTodoMutationCompletion = (
  action: TodoWriteAction,
  input: unknown,
  result: { data: unknown }
): string | null => {
  const prefixes: Record<TodoWriteAction, string> = {
    add: '已添加待办',
    update: '已更新待办',
    delete: '已删除待办'
  }
  const target =
    getTodoInputString(
      isRecord(result.data) && isRecord(result.data.item) ? result.data.item : null,
      'text'
    ) ?? getTodoInputString(input, 'text')

  return target ? `${prefixes[action]}：${target}。` : `${prefixes[action]}。`
}
```

- [ ] **Step 5: 确认配置常量**

```ts
// Todo 创建确认配置。
const TODO_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认创建',
  question: '确认创建待办',
  confirm: '确认创建',
  cancel: '取消创建',
  renderTarget: renderTodoMutationTarget,
  renderSummary: (input) => renderTodoMutationSummary('add', input),
  completion: {
    renderMessage: (input, result) =>
      renderTodoMutationCompletion('add', input, result)
  }
}

// Todo 更新确认配置。
const TODO_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认更新',
  question: '确认更新待办',
  confirm: '确认更新',
  cancel: '取消更新',
  renderTarget: renderTodoMutationTarget,
  renderSummary: (input) => renderTodoMutationSummary('update', input),
  completion: {
    renderMessage: (input, result) =>
      renderTodoMutationCompletion('update', input, result)
  }
}

// Todo 删除确认配置。
const TODO_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认删除',
  question: '确认永久删除待办',
  confirm: '确认删除',
  cancel: '取消删除',
  renderTarget: renderTodoMutationTarget,
  renderSummary: (input) => renderTodoMutationSummary('delete', input),
  completion: {
    renderMessage: (input, result) =>
      renderTodoMutationCompletion('delete', input, result)
  }
}
```

- [ ] **Step 6: 入参解析函数**

```ts
/**
 * 解析 Todo 工具入参。
 */
const parseInput = (input: unknown): TodoQueryToolInput => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    entryDate: parseString(input.entryDate),
    query: parseString(input.query),
    priority: parseString(input.priority) as TodoPriority | undefined,
    completed: typeof input.completed === 'boolean' ? input.completed : undefined,
    sql: parseString(input.sql),
    limit: typeof input.limit === 'number' ? input.limit : undefined
  }
}

/**
 * 解析 Todo 新建入参。
 */
const parseCreateInput = (input: unknown): TodoCreateInput => {
  if (!isRecord(input)) {
    throw new Error('Todo create input must be an object')
  }

  const entryDate = parseString(input.entryDate)?.trim()
  const text = parseString(input.text)?.trim()
  const priority = parseString(input.priority)

  if (!entryDate) {
    throw new Error('Todo create requires entryDate')
  }

  if (!text) {
    throw new Error('Todo create requires text')
  }

  if (!priority) {
    throw new Error('Todo create requires priority')
  }

  return { entryDate, text, priority: priority as TodoPriority }
}

/**
 * 解析 Todo 更新入参。
 */
const parseUpdateInput = (
  input: unknown
): { id: number; profile: TodoUpdateInput } => {
  if (!isRecord(input)) {
    throw new Error('Todo update input must be an object')
  }

  if (typeof input.id !== 'number') {
    throw new Error('Todo update requires numeric id')
  }

  const text = parseString(input.text)?.trim()
  const priority = parseString(input.priority)
  const completed = typeof input.completed === 'boolean' ? input.completed : false

  if (!text) {
    throw new Error('Todo update requires text')
  }

  if (!priority) {
    throw new Error('Todo update requires priority')
  }

  return { id: input.id, profile: { text, priority: priority as TodoPriority, completed } }
}

/**
 * 解析 Todo 删除入参。
 */
const parseDeleteInput = (input: unknown): { id: number } => {
  if (!isRecord(input)) {
    throw new Error('Todo delete input must be an object')
  }

  if (typeof input.id !== 'number') {
    throw new Error('Todo delete requires numeric id')
  }

  return { id: input.id }
}
```

- [ ] **Step 7: SQL 构造与安全校验**

```ts
/**
 * 转义 SQL 字符串字面量。
 */
const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

/**
 * 转义 LIKE 查询字面量。
 */
const escapeSqlLike = (value: string): string =>
  escapeSqlString(
    value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  )

/**
 * 构造基础字段 query 条件。
 */
const buildQueryCondition = (query: string | undefined): string | null => {
  const trimmed = query?.trim()
  if (!trimmed) {
    return null
  }

  return `text LIKE '%${escapeSqlLike(trimmed)}%'`
}

/**
 * 获取今天的日期字符串。
 */
const getTodayDate = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${date}`
}

/**
 * 构造结构化查询 WHERE 子句。
 */
const buildStructuredWhere = (parsed: TodoQueryToolInput): string => {
  const entryDate = parsed.entryDate?.trim() || getTodayDate()
  const isCrossDate = entryDate === 'all'

  const whereParts: (string | null)[] = [
    isCrossDate ? null : `entry_date = '${escapeSqlString(entryDate)}'`,
    parsed.priority ? `priority = '${escapeSqlString(parsed.priority)}'` : null,
    typeof parsed.completed === 'boolean'
      ? `completed = ${parsed.completed ? 1 : 0}`
      : null,
    buildQueryCondition(parsed.query)
  ]

  const filtered = whereParts.filter((condition): condition is string => Boolean(condition))

  return filtered.length > 0 ? ` WHERE ${filtered.join(' AND ')}` : ''
}

/**
 * 将结构化查询编译为受控 SQL。
 */
const buildStructuredSql = (parsed: TodoQueryToolInput, limit: number): string =>
  `SELECT ${TODO_COLUMNS} FROM ${TODO_TABLE_NAME}${buildStructuredWhere(parsed)} ORDER BY completed ASC, sort_order ASC, created_at ASC`

/**
 * 校验并限制 AI 生成的 Todo SQL。
 */
const prepareTodoSql = (sql: string, limit: number): string => {
  const normalizedSql = sql.trim()

  if (!normalizedSql) {
    throw new Error('Todo SQL cannot be empty')
  }

  if (normalizedSql.length > MAX_TODO_SQL_LENGTH) {
    throw new Error('Todo SQL is too long')
  }

  if (normalizedSql.includes(';') || SQL_COMMENT_PATTERN.test(normalizedSql)) {
    throw new Error(
      'Todo SQL only allows a single SELECT statement without comments'
    )
  }

  if (!/^select\b/i.test(normalizedSql)) {
    throw new Error('Todo SQL only allows SELECT queries')
  }

  if (FORBIDDEN_SQL_PATTERN.test(normalizedSql)) {
    throw new Error('Todo SQL contains a forbidden keyword')
  }

  if (
    !new RegExp(`\\bfrom\\s+${TODO_TABLE_NAME}\\b`, 'i').test(normalizedSql)
  ) {
    throw new Error(`Todo SQL can only query the ${TODO_TABLE_NAME} table`)
  }

  if (/\bfrom\s+(?!todos\b)[a-z_][\w]*/i.test(normalizedSql)) {
    throw new Error(`Todo SQL can only query the ${TODO_TABLE_NAME} table`)
  }

  const hasLimit = /\blimit\s+\d+\b/i.test(normalizedSql)
  return hasLimit ? normalizedSql : `${normalizedSql} LIMIT ${limit}`
}

/**
 * 执行受控 Todo SQL 查询。
 */
const queryBySql = (
  todosService: Pick<TodosService, 'querySql'>,
  sql: string,
  limit: number
): { items: TodoQueryToolItem[]; rows: unknown[] } => {
  const rows = todosService
    .querySql(prepareTodoSql(sql, limit))
    .slice(0, limit)
  const items = rows.filter(isTodoSqlRow).map(sqlRowToToolItem)

  return { items, rows }
}

/**
 * 渲染 SQL 查询观察文本。
 */
const renderSqlObservation = (rows: unknown[]): string => {
  if (rows.length === 0) {
    return 'SQL query returned no rows.'
  }

  const rowLabel = rows.length === 1 ? 'row' : 'rows'
  return `SQL query returned ${rows.length} ${rowLabel}.`
}
```

- [ ] **Step 8: 四工具工厂函数**

```ts
/**
 * 创建 Todo 只读查询工具。
 */
export const createTodoQueryTool = (
  todosService: Pick<TodosService, 'querySql'>
): TodoQueryTool => ({
  name: 'todos_tool_query',
  description:
    'Query todos in the local Todos table. Read-only; never modifies data.',
  prompt: {
    summary:
      'Query todos in the local Todos table. Read-only; supports structured filters and controlled SQL.',
    intentKeywords: [
      '待办',
      '任务',
      '清单',
      '要做',
      '完成',
      '优先级',
      'P0',
      'P1',
      'P2',
      'P3',
      'todo',
      'task',
      'done',
      'completed'
    ],
    whenToUse: [
      'Use when the user asks about todos, tasks, or things to do.',
      'Use when the user asks what is pending, done, or planned for a specific date.',
      'Use when the user asks about priority or completion status of tasks.',
      'Use read-only SQL against todos when the user needs combined filters, sorting, or more precise filtering.'
    ],
    whenNotToUse: [
      'Do not use for casual chat, writing, translation, or questions unrelated to local todos.',
      'Do not use when the user asks to create, update, or delete todos.'
    ],
    safety: [
      'Read only from the local Todos table. Never write data.',
      `SQL must be a single SELECT against only the ${TODO_TABLE_NAME} table. JOIN, UNION, comments, multiple statements, and write keywords are forbidden.`,
      'Default to today\'s date when entryDate is not specified. Use entryDate = "all" only when the user explicitly asks across all dates.',
      'Never invent todo items that the tool did not return.',
      'If tool results are insufficient, say the available information is insufficient.'
    ],
    output:
      'Return the todo facts needed to answer the user. Do not repeat irrelevant fields.',
    examples: [
      `{"limit":10}`,
      `{"query":"买菜","completed":false}`,
      `{"entryDate":"all","priority":"P0","completed":false}`,
      `{"sql":"SELECT ${TODO_COLUMNS} FROM ${TODO_TABLE_NAME} WHERE priority = 'P0' AND completed = 0 ORDER BY sort_order ASC","limit":5}`
    ]
  },
  parameters: {
    type: 'object',
    properties: {
      entryDate: {
        type: 'string',
        description:
          'Target date in YYYY-MM-DD format. Defaults to today. Pass "all" to query across all dates.'
      },
      query: {
        type: 'string',
        description: 'Search text contains (LIKE matching on todo text).'
      },
      priority: {
        ...TODO_PRIORITY_SCHEMA,
        description: 'Exact priority filter'
      },
      completed: {
        type: 'boolean',
        description: 'Completion status filter'
      },
      sql: {
        type: 'string',
        description: `Controlled read-only SQL. Must SELECT FROM ${TODO_TABLE_NAME}; WHERE, ORDER BY, LIMIT, and COUNT(*) AS count are allowed.`
      },
      limit: {
        type: 'number',
        description: 'Maximum number of rows to return'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseInput(input)
    const limit = Math.max(
      1,
      Math.min(parsed.limit ?? DEFAULT_TODO_LIMIT, MAX_TODO_LIMIT)
    )

    const queryResult = parsed.sql
      ? queryBySql(todosService, parsed.sql, limit)
      : queryBySql(todosService, buildStructuredSql(parsed, limit), limit)

    const { items, rows } = queryResult
    const observation = renderSqlObservation(rows)

    return {
      observation,
      data: { rows, items },
      items,
      rows
    }
  }
})

/**
 * 创建 Todo 新建工具。
 */
export const createTodoAddTool = (
  todosService: Pick<TodosService, 'create'>
): TodoWriteTool => ({
  name: 'todos_tool_add',
  description: 'Create a todo item in the local Todos table.',
  confirmation: TODO_ADD_CONFIRMATION,
  prompt: {
    summary: 'Create a new todo item in the local Todos table.',
    intentKeywords: [
      '添加',
      '新增',
      '创建',
      '记录待办',
      'add todo',
      'create task'
    ],
    whenToUse: [
      'Use when the user explicitly asks to create a new todo item.',
      'Use common_tool_ask to ask for missing required facts when the create request is underspecified.'
    ],
    whenNotToUse: [
      'Do not use for read-only questions about existing todos.',
      'Do not use when the user has not asked to create a todo.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For creation, confirmationSummary must include the todo text and priority.',
      'entryDate defaults to today when not explicitly specified by the user.',
      'Never invent todo text the user did not provide or confirm.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return the created todo facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将创建待办：买水果（P2）。","entryDate":"2026-06-10","text":"买水果","priority":"P2"}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['entryDate', 'text', 'priority', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. Include the todo text and priority.'
      },
      entryDate: {
        type: 'string',
        description: 'Target date in YYYY-MM-DD format. Default to today when not explicitly specified.'
      },
      text: {
        type: 'string',
        description: 'Todo item text'
      },
      priority: TODO_PRIORITY_SCHEMA
    }
  },
  execute: async (input) => {
    const created = todosService.create(parseCreateInput(input))

    return {
      observation: `Created todo: ${created.text}.`,
      data: { item: toToolItem(created) }
    }
  }
})

/**
 * 创建 Todo 更新工具。
 */
export const createTodoUpdateTool = (
  todosService: Pick<TodosService, 'update'>
): TodoWriteTool => ({
  name: 'todos_tool_update',
  description: 'Update an existing todo item in the local Todos table by id.',
  confirmation: TODO_UPDATE_CONFIRMATION,
  prompt: {
    summary: 'Update an existing todo item in the local Todos table by id.',
    intentKeywords: [
      '修改',
      '更新',
      '改成',
      '纠正',
      '完成待办',
      'update todo',
      'edit task',
      'mark done',
      '标记完成'
    ],
    whenToUse: [
      'Use when the user explicitly asks to update an existing todo.',
      'Use after todos_tool_query when the user identifies a todo by text instead of id, then update the resolved todo id.',
      'Use when the user asks to mark a todo as completed or uncompleted.'
    ],
    whenNotToUse: [
      'Do not use for creating new todos.',
      'Do not use when the user only mentions a task without explicitly asking to update it.',
      'Do not use when the target todo id is unknown.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm updates; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For updates, confirmationSummary must name the todo text and list the key fields that will change.',
      'Require the todo id and the complete replacement fields (text, priority, completed).',
      'Query first when the user only provides a text description, then merge unchanged fields before updating.',
      'Never overwrite fields with guesses.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return the updated todo facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将更新待办：买水果。\\n- 优先级：P1\\n- 状态：已完成","id":1,"text":"买水果","priority":"P1","completed":true}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'text', 'priority', 'completed', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. Include the todo text and key changed fields.'
      },
      id: {
        type: 'number',
        description: 'Todo item id'
      },
      text: {
        type: 'string',
        description: 'Todo item text'
      },
      priority: TODO_PRIORITY_SCHEMA,
      completed: {
        type: 'boolean',
        description: 'Whether the todo is completed'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseUpdateInput(input)
    const updated = todosService.update(parsed.id, parsed.profile)

    return {
      observation: `Updated todo: ${updated.text}.`,
      data: { item: toToolItem(updated) }
    }
  }
})

/**
 * 创建 Todo 删除工具。
 */
export const createTodoDeleteTool = (
  todosService: Pick<TodosService, 'delete'>
): TodoWriteTool => ({
  name: 'todos_tool_delete',
  description: 'Delete an existing todo item from the local Todos table by id.',
  confirmation: TODO_DELETE_CONFIRMATION,
  prompt: {
    summary: 'Delete an existing todo item from the local Todos table by id.',
    intentKeywords: [
      '删除',
      '移除',
      '删掉',
      'delete todo',
      'remove task'
    ],
    whenToUse: [
      'Use when the user explicitly asks to delete a todo.',
      'Use after todos_tool_query when the user identifies a todo by text instead of id, then delete the resolved todo id.'
    ],
    whenNotToUse: [
      'Do not use for temporary filtering or hiding.',
      'Do not use when the target todo id is unknown or ambiguous.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For deletion, confirmationSummary must identify the todo text and any key facts known from query results.',
      'Require the exact numeric todo id.',
      'Ask the user for clarification before deleting when multiple todos may match.'
    ],
    output:
      'Include confirmationSummary in the tool arguments; return a concise deletion confirmation.',
    examples: [
      '{"confirmationSummary":"将删除待办：买水果（P2，未完成）。","id":1}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. Include the todo text and any distinguishing facts.'
      },
      id: {
        type: 'number',
        description: 'Todo item id'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseDeleteInput(input)
    todosService.delete(parsed.id)

    return {
      observation: `Deleted todo: ${parsed.id}.`,
      data: { id: parsed.id }
    }
  }
})

/**
 * 创建完整 Todo 工具组。
 */
export const createTodoTools = (
  todosService: Pick<
    TodosService,
    'querySql' | 'create' | 'update' | 'delete'
  >
): AgentTool[] => [
  createTodoQueryTool(todosService),
  createTodoAddTool(todosService),
  createTodoUpdateTool(todosService),
  createTodoDeleteTool(todosService)
]
```

- [ ] **Step 9: 验证 todoTool.ts 编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit --pretty 2>&1 | head -40
```

预期：无新增类型错误。

---

### Task 4: 在 toolRegistry 中注册 Todo 工具

**Files:**
- Modify: `src/main/agent/tools/toolRegistry.ts`

- [ ] **Step 1: 导入 createTodoTools 和 TodosService**

在文件顶部的 import 区块追加：

```ts
import { createTodoTools } from '@/agent/tools/todoTool'
import type { TodosService } from '@/services/todosService'
```

完整导入区变为：

```ts
import { createPeopleTools } from '@/agent/tools/peopleTool'
import { createTodoTools } from '@/agent/tools/todoTool'
import { createDateOffsetTool, createTimeNowTool } from '@/agent/tools/commonTimeTool'
import { createAskTool } from '@/agent/tools/askTool'
import type { AgentMessage, AgentTool, AgentToolPrompt, JsonSchema } from '@/agent/types'
import type { PeopleService } from '@/services/peopleService'
import type { TodosService } from '@/services/todosService'
```

- [ ] **Step 2: 扩展 AgentToolRegistryContext**

将 `AgentToolRegistryContext` 类型从：

```ts
export type AgentToolRegistryContext = {
  peopleService: Pick<PeopleService, 'list' | 'querySql' | 'create' | 'update' | 'delete'>
}
```

改为：

```ts
export type AgentToolRegistryContext = {
  peopleService: Pick<PeopleService, 'list' | 'querySql' | 'create' | 'update' | 'delete'>
  todosService: Pick<TodosService, 'querySql' | 'create' | 'update' | 'delete'>
}
```

- [ ] **Step 3: 在工厂列表中注册 createTodoTools**

在 `builtinToolFactories` 数组中，`createPeopleTools` 之后追加一行：

```ts
  ({ todosService }) => createTodoTools(todosService),
```

完整 `builtinToolFactories` 变为：

```ts
const builtinToolFactories: AgentToolFactory[] = [
  () => createAskTool(),
  ({ peopleService }) => createPeopleTools(peopleService),
  ({ todosService }) => createTodoTools(todosService),
  () => createTimeNowTool(),
  () => createDateOffsetTool()
]
```

- [ ] **Step 4: 验证 toolRegistry.ts 编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit --pretty 2>&1 | head -40
```

预期：这时会报错 — `aiHandlers.ts` 中 `createAgentToolRegistry` 调用缺少 `todosService`。这是预期行为，下个任务修复。

---

### Task 5: 在 aiHandlers.ts 注入 todosService

**Files:**
- Modify: `src/main/ipc/aiHandlers.ts`

- [ ] **Step 1: 导入 createTodosService**

在文件顶部已有导入附近追加：

```ts
import { createTodosService, type DatabaseConnection as TodosDatabaseConnection } from '@/services/todosService'
```

可放在 `createPeopleService` 导入行之后。

- [ ] **Step 2: 创建 todosService 实例并注入上下文**

找到 `registerAiHandlers` 函数内的上下文构建代码（约第 540-544 行），从：

```ts
  const peopleService = createPeopleService(database as unknown as PeopleDatabaseConnection)
  const aiChatService = createAiChatPersistenceService(database as unknown as AiChatDatabaseConnection)
  const toolRegistry = createAgentToolRegistry({
    peopleService
  })
```

改为：

```ts
  const peopleService = createPeopleService(database as unknown as PeopleDatabaseConnection)
  const todosService = createTodosService(database as unknown as TodosDatabaseConnection)
  const aiChatService = createAiChatPersistenceService(database as unknown as AiChatDatabaseConnection)
  const toolRegistry = createAgentToolRegistry({
    peopleService,
    todosService
  })
```

- [ ] **Step 3: 全量编译验证**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit --pretty 2>&1 | head -40
```

预期：无新增类型错误，编译通过。

---

### Task 6: 运行 Lint 与完整性校验

**Files:**
- None（仅验证）

- [ ] **Step 1: ESLint 检查**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx eslint src/main/agent/tools/todoTool.ts src/main/agent/tools/toolRegistry.ts src/main/agent/types.ts src/main/services/todosService.ts src/main/ipc/aiHandlers.ts --max-warnings 0 2>&1 | tail -20
```

预期：无新增 lint 错误。

- [ ] **Step 2: TypeCheck 终极验证**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npm run typecheck 2>&1 | tail -20
```

预期：全部通过。

---

### Task 7: 提交

- [ ] **Step 1: 提交全部变更**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent
git add src/main/agent/types.ts
git add src/main/services/todosService.ts
git add src/main/agent/tools/todoTool.ts
git add src/main/agent/tools/toolRegistry.ts
git add src/main/ipc/aiHandlers.ts
git commit -m "feat(agent): 集成 Todo 查询/新增/更新/删除四工具

- 在 types.ts 新增 TodoQueryToolInput / TodoQueryToolItem / TodoQueryToolResult 类型
- 在 todosService 增加 querySql 只读 SQL 透传方法
- 新建 todoTool.ts，镜像 peopleTool 模式实现四工具 + 受控 SQL
- 扩展 AgentToolRegistryContext 增加 todosService 依赖
- 在 aiHandlers 中注入 createTodosService 实例"
```
