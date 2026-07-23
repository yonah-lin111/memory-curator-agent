import type {
  PeopleQueryConditions,
  PeopleQueryToolInput,
  PeopleQueryToolItem,
} from "@/agent/types"
import type { PersonRelationship } from "@/db/schema"
import type { PeopleService } from "@/services/peopleService"
import {
  DEFAULT_PEOPLE_COLUMNS,
  DEFAULT_PEOPLE_LIMIT,
  FORBIDDEN_SQL_PATTERN,
  MAX_PEOPLE_LIMIT,
  MAX_PEOPLE_SQL_LENGTH,
  PEOPLE_COLUMNS,
  PEOPLE_RELATIONSHIP_SCHEMA,
  PEOPLE_TABLE_NAME,
  SQL_COMMENT_PATTERN,
} from "../constants"
import type { PeopleQueryTool } from "../types"
import { isPersonSqlRow, isRecord, parseString, sqlRowToToolItem } from "../utils"

/**
 * 解析 People 条件查询入参。
 */
const parseConditions = (value: unknown): PeopleQueryConditions | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  return {
    name: parseString(value.name),
    gender: parseString(value.gender),
    relationship: parseString(value.relationship) as PersonRelationship | undefined,
    status: parseString(value.status),
    birthday: parseString(value.birthday),
    contact: parseString(value.contact),
    tag: parseString(value.tag),
    details: parseString(value.details),
    updatedAfter: parseString(value.updatedAfter),
    updatedBefore: parseString(value.updatedBefore),
  }
}

/**
 * 解析 People 工具入参。
 */
const parseInput = (input: unknown): PeopleQueryToolInput => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    query: parseString(input.query),
    relationship: parseString(input.relationship) as PersonRelationship | undefined,
    conditions: parseConditions(input.conditions),
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

  return `${column} LIKE '%${escapeSqlLike(trimmed)}%' ESCAPE '\\'`
}

/**
 * 构造相等条件。
 */
const buildEqualCondition = (column: string, value: string | undefined): string | null => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  return `${column} = '${escapeSqlString(trimmed)}'`
}

/**
 * 构造基础字段 query 条件。
 */
const buildBaseQueryCondition = (query: string | undefined): string | null => {
  const trimmed = query?.trim()
  if (!trimmed) {
    return null
  }

  return `(${["name", "gender", "relationship", "status", "birthday", "contact", "tags"]
    .map((column) => buildLikeCondition(column, trimmed))
    .filter((condition): condition is string => Boolean(condition))
    .join(" OR ")})`
}

/**
 * 构造结构化查询 WHERE 子句。
 */
const buildStructuredWhere = (
  parsed: PeopleQueryToolInput,
  queryTarget: "base" | "details",
): string => {
  const conditions = parsed.conditions
  const whereParts = [
    buildEqualCondition("relationship", parsed.relationship),
    buildLikeCondition("name", conditions?.name),
    buildLikeCondition("gender", conditions?.gender),
    buildEqualCondition("relationship", conditions?.relationship),
    buildLikeCondition("status", conditions?.status),
    buildLikeCondition("birthday", conditions?.birthday),
    buildLikeCondition("contact", conditions?.contact),
    buildLikeCondition("tags", conditions?.tag),
    buildLikeCondition("details", conditions?.details),
    conditions?.updatedAfter
      ? `updated_at >= '${escapeSqlString(conditions.updatedAfter.trim())}'`
      : null,
    conditions?.updatedBefore
      ? `updated_at <= '${escapeSqlString(conditions.updatedBefore.trim())}'`
      : null,
    queryTarget === "base"
      ? buildBaseQueryCondition(parsed.query)
      : buildLikeCondition("details", parsed.query),
  ].filter((condition): condition is string => Boolean(condition))

  return whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : ""
}

/**
 * 将结构化查询编译为受控 SQL。
 */
