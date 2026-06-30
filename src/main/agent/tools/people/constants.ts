// People 工具默认返回数量。
export const DEFAULT_PEOPLE_LIMIT = 8;

// People 工具最大返回数量。
export const MAX_PEOPLE_LIMIT = 20;

// People SQL 最大长度。
export const MAX_PEOPLE_SQL_LENGTH = 1200;

// People 查询表名。
export const PEOPLE_TABLE_NAME = "associated_people";

// People 查询字段清单。
export const PEOPLE_COLUMNS =
  "external_id AS id, avatar, name, gender, relationship, status, birthday, contact, tags, details, created_at, updated_at";

// People 关系枚举 Schema。
export const PEOPLE_RELATIONSHIP_SCHEMA = {
  type: "string",
  enum: ["女朋友", "家人", "朋友", "同事", "其他"],
  description: "Relationship category",
};

// People 完整资料字段 Schema。
export const PEOPLE_PROFILE_PROPERTIES = {
  confirmationSummary: {
    type: "string",
    description:
      "Concise Markdown Chinese explanation shown above the internal confirmation. Include key add/update/delete facts: target name/relationship and important fields or facts being created, changed, or removed. Avoid generic text like only 'will update' or profile ids unless no readable target is available.",
  },
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
export const PEOPLE_PROFILE_REQUIRED = [
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
export const DEFAULT_PEOPLE_COLUMNS =
  "external_id AS id, avatar, name, gender, relationship, status, birthday, contact, tags, created_at, updated_at";

// 禁止 AI SQL 使用的高风险关键字。
export const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union|join)\b/i;

// SQL 注释片段。
export const SQL_COMMENT_PATTERN = /--|\/\*|\*\//;
