import type { ToolConfirmationConfig } from "@/agent/tools/toolConfirmation"
import type {
  AgentTool,
  JournalQueryToolInput,
  JournalQueryToolItem,
  JournalQueryToolResult,
} from "@/agent/types"
import type { JournalItem, JournalSaveInput } from "@/db/schema"
import type { JournalsService } from "@/services/journalsService"

// Journal 查询工具类型。
type JournalQueryTool = Omit<AgentTool, "execute"> & {
  execute: (input: unknown) => Promise<JournalQueryToolResult>
}

// Journal 写入工具结果。
type JournalWriteToolResult = {
  observation: string
  data: unknown
}

// Journal 写入工具类型。
type JournalWriteTool = Omit<AgentTool, "execute"> & {
  execute: (input: unknown) => Promise<JournalWriteToolResult>
}

// Journal 写入动作。
type JournalWriteAction = "add" | "update" | "delete"

// Journal 工具默认返回数量。
const DEFAULT_JOURNAL_LIMIT = 20

// Journal 工具最大返回数量。
const MAX_JOURNAL_LIMIT = 50

// Journal SQL 最大长度。
const MAX_JOURNAL_SQL_LENGTH = 1200

// Journal 查询表名。
const JOURNAL_TABLE_NAME = "journals"

// Journal 查询字段清单。
const JOURNAL_COLUMNS = "id, entry_date, content, created_at, updated_at"

// 日记日期格式。
const ENTRY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// 日记日期前缀格式。
const DATE_PREFIX_PATTERN = /^\d{4}(-\d{2})?$/

// 禁止 AI SQL 使用的高风险关键字。
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union|join)\b/i

// SQL 注释片段。
const SQL_COMMENT_PATTERN = /--|\/\*|\*\//

// Journal 数据库行类型。
type JournalSqlRow = Record<string, unknown>

/**
 * 将日记映射为工具返回项。
 */
const toToolItem = (journal: JournalItem): JournalQueryToolItem => ({
  id: journal.id,
  entryDate: journal.entryDate,
  content: journal.content,
  createdAt: journal.createdAt,
  updatedAt: journal.updatedAt,
})

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

/**
 * 判断 SQL 原始行是否包含完整日记字段。
 */
const isJournalSqlRow = (value: unknown): value is JournalSqlRow =>
  isRecord(value) &&
  typeof value.id === "number" &&
  typeof value.entry_date === "string" &&
  typeof value.content === "string"

/**
 * 将完整 SQL 日记行映射为工具返回项。
 */
const sqlRowToToolItem = (row: JournalSqlRow): JournalQueryToolItem =>
  toToolItem({
    id: row.id as number,
    entryDate: row.entry_date as string,
    content: row.content as string,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
  })

/**
 * 解析字符串字段。
 */
const parseString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined

/**
 * 读取 Journal 写入输入中的非空字符串字段。
 */
const getJournalInputString = (input: unknown, key: string): string | null => {
  if (!isRecord(input)) {
    return null
  }

  const value = parseString(input[key])?.trim()

  return value || null
}

/**
 * 解析 Journal 查询工具入参。
 */
const parseInput = (input: unknown): JournalQueryToolInput => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    query: parseString(input.query),
    entryDate: parseString(input.entryDate),
    datePrefix: parseString(input.datePrefix),
    sql: parseString(input.sql),
    limit: typeof input.limit === "number" ? input.limit : undefined,
  }
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
 * 构造 LIKE 条件。
 */
const buildLikeCondition = (column: string, value: string | undefined): string | null => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  return `${column} LIKE '%${escapeSqlLike(trimmed)}%'`
}

/**
 * 构造结构化查询 WHERE 子句。
 */
const buildStructuredWhere = (parsed: JournalQueryToolInput): string => {
  const whereParts: (string | null)[] = [
    parsed.entryDate && ENTRY_DATE_PATTERN.test(parsed.entryDate.trim())
      ? `entry_date = '${escapeSqlString(parsed.entryDate.trim())}'`
      : null,
    parsed.datePrefix && DATE_PREFIX_PATTERN.test(parsed.datePrefix.trim())
      ? `entry_date LIKE '${escapeSqlLike(parsed.datePrefix.trim())}%'`
      : null,
    buildLikeCondition("content", parsed.query),
  ]

  const filtered = whereParts.filter((condition): condition is string => Boolean(condition))

  return filtered.length > 0 ? ` WHERE ${filtered.join(" AND ")}` : ""
}

