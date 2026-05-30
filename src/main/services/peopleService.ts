import { randomUUID } from 'node:crypto'
import type {
  AssociatedPersonCreateInput,
  AssociatedPersonItem,
  AssociatedPersonRow,
  AssociatedPersonUpdateInput,
  PersonRelationship
} from '../db/schema'

// 数据库语句接口。
export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => unknown
}

// People 服务依赖的最小数据库接口。
export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
}

// People 服务方法集合。
export type PeopleService = {
  // 读取全部关联人物。
  list: () => AssociatedPersonItem[]
  // 执行只读人物 SQL 查询并返回原始行。
  querySql: (sql: string) => unknown[]
  // 创建关联人物。
  create: (input: AssociatedPersonCreateInput) => AssociatedPersonItem
  // 更新关联人物。
  update: (id: string, input: AssociatedPersonUpdateInput) => AssociatedPersonItem
  // 删除关联人物。
  delete: (id: string) => void
}

// 合法人物关系集合。
const PERSON_RELATIONSHIPS: PersonRelationship[] = ['女朋友', '家人', '朋友', '同事', '其他']

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
 * 校验人物输入。
 */
const validatePersonInput = (
  input: AssociatedPersonCreateInput | AssociatedPersonUpdateInput
): void => {
  if (!input.name.trim()) {
    throw new Error('姓名不能为空')
  }

  if (!PERSON_RELATIONSHIPS.includes(input.relationship)) {
    throw new Error('人物关系分类不正确')
  }

  if (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error('人物标签格式不正确')
  }
}

/**
 * 将数据库行映射为页面关联人物。
 */
const mapPersonRow = (row: AssociatedPersonRow): AssociatedPersonItem => ({
  id: row.id,
  avatar: row.avatar,
  name: row.name,
  gender: row.gender,
  relationship: row.relationship,
  status: row.status,
  birthday: row.birthday,
  contact: row.contact,
  tags: parseStoredTags(row.tags),
  details: row.details,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

/**
 * 创建 People 服务。
 */
export const createPeopleService = (database: DatabaseConnection): PeopleService => ({
  list: () => {
    const rows = database
      .prepare(
        'SELECT id, avatar, name, gender, relationship, status, birthday, contact, tags, details, created_at, updated_at FROM associated_people ORDER BY updated_at DESC, created_at DESC'
      )
      .all() as AssociatedPersonRow[]

    return rows.map(mapPersonRow)
  },
  querySql: (sql) => {
    return database.prepare(sql).all()
  },
  create: (input) => {
    validatePersonInput(input)

    const timestamp = createTimestamp()
    const id = randomUUID()

    database
      .prepare(
        'INSERT INTO associated_people (id, avatar, name, gender, relationship, status, birthday, contact, tags, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        input.avatar,
        input.name.trim(),
        input.gender.trim(),
        input.relationship,
        input.status.trim(),
        input.birthday.trim(),
        input.contact.trim(),
        JSON.stringify(input.tags),
        input.details,
        timestamp,
        timestamp
      )

    const row = database
      .prepare(
        'SELECT id, avatar, name, gender, relationship, status, birthday, contact, tags, details, created_at, updated_at FROM associated_people WHERE id = ?'
      )
      .get(id) as AssociatedPersonRow | undefined

    if (!row) {
      throw new Error('新建人物后读取失败')
    }

    return mapPersonRow(row)
  },
  update: (id, input) => {
    validatePersonInput(input)

    const existing = database
      .prepare(
        'SELECT id, avatar, name, gender, relationship, status, birthday, contact, tags, details, created_at, updated_at FROM associated_people WHERE id = ?'
      )
      .get(id) as AssociatedPersonRow | undefined

    if (!existing) {
      throw new Error('人物不存在')
    }

    const updatedAt = createTimestamp()
    database
      .prepare(
        'UPDATE associated_people SET avatar = ?, name = ?, gender = ?, relationship = ?, status = ?, birthday = ?, contact = ?, tags = ?, details = ?, updated_at = ? WHERE id = ?'
      )
      .run(
        input.avatar,
        input.name.trim(),
        input.gender.trim(),
        input.relationship,
        input.status.trim(),
        input.birthday.trim(),
        input.contact.trim(),
        JSON.stringify(input.tags),
        input.details,
        updatedAt,
        id
      )

    return mapPersonRow({
      ...existing,
      avatar: input.avatar,
      name: input.name.trim(),
      gender: input.gender.trim(),
      relationship: input.relationship,
      status: input.status.trim(),
      birthday: input.birthday.trim(),
      contact: input.contact.trim(),
      tags: JSON.stringify(input.tags),
      details: input.details,
      updated_at: updatedAt
    })
  },
  delete: (id) => {
    database.prepare('DELETE FROM associated_people WHERE id = ?').run(id)
  }
})
