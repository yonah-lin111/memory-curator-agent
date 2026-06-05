import { createPeopleTools } from '@/agent/tools/peopleTool'
import { createDateOffsetTool, createTimeNowTool } from '@/agent/tools/commonTimeTool'
import { createAskTool } from '@/agent/tools/askTool'
import type { AgentMessage, AgentTool, AgentToolPrompt, JsonSchema } from '@/agent/types'
import type { PeopleService } from '@/services/peopleService'

// Agent 工具注册上下文。
export type AgentToolRegistryContext = {
  // People 服务。
  peopleService: Pick<PeopleService, 'list' | 'querySql' | 'create' | 'update' | 'delete'>
}

// Agent 工具工厂。
export type AgentToolFactory = (context: AgentToolRegistryContext) => AgentTool | AgentTool[]

// Agent 工具注册表。
export type AgentToolRegistry = {
  /**
   * 获取所有已注册工具。
   */
  all: () => AgentTool[]
  /**
   * 获取所有已注册工具名。
   */
  ids: () => string[]
  /**
   * 按名称获取工具。
   */
  get: (name: string) => AgentTool | undefined
  /**
   * 获取给模型使用的工具定义。
   */
  forModel: (messages?: AgentMessage[]) => AgentTool[]
}

// 内置工具工厂列表。
const builtinToolFactories: AgentToolFactory[] = [
  () => createAskTool(),
  ({ peopleService }) => createPeopleTools(peopleService),
  () => createTimeNowTool(),
  () => createDateOffsetTool()
]

// 工具调用公共约束。
const TOOL_CALL_GUARD =
  'Call constraints: provide arguments strictly according to the parameter schema; call only when the capability is actually needed; never invent information that the tool did not return.'

/**
 * 校验工具名唯一性。
 */
const assertUniqueToolNames = (tools: AgentTool[]): void => {
  const seen = new Set<string>()

  for (const tool of tools) {
    if (seen.has(tool.name)) {
      throw new Error(`Duplicate Agent tool registration: ${tool.name}`)
    }

    seen.add(tool.name)
  }
}

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 格式化参数路径。
 */
const formatPath = (path: string): string => path || 'parameters'

/**
 * 校验枚举值。
 */
const validateEnum = (schema: JsonSchema, value: unknown, path: string): string | null => {
  if (!schema.enum || typeof value !== 'string') {
    return null
  }

  return schema.enum.includes(value) ? null : `${formatPath(path)} must be one of ${schema.enum.join(' / ')}`
}

/**
 * 按 JSON Schema 子集校验工具参数。
 */
const validateBySchema = (schema: JsonSchema, value: unknown, path = ''): string | null => {
  const enumError = validateEnum(schema, value, path)
  if (enumError) {
    return enumError
  }

  if (schema.type === 'object') {
    if (!isRecord(value)) {
      return `${formatPath(path)} must be an object`
    }

    for (const key of schema.required ?? []) {
      if (value[key] === undefined) {
        return `Missing required field ${path ? `${path}.${key}` : key}`
      }
    }

    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (value[key] !== undefined) {
        const error = validateBySchema(childSchema, value[key], path ? `${path}.${key}` : key)
        if (error) {
          return error
        }
      }
    }

    return null
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      return `${formatPath(path)} must be an array`
    }

    if (schema.items) {
      for (const [index, item] of value.entries()) {
        const error = validateBySchema(schema.items, item, `${formatPath(path)}[${index}]`)
        if (error) {
          return error
        }
      }
    }

    return null
  }

  if (schema.type === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? null : `${formatPath(path)} must be a number`
  }

  if (schema.type === 'string') {
    return typeof value === 'string' ? null : `${formatPath(path)} must be a string`
  }

  if (schema.type === 'boolean') {
    return typeof value === 'boolean' ? null : `${formatPath(path)} must be a boolean`
  }

  return null
}

/**
 * 校验工具参数。
 */
const assertValidToolInput = (tool: AgentTool, input: unknown): void => {
  const error = validateBySchema(tool.parameters, input)
  if (error) {
    throw new Error(`Invalid arguments for tool ${tool.name}: ${error}`)
  }
}

/**
 * 渲染列表段落。
 */
const renderListSection = (title: string, items: string[] | undefined): string[] => {
  if (!items?.length) {
    return []
  }

  return [`${title}:`, ...items.map((item) => `- ${item}`)]
}

/**
 * 渲染结构化工具提示词。
 */
const renderToolPrompt = (prompt: AgentToolPrompt): string =>
  [
    `Capability: ${prompt.summary}`,
    ...renderListSection('When to use', prompt.whenToUse),
    ...renderListSection('Do not use', prompt.whenNotToUse),
    ...renderListSection('Safety boundaries', prompt.safety),
    prompt.output ? `Output requirements: ${prompt.output}` : undefined,
    ...renderListSection('Examples', prompt.examples)
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

/**
 * 增强工具说明。
 */
const prepareDescription = (tool: AgentTool): string => {
  const description = tool.prompt ? renderToolPrompt(tool.prompt) : tool.description
  return description.includes(TOOL_CALL_GUARD) ? description : `${description}\n\n${TOOL_CALL_GUARD}`
}

/**
 * 返回本轮可见工具。
 */
export const selectToolsForTurn = (tools: AgentTool[], _messages: AgentMessage[]): AgentTool[] => {
  assertUniqueToolNames(tools)

  return [...tools]
}

/**
 * 准备给模型和执行层使用的工具定义。
 */
export const prepareToolsForModel = (tools: AgentTool[], messages?: AgentMessage[]): AgentTool[] => {
  assertUniqueToolNames(tools)

  const selectedTools = messages ? selectToolsForTurn(tools, messages) : tools

  return selectedTools.map((tool) => ({
    ...tool,
    description: prepareDescription(tool),
    execute: async (input) => {
      assertValidToolInput(tool, input)
      return tool.execute(input)
    }
  }))
}

/**
 * 创建 Agent 工具注册表。
 */
export const createAgentToolRegistry = (
  context: AgentToolRegistryContext,
  factories: AgentToolFactory[] = builtinToolFactories
): AgentToolRegistry => {
  const tools = factories.flatMap((factory) => factory(context))

  assertUniqueToolNames(tools)

  const toolsByName = new Map<string, AgentTool>(tools.map((tool) => [tool.name, tool]))

  return {
    all: () => [...tools],
    ids: () => tools.map((tool) => tool.name),
    get: (name) => toolsByName.get(name),
    forModel: (messages) => prepareToolsForModel(tools, messages)
  }
}
