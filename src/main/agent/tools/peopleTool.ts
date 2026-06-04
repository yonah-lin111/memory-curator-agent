import type {
  AssociatedPersonCreateInput,
  AssociatedPersonItem,
  AssociatedPersonUpdateInput,
  PersonRelationship,
} from "../../db/schema";
import type { PeopleService } from "../../services/peopleService";
import type {
  AgentTool,
  PeopleQueryConditions,
  PeopleQueryToolInput,
  PeopleQueryToolItem,
  PeopleQueryToolResult,
} from "../types";

// People 查询工具类型。
type PeopleQueryTool = Omit<AgentTool, "execute"> & {
  /**
   * 执行 People 查询。
   */
  execute: (input: unknown) => Promise<PeopleQueryToolResult>;
};

// People 写入工具结果。
type PeopleWriteToolResult = {
  // 回灌模型的观察文本。
  observation: string;
  // 调试或 UI 可用结构化数据。
  data: unknown;
};

// People 写入工具类型。
type PeopleWriteTool = Omit<AgentTool, "execute"> & {
  /**
   * 执行 People 写入。
   */
  execute: (input: unknown) => Promise<PeopleWriteToolResult>;
};

// People 工具默认返回数量。
const DEFAULT_PEOPLE_LIMIT = 8;

// People 工具最大返回数量。
const MAX_PEOPLE_LIMIT = 20;

// People SQL 最大长度。
const MAX_PEOPLE_SQL_LENGTH = 1200;

// People 查询表名。
const PEOPLE_TABLE_NAME = "associated_people";

// People 查询字段清单。
const PEOPLE_COLUMNS =
  "external_id AS id, avatar, name, gender, relationship, status, birthday, contact, tags, details, created_at, updated_at";

// People 关系枚举 Schema。
const PEOPLE_RELATIONSHIP_SCHEMA = {
  type: "string",
  enum: ["女朋友", "家人", "朋友", "同事", "其他"],
  description: "Relationship category",
};

// People 完整资料字段 Schema。
const PEOPLE_PROFILE_PROPERTIES = {
  avatar: {
    type: "string",
    description: "Avatar URI. Use an empty string when absent.",
  },
  name: {
    type: "string",
    description: "Person name",
  },
  gender: {
    type: "string",
    description: "Gender text. Use an empty string when absent.",
  },
  relationship: PEOPLE_RELATIONSHIP_SCHEMA,
  status: {
    type: "string",
    description:
      "Current status or short summary. Use an empty string when absent.",
  },
  birthday: {
    type: "string",
    description: "Birthday text. Use an empty string when absent.",
  },
  contact: {
    type: "string",
    description: "Contact details. Use an empty string when absent.",
  },
  tags: {
    type: "array",
    items: {
      type: "string",
    },
    description: "Profile tags",
  },
  details: {
    type: "string",
    description:
      "Full profile details in Markdown format. Use headings, lists, paragraphs, and Markdown image syntax when useful. Use an empty string when absent.",
  },
};

// People 完整资料必填字段。
const PEOPLE_PROFILE_REQUIRED = [
  "avatar",
  "name",
  "gender",
  "relationship",
  "status",
  "birthday",
  "contact",
  "tags",
  "details",
];

// People 默认查询字段清单，不包含 details。
const DEFAULT_PEOPLE_COLUMNS =
  "external_id AS id, avatar, name, gender, relationship, status, birthday, contact, tags, created_at, updated_at";

// 禁止 AI SQL 使用的高风险关键字。
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union|join)\b/i;

// SQL 注释片段。
const SQL_COMMENT_PATTERN = /--|\/\*|\*\//;

// People 数据库行类型。
type PeopleSqlRow = Record<string, unknown>;

/**
 * 将人物压缩为工具返回项。
 */
const toToolItem = (person: AssociatedPersonItem): PeopleQueryToolItem => ({
  id: person.id,
  name: person.name,
  gender: person.gender,
  relationship: person.relationship,
  status: person.status,
  birthday: person.birthday,
  contact: person.contact,
  tags: person.tags,
  details: person.details,
  updatedAt: person.updatedAt,
});

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * 判断 SQL 原始行是否包含完整人物字段。
 */
