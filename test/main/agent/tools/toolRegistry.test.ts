import { describe, expect, it } from 'vitest'
import { createAgentToolRegistry, prepareToolsForModel, selectToolsForTurn } from '@/agent/tools/toolRegistry'
import type { AgentTool } from '@/agent/types'
import type { NotesService } from '@/services/notesService'
import type { JournalsService } from '@/services/journalsService'
import type { PeopleService } from '@/services/peopleService'
import type { TodosService } from '@/services/todosService'
import type { SnippetsService } from '@/services/snippetsService'

// Notes 服务桩。
const notesService: Pick<NotesService, 'querySql' | 'create' | 'update' | 'delete'> = {
  querySql: () => [],
  create: (input) => ({
    id: 1,
    title: input.title,
    content: input.content,
    source: input.source,
    tags: input.tags,
    time: '2026-06-13 10:00',
    isCurated: false,
    clue: '可能关联主题「Markdown 新素材」'
  }),
  update: (id, input) => ({
    id,
    title: input.title,
    content: input.content,
    source: input.source,
    tags: input.tags,
    time: '2026-06-13 10:00',
    isCurated: false,
    clue: '可能关联主题「Markdown 新素材」'
  }),
  delete: () => undefined
}

// Journals 服务桩。
const journalsService: Pick<JournalsService, 'querySql' | 'save' | 'delete'> = {
  querySql: () => [],
  save: (input) => ({
    id: 1,
    entryDate: input.entryDate,
    content: input.content,
    createdAt: '2026-06-13 10:00',
    updatedAt: '2026-06-13 10:00'
  }),
  delete: () => undefined
}

// People 服务桩。
const peopleService: Pick<PeopleService, 'list' | 'querySql' | 'create' | 'update' | 'delete'> = {
  list: () => [],
  querySql: () => [],
  create: (input) => ({
    id: 'person-new',
    createdAt: '2026-06-03 10:00',
    updatedAt: '2026-06-03 10:00',
    ...input
  }),
  update: (id, input) => ({
    id,
    createdAt: '2026-06-03 09:00',
    updatedAt: '2026-06-03 10:00',
    ...input
  }),
  delete: () => undefined
}

// Todos 服务桩。
const todosService: Pick<TodosService, 'querySql' | 'create' | 'update' | 'delete'> = {
  querySql: () => [],
  create: (input) => ({
    id: 1,
    entryDate: input.entryDate,
    text: input.text,
    priority: input.priority,
    completed: false,
    sortOrder: 0,
    createdAt: '2026-06-10 10:00',
    updatedAt: '2026-06-10 10:00'
  }),
  update: (id, input) => ({
    id,
    entryDate: '2026-06-10',
    text: input.text,
    priority: input.priority,
    completed: input.completed ?? false,
    sortOrder: 0,
    createdAt: '2026-06-10 09:00',
    updatedAt: '2026-06-10 10:00'
  }),
  delete: () => undefined
}

