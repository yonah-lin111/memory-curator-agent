import { describe, expect, it } from 'vitest'
import { createAgentToolRegistry, prepareToolsForModel } from '../../../src/main/agent/toolRegistry'
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
