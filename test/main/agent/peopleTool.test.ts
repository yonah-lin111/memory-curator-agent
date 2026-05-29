import { describe, expect, it } from 'vitest'
import type { AssociatedPersonItem } from '../../../src/main/db/schema'
import { createPeopleListTool } from '../../../src/main/agent/peopleTool'
import type { PeopleService } from '../../../src/main/services/peopleService'

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
  }
]

const peopleService: Pick<PeopleService, 'list'> = {
  list: () => people
}

describe('peopleTool', () => {
  it('按 query 查询 people 表并返回观察文本', async () => {
    const tool = createPeopleListTool(peopleService)

    const result = await tool.execute({
      query: 'TypeScript'
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('阿明')
    expect(result.observation).toContain('找到 1 位关联人物')
    expect(result.observation).toContain('阿明')
  })

  it('支持关系过滤和 limit 限制', async () => {
    const tool = createPeopleListTool(peopleService)

    const result = await tool.execute({
      relationship: '同事',
      limit: 1
    })

    expect(result.items.map((item) => item.name)).toEqual(['小周'])
  })
})
