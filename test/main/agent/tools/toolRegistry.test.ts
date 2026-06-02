import { describe, expect, it } from 'vitest'
import { createAgentToolRegistry, prepareToolsForModel, selectToolsForTurn } from '../../../../src/main/agent/tools/toolRegistry'
import type { AgentTool } from '../../../../src/main/agent/types'
import type { PeopleService } from '../../../../src/main/services/peopleService'

// People 服务桩。
const peopleService: Pick<PeopleService, 'list' | 'querySql'> = {
  list: () => [],
  querySql: () => []
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

    expect(registry.ids()).toEqual([
      'ask_user',
      'people_query',
      'common_time_now',
      'common_date_offset',
      'common_runtime_info'
    ])
    expect(registry.get('ask_user')?.description).toContain('structured clarification')
    expect(registry.get('people_query')?.description).toContain('People table')
    expect(registry.get('common_time_now')?.description).toContain('current date')
    expect(registry.get('common_date_offset')?.description).toContain('date offsets')
    expect(registry.get('common_runtime_info')?.description).toContain('runtime information')
    expect(registry.all()).toHaveLength(5)
  })

  it('拒绝重复工具名，避免模型调用歧义', () => {
    expect(() =>
      createAgentToolRegistry(
        {
          peopleService
        },
        [() => createTestTool('same_tool'), () => createTestTool('same_tool')]
      )
    ).toThrow('Duplicate Agent tool registration: same_tool')
  })

  it('为模型准备工具说明并保留原始工具不变', () => {
    const tool = createTestTool('query_memory')
    const [prepared] = prepareToolsForModel([tool])

    expect(tool.description).toBe('query_memory 工具')
    expect(prepared.description).toContain('query_memory 工具')
    expect(prepared.description).toContain('provide arguments strictly according to the parameter schema')
  })

  it('优先用结构化 prompt 统一渲染工具说明', () => {
    const [prepared] = prepareToolsForModel([
      {
        ...createTestTool('query_memory'),
        prompt: {
          summary: 'Query local memories.',
          whenToUse: ['Use when the user asks about saved memories.'],
          whenNotToUse: ['Do not use for casual chat.'],
          safety: ['Read-only; never writes data.'],
          output: 'Return a concise observation.',
          intentKeywords: ['记忆']
        }
      }
    ])

    expect(prepared.description).toContain('Capability: Query local memories.')
    expect(prepared.description).toContain('When to use:')
    expect(prepared.description).toContain('- Use when the user asks about saved memories.')
    expect(prepared.description).toContain('Do not use:')
    expect(prepared.description).toContain('- Do not use for casual chat.')
    expect(prepared.description).toContain('Safety boundaries:')
    expect(prepared.description).toContain('- Read-only; never writes data.')
    expect(prepared.description).toContain('Output requirements: Return a concise observation.')
  })

  it('people_query 使用结构化 prompt 元数据', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })
    const peopleTool = registry.get('people_query')
    const prepared = prepareToolsForModel(registry.all()).find((tool) => tool.name === 'people_query')

    expect(peopleTool?.prompt?.summary).toContain('People table')
    expect(prepared?.description).toContain('When to use:')
    expect(prepared?.description).toContain('local People table')
    expect(prepared?.description).toContain('Markdown image syntax ![](...)')
  })

  it('ask_user 使用结构化 prompt 并每轮常驻', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })
    const askTool = registry.get('ask_user')
    const [prepared] = prepareToolsForModel([askTool!])

    expect(askTool?.prompt?.alwaysAvailable).toBe(true)
    expect(prepared.description).toContain('Capability: Ask the user structured clarification questions')
    expect(prepared.description).toContain('When to use:')
  })

  it('根据用户意图筛选工具，普通闲聊不注入 people_query', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '你好，今天聊点轻松的' }]).map((tool) => tool.name)).toEqual([
      'ask_user'
    ])
  })

  it('根据当前时间意图筛选工具，注入 common_time_now', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '现在几点？' }]).map((tool) => tool.name)).toEqual([
      'ask_user',
      'common_time_now'
    ])
  })

  it('根据日期偏移意图筛选工具，注入 common_date_offset', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '明天是星期几？' }]).map((tool) => tool.name)).toEqual([
      'ask_user',
      'common_date_offset'
    ])
  })

  it('根据运行环境意图筛选工具，注入 common_runtime_info', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '当前系统信息是什么？' }]).map((tool) => tool.name)).toEqual([
      'ask_user',
      'common_runtime_info'
    ])
  })

  it('根据用户意图筛选工具，人物关系问题注入 people_query', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '阿明是谁，他和我什么关系？' }]).map((tool) => tool.name)).toEqual([
      'ask_user',
      'people_query'
    ])
  })

  it('根据亲密关系称谓筛选工具，女朋友偏好问题注入 people_query', () => {
    const registry = createAgentToolRegistry({
      peopleService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '我女朋友喜欢吃什么？' }]).map((tool) => tool.name)).toEqual([
      'ask_user',
      'people_query'
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
          name: 'people_query',
          content: '找到 1 位关联人物：阿明｜朋友｜技术狂热者'
        }
      ]).map((tool) => tool.name)
    ).toEqual(['ask_user', 'people_query', 'common_time_now', 'common_date_offset', 'common_runtime_info'])
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

    await expect(prepared.execute({})).rejects.toThrow('Invalid arguments for tool strict_tool: Missing required field query')
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

    await expect(prepared.execute({ limit: '20' })).rejects.toThrow('Invalid arguments for tool typed_tool: limit must be a number')
  })
})