const buildStructuredSql = (
  parsed: PeopleQueryToolInput,
  queryTarget: "base" | "details",
  limit: number,
): string => {
  const isSingleQuery = limit === 1
  const shouldSelectDetails =
    isSingleQuery || Boolean(parsed.conditions?.details) || queryTarget === "details"
  const columns = shouldSelectDetails ? PEOPLE_COLUMNS : DEFAULT_PEOPLE_COLUMNS

  return `SELECT ${columns} FROM ${PEOPLE_TABLE_NAME}${buildStructuredWhere(parsed, queryTarget)} ORDER BY updated_at DESC, created_at DESC`
}

/**
 * 校验并限制 AI 生成的 People SQL。
 */
const preparePeopleSql = (sql: string, limit: number): string => {
  const normalizedSql = sql.trim()

  if (!normalizedSql) {
    throw new Error("People SQL cannot be empty")
  }

  if (normalizedSql.length > MAX_PEOPLE_SQL_LENGTH) {
    throw new Error("People SQL is too long")
  }

  if (normalizedSql.includes(";") || SQL_COMMENT_PATTERN.test(normalizedSql)) {
    throw new Error("People SQL only allows a single SELECT statement without comments")
  }

  if (!/^select\b/i.test(normalizedSql)) {
    throw new Error("People SQL only allows SELECT queries")
  }

  if (FORBIDDEN_SQL_PATTERN.test(normalizedSql)) {
    throw new Error("People SQL contains a forbidden keyword")
  }

  if (!new RegExp(`\\bfrom\\s+${PEOPLE_TABLE_NAME}\\b`, "i").test(normalizedSql)) {
    throw new Error(`People SQL can only query the ${PEOPLE_TABLE_NAME} table`)
  }

  if (/\bfrom\s+(?!associated_people\b)[a-z_][\w]*/i.test(normalizedSql)) {
    throw new Error(`People SQL can only query the ${PEOPLE_TABLE_NAME} table`)
  }

  const hasLimit = /\blimit\s+\d+\b/i.test(normalizedSql)
  return hasLimit ? normalizedSql : `${normalizedSql} LIMIT ${limit}`
}

/**
 * 执行受控 People SQL 查询。
 */