const isPersonSqlRow = (value: unknown): value is PeopleSqlRow =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.gender === "string" &&
  typeof value.relationship === "string" &&
  typeof value.status === "string" &&
  typeof value.birthday === "string" &&
  typeof value.contact === "string" &&
  typeof value.tags === "string" &&
  typeof value.updated_at === "string";

/**
 * 解析 SQL 行中的标签字段。
 */
const parseSqlTags = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown;

  return Array.isArray(parsed)
    ? parsed.filter((tag): tag is string => typeof tag === "string")
    : [];
};

/**
 * 将完整 SQL 人物行映射为工具返回项。
 */
const sqlRowToToolItem = (row: PeopleSqlRow): PeopleQueryToolItem =>
  toToolItem({
    id: row.id as string,
    avatar: "",
    name: row.name as string,
    gender: row.gender as string,
    relationship: row.relationship as PersonRelationship,
    status: row.status as string,
    birthday: row.birthday as string,
    contact: row.contact as string,
    tags: parseSqlTags(row.tags as string),
    details: typeof row.details === "string" ? row.details : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: row.updated_at as string,
  });

/**
 * 解析字符串字段。
 */
const parseString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * 解析 People 条件查询入参。
 */
const parseConditions = (value: unknown): PeopleQueryConditions | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    name: parseString(value.name),
    gender: parseString(value.gender),
    relationship: parseString(value.relationship) as
      | PersonRelationship
      | undefined,
    status: parseString(value.status),
    birthday: parseString(value.birthday),
    contact: parseString(value.contact),
    tag: parseString(value.tag),
    details: parseString(value.details),
    updatedAfter: parseString(value.updatedAfter),
    updatedBefore: parseString(value.updatedBefore),
  };
};

/**
 * 解析 People 工具入参。
 */
const parseInput = (input: unknown): PeopleQueryToolInput => {
  if (!isRecord(input)) {
    return {};
  }

  return {
    query: parseString(input.query),
    relationship: parseString(input.relationship) as
      | PersonRelationship
      | undefined,
    conditions: parseConditions(input.conditions),
    sql: parseString(input.sql),
    limit: typeof input.limit === "number" ? input.limit : undefined,
  };
};

/**
 * 解析字符串数组字段。
 */
const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/**
 * 解析完整人物资料输入。
 */
const parsePersonProfileInput = (
  input: Record<string, unknown>,
): AssociatedPersonCreateInput => ({
  avatar: parseString(input.avatar) ?? "",
  name: parseString(input.name) ?? "",
  gender: parseString(input.gender) ?? "",
  relationship: (parseString(input.relationship) ??
    "其他") as PersonRelationship,
  status: parseString(input.status) ?? "",
  birthday: parseString(input.birthday) ?? "",
  contact: parseString(input.contact) ?? "",
  tags: parseStringArray(input.tags),
  details: parseString(input.details) ?? "",
});

/**
 * 解析 People 新建入参。
 */
const parseCreateInput = (input: unknown): AssociatedPersonCreateInput => {
  if (!isRecord(input)) {
    throw new Error("People profile input must be an object");
  }

  return parsePersonProfileInput(input);
};

/**
 * 解析 People 更新入参。
 */
const parseUpdateInput = (
  input: unknown,
): { id: string; profile: AssociatedPersonUpdateInput } => {
  if (!isRecord(input)) {
    throw new Error("People update input must be an object");
  }

  const id = parseString(input.id)?.trim();
  if (!id) {
    throw new Error("People update requires id");
  }

  return {
    id,
    profile: parsePersonProfileInput(input),
  };
};

/**
 * 解析 People 删除入参。
 */
const parseDeleteInput = (input: unknown): { id: string } => {
  if (!isRecord(input)) {
    throw new Error("People delete input must be an object");
  }

  const id = parseString(input.id)?.trim();
  if (!id) {
    throw new Error("People delete requires id");
  }

  return { id };
};

