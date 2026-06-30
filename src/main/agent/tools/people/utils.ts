import type {
  AssociatedPersonCreateInput,
  AssociatedPersonItem,
  PersonRelationship,
} from '@/db/schema';
import type { PeopleQueryToolItem } from '@/agent/types';
import type { PeopleSqlRow, PeopleWriteAction } from './types';

/**
 * 将人物压缩为工具返回项。
 */
export const toToolItem = (person: AssociatedPersonItem): PeopleQueryToolItem => ({
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
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * 判断 SQL 原始行是否包含完整人物字段。
 */
export const isPersonSqlRow = (value: unknown): value is PeopleSqlRow =>
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
export const parseSqlTags = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown;

  return Array.isArray(parsed)
    ? parsed.filter((tag): tag is string => typeof tag === "string")
    : [];
};

/**
 * 将完整 SQL 人物行映射为工具返回项。
 */
export const sqlRowToToolItem = (row: PeopleSqlRow): PeopleQueryToolItem =>
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
export const parseString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * 读取 People 写入输入中的非空字符串字段。
 */
export const getPeopleInputString = (input: unknown, key: string): string | null => {
  if (!isRecord(input)) {
    return null;
  }

  const value = parseString(input[key])?.trim();

  return value || null;
};

/**
 * 生成 People 写入目标名称。
 */
export const renderPeopleMutationTarget = (input: unknown): string | null =>
  getPeopleInputString(input, "name") ?? getPeopleInputString(input, "id");

/**
 * 生成 People 写入前确认说明。
 */
export const renderPeopleMutationSummary = (
  action: PeopleWriteAction,
  input: unknown,
): string | null => {
  const aiSummary = getPeopleInputString(input, "confirmationSummary");
  const name = getPeopleInputString(input, "name");
  const id = getPeopleInputString(input, "id");
  const relationship = getPeopleInputString(input, "relationship");
  const target = name ?? id;

  if (aiSummary) {
    return aiSummary;
  }

  if (!target) {
    return null;
  }

  if (action === "add") {
    const relationshipSuffix = relationship ? `（${relationship}）` : "";

    return `将创建人物档案：${target}${relationshipSuffix}。`;
  }

  if (action === "update") {
    return `将更新人物档案：${target}。`;
  }

  return `将删除人物档案：${target}。`;
};

/**
 * 读取 People 写入结果中的可读名称。
 */
export const getPeopleMutationResultName = (result: {
  data: unknown;
}): string | null => {
  const record = isRecord(result.data) ? result.data : {};
  const item = isRecord(record.item) ? record.item : null;

  return getPeopleInputString(item, "name");
};

/**
 * 生成 People 写入完成提示。
 */
export const renderPeopleMutationCompletion = (
  action: PeopleWriteAction,
  input: unknown,
  result: { data: unknown },
): string | null => {
  const prefixes: Record<PeopleWriteAction, string> = {
    add: "已添加人物资料",
    update: "已更新人物资料",
    delete: "已删除人物资料",
  };
  const target =
    getPeopleMutationResultName(result) ?? getPeopleInputString(input, "name");

  return target ? `${prefixes[action]}：${target}。` : `${prefixes[action]}。`;
};

/**
 * 解析字符串数组字段。
 */
export const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/**
 * 解析完整人物资料输入。
 */
export const parsePersonProfileInput = (
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
