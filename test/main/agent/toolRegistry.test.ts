import { describe, expect, it } from 'vitest'
import { createAgentToolRegistry, prepareToolsForModel, selectToolsForTurn } from '../../../src/main/agent/toolRegistry'
import type { AgentTool } from '../../../src/main/agent/types'
import type { PeopleService } from '../../../src/main/services/peopleService'

// People 服务桩。
const peopleService: Pick<PeopleService, 'list'> = {
  list: () => []
}

// 创建测试工具。
const createTestTool = (name: string): AgentTool => ({
  name,
  description: `${name} 工具`,
  parameters: {
    type: 'object',
    properties: {}
  },
  execute: async () => ({
    observation: 'ok',
    data: null
  })
})

describe('toolRegistry', () => {
  it('集中注册内置工具并支持按名称读取', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(registry.ids()).toEqual(['people_list'])
    expect(registry.get('people_list')?.description).toContain('People 表')
    expect(registry.all()).toHaveLength(1)
  })

  it('拒绝重复工具名，避免模型调用歧义', () => {
    expect(() =>
      createAgentToolRegistry(
        {
          peopleService
        },
        [() => createTestTool('same_tool'), () => createTestTool('same_tool')]
      )
    ).toThrow('重复注册 Agent 工具：same_tool')
  })

  it('为模型准备工具说明并保留原始工具不变', () => {
    const tool = createTestTool('query_memory')
    const [prepared] = prepareToolsForModel([tool])

    expect(tool.description).toBe('query_memory 工具')
    expect(prepared.description).toContain('query_memory 工具')
    expect(prepared.description).toContain('严格按参数 Schema 提供参数')
  })

  it('优先用结构化 prompt 统一渲染工具说明', () => {
    const [prepared] = prepareToolsForModel([
      {
        ...createTestTool('query_memory'),
        prompt: {
          summary: '查询本地记忆。',
          whenToUse: ['用户询问已保存记忆时使用。'],
          whenNotToUse: ['用户只是闲聊时不要使用。'],
          safety: ['只读，不写入数据。'],
          output: '返回简短观察文本。',
          intentKeywords: ['记忆']
        }
      }
    ])

    expect(prepared.description).toContain('能力：查询本地记忆。')
    expect(prepared.description).toContain('使用时机：')
    expect(prepared.description).toContain('- 用户询问已保存记忆时使用。')
    expect(prepared.description).toContain('不要使用：')
    expect(prepared.description).toContain('- 用户只是闲聊时不要使用。')
    expect(prepared.description).toContain('安全边界：')
    expect(prepared.description).toContain('- 只读，不写入数据。')
    expect(prepared.description).toContain('输出要求：返回简短观察文本。')
  })

  it('people_list 使用结构化 prompt 元数据', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })
    const peopleTool = registry.get('people_list')
    const [prepared] = prepareToolsForModel(registry.all())

    expect(peopleTool?.prompt?.summary).toContain('People 表')
    expect(prepared.description).toContain('使用时机：')
    expect(prepared.description).toContain('本地 People 表')
  })

  it('根据用户意图筛选工具，普通闲聊不注入 people_list', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '你好，今天聊点轻松的' }])).toEqual([])
  })

  it('根据用户意图筛选工具，人物关系问题注入 people_list', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '阿明是谁，他和我什么关系？' }]).map((tool) => tool.name)).toEqual([
      'people_list'
    ])
  })

  it('根据亲密关系称谓筛选工具，女朋友偏好问题注入 people_list', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '我女朋友喜欢吃什么？' }]).map((tool) => tool.name)).toEqual([
      'people_list'
    ])
  })

  it('工具回灌后的后续轮保留可用工具，避免工具链被截断', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(
      selectToolsForTurn(registry.all(), [
        {
          role: 'user',
          content: '阿明是谁'
        },
        {
          role: 'tool',
          toolCallId: 'call-1',
          name: 'people_list',
          content: '找到 1 位关联人物：阿明｜朋友｜技术狂热者'
        }
      ]).map((tool) => tool.name)
    ).toEqual(['people_list'])
  })

  it('执行前统一校验工具入参，拒绝缺失必填字段', async () => {
    const [prepared] = prepareToolsForModel([
      {
        ...createTestTool('strict_tool'),
        parameters: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string'
            }
          }
        }
      }
    ])

    await expect(prepared.execute({})).rejects.toThrow('工具 strict_tool 参数无效：缺少必填字段 query')
  })

  it('执行前统一校验工具入参，拒绝字段类型错误', async () => {
    const [prepared] = prepareToolsForModel([
      {
        ...createTestTool('typed_tool'),
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number'
            }
          }
        }
      }
    ])

    await expect(prepared.execute({ limit: '20' })).rejects.toThrow('工具 typed_tool 参数无效：limit 必须是 number')
  })
})