/**
 * 转义 SQL 字符串字面量。
 */
const escapeSqlString = (value: string): string => value.replace(/'/g, "''");

/**
 * 转义 LIKE 查询字面量。
 */
const escapeSqlLike = (value: string): string =>
  escapeSqlString(
    value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_"),
  );

/**
 * 构造 LIKE 条件。
 */
const buildLikeCondition = (
  column: string,
  value: string | undefined,
): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return `${column} LIKE '%${escapeSqlLike(trimmed)}%' ESCAPE '\\'`;
};

/**
 * 构造相等条件。
 */
const buildEqualCondition = (
  column: string,
  value: string | undefined,
): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return `${column} = '${escapeSqlString(trimmed)}'`;
};

/**
 * 构造基础字段 query 条件。
 */
const buildBaseQueryCondition = (query: string | undefined): string | null => {
  const trimmed = query?.trim();
  if (!trimmed) {
    return null;
  }

  return `(${[
    "name",
    "gender",
    "relationship",
    "status",
    "birthday",
    "contact",
    "tags",
  ]
    .map((column) => buildLikeCondition(column, trimmed))
    .filter((condition): condition is string => Boolean(condition))
    .join(" OR ")})`;
};

/**
 * 构造结构化查询 WHERE 子句。
 */
const buildStructuredWhere = (
  parsed: PeopleQueryToolInput,
  queryTarget: "base" | "details",
): string => {
  const conditions = parsed.conditions;
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
  ].filter((condition): condition is string => Boolean(condition));

  return whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "";
};

/**
 * 将结构化查询编译为受控 SQL。
 */
const buildStructuredSql = (
  parsed: PeopleQueryToolInput,
  queryTarget: "base" | "details",
  limit: number,
): string => {
  const isSingleQuery = limit === 1;
  const shouldSelectDetails =
    isSingleQuery ||
    Boolean(parsed.conditions?.details) ||
    queryTarget === "details";
  const columns = shouldSelectDetails ? PEOPLE_COLUMNS : DEFAULT_PEOPLE_COLUMNS;

  return `SELECT ${columns} FROM ${PEOPLE_TABLE_NAME}${buildStructuredWhere(parsed, queryTarget)} ORDER BY updated_at DESC, created_at DESC`;
};

/**
 * 校验并限制 AI 生成的 People SQL。
 */
const preparePeopleSql = (sql: string, limit: number): string => {
  const normalizedSql = sql.trim();

  if (!normalizedSql) {
    throw new Error("People SQL cannot be empty");
  }

  if (normalizedSql.length > MAX_PEOPLE_SQL_LENGTH) {
    throw new Error("People SQL is too long");
  }

  if (normalizedSql.includes(";") || SQL_COMMENT_PATTERN.test(normalizedSql)) {
    throw new Error(
      "People SQL only allows a single SELECT statement without comments",
    );
  }

  if (!/^select\b/i.test(normalizedSql)) {
    throw new Error("People SQL only allows SELECT queries");
  }

  if (FORBIDDEN_SQL_PATTERN.test(normalizedSql)) {
    throw new Error("People SQL contains a forbidden keyword");
  }

  if (
    !new RegExp(`\\bfrom\\s+${PEOPLE_TABLE_NAME}\\b`, "i").test(normalizedSql)
  ) {
    throw new Error(`People SQL can only query the ${PEOPLE_TABLE_NAME} table`);
  }

  if (/\bfrom\s+(?!associated_people\b)[a-z_][\w]*/i.test(normalizedSql)) {
    throw new Error(`People SQL can only query the ${PEOPLE_TABLE_NAME} table`);
  }

  const hasLimit = /\blimit\s+\d+\b/i.test(normalizedSql);
  return hasLimit ? normalizedSql : `${normalizedSql} LIMIT ${limit}`;
};

/**
 * 执行受控 People SQL 查询。
 */
const queryBySql = (
  peopleService: Pick<PeopleService, "querySql">,
  sql: string,
  limit: number,
): { items: PeopleQueryToolItem[]; rows: unknown[] } => {
  const rows = peopleService
    .querySql(preparePeopleSql(sql, limit))
    .slice(0, limit);
  const items = rows.filter(isPersonSqlRow).map(sqlRowToToolItem);

  return {
    items,
    rows,
  };
};

