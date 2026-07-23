import type { ToolConfirmationConfig } from "@/agent/tools/toolConfirmation"
import type {
  AgentTool,
  TodoQueryToolInput,
  TodoQueryToolItem,
  TodoQueryToolResult,
} from "@/agent/types"
import type { TodoCreateInput, TodoItem, TodoPriority, TodoUpdateInput } from "@/db/schema"
import type { TodosService } from "@/services/todosService"

// Todo 查询工具类型。
type TodoQueryTool = Omit<AgentTool, "execute"> & {
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
type TodoWriteTool = Omit<AgentTool, "execute"> & {
  /**
   * 执行 Todo 写入。
   */
  execute: (input: unknown) => Promise<TodoWriteToolResult>
}

// Todo 写入动作。
type TodoWriteAction = "add" | "update" | "delete"

// Todo 工具默认返回数量。
const DEFAULT_TODO_LIMIT = 20

// Todo 工具最大返回数量。
const MAX_TODO_LIMIT = 50

// Todo SQL 最大长度。
const MAX_TODO_SQL_LENGTH = 1200

// Todo 查询表名。
const TODO_TABLE_NAME = "todos"

// Todo 查询字段清单。
const TODO_COLUMNS = "id, entry_date, text, priority, completed, sort_order, created_at, updated_at"

// Todo 优先级枚举 Schema。
const TODO_PRIORITY_SCHEMA = {
  type: "string",
  enum: ["P0", "P1", "P2", "P3"],
  description: "Todo priority level",
}

// 禁止 AI SQL 使用的高风险关键字。
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union|join)\b/i

// SQL 注释片段。
const SQL_COMMENT_PATTERN = /--|\/\*|\*\//

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
  updatedAt: todo.updatedAt,
})

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

/**
 * 判断 SQL 原始行是否包含完整待办字段。
 */
const isTodoSqlRow = (value: unknown): value is TodoSqlRow =>
  isRecord(value) &&
  typeof value.id === "number" &&
  typeof value.entry_date === "string" &&
  typeof value.text === "string" &&
  typeof value.priority === "string" &&
  typeof value.completed === "number" &&
  typeof value.sort_order === "number" &&
  typeof value.created_at === "string" &&
  typeof value.updated_at === "string"

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
    updatedAt: row.updated_at as string,
  })

/**
 * 解析字符串字段。
 */
const parseString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined

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
  getTodoInputString(input, "text") ??
  (typeof (input as Record<string, unknown> | null)?.id === "number"
    ? `#${(input as Record<string, unknown>).id as number}`
    : null)

/**
 * 生成 Todo 写入前确认说明。
 */
const renderTodoMutationSummary = (action: TodoWriteAction, input: unknown): string | null => {
  const aiSummary = getTodoInputString(input, "confirmationSummary")
  const text = getTodoInputString(input, "text")
  const priority = getTodoInputString(input, "priority")
  const id =
    typeof (input as Record<string, unknown> | null)?.id === "number"
      ? String((input as Record<string, unknown>).id)
      : null
  const target = text ?? id

  if (aiSummary) {
    return aiSummary
  }

  if (!target) {
    return null
  }

  if (action === "add") {
    const prioritySuffix = priority ? `（P${priority}）` : ""
    return `将创建待办：${target}${prioritySuffix}。`
  }

  if (action === "update") {
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
  result: { data: unknown },
): string | null => {
  const prefixes: Record<TodoWriteAction, string> = {
    add: "已添加待办",
    update: "已更新待办",
    delete: "已删除待办",
  }
  const target =
    getTodoInputString(
      isRecord(result.data) && isRecord(result.data.item) ? result.data.item : null,
      "text",
    ) ?? getTodoInputString(input, "text")

  return target ? `${prefixes[action]}：${target}。` : `${prefixes[action]}。`
}

// Todo 创建确认配置。
const TODO_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: "确认创建",
  question: "确认创建待办",
  confirm: "确认创建",
  cancel: "取消创建",
  renderTarget: renderTodoMutationTarget,
  renderSummary: (input) => renderTodoMutationSummary("add", input),
  completion: {
    renderMessage: (input, result) => renderTodoMutationCompletion("add", input, result),
  },
}

