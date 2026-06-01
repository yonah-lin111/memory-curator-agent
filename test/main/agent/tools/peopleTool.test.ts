import { describe, expect, it } from 'vitest'
import type { AssociatedPersonItem } from '../../../../src/main/db/schema'
import { createPeopleQueryTool } from '../../../../src/main/agent/tools/peopleTool'
import type { PeopleService } from '../../../../src/main/services/peopleService'

const people: AssociatedPersonItem[] = [
  {
    id: 'person-1',
    avatar: '',
    name: '阿明',
    gender: '男',
    relationship: '朋友',
    status: '技术狂热者',
    birthday: '09月11日',
    contact: 'GitHub: aming-coder',
    tags: ['极客', '开朗'],
    details: '# 阿明\n喜欢 TypeScript 和本地优先工具。',
    createdAt: '2026-05-01 10:00',
    updatedAt: '2026-05-02 10:00'
  },
  {
    id: 'person-2',
    avatar: '',
    name: '小周',
    gender: '女',
    relationship: '同事',
    status: '项目协作',
    birthday: '',
    contact: '微信',
    tags: ['产品'],
    details: '# 小周',
    createdAt: '2026-05-01 09:00',
    updatedAt: '2026-05-02 09:00'
  },
  {
    id: 'person-3',
    avatar: '',
    name: '小林',
    gender: '男',
    relationship: '朋友',
    status: 'TypeScript 同好',
    birthday: '',
    contact: '',
    tags: [],
    details: '# 小林\n不是本地优先工具的主要协作者。',
    createdAt: '2026-05-01 08:00',
    updatedAt: '2026-05-02 08:00'
  }
]

const toSqlRow = (person: AssociatedPersonItem, includeDetails = true): Record<string, unknown> => ({
  id: person.id,
  avatar: person.avatar,
  name: person.name,
  gender: person.gender,
  relationship: person.relationship,
  status: person.status,
  birthday: person.birthday,
  contact: person.contact,
  tags: JSON.stringify(person.tags),
  ...(includeDetails ? { details: person.details } : {}),
  created_at: person.createdAt,
  updated_at: person.updatedAt
})

const matchesBaseQuery = (person: AssociatedPersonItem, query: string): boolean =>
  [person.name, person.gender, person.relationship, person.status, person.birthday, person.contact, ...person.tags]
    .join('\n')
    .includes(query)

const peopleService: Pick<PeopleService, 'querySql'> = {
  querySql: (sql) => {
    if (sql.includes('COUNT(*)')) {
      return [{ count: people.length }]
    }

    if (sql.includes("relationship = '同事'")) {
      return people.filter((person) => person.relationship === '同事').map((person) => toSqlRow(person))
    }

    if (sql.includes('本地优先')) {
      if (!sql.includes('details LIKE')) {
        return []
      }

      return people
        .filter((person) => person.details.includes('本地优先工具'))
        .filter((person) => (sql.includes('极客') ? person.tags.includes('极客') : true))
        .map((person) => toSqlRow(person))
    }

    if (sql.includes('TypeScript')) {
      return people.filter((person) => matchesBaseQuery(person, 'TypeScript')).map((person) => toSqlRow(person, false))
    }

    return people.map((person) =>
      toSqlRow(person, !sql.startsWith('SELECT id, avatar, name, gender, relationship, status, birthday, contact, tags, created_at, updated_at'))
    )
  }
}

describe('peopleTool', () => {
  it('按 query 查询 people 表并返回观察文本', async () => {
    const tool = createPeopleQueryTool(peopleService)

    const result = await tool.execute({
      query: 'TypeScript'
    })

    expect(result.items.map((item) => item.name)).toEqual(['小林'])
    expect(result.items[0].details).toBe('')
    expect(result.observation).toBe('SQL 查询返回 1 行，结构化数据已回传。')
    expect(result.observation).not.toContain('小林')
  })

  it('query 基础字段无命中时才兜底查询 details', async () => {
    const tool = createPeopleQueryTool(peopleService)

    const result = await tool.execute({
      query: '本地优先工具'
    })

    expect(result.items.map((item) => item.name)).toEqual(['阿明', '小林'])
    expect(result.items[0].details).toContain('本地优先工具')
    expect(result.observation).toBe('SQL 查询返回 2 行，结构化数据已回传。')
    expect(result.observation).not.toContain('阿明')
  })

  it('返回完整详情，不截断查询内容', async () => {
    const tool = createPeopleQueryTool({
      ...peopleService,
      querySql: (sql) =>
        sql.includes('details LIKE')
          ? [
              toSqlRow({
                ...people[0],
                details: `# 阿明\n${'很长的详情内容。'.repeat(20)}`
              })
            ]
          : []
    })

    const result = await tool.execute({
      query: '很长的详情内容'
    })

    expect(result.items[0].details).toContain('很长的详情内容。'.repeat(20))
    expect(result.items[0].details).not.toContain('...')
  })

  it('支持关系过滤和 limit 限制', async () => {
    const tool = createPeopleQueryTool(peopleService)

    const result = await tool.execute({
      relationship: '同事',
      limit: 1
    })

    expect(result.items.map((item) => item.name)).toEqual(['小周'])
  })

  it('支持结构化条件查询', async () => {
    const tool = createPeopleQueryTool(peopleService)

    const result = await tool.execute({
      conditions: {
        relationship: '朋友',
        tag: '极客',
        details: '本地优先'
      }
    })

    expect(result.items.map((item) => item.name)).toEqual(['阿明'])
  })

  it('支持受控 SQL 条件查询', async () => {
    const tool = createPeopleQueryTool(peopleService)

    const result = await tool.execute({
      sql: "SELECT * FROM associated_people WHERE relationship = '同事' ORDER BY updated_at DESC",
      limit: 5
    })

    expect(result.items.map((item) => item.name)).toEqual(['小周'])
    expect(result.data).toMatchObject({
      rows: [
        expect.objectContaining({
          name: '小周'
        })
      ]
    })
  })

  it('支持受控 SQL 数量统计', async () => {
    const tool = createPeopleQueryTool(peopleService)

    const result = await tool.execute({
      sql: 'SELECT COUNT(*) AS count FROM associated_people',
      limit: 1
    })

    expect(result.items).toEqual([])
    expect(result.data).toEqual({
      rows: [{ count: 3 }],
      items: []
    })
    expect(result.observation).toBe('SQL 查询返回 1 行，结构化数据已回传。')
  })

  it('拒绝危险 SQL', async () => {
    const tool = createPeopleQueryTool(peopleService)

    await expect(
      tool.execute({
        sql: 'DROP TABLE associated_people'
      })
    ).rejects.toThrow('People SQL 只允许 SELECT 查询')
  })
})