/**
 * 将结构化查询编译为受控 SQL。
 */
const buildStructuredSql = (parsed: JournalQueryToolInput): string =>
  `SELECT ${JOURNAL_COLUMNS} FROM ${JOURNAL_TABLE_NAME}${buildStructuredWhere(parsed)} ORDER BY entry_date DESC, id DESC`

/**
 * 校验并限制 AI 生成的 Journal SQL。
 */
const prepareJournalSql = (sql: string, limit: number): string => {
  const normalizedSql = sql.trim()

  if (!normalizedSql) {
    throw new Error("Journal SQL cannot be empty")
  }

  if (normalizedSql.length > MAX_JOURNAL_SQL_LENGTH) {
    throw new Error("Journal SQL is too long")
  }

  if (normalizedSql.includes(";") || SQL_COMMENT_PATTERN.test(normalizedSql)) {
    throw new Error("Journal SQL only allows a single SELECT statement without comments")
  }

  if (!/^select\b/i.test(normalizedSql)) {
    throw new Error("Journal SQL only allows SELECT queries")
  }

  if (FORBIDDEN_SQL_PATTERN.test(normalizedSql)) {
    throw new Error("Journal SQL contains a forbidden keyword")
  }

  if (!new RegExp(`\\bfrom\\s+${JOURNAL_TABLE_NAME}\\b`, "i").test(normalizedSql)) {
    throw new Error(`Journal SQL can only query the ${JOURNAL_TABLE_NAME} table`)
  }

  if (/\bfrom\s+(?!journals\b)[a-z_][\w]*/i.test(normalizedSql)) {
    throw new Error(`Journal SQL can only query the ${JOURNAL_TABLE_NAME} table`)
  }

  const hasLimit = /\blimit\s+\d+\b/i.test(normalizedSql)
  return hasLimit ? normalizedSql : `${normalizedSql} LIMIT ${limit}`
}

/**
 * 执行受控 Journal SQL 查询。
 */