// Todo 更新确认配置。
const TODO_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: "确认更新",
  question: "确认更新待办",
  confirm: "确认更新",
  cancel: "取消更新",
  renderTarget: renderTodoMutationTarget,
  renderSummary: (input) => renderTodoMutationSummary("update", input),
  completion: {
    renderMessage: (input, result) => renderTodoMutationCompletion("update", input, result),
  },
}

// Todo 删除确认配置。
const TODO_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: "确认删除",
  question: "确认永久删除待办",
  confirm: "确认删除",
  cancel: "取消删除",
  renderTarget: renderTodoMutationTarget,
  renderSummary: (input) => renderTodoMutationSummary("delete", input),
  completion: {
    renderMessage: (input, result) => renderTodoMutationCompletion("delete", input, result),
  },
}

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
    completed: typeof input.completed === "boolean" ? input.completed : undefined,
    sql: parseString(input.sql),
    limit: typeof input.limit === "number" ? input.limit : undefined,
  }
}

/**
 * 解析 Todo 新建入参。
 */
const parseCreateInput = (input: unknown): TodoCreateInput => {
  if (!isRecord(input)) {
    throw new Error("Todo create input must be an object")
  }

  const entryDate = parseString(input.entryDate)?.trim()
  const text = parseString(input.text)?.trim()
  const priority = parseString(input.priority)

  if (!entryDate) {
    throw new Error("Todo create requires entryDate")
  }

  if (!text) {
    throw new Error("Todo create requires text")
  }

  if (!priority) {
    throw new Error("Todo create requires priority")
  }

  return { entryDate, text, priority: priority as TodoPriority }
}

/**
 * 解析 Todo 更新入参。
 */