// Snippets 服务桩。
const snippetsService: Pick<SnippetsService, 'querySql' | 'create' | 'update' | 'delete'> = {
  querySql: () => [],
  create: (input) => ({
    id: 1,
    entryDate: input.entryDate,
    title: input.title,
    content: input.content,
    tags: input.tags,
    time: '10:00',
    createdAt: '2026-06-10 10:00',
    updatedAt: '2026-06-10 10:00'
  }),
  update: (id, input) => ({
    id,
    entryDate: '2026-06-10',
    title: input.title,
    content: input.content,
    tags: input.tags,
    time: '10:00',
    createdAt: '2026-06-10 09:00',
    updatedAt: '2026-06-10 10:00'
  }),
  delete: () => undefined
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
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })

    expect(registry.ids()).toEqual([
      'common_tool_ask',
      'notes_tool_query',
      'notes_tool_add',
      'notes_tool_update',
      'notes_tool_delete',
      'notes_tool_batch_add',
      'notes_tool_batch_update',
      'notes_tool_batch_delete',
      'journals_tool_query',
      'journals_tool_add',
      'journals_tool_update',
      'journals_tool_delete',
      'journals_tool_batch_add',
      'journals_tool_batch_update',
      'journals_tool_batch_delete',
      'people_tool_query',
      'people_tool_add',
      'people_tool_update',
      'people_tool_delete',
      'people_tool_batch_add',
      'people_tool_batch_update',
      'people_tool_batch_delete',
      'todos_tool_query',
      'todos_tool_add',
      'todos_tool_update',
      'todos_tool_delete',
      'todos_tool_batch_add',
      'todos_tool_batch_update',
      'todos_tool_batch_delete',
      'snippets_tool_query',
      'snippets_tool_add',
      'snippets_tool_update',
      'snippets_tool_delete',
      'snippets_tool_batch_add',
      'snippets_tool_batch_update',
      'snippets_tool_batch_delete',
      'common_tool_time_now',
      'common_tool_date_offset'
    ])
    expect(registry.get('common_tool_ask')?.description).toContain('structured clarification')
    expect(registry.get('common_tool.explain')).toBeUndefined()
    expect(registry.get('notes_tool_query')?.description).toContain('Notes table')
    expect(registry.get('notes_tool_add')?.description).toContain('Create a note')
    expect(registry.get('notes_tool_update')?.description).toContain('Update an existing note')
    expect(registry.get('notes_tool_delete')?.description).toContain('Delete an existing note')
    expect(registry.get('journals_tool_query')?.description).toContain('Journals table')
    expect(registry.get('journals_tool_add')?.description).toContain('Create a new journal entry')
    expect(registry.get('journals_tool_update')?.description).toContain('Update an existing journal entry')
    expect(registry.get('journals_tool_delete')?.description).toContain('Delete an existing journal entry')
    expect(registry.get('people_tool_query')?.description).toContain('People table')
    expect(registry.get('people_tool_add')?.description).toContain('Create a people profile')
    expect(registry.get('people_tool_update')?.description).toContain('Update an existing people profile')
    expect(registry.get('people_tool_delete')?.description).toContain('Delete an existing people profile')
    expect(registry.get('common_tool_time_now')?.description).toContain('current date')
    expect(registry.get('common_tool_date_offset')?.description).toContain('date offsets')
    expect(registry.all()).toHaveLength(38)
  })

  it('拒绝重复工具名，避免模型调用歧义', () => {
    expect(() =>
      createAgentToolRegistry(
        {
          notesService,
          journalsService,
          peopleService,
          todosService,
          snippetsService
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

  it('people_tool_query 使用结构化 prompt 元数据', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })
    const peopleTool = registry.get('people_tool_query')
    const prepared = prepareToolsForModel(registry.all()).find((tool) => tool.name === 'people_tool_query')

    expect(peopleTool?.prompt?.summary).toContain('People table')
    expect(prepared?.description).toContain('When to use:')
    expect(prepared?.description).toContain('local People table')
    expect(prepared?.description).toContain('Markdown image syntax ![](...)')
  })

  it('common_tool_ask 使用结构化 prompt 并每轮常驻', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })
    const askTool = registry.get('common_tool_ask')
    const [prepared] = prepareToolsForModel([askTool!])

    expect(askTool?.prompt?.alwaysAvailable).toBe(true)
    expect(prepared.description).toContain('Capability: Ask the user structured clarification questions')
    expect(prepared.description).toContain('When to use:')
  })

  it('people 写入工具声明内部确认配置', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })
    const addTool = registry.get('people_tool_add')
    const updateTool = registry.get('people_tool_update')
    const deleteTool = registry.get('people_tool_delete')

    expect(addTool?.confirmation?.header).toBe('确认创建')
    expect(updateTool?.confirmation?.header).toBe('确认更新')
    expect(deleteTool?.confirmation?.header).toBe('确认删除')
  })

  it('注册工具默认对模型可见，普通闲聊不再硬过滤 People 工具', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '你好，今天聊点轻松的' }]).map((tool) => tool.name)).toEqual(
      registry.ids()
    )
  })

  it('注册工具默认对模型可见，当前时间工具无需关键词硬注入', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '现在几点？' }]).map((tool) => tool.name)).toEqual(registry.ids())
  })

  it('注册工具默认对模型可见，日期偏移工具无需关键词硬注入', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '明天是星期几？' }]).map((tool) => tool.name)).toEqual(registry.ids())
  })

  it('注册工具默认对模型可见，人物关系问题不再依赖硬过滤注入 query', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '阿明是谁，他和我什么关系？' }]).map((tool) => tool.name)).toEqual(
      registry.ids()
    )
  })

  it('注册工具默认对模型可见，亲密关系称谓不再依赖硬过滤注入 query', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '我女朋友喜欢吃什么？' }]).map((tool) => tool.name)).toEqual(
      registry.ids()
    )
  })

  it('注册工具默认对模型可见，人物写入工具不再依赖关键词注入', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '帮我添加一个朋友小陈' }]).map((tool) => tool.name)).toEqual(
      registry.ids()
    )
    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '把阿明的状态修改为技术负责人' }]).map((tool) => tool.name)).toEqual(
      registry.ids()
    )
    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '删除小陈这个人物资料' }]).map((tool) => tool.name)).toEqual(
      registry.ids()
    )
  })

  it('注册工具默认对模型可见，人物恢复不再依赖关键词注入 add', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
    })

    expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '恢复一下吧' }]).map((tool) => tool.name)).toEqual(registry.ids())
  })

  it('工具回灌后的后续轮仍保留完整注册工具面', () => {
    const registry = createAgentToolRegistry({
      notesService,
      journalsService,
      peopleService,
      todosService,
      snippetsService
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
          name: 'people_tool_query',
          content: '找到 1 位关联人物：阿明｜朋友｜技术狂热者'
        }
      ]).map((tool) => tool.name)
    ).toEqual(registry.ids())
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