const queryBySql = (
  journalsService: Pick<JournalsService, "querySql">,
  sql: string,
  limit: number,
): { items: JournalQueryToolItem[]; rows: unknown[] } => {
  const rows = journalsService.querySql(prepareJournalSql(sql, limit)).slice(0, limit)
  const items = rows.filter(isJournalSqlRow).map(sqlRowToToolItem)

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
 * 创建 Journal 只读查询工具。
 */
export const createJournalQueryTool = (
  journalsService: Pick<JournalsService, "querySql">,
): JournalQueryTool => ({
  name: "journals_tool_query",
  description: "Query journals in the local Journals table. Read-only; never modifies data.",
  prompt: {
    summary:
      "Query journals in the local Journals table. Read-only; supports structured filters and controlled SQL.",
    intentKeywords: [
      "日记",
      "日志",
      "日报",
      "每日",
      "反思",
      "回顾",
      "journal",
      "journals",
      "diary",
      "query journals",
    ],
    whenToUse: [
      "Use when the user asks about journals, diaries, daily entries, or reflections.",
      "Use when the user asks what was written on a specific date or date range.",
      "Use when the user asks to review past journals or reflections.",
      "Use read-only SQL against journals when the user needs combined filters or more precise filtering.",
    ],
    whenNotToUse: [
      "Do not use for casual chat, writing, translation, or questions unrelated to local journals.",
      "Do not use when the user asks to create, update, or delete journals.",
    ],
    safety: [
      "Read only from the local Journals table. Never write data.",
      `SQL must be a single SELECT against only the ${JOURNAL_TABLE_NAME} table. JOIN, UNION, comments, multiple statements, and write keywords are forbidden.`,
      "Never invent journal items that the tool did not return.",
      "If tool results are insufficient, say the available information is insufficient.",
    ],
    output: "Return the journal facts needed to answer the user. Do not repeat irrelevant fields.",
    examples: [
      `{"limit":10}`,
      `{"query":"工作总结"}`,
      `{"datePrefix":"2026-06"}`,
      `{"entryDate":"2026-06-13"}`,
      `{"sql":"SELECT ${JOURNAL_COLUMNS} FROM ${JOURNAL_TABLE_NAME} ORDER BY entry_date DESC","limit":7}`,
    ],
  },
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search text contains (LIKE matching on content).",
      },
      entryDate: {
        type: "string",
        description: "Exact journal date in YYYY-MM-DD format.",
      },
      datePrefix: {
        type: "string",
        description: "Date prefix match (YYYY for year, YYYY-MM for month).",
      },
      sql: {
        type: "string",
        description: `Controlled read-only SQL. Must SELECT FROM ${JOURNAL_TABLE_NAME}; WHERE, ORDER BY, LIMIT, and COUNT(*) AS count are allowed.`,
      },
      limit: {
        type: "number",
        description: "Maximum number of rows to return",
      },
    },
  },
  execute: async (input) => {
    const parsed = parseInput(input)
    const limit = Math.max(1, Math.min(parsed.limit ?? DEFAULT_JOURNAL_LIMIT, MAX_JOURNAL_LIMIT))

    const queryResult = parsed.sql
      ? queryBySql(journalsService, parsed.sql, limit)
      : queryBySql(journalsService, buildStructuredSql(parsed), limit)

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

// Journal 完整资料字段 Schema。
const JOURNAL_PROFILE_PROPERTIES = {
  confirmationSummary: {
    type: "string",
    description:
      "Concise Markdown Chinese explanation shown above the internal confirmation. Include key add/update/delete facts related to the journal entry.",
  },
  entryDate: {
    type: "string",
    description: "Journal date in YYYY-MM-DD format",
  },
  content: {
    type: "string",
    description: "Journal content",
  },
}

/**
 * 生成 Journal 写入目标名称。
 */
const renderJournalMutationTarget = (input: unknown): string | null =>
  getJournalInputString(input, "entryDate") ?? null

/**
 * 生成 Journal 写入前确认说明。
 */
const renderJournalMutationSummary = (
  action: JournalWriteAction,
  input: unknown,
): string | null => {
  const aiSummary = getJournalInputString(input, "confirmationSummary")
  if (aiSummary) {
    return aiSummary
  }

  const entryDate = getJournalInputString(input, "entryDate") ?? "未知日期"
  const preview = getJournalInputString(input, "content")?.slice(0, 60)
  const previewSuffix = preview && preview.length > 60 ? "…" : ""

  switch (action) {
    case "add":
      return `新建 **${entryDate}** 日记${preview ? `（${preview}${previewSuffix}）` : ""}`
    case "update":
      return `更新 **${entryDate}** 日记${preview ? `（${preview}${previewSuffix}）` : ""}`
    case "delete":
      return `删除 **${entryDate}** 日记`
    default:
      return null
  }
}

/**
 * 构建 Journal 写入确认配置。
 */
const buildJournalConfirmation = (action: JournalWriteAction): ToolConfirmationConfig => ({
  header: "确认操作",
  question: `Are you sure you want to ${action === "delete" ? "delete this journal entry" : "execute this journal operation"}?`,
  confirm: "确认",
  cancel: "取消",
  renderTarget: renderJournalMutationTarget,
  renderSummary: (input) => renderJournalMutationSummary(action, input),
  completion: {
    renderMessage: (_input, _result) =>
      action === "delete" ? "Journal entry deleted." : "Journal entry saved.",
  },
})

/**
 * 构建 Journal 写入工具提示词。
 */
const buildJournalWritePrompt = (action: JournalWriteAction) => {
  const actionVerb = action === "add" ? "Create" : action === "update" ? "Update" : "Delete"

  return {
    summary: `${actionVerb} a journal entry in the local Journals table.`,
    intentKeywords:
      action === "delete"
        ? ["删除日记", "删日记", "remove journal", "delete journal"]
        : action === "update"
          ? ["更新日记", "修改日记", "编辑日记", "update journal", "edit journal"]
          : ["新建日记", "写日记", "记日记", "add journal", "create journal"],
    whenToUse: [
      action === "add"
        ? "Use when the user wants to create a new journal entry for a specific date."
        : action === "update"
          ? "Use when the user wants to modify an existing journal entry."
          : "Use when the user wants to delete a journal entry.",
      "An internal confirmation must succeed before writing.",
    ],
    whenNotToUse: [
      "Do not use for querying or reading journals.",
      "Do not use for writing or modifying any other table.",
    ],
    safety: [
      "Only write to the Journals table.",
      "Must confirm with the user before any write operation.",
      "Never invent content that the user did not provide.",
      `entryDate must match the YYYY-MM-DD format.`,
    ],
    output: "Confirm the action result to the user.",
  }
}

/**
 * 校验 Journal 写入输入。
 */
const validateJournalWriteInput = (input: unknown): void => {
  if (!isRecord(input)) {
    throw new Error("Journal input must be an object")
  }

  const entryDate = parseString(input.entryDate)?.trim()
  if (!entryDate) {
    throw new Error("entryDate is required")
  }

  if (!ENTRY_DATE_PATTERN.test(entryDate)) {
    throw new Error("entryDate must be in YYYY-MM-DD format")
  }
}

/**
 * 校验 Journal 写入内容（add/update 需要 content）。
 */
const validateJournalContent = (input: unknown): void => {
  validateJournalWriteInput(input)

  if (!isRecord(input)) {
    throw new Error("Journal input must be an object")
  }

  if (!parseString(input.content)?.trim()) {
    throw new Error("Journal content is required and cannot be empty")
  }
}

/**
 * 构建 Journal 保存输入。
 */
const buildSaveInput = (input: unknown): JournalSaveInput => {
  if (!isRecord(input)) {
    throw new Error("Journal input must be an object")
  }

  return {
    entryDate: parseString(input.entryDate)!.trim(),
    content: parseString(input.content)!.trim(),
  }
}

/**
 * 创建 Journal 新增工具。
 */
export const createJournalAddTool = (
  journalsService: Pick<JournalsService, "save">,
): JournalWriteTool => ({
  name: "journals_tool_add",
  description: "Create a new journal entry for a specific date.",
  confirmation: buildJournalConfirmation("add"),
  prompt: buildJournalWritePrompt("add"),
  parameters: {
    type: "object",
    properties: JOURNAL_PROFILE_PROPERTIES,
    required: ["entryDate", "content"],
  },
  execute: async (input) => {
    validateJournalContent(input)
    const saveInput = buildSaveInput(input)
    const journal = journalsService.save(saveInput)

    return {
      observation: `Journal for ${journal.entryDate} created.`,
      data: toToolItem(journal),
    }
  },
})

/**
 * 创建 Journal 更新工具。
 */
export const createJournalUpdateTool = (
  journalsService: Pick<JournalsService, "save">,
): JournalWriteTool => ({
  name: "journals_tool_update",
  description: "Update an existing journal entry.",
  confirmation: buildJournalConfirmation("update"),
  prompt: buildJournalWritePrompt("update"),
  parameters: {
    type: "object",
    properties: JOURNAL_PROFILE_PROPERTIES,
    required: ["entryDate", "content"],
  },
  execute: async (input) => {
    validateJournalContent(input)
    const saveInput = buildSaveInput(input)
    const journal = journalsService.save(saveInput)

    return {
      observation: `Journal for ${journal.entryDate} updated.`,
      data: toToolItem(journal),
    }
  },
})

/**
 * 创建 Journal 删除工具。
 */
export const createJournalDeleteTool = (
  journalsService: Pick<JournalsService, "delete">,
): JournalWriteTool => ({
  name: "journals_tool_delete",
  description: "Delete an existing journal entry by date.",
  confirmation: buildJournalConfirmation("delete"),
  prompt: buildJournalWritePrompt("delete"),
  parameters: {
    type: "object",
    properties: {
      confirmationSummary: {
        type: "string",
        description: "Concise Markdown Chinese explanation shown above the internal confirmation.",
      },
      entryDate: {
        type: "string",
        description: "Journal date in YYYY-MM-DD format",
      },
    },
    required: ["entryDate"],
  },
  execute: async (input) => {
    validateJournalWriteInput(input)
    if (!isRecord(input)) {
      throw new Error("Journal input must be an object")
    }

    const entryDate = parseString(input.entryDate)!.trim()
    journalsService.delete(entryDate)

    return {
      observation: `Journal for ${entryDate} deleted.`,
      data: { entryDate },
    }
  },
})

// 批量写入工具结果。
type JournalBatchWriteToolResult = {
  observation: string
  data: unknown
}

// 批量写入工具类型。
type JournalBatchWriteTool = Omit<AgentTool, "execute"> & {
  execute: (input: unknown) => Promise<JournalBatchWriteToolResult>
}

// 批量 Journal 条目 Schema。
const BATCH_PROFILE_PROPERTIES = {
  confirmationSummary: {
    type: "string",
    description: "Concise Markdown Chinese explanation shown above the internal confirmation.",
  },
  entries: {
    type: "array",
    items: {
      type: "object",
      properties: JOURNAL_PROFILE_PROPERTIES,
    },
    description: "Array of journal entries to process",
  },
}

/**
 * 生成批量 Journal 写入的目标名称。
 */
const renderJournalBatchMutationTarget = (input: unknown): string | null => {
  if (!isRecord(input) || !Array.isArray(input.entries)) {
    return null
  }

  const count = input.entries.length
  return count > 0 ? `${count} entries` : null
}

/**
 * 生成批量 Journal 写入的确认说明。
 */
const renderJournalBatchMutationSummary = (
  action: JournalWriteAction,
  input: unknown,
): string | null => {
  const aiSummary = getJournalInputString(input, "confirmationSummary")
  if (aiSummary) {
    return aiSummary
  }

  if (!isRecord(input) || !Array.isArray(input.entries)) {
    return null
  }

  const count = input.entries.length
  const actionLabel = action === "delete" ? "删除" : action === "update" ? "更新" : "新建"

  return `批量${actionLabel} **${count}** 条日记`
}

/**
 * 构建批量 Journal 确认配置。
 */
const buildJournalBatchConfirmation = (action: JournalWriteAction): ToolConfirmationConfig => ({
  header: "确认批量操作",
  question: `Are you sure you want to batch ${action === "delete" ? "delete these journal entries" : "execute this batch journal operation"}?`,
  confirm: "确认",
  cancel: "取消",
  renderTarget: renderJournalBatchMutationTarget,
  renderSummary: (input) => renderJournalBatchMutationSummary(action, input),
  completion: {
    renderMessage: (_input, _result) =>
      action === "delete" ? "Batch journal entries deleted." : "Batch journal entries saved.",
  },
})

/**
 * 创建 Journal 批量新增工具。
 */
export const createJournalBatchAddTool = (
  journalsService: Pick<JournalsService, "save">,
): JournalBatchWriteTool => ({
  name: "journals_tool_batch_add",
  description: "Batch create journal entries.",
  confirmation: buildJournalBatchConfirmation("add"),
  prompt: {
    summary: "Batch create journal entries in the local Journals table.",
    intentKeywords: ["批量新建日记", "batch add journals"],
    whenToUse: [
      "Use when the user wants to create multiple journal entries at once.",
      "An internal confirmation must succeed before writing.",
    ],
    whenNotToUse: [
      "Do not use for single journal operations.",
      "Do not use for querying or reading journals.",
    ],
    safety: [
      "Only write to the Journals table.",
      "Must confirm with the user before any write operation.",
      "Never invent content that the user did not provide.",
    ],
    output: "Confirm the action result to the user.",
  },
  parameters: {
    type: "object",
    properties: BATCH_PROFILE_PROPERTIES,
    required: ["entries"],
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.entries)) {
      throw new Error("Batch input must have an entries array")
    }

    const entries = input.entries as unknown[]
    const items: JournalQueryToolItem[] = []

    for (const entry of entries) {
      validateJournalContent(entry)
      const saveInput = buildSaveInput(entry)
      const journal = journalsService.save(saveInput)
      items.push(toToolItem(journal))
    }

    return {
      observation: `${items.length} journal entries created.`,
      data: { items },
    }
  },
})

