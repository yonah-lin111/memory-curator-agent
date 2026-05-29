import type { AssociatedPersonItem, PersonRelationship } from '../db/schema'
import type { PeopleService } from '../services/peopleService'
import type { AgentTool, PeopleListToolInput, PeopleListToolItem, PeopleListToolResult } from './types'

// People 查询工具类型。
type PeopleListTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 People 查询。
   */
  execute: (input: unknown) => Promise<PeopleListToolResult>
}

// People 工具默认返回数量。
const DEFAULT_PEOPLE_LIMIT = 8

// People 工具最大返回数量。
const MAX_PEOPLE_LIMIT = 20

/**
 * 判断人物是否命中搜索关键字。
 */
const matchesQuery = (person: AssociatedPersonItem, query: string): boolean => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  return [person.name, person.gender, person.relationship, person.status, person.birthday, person.contact, person.details, ...person.tags]
    .join('\n')
    .toLowerCase()
    .includes(normalizedQuery)
}

/**
 * 截断详情，避免工具观察污染上下文。
 */
const truncateDetails = (details: string): string => {
  const normalized = details.replace(/\s+/g, ' ').trim()
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized
}

/**
 * 将人物压缩为工具返回项。
 */
const toToolItem = (person: AssociatedPersonItem): PeopleListToolItem => ({
  id: person.id,
  name: person.name,
  gender: person.gender,
  relationship: person.relationship,
  status: person.status,
  birthday: person.birthday,
  contact: person.contact,
  tags: person.tags,
  details: truncateDetails(person.details),
  updatedAt: person.updatedAt
})

/**
 * 解析 People 工具入参。
 */
const parseInput = (input: unknown): PeopleListToolInput => {
  if (!input || typeof input !== 'object') {
    return {}
  }

  const record = input as Record<string, unknown>
  return {
    query: typeof record.query === 'string' ? record.query : undefined,
    relationship: typeof record.relationship === 'string' ? (record.relationship as PersonRelationship) : undefined,
    limit: typeof record.limit === 'number' ? record.limit : undefined
  }
}

/**
 * 创建 People 只读查询工具。
 */
export const createPeopleListTool = (peopleService: Pick<PeopleService, 'list'>): PeopleListTool => ({
  name: 'people_list',
  description: '查询本地 People 表中的关联人物档案，只读，不会修改数据。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '按姓名、状态、联系方式、标签或详情搜索的关键字'
      },
      relationship: {
        type: 'string',
        enum: ['女朋友', '家人', '朋友', '同事', '其他'],
        description: '关系分类过滤'
      },
      limit: {
        type: 'number',
        description: '最多返回数量'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseInput(input)
    const limit = Math.max(1, Math.min(parsed.limit ?? DEFAULT_PEOPLE_LIMIT, MAX_PEOPLE_LIMIT))
    const items = peopleService
      .list()
      .filter((person) => (parsed.relationship ? person.relationship === parsed.relationship : true))
      .filter((person) => matchesQuery(person, parsed.query ?? ''))
      .slice(0, limit)
      .map(toToolItem)
    const observation =
      items.length === 0
        ? '没有找到匹配的关联人物。'
        : `找到 ${items.length} 位关联人物：${items
            .map((item) => `${item.name}｜${item.relationship}｜${item.status || '无状态'}`)
            .join('；')}`

    return {
      observation,
      data: items,
      items
    }
  }
})