/**
 * 渲染 SQL 查询观察文本。
 */
const renderSqlObservation = (rows: unknown[]): string => {
  if (rows.length === 0) {
    return "SQL query returned no rows.";
  }

  const rowLabel = rows.length === 1 ? "row" : "rows";
  return `SQL query returned ${rows.length} ${rowLabel}.`;
};

/**
 * 执行结构化 SQL 查询，必要时再兜底查询 details。
 */
const queryStructuredBySql = (
  peopleService: Pick<PeopleService, "querySql">,
  parsed: PeopleQueryToolInput,
  limit: number,
): { items: PeopleQueryToolItem[]; rows: unknown[] } => {
  const baseResult = queryBySql(
    peopleService,
    buildStructuredSql(parsed, "base", limit),
    limit,
  );
  if (
    baseResult.rows.length > 0 ||
    !parsed.query?.trim() ||
    parsed.conditions?.details
  ) {
    return baseResult;
  }

  return queryBySql(
    peopleService,
    buildStructuredSql(parsed, "details", limit),
    limit,
  );
};

/**
 * 创建 People 只读查询工具。
 */
export const createPeopleQueryTool = (
  peopleService: Pick<PeopleService, "querySql">,
): PeopleQueryTool => ({
  name: "people_tool.query",
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
            description:
              "Updated-at lower bound, in the same format as updated_at",
          },
          updatedBefore: {
            type: "string",
            description:
              "Updated-at upper bound, in the same format as updated_at",
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
    const parsed = parseInput(input);
    const limit = Math.max(
      1,
      Math.min(parsed.limit ?? DEFAULT_PEOPLE_LIMIT, MAX_PEOPLE_LIMIT),
    );
    const queryResult = parsed.sql
      ? queryBySql(peopleService, parsed.sql, limit)
      : queryStructuredBySql(peopleService, parsed, limit);
    const { items, rows } = queryResult;
    const observation = renderSqlObservation(rows);

    return {
      observation,
      data: {
        rows,
        items,
      },
      items,
      rows,
    };
  },
});

/**
 * 创建 People 新建工具。
 */
export const createPeopleAddTool = (
  peopleService: Pick<PeopleService, "create">,
): PeopleWriteTool => ({
  name: "people_tool.add",
  description: "Create a people profile in the local People table.",
  prompt: {
    summary: "Create a new profile in the local People table.",
    intentKeywords: [
      "添加",
      "新增",
      "创建",
      "记录",
      "恢复",
      "还原",
      "找回",
      "重新添加",
      "新建人物",
      "add person",
      "create person",
      "restore person",
    ],
    whenToUse: [
      "Use when the user explicitly asks to create or save a new people profile.",
      "Use common_tool.ask to ask for missing required facts when the create request is ambiguous or underspecified.",
    ],
    whenNotToUse: [
      "Do not use for read-only questions about existing people profiles.",
      "Do not use when the user has not asked to save data.",
    ],
    safety: [
      "Do not call common_tool.ask only to confirm creation; the system will request internal confirmation before execution.",
      "Only create structured people profiles through PeopleService.",
      "Use empty strings or an empty tags array for absent optional-looking fields.",
      "Write details as Markdown content, not plain unstructured fragments.",
      "Never invent profile facts the user did not provide or confirm.",
    ],
    output: "Return the created people profile facts needed by the user.",
    examples: [
      '{"name":"小陈","gender":"","relationship":"朋友","status":"","birthday":"","contact":"","tags":[],"details":"","avatar":""}',
    ],
  },
  parameters: {
    type: "object",
    required: PEOPLE_PROFILE_REQUIRED,
    properties: PEOPLE_PROFILE_PROPERTIES,
  },
  execute: async (input) => {
    const created = peopleService.create(parseCreateInput(input));

    return {
      observation: `Created people profile: ${created.name}.`,
      data: {
        item: toToolItem(created),
      },
    };
  },
});