const parseUpdateInput = (input: unknown): { id: number; profile: TodoUpdateInput } => {
  if (!isRecord(input)) {
    throw new Error("Todo update input must be an object")
  }

  if (typeof input.id !== "number") {
    throw new Error("Todo update requires numeric id")
  }

  const text = parseString(input.text)?.trim()
  const priority = parseString(input.priority)
  const completed = typeof input.completed === "boolean" ? input.completed : false
  const entryDate = parseString(input.entryDate)?.trim()
  const sortOrder = typeof input.sortOrder === "number" ? input.sortOrder : undefined

  if (!text) {
    throw new Error("Todo update requires text")
  }

  if (!priority) {
    throw new Error("Todo update requires priority")
  }

  return {
    id: input.id,
    profile: {
      text,
      priority: priority as TodoPriority,
      completed,
      ...(entryDate ? { entryDate } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    },
  }
}

/**
 * 解析 Todo 删除入参。
 */
const parseDeleteInput = (input: unknown): { id: number } => {
  if (!isRecord(input)) {
    throw new Error("Todo delete input must be an object")
  }

  if (typeof input.id !== "number") {
    throw new Error("Todo delete requires numeric id")
  }

  return { id: input.id }
}

/**
 * 转义 SQL 字符串字面量。
 */
const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

/**
 * 转义 LIKE 查询字面量。
 */
const escapeSqlLike = (value: string): string =>
  escapeSqlString(value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_"))

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
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const date = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${date}`
}

/**
 * 构造结构化查询 WHERE 子句。
 */
const buildStructuredWhere = (parsed: TodoQueryToolInput): string => {
  const entryDate = parsed.entryDate?.trim() || getTodayDate()
  const isCrossDate = entryDate === "all"

  const whereParts: (string | null)[] = [
    isCrossDate ? null : `entry_date = '${escapeSqlString(entryDate)}'`,
    parsed.priority ? `priority = '${escapeSqlString(parsed.priority)}'` : null,
    typeof parsed.completed === "boolean" ? `completed = ${parsed.completed ? 1 : 0}` : null,
    buildQueryCondition(parsed.query),
  ]

  const filtered = whereParts.filter((condition): condition is string => Boolean(condition))

  return filtered.length > 0 ? ` WHERE ${filtered.join(" AND ")}` : ""
}

/**
 * 将结构化查询编译为受控 SQL。
 */
const buildStructuredSql = (parsed: TodoQueryToolInput): string =>
  `SELECT ${TODO_COLUMNS} FROM ${TODO_TABLE_NAME}${buildStructuredWhere(parsed)} ORDER BY completed ASC, sort_order ASC, created_at ASC`

/**
 * 校验并限制 AI 生成的 Todo SQL。
 */
const prepareTodoSql = (sql: string, limit: number): string => {
  const normalizedSql = sql.trim()

  if (!normalizedSql) {
    throw new Error("Todo SQL cannot be empty")
  }

  if (normalizedSql.length > MAX_TODO_SQL_LENGTH) {
    throw new Error("Todo SQL is too long")
  }

  if (normalizedSql.includes(";") || SQL_COMMENT_PATTERN.test(normalizedSql)) {
    throw new Error("Todo SQL only allows a single SELECT statement without comments")
  }

  if (!/^select\b/i.test(normalizedSql)) {
    throw new Error("Todo SQL only allows SELECT queries")
  }

  if (FORBIDDEN_SQL_PATTERN.test(normalizedSql)) {
    throw new Error("Todo SQL contains a forbidden keyword")
  }

  if (!new RegExp(`\\bfrom\\s+${TODO_TABLE_NAME}\\b`, "i").test(normalizedSql)) {
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
  todosService: Pick<TodosService, "querySql">,
  sql: string,
  limit: number,
): { items: TodoQueryToolItem[]; rows: unknown[] } => {
  const rows = todosService.querySql(prepareTodoSql(sql, limit)).slice(0, limit)
  const items = rows.filter(isTodoSqlRow).map(sqlRowToToolItem)

  return { items, rows }
}

/**
 * 渲染 SQL 查询观察文本。
 */
const renderSqlObservation = (rows: unknown[]): string => {
  if (rows.length === 0) {
    return "SQL query returned no rows."
  }

  const rowLabel = rows.length === 1 ? "row" : "rows"
  return `SQL query returned ${rows.length} ${rowLabel}.`
}

/**
 * 创建 Todo 只读查询工具。
 */
export const createTodoQueryTool = (
  todosService: Pick<TodosService, "querySql">,
): TodoQueryTool => ({
  name: "todos_tool_query",
  description: "Query todos in the local Todos table. Read-only; never modifies data.",
  prompt: {
    summary:
      "Query todos in the local Todos table. Read-only; supports structured filters and controlled SQL.",
    intentKeywords: [
      "待办",
      "任务",
      "清单",
      "要做",
      "完成",
      "优先级",
      "P0",
      "P1",
      "P2",
      "P3",
      "todo",
      "task",
      "done",
      "completed",
    ],
    whenToUse: [
      "Use when the user asks about todos, tasks, or things to do.",
      "Use when the user asks what is pending, done, or planned for a specific date.",
      "Use when the user asks about priority or completion status of tasks.",
      "Use read-only SQL against todos when the user needs combined filters, sorting, or more precise filtering.",
    ],
    whenNotToUse: [
      "Do not use for casual chat, writing, translation, or questions unrelated to local todos.",
      "Do not use when the user asks to create, update, or delete todos.",
    ],
    safety: [
      "Read only from the local Todos table. Never write data.",
      `SQL must be a single SELECT against only the ${TODO_TABLE_NAME} table. JOIN, UNION, comments, multiple statements, and write keywords are forbidden.`,
      'Default to today\'s date when entryDate is not specified. Use entryDate = "all" only when the user explicitly asks across all dates.',
      "Never invent todo items that the tool did not return.",
      "If tool results are insufficient, say the available information is insufficient.",
    ],
    output: "Return the todo facts needed to answer the user. Do not repeat irrelevant fields.",
    examples: [
      `{"limit":10}`,
      `{"query":"买菜","completed":false}`,
      `{"entryDate":"all","priority":"P0","completed":false}`,
      `{"sql":"SELECT ${TODO_COLUMNS} FROM ${TODO_TABLE_NAME} WHERE priority = 'P0' AND completed = 0 ORDER BY sort_order ASC","limit":5}`,
    ],
  },
  parameters: {
    type: "object",
    properties: {
      entryDate: {
        type: "string",
        description:
          'Target date in YYYY-MM-DD format. Defaults to today. Pass "all" to query across all dates.',
      },
      query: {
        type: "string",
        description: "Search text contains (LIKE matching on todo text).",
      },
      priority: {
        ...TODO_PRIORITY_SCHEMA,
        description: "Exact priority filter",
      },
      completed: {
        type: "boolean",
        description: "Completion status filter",
      },
      sql: {
        type: "string",
        description: `Controlled read-only SQL. Must SELECT FROM ${TODO_TABLE_NAME}; WHERE, ORDER BY, LIMIT, and COUNT(*) AS count are allowed.`,
      },
      limit: {
        type: "number",
        description: "Maximum number of rows to return",
      },
    },
  },
  execute: async (input) => {
    const parsed = parseInput(input)
    const limit = Math.max(1, Math.min(parsed.limit ?? DEFAULT_TODO_LIMIT, MAX_TODO_LIMIT))

    const queryResult = parsed.sql
      ? queryBySql(todosService, parsed.sql, limit)
      : queryBySql(todosService, buildStructuredSql(parsed), limit)

    const { items, rows } = queryResult
    const observation = renderSqlObservation(rows)

    return {
      observation,
      data: { rows, items },
      items,
      rows,
    }
  },
})

/**
 * 创建 Todo 新建工具。
 */
export const createTodoAddTool = (todosService: Pick<TodosService, "create">): TodoWriteTool => ({
  name: "todos_tool_add",
  description: "Create a todo item in the local Todos table.",
  confirmation: TODO_ADD_CONFIRMATION,
  prompt: {
    summary: "Create a new todo item in the local Todos table.",
    intentKeywords: ["添加", "新增", "创建", "记录待办", "add todo", "create task"],
    whenToUse: [
      "Use when the user explicitly asks to create a new todo item.",
      "Use common_tool_ask to ask for missing required facts when the create request is underspecified.",
    ],
    whenNotToUse: [
      "Do not use for read-only questions about existing todos.",
      "Do not use when the user has not asked to create a todo.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For creation, confirmationSummary must include the todo text and priority.",
      "entryDate defaults to today when not explicitly specified by the user.",
      "Never invent todo text the user did not provide or confirm.",
    ],
    output:
      "Include confirmationSummary in the tool arguments; return the created todo facts needed by the user.",
    examples: [
      '{"confirmationSummary":"将创建待办：买水果（P2）。","entryDate":"2026-06-10","text":"买水果","priority":"P2"}',
    ],
  },
  parameters: {
    type: "object",
    required: ["entryDate", "text", "priority", "confirmationSummary"],
    properties: {
      confirmationSummary: {
        type: "string",
        description:
          "Concise Markdown Chinese explanation shown above the internal confirmation. Include the todo text and priority.",
      },
      entryDate: {
        type: "string",
        description:
          "Target date in YYYY-MM-DD format. Default to today when not explicitly specified.",
      },
      text: {
        type: "string",
        description: "Todo item text",
      },
      priority: TODO_PRIORITY_SCHEMA,
    },
  },
  execute: async (input) => {
    const created = todosService.create(parseCreateInput(input))

    return {
      observation: `Created todo: ${created.text}.`,
      data: { item: toToolItem(created) },
    }
  },
})

/**
 * 创建 Todo 更新工具。
 */
export const createTodoUpdateTool = (
  todosService: Pick<TodosService, "update">,
): TodoWriteTool => ({
  name: "todos_tool_update",
  description: "Update an existing todo item in the local Todos table by id.",
  confirmation: TODO_UPDATE_CONFIRMATION,
  prompt: {
    summary: "Update an existing todo item in the local Todos table by id.",
    intentKeywords: [
      "修改",
      "更新",
      "改成",
      "纠正",
      "完成待办",
      "update todo",
      "edit task",
      "mark done",
      "标记完成",
    ],
    whenToUse: [
      "Use when the user explicitly asks to update an existing todo.",
      "Use after todos_tool_query when the user identifies a todo by text instead of id, then update the resolved todo id.",
      "Use when the user asks to mark a todo as completed or uncompleted.",
    ],
    whenNotToUse: [
      "Do not use for creating new todos.",
      "Do not use when the user only mentions a task without explicitly asking to update it.",
      "Do not use when the target todo id is unknown.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm updates; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For updates, confirmationSummary must name the todo text and list the key fields that will change.",
      "Require the todo id and the complete replacement fields (text, priority, completed).",
      "Query first when the user only provides a text description, then merge unchanged fields before updating.",
      "Never overwrite fields with guesses.",
    ],
    output:
      "Include confirmationSummary in the tool arguments; return the updated todo facts needed by the user.",
    examples: [
      '{"confirmationSummary":"将更新待办：买水果。\\n- 优先级：P1\\n- 状态：已完成","id":1,"text":"买水果","priority":"P1","completed":true}',
    ],
  },
  parameters: {
    type: "object",
    required: ["id", "text", "priority", "completed", "confirmationSummary"],
    properties: {
      confirmationSummary: {
        type: "string",
        description:
          "Concise Markdown Chinese explanation shown above the internal confirmation. Include the todo text and key changed fields.",
      },
      id: {
        type: "number",
        description: "Todo item id",
      },
      text: {
        type: "string",
        description: "Todo item text",
      },
      priority: TODO_PRIORITY_SCHEMA,
      completed: {
        type: "boolean",
        description: "Whether the todo is completed",
      },
      entryDate: {
        type: "string",
        description:
          "Target date in YYYY-MM-DD format. Only set when the user explicitly asks to change the date.",
      },
      sortOrder: {
        type: "number",
        description: "Sort order number. Only set when the user explicitly asks to reorder.",
      },
    },
  },
  execute: async (input) => {
    const parsed = parseUpdateInput(input)
    const updated = todosService.update(parsed.id, parsed.profile)

    return {
      observation: `Updated todo: ${updated.text}.`,
      data: { item: toToolItem(updated) },
    }
  },
})

/**
 * 创建 Todo 删除工具。
 */
export const createTodoDeleteTool = (
  todosService: Pick<TodosService, "delete">,
): TodoWriteTool => ({
  name: "todos_tool_delete",
  description: "Delete an existing todo item from the local Todos table by id.",
  confirmation: TODO_DELETE_CONFIRMATION,
  prompt: {
    summary: "Delete an existing todo item from the local Todos table by id.",
    intentKeywords: ["删除", "移除", "删掉", "delete todo", "remove task"],
    whenToUse: [
      "Use when the user explicitly asks to delete a todo.",
      "Use after todos_tool_query when the user identifies a todo by text instead of id, then delete the resolved todo id.",
    ],
    whenNotToUse: [
      "Do not use for temporary filtering or hiding.",
      "Do not use when the target todo id is unknown or ambiguous.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For deletion, confirmationSummary must identify the todo text and any key facts known from query results.",
      "Require the exact numeric todo id.",
      "Ask the user for clarification before deleting when multiple todos may match.",
    ],
    output:
      "Include confirmationSummary in the tool arguments; return a concise deletion confirmation.",
    examples: ['{"confirmationSummary":"将删除待办：买水果（P2，未完成）。","id":1}'],
  },
  parameters: {
    type: "object",
    required: ["id", "confirmationSummary"],
    properties: {
      confirmationSummary: {
        type: "string",
        description:
          "Concise Markdown Chinese explanation shown above the internal confirmation. Include the todo text and any distinguishing facts.",
      },
      id: {
        type: "number",
        description: "Todo item id",
      },
    },
  },
  execute: async (input) => {
    const parsed = parseDeleteInput(input)
    todosService.delete(parsed.id)

    return {
      observation: `Deleted todo: ${parsed.id}.`,
      data: { id: parsed.id },
    }
  },
})

// Todo 批量创建确认配置。
const TODO_BATCH_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: "批量确认创建",
  question: "确认批量创建待办",
  confirm: "确认创建",
  cancel: "取消创建",
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const items = Array.isArray(input.items) ? input.items : []
    return `${items.length} 项待办`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getTodoInputString(input, "confirmationSummary")
    if (aiSummary) return aiSummary
    const items = Array.isArray(input.items) ? input.items : []
    if (items.length === 0) return null
    const previews = (items as unknown[])
      .slice(0, 3)
      .map((item) => {
        if (!isRecord(item)) return null
        const text = getTodoInputString(item, "text")
        const priority = getTodoInputString(item, "priority")
        return text ? `${text}（P${priority ?? "?"}）` : null
      })
      .filter((p): p is string => Boolean(p))
    const suffix = items.length > 3 ? ` 等 ${items.length} 项` : ""
    return `将批量创建待办：${previews.join("、")}${suffix}。`
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === "number" ? `已批量创建 ${count} 项待办。` : "已批量创建待办。"
    },
  },
}

// Todo 批量更新确认配置。
const TODO_BATCH_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: "批量确认更新",
  question: "确认批量更新待办",
  confirm: "确认更新",
  cancel: "取消更新",
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const items = Array.isArray(input.items) ? input.items : []
    return `${items.length} 项待办`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getTodoInputString(input, "confirmationSummary")
    if (aiSummary) return aiSummary
    const items = Array.isArray(input.items) ? input.items : []
    if (items.length === 0) return null
    const previews = (items as unknown[])
      .slice(0, 3)
      .map((item) => {
        if (!isRecord(item)) return null
        const text = getTodoInputString(item, "text")
        const completed = typeof item.completed === "boolean" ? item.completed : undefined
        const completionTag = completed === true ? "✓" : completed === false ? "○" : ""
        return text ? `${text}${completionTag ? ` ${completionTag}` : ""}` : null
      })
      .filter((p): p is string => Boolean(p))
    const suffix = items.length > 3 ? ` 等 ${items.length} 项` : ""
    return `将批量更新待办：${previews.join("、")}${suffix}。`
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === "number" ? `已批量更新 ${count} 项待办。` : "已批量更新待办。"
    },
  },
}

// Todo 批量删除确认配置。
const TODO_BATCH_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: "批量确认删除",
  question: "确认批量永久删除待办",
  confirm: "确认删除",
  cancel: "取消删除",
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const ids = Array.isArray(input.ids) ? input.ids : []
    return `${ids.length} 项待办`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getTodoInputString(input, "confirmationSummary")
    if (aiSummary) return aiSummary
    const ids = Array.isArray(input.ids) ? input.ids : []
    return ids.length > 0 ? `将批量删除 ${ids.length} 项待办。` : null
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === "number" ? `已批量删除 ${count} 项待办。` : "已批量删除待办。"
    },
  },
}

/**
 * 创建 Todo 批量新建工具。
 */
const createTodoBatchAddTool = (todosService: Pick<TodosService, "create">): TodoWriteTool => ({
  name: "todos_tool_batch_add",
  description: "Create multiple todo items at once in the local Todos table.",
  confirmation: TODO_BATCH_ADD_CONFIRMATION,
  prompt: {
    summary: "Batch create multiple todo items in the local Todos table.",
    intentKeywords: [
      "批量添加",
      "批量创建",
      "批量新增",
      "批量记录待办",
      "batch add todos",
      "batch create tasks",
    ],
    whenToUse: [
      "Use when the user explicitly asks to create multiple todo items at once.",
      "Use when the user lists several tasks separated by newlines, commas, or bullet points.",
      "Use when batch creation is more efficient than calling the single-add tool multiple times.",
      "Use common_tool_ask to ask for missing required facts when any batch item is underspecified.",
    ],
    whenNotToUse: [
      "Do not use for creating a single todo item — use todos_tool_add instead.",
      "Do not use for read-only questions about existing todos.",
      "Do not use when the user has not asked to create todos.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For batch creation, confirmationSummary must summarize the items being created (count and key texts).",
      "entryDate defaults to today when not explicitly specified for each item.",
      "Never invent todo text the user did not provide or confirm.",
      "Each item must have entryDate, text, and priority filled.",
    ],
    output:
      "Include confirmationSummary in the tool arguments; return the count and created todo facts needed by the user.",
    examples: [
      '{"confirmationSummary":"将批量创建 3 项待办。\n- 买水果（P2）\n- 开会（P1）\n- 写代码（P0）","items":[{"entryDate":"2026-06-10","text":"买水果","priority":"P2"},{"entryDate":"2026-06-10","text":"开会","priority":"P1"},{"entryDate":"2026-06-10","text":"写代码","priority":"P0"}]}',
    ],
  },
  parameters: {
    type: "object",
    required: ["items", "confirmationSummary"],
    properties: {
      confirmationSummary: {
        type: "string",
        description:
          "Concise Markdown Chinese explanation shown above the internal confirmation. List all items or summarize with count and key texts.",
      },
      items: {
        type: "array",
        description: "Array of todo items to create",
        items: {
          type: "object",
          required: ["entryDate", "text", "priority"],
          properties: {
            entryDate: {
              type: "string",
              description:
                "Target date in YYYY-MM-DD format. Default to today when not explicitly specified.",
            },
            text: {
              type: "string",
              description: "Todo item text",
            },
            priority: TODO_PRIORITY_SCHEMA,
          },
        },
      },
    },
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.items)) {
      throw new Error("Todo batch create requires items array")
    }

    const results = (input.items as unknown[]).map((item) => {
      const created = todosService.create(parseCreateInput(item))
      return toToolItem(created)
    })

    return {
      observation: `Batch created ${results.length} todos.`,
      data: { items: results, count: results.length },
    }
  },
})

/**
 * 创建 Todo 批量更新工具。
 */
const createTodoBatchUpdateTool = (todosService: Pick<TodosService, "update">): TodoWriteTool => ({
  name: "todos_tool_batch_update",
  description: "Update multiple todo items at once in the local Todos table by id.",
  confirmation: TODO_BATCH_UPDATE_CONFIRMATION,
  prompt: {
    summary: "Batch update multiple todo items in the local Todos table by id.",
    intentKeywords: [
      "批量修改",
      "批量更新",
      "批量完成",
      "全部标记完成",
      "全部完成",
      "batch update todos",
      "batch edit tasks",
      "mark all done",
    ],
    whenToUse: [
      "Use when the user explicitly asks to update multiple todo items at once.",
      'Use when the user asks to "mark all as done" or "complete all tasks".',
      'Use when the user asks to change multiple todos together (e.g., "move these to tomorrow").',
      "Use after todos_tool_query when the user identifies multiple todos to update.",
    ],
    whenNotToUse: [
      "Do not use for updating a single todo item — use todos_tool_update instead.",
      "Do not use for creating new todos.",
      "Do not use when target todo ids are unknown or ambiguous.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm updates; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For batch updates, confirmationSummary must summarize the changes (count, key fields being modified).",
      "Each item must include its numeric id and complete replacement fields (text, priority, completed).",
      "Query first when the user provides descriptions instead of ids.",
      "Never overwrite fields with guesses.",
      "Only include entryDate when the user explicitly asks to change the date.",
    ],
    output:
      "Include confirmationSummary in the tool arguments; return the count and updated todo facts needed by the user.",
    examples: [
      '{"confirmationSummary":"将批量更新 2 项待办标记为已完成。","items":[{"id":1,"text":"买水果","priority":"P2","completed":true},{"id":2,"text":"开会","priority":"P1","completed":true}]}',
    ],
  },
  parameters: {
    type: "object",
    required: ["items", "confirmationSummary"],
    properties: {
      confirmationSummary: {
        type: "string",
        description:
          "Concise Markdown Chinese explanation shown above the internal confirmation. Summarize all items and key changed fields.",
      },
      items: {
        type: "array",
        description: "Array of todo items to update, each with id and replacement fields",
        items: {
          type: "object",
          required: ["id", "text", "priority", "completed"],
          properties: {
            id: {
              type: "number",
              description: "Todo item id",
            },
            text: {
              type: "string",
              description: "Todo item text",
            },
            priority: TODO_PRIORITY_SCHEMA,
            completed: {
              type: "boolean",
              description: "Whether the todo is completed",
            },
            entryDate: {
              type: "string",
              description:
                "Target date in YYYY-MM-DD format. Only set when the user explicitly asks to change the date.",
            },
          },
        },
      },
    },
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.items)) {
      throw new Error("Todo batch update requires items array")
    }

    const results = (input.items as unknown[]).map((item) => {
      const parsed = parseUpdateInput(item)
      const updated = todosService.update(parsed.id, parsed.profile)
      return toToolItem(updated)
    })

    return {
      observation: `Batch updated ${results.length} todos.`,
      data: { items: results, count: results.length },
    }
  },
})

/**
 * 创建 Todo 批量删除工具。
 */
const createTodoBatchDeleteTool = (todosService: Pick<TodosService, "delete">): TodoWriteTool => ({
  name: "todos_tool_batch_delete",
  description: "Delete multiple todo items at once from the local Todos table by id.",
  confirmation: TODO_BATCH_DELETE_CONFIRMATION,
  prompt: {
    summary: "Batch delete multiple todo items from the local Todos table by id.",
    intentKeywords: [
      "批量删除",
      "批量移除",
      "清空待办",
      "全部删除",
      "batch delete todos",
      "remove all tasks",
      "clear todos",
    ],
    whenToUse: [
      "Use when the user explicitly asks to delete multiple todo items at once.",
      'Use when the user asks to "clear all todos" or "delete all tasks".',
      "Use after todos_tool_query when the user identifies multiple todos to delete.",
    ],
    whenNotToUse: [
      "Do not use for deleting a single todo item — use todos_tool_delete instead.",
      "Do not use for temporary filtering or hiding.",
      "Do not use when target todo ids are unknown or ambiguous.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For batch deletion, confirmationSummary must identify the count and distinguishing facts of todos being deleted.",
      "Require exact numeric ids.",
      "Ask the user for clarification before deleting when the set of todos is ambiguous.",
      "Batch deletion is permanent and cannot be undone — be conservative.",
    ],
    output:
      "Include confirmationSummary in the tool arguments; return count and concise deletion confirmation.",
    examples: [
      '{"confirmationSummary":"将批量删除 3 项已完成待办。\n- #1 买水果\n- #2 开会\n- #3 写代码","ids":[1,2,3]}',
    ],
  },
  parameters: {
    type: "object",
    required: ["ids", "confirmationSummary"],
    properties: {
      confirmationSummary: {
        type: "string",
        description:
          "Concise Markdown Chinese explanation shown above the internal confirmation. Include the count and key distinguishing facts.",
      },
      ids: {
        type: "array",
        description: "Array of todo ids to delete",
        items: {
          type: "number",
          description: "Todo item id",
        },
      },
    },
  },
  execute: async (input) => {
    if (
      !isRecord(input) ||
      !Array.isArray(input.ids) ||
      input.ids.some((id: unknown) => typeof id !== "number")
    ) {
      throw new Error("Todo batch delete requires ids array of numbers")
    }

    const ids = input.ids as number[]
    ids.forEach((id) => {
      todosService.delete(id)
    })

    return {
      observation: `Batch deleted ${ids.length} todos.`,
      data: { ids, count: ids.length },
    }
  },
})

/**
 * 创建完整 Todo 工具组。
 */
export const createTodoTools = (
  todosService: Pick<TodosService, "querySql" | "create" | "update" | "delete">,
): AgentTool[] => [
  createTodoQueryTool(todosService),
  createTodoAddTool(todosService),
  createTodoUpdateTool(todosService),
  createTodoDeleteTool(todosService),
  createTodoBatchAddTool(todosService),
  createTodoBatchUpdateTool(todosService),
  createTodoBatchDeleteTool(todosService),
]