/**
 * 创建 Journal 批量更新工具。
 */
export const createJournalBatchUpdateTool = (
  journalsService: Pick<JournalsService, "save">,
): JournalBatchWriteTool => ({
  name: "journals_tool_batch_update",
  description: "Batch update journal entries.",
  confirmation: buildJournalBatchConfirmation("update"),
  prompt: {
    summary: "Batch update journal entries in the local Journals table.",
    intentKeywords: ["批量更新日记", "batch update journals"],
    whenToUse: [
      "Use when the user wants to modify multiple journal entries at once.",
      "An internal confirmation must succeed before writing.",
    ],
    whenNotToUse: [
      "Do not use for single journal operations.",
      "Do not use for querying or reading journals.",
    ],
    safety: [
      "Only write to the Journals table.",
      "Must confirm with the user before any write operation.",
      "Never invent content that the user did not provide.",
    ],
    output: "Confirm the action result to the user.",
  },
  parameters: {
    type: "object",
    properties: BATCH_PROFILE_PROPERTIES,
    required: ["entries"],
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.entries)) {
      throw new Error("Batch input must have an entries array")
    }

    const entries = input.entries as unknown[]
    const items: JournalQueryToolItem[] = []

    for (const entry of entries) {
      validateJournalContent(entry)
      const saveInput = buildSaveInput(entry)
      const journal = journalsService.save(saveInput)
      items.push(toToolItem(journal))
    }

    return {
      observation: `${items.length} journal entries updated.`,
      data: { items },
    }
  },
})