const queryBySql = (
  peopleService: Pick<PeopleService, "querySql">,
  sql: string,
  limit: number,
): { items: PeopleQueryToolItem[]; rows: unknown[] } => {
  const rows = peopleService.querySql(preparePeopleSql(sql, limit)).slice(0, limit)
  const items = rows.filter(isPersonSqlRow).map(sqlRowToToolItem)

  return {
    items,
    rows,
  }
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
 * 执行结构化 SQL 查询，必要时再兜底查询 details。
 */
const queryStructuredBySql = (
  peopleService: Pick<PeopleService, "querySql">,
  parsed: PeopleQueryToolInput,
  limit: number,
): { items: PeopleQueryToolItem[]; rows: unknown[] } => {
  const baseResult = queryBySql(peopleService, buildStructuredSql(parsed, "base", limit), limit)
  if (baseResult.rows.length > 0 || !parsed.query?.trim() || parsed.conditions?.details) {
    return baseResult
  }

  return queryBySql(peopleService, buildStructuredSql(parsed, "details", limit), limit)
}

/**
 * 创建 People 只读查询工具。
 */
export const createPeopleQueryTool = (
  peopleService: Pick<PeopleService, "querySql">,
): PeopleQueryTool => ({
  name: "people_tool_query",
  description:
    "Query associated people profiles in the local People table. Read-only; never modifies data.",
  prompt: {
    summary:
      "Query associated people profiles in the local People table. Read-only; supports structured filters and controlled SQL.",
    intentKeywords: [
      "人",
      "人物",
      "谁",
      "关系",
      "女朋友",
      "朋友",
      "家人",
      "同事",
      "喜欢",
      "爱吃",
      "偏好",
      "生日",
      "联系方式",
      "标签",
      "状态",
      "people",
      "person",
      "profile",
    ],
    whenToUse: [
      "Use when the user asks who a person is, or asks about relationship, status, birthday, contact details, or tags.",
      "Use details when the user explicitly asks about preferences, background, notes, experiences, or other information that may only exist in details.",
      "Use when the user question requires confirming a people fact from the local People table.",
      "Use when the user provides a name, relationship, status, tag, or details keyword and needs matching people.",
      "Use read-only SQL against associated_people when the user needs combined filters, sorting, or more precise filtering.",
    ],
    whenNotToUse: [
      "Do not use for casual chat, writing, translation, or questions unrelated to local people profiles.",
      "Do not use when the user asks to create, update, or delete people profiles.",
    ],
    safety: [
      "Read only from the local People table. Never write data.",
      `SQL must be a single SELECT against only the ${PEOPLE_TABLE_NAME} table. JOIN, UNION, comments, multiple statements, and write keywords are forbidden.`,
      "For a single-item query (limit = 1), include details by default. For batch queries (limit > 1), omit details by default to reduce transfer and compute cost.",
      "Important: include details when the requested content does not match base fields such as name, relationship, status, or tags, or when limit = 1. For batch queries, include details only when base fields do not match or details are explicitly needed.",
      "Never invent people facts that the tool did not return.",
      "If tool results are insufficient, say the available information is insufficient.",
    ],
    output:
      "Return the people facts needed to answer the user. Do not repeat irrelevant fields. When outputting database images such as avatar or details images, use Markdown image syntax ![](...) directly.",
    examples: [
      `{"sql":"SELECT ${DEFAULT_PEOPLE_COLUMNS} FROM ${PEOPLE_TABLE_NAME} WHERE relationship = '朋友' ORDER BY updated_at DESC","limit":5}`,
      `{"sql":"SELECT COUNT(*) AS count FROM ${PEOPLE_TABLE_NAME}","limit":1}`,
      `{"sql":"SELECT ${PEOPLE_COLUMNS} FROM ${PEOPLE_TABLE_NAME} WHERE details LIKE '%爱吃%' ORDER BY updated_at DESC","limit":5}`,
      '{"conditions":{"relationship":"同事","tag":"产品"},"limit":5}',
    ],
  },
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search by name, gender, relationship, status, birthday, contact, or tags. For a single-item query (limit = 1), or when base fields do not match, search with details as a fallback.",
      },
      relationship: {
        ...PEOPLE_RELATIONSHIP_SCHEMA,
        description: "Relationship category filter",
      },
      conditions: {
        type: "object",
        description:
          "Structured filters. String fields use contains matching; relationship uses exact matching.",
        properties: {
          name: {
            type: "string",
            description: "Name contains",
          },
          gender: {
            type: "string",
            description: "Gender contains",
          },
          relationship: {
            ...PEOPLE_RELATIONSHIP_SCHEMA,
            description: "Exact relationship category filter",
          },
          status: {
            type: "string",
            description: "Status contains",
          },
          birthday: {
            type: "string",
            description: "Birthday contains",
          },
          contact: {
            type: "string",
            description: "Contact contains",
          },
          tag: {
            type: "string",
            description: "Any tag contains",
          },
          details: {
            type: "string",
            description:
              "Details contains. Use by default for a single-item query (limit = 1). For batch queries (limit > 1), use only when base fields cannot answer, no base-field match is found, or details are explicitly needed.",
          },
          updatedAfter: {
            type: "string",
            description: "Updated-at lower bound, in the same format as updated_at",
          },
          updatedBefore: {
            type: "string",
            description: "Updated-at upper bound, in the same format as updated_at",
          },
        },
      },
      sql: {
        type: "string",
        description: `Controlled read-only SQL. Must SELECT FROM ${PEOPLE_TABLE_NAME}; WHERE, ORDER BY, LIMIT, and COUNT(*) AS count are allowed. For a single-item query (limit = 1), SELECT should include details. For batch queries (limit > 1), omit details unless base fields do not match.`,
      },
      limit: {
        type: "number",
        description: "Maximum number of rows to return",
      },
    },
  },
  execute: async (input) => {
    const parsed = parseInput(input)
    const limit = Math.max(1, Math.min(parsed.limit ?? DEFAULT_PEOPLE_LIMIT, MAX_PEOPLE_LIMIT))
    const queryResult = parsed.sql
      ? queryBySql(peopleService, parsed.sql, limit)
      : queryStructuredBySql(peopleService, parsed, limit)
    const { items, rows } = queryResult
    const observation = renderSqlObservation(rows)

    return {
      observation,
      data: {
        rows,
        items,
      },
      items,
      rows,
    }
  },
})