/**
 * 创建 People 更新工具。
 */
export const createPeopleUpdateTool = (
  peopleService: Pick<PeopleService, "update">,
): PeopleWriteTool => ({
  name: "people_tool.update",
  description:
    "Update an existing people profile in the local People table by id.",
  prompt: {
    summary: "Update an existing profile in the local People table by id.",
    intentKeywords: [
      "修改",
      "更新",
      "改成",
      "纠正",
      "补充人物",
      "update person",
      "edit person",
    ],
    whenToUse: [
      "Use when the user explicitly asks to update an existing people profile.",
      "Use after people_tool.query when the user identifies a person by name or relationship instead of id, then update the resolved profile id.",
    ],
    whenNotToUse: [
      "Do not use for creating new people profiles.",
      "Do not use when the user only states a fact or preference and has not explicitly asked to update saved data.",
      "Do not use when the target profile id is unknown.",
    ],
    safety: [
      "Do not call common_tool.ask only to confirm updates; the system will request internal confirmation before execution.",
      "Require the profile id and a complete replacement profile.",
      "Query first when the user only provides a name, then merge unchanged fields before updating.",
      "Never overwrite fields with guesses.",
    ],
    output: "Return the updated people profile facts needed by the user.",
    examples: [
      '{"id":"person-1","name":"阿明","gender":"男","relationship":"朋友","status":"技术负责人","birthday":"09月11日","contact":"GitHub: aming-coder","tags":["极客"],"details":"# 阿明","avatar":""}',
    ],
  },
  parameters: {
    type: "object",
    required: ["id", ...PEOPLE_PROFILE_REQUIRED],
    properties: {
      id: {
        type: "string",
        description: "People profile id",
      },
      ...PEOPLE_PROFILE_PROPERTIES,
    },
  },
  execute: async (input) => {
    const parsed = parseUpdateInput(input);
    const updated = peopleService.update(parsed.id, parsed.profile);

    return {
      observation: `Updated people profile: ${updated.name}.`,
      data: {
        item: toToolItem(updated),
      },
    };
  },
});

/**
 * 创建 People 删除工具。
 */
export const createPeopleDeleteTool = (
  peopleService: Pick<PeopleService, "delete">,
): PeopleWriteTool => ({
  name: "people_tool.delete",
  description:
    "Delete an existing people profile from the local People table by id.",
  prompt: {
    summary: "Delete an existing profile from the local People table by id.",
    intentKeywords: [
      "删除",
      "移除",
      "删掉",
      "delete person",
      "remove person",
    ],
    whenToUse: [
      "Use when the user explicitly asks to delete a people profile.",
      "Use after people_tool.query when the user identifies a person by name or relationship instead of id, then delete the resolved profile id.",
    ],
    whenNotToUse: [
      "Do not use for temporary filtering or hiding.",
      "Do not use when the target profile id is unknown or ambiguous.",
    ],
    safety: [
      "Do not call common_tool.ask only to confirm deletion; the system will request internal confirmation before execution.",
      "Require the exact profile id.",
      "Ask the user for clarification before deleting when multiple profiles may match.",
    ],
    output: "Return a concise deletion confirmation.",
    examples: ['{"id":"person-1"}'],
  },
  parameters: {
    type: "object",
    required: ["id"],
    properties: {
      id: {
        type: "string",
        description: "People profile id",
      },
    },
  },
  execute: async (input) => {
    const parsed = parseDeleteInput(input);
    peopleService.delete(parsed.id);

    return {
      observation: `Deleted people profile: ${parsed.id}.`,
      data: {
        id: parsed.id,
      },
    };
  },
});

/**
 * 创建完整 People 工具组。
 */
export const createPeopleTools = (
  peopleService: Pick<
    PeopleService,
    "querySql" | "create" | "update" | "delete"
  >,
): AgentTool[] => [
  createPeopleQueryTool(peopleService),
  createPeopleAddTool(peopleService),
  createPeopleUpdateTool(peopleService),
  createPeopleDeleteTool(peopleService),
];