/**
 * 创建 Journal 批量删除工具。
 */
export const createJournalBatchDeleteTool = (
  journalsService: Pick<JournalsService, "delete">,
): JournalBatchWriteTool => ({
  name: "journals_tool_batch_delete",
  description: "Batch delete journal entries.",
  confirmation: buildJournalBatchConfirmation("delete"),
  prompt: {
    summary: "Batch delete journal entries from the local Journals table.",
    intentKeywords: ["批量删除日记", "batch delete journals"],
    whenToUse: [
      "Use when the user wants to delete multiple journal entries at once.",
      "An internal confirmation must succeed before writing.",
    ],
    whenNotToUse: [
      "Do not use for single journal operations.",
      "Do not use for querying or reading journals.",
    ],
    safety: [
      "Only write to the Journals table.",
      "Must confirm with the user before any write operation.",
    ],
    output: "Confirm the action result to the user.",
  },
  parameters: {
    type: "object",
    properties: {
      confirmationSummary: {
        type: "string",
        description: "Concise Markdown Chinese explanation shown above the internal confirmation.",
      },
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            entryDate: {
              type: "string",
              description: "Journal date in YYYY-MM-DD format",
            },
          },
          required: ["entryDate"],
        },
        description: "Array of journal dates to delete",
      },
    },
    required: ["entries"],
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.entries)) {
      throw new Error("Batch delete input must have an entries array")
    }

    const entries = input.entries as unknown[]
    const deletedDates: string[] = []

    for (const entry of entries) {
      validateJournalWriteInput(entry)
      if (!isRecord(entry)) {
        continue
      }
      const entryDate = parseString(entry.entryDate)!.trim()
      journalsService.delete(entryDate)
      deletedDates.push(entryDate)
    }

    return {
      observation: `${deletedDates.length} journal entries deleted.`,
      data: { entryDates: deletedDates },
    }
  },
})

/**
 * 创建全部 Journal 工具。
 */
export const createJournalTools = (
  journalsService: Pick<JournalsService, "querySql" | "save" | "delete">,
): AgentTool[] => [
  createJournalQueryTool(journalsService),
  createJournalAddTool(journalsService),
  createJournalUpdateTool(journalsService),
  createJournalDeleteTool(journalsService),
  createJournalBatchAddTool(journalsService),
  createJournalBatchUpdateTool(journalsService),
  createJournalBatchDeleteTool(journalsService),
]
