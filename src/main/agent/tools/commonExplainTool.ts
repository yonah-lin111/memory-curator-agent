import type { AgentTool, AgentToolResult } from '../types'

// Explain 支持的写入动作。
export type ExplainAction = 'add' | 'update' | 'delete'

// Explain 支持的目标写入工具。
export type ExplainTargetTool = 'people_tool.add' | 'people_tool.update' | 'people_tool.delete'

// Explain 工具结构化数据。
export type ExplainToolData = {
  // 工具数据类型。
  kind: 'explain'
  // 即将调用的目标写入工具。
  targetTool: ExplainTargetTool
  // 即将执行的写入动作。
  action: ExplainAction
  // 展示给用户的 Markdown 简短说明。
  content: string
}

// Explain 工具输入。
type ExplainToolInput = {
  // 即将调用的目标写入工具。
  targetTool: ExplainTargetTool
  // 即将执行的写入动作。
  action: ExplainAction
  // 展示给用户的 Markdown 简短说明。
  content: string
}

// Explain 内容最大长度。
const MAX_EXPLAIN_CONTENT_LENGTH = 800

// 目标工具到写入动作的映射。
const TARGET_TOOL_ACTIONS: Record<ExplainTargetTool, ExplainAction> = {
  'people_tool.add': 'add',
  'people_tool.update': 'update',
  'people_tool.delete': 'delete'
}

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 判断字符串是否为 Explain 目标工具。
 */
const isExplainTargetTool = (value: string): value is ExplainTargetTool =>
  value === 'people_tool.add' || value === 'people_tool.update' || value === 'people_tool.delete'

/**
 * 判断字符串是否为 Explain 动作。
 */
const isExplainAction = (value: string): value is ExplainAction =>
  value === 'add' || value === 'update' || value === 'delete'

/**
 * 裁剪说明内容。
 */
const trimExplainContent = (content: string): string => content.trim().slice(0, MAX_EXPLAIN_CONTENT_LENGTH)

/**
 * 解析 Explain 工具入参。
 */
const parseInput = (input: unknown): ExplainToolInput => {
  if (!isRecord(input)) {
    throw new Error('Explain input must be an object')
  }

  if (typeof input.targetTool !== 'string' || !isExplainTargetTool(input.targetTool)) {
    throw new Error('Explain targetTool must be a supported write tool')
  }

  if (typeof input.action !== 'string' || !isExplainAction(input.action)) {
    throw new Error('Explain action must be add, update, or delete')
  }

  if (TARGET_TOOL_ACTIONS[input.targetTool] !== input.action) {
    throw new Error(`Explain action ${input.action} does not match ${input.targetTool}`)
  }

  if (typeof input.content !== 'string') {
    throw new Error('Explain content must be a string')
  }

  const content = trimExplainContent(input.content)
  if (!content) {
    throw new Error('Explain content cannot be empty')
  }

  return {
    targetTool: input.targetTool,
    action: input.action,
    content
  }
}

/**
 * 判断值是否为 Explain 工具数据。
 */
export const isExplainToolData = (value: unknown): value is ExplainToolData =>
  isRecord(value) &&
  value.kind === 'explain' &&
  typeof value.targetTool === 'string' &&
  isExplainTargetTool(value.targetTool) &&
  typeof value.action === 'string' &&
  isExplainAction(value.action) &&
  typeof value.content === 'string' &&
  value.content.trim().length > 0

/**
 * 创建写入前说明工具。
 */
export const createExplainTool = (): AgentTool => ({
  name: 'common_tool.explain',
  description: 'Explain the pending write operation before add, update, or delete tools execute.',
  prompt: {
    summary: 'Explain the pending write operation before add, update, or delete tools execute.',
    alwaysAvailable: true,
    whenToUse: [
      'Use immediately before people_tool.add to summarize the profile that will be created.',
      'Use immediately before people_tool.update to summarize the target person and fields that will be saved.',
      'Use immediately before people_tool.delete to summarize the person that will be deleted.',
      'If the target must be found first, call the read/query tool first, then call common_tool.explain, then call the write tool.'
    ],
    whenNotToUse: [
      'Do not use before read-only tools, time tools, ordinary answers, or casual conversation.',
      'Do not use as a replacement for common_tool.ask when critical information is missing.',
      'Do not use as a replacement for the system write confirmation.'
    ],
    safety: [
      'Keep content concise and factual.',
      'Do not invent unknown profile fields.',
      'Mention enough identifying information for the user to understand the write target.'
    ],
    output: 'Return concise Markdown in content. Keep the explanation under 800 characters.'
  },
  parameters: {
    type: 'object',
    required: ['targetTool', 'action', 'content'],
    properties: {
      targetTool: {
        type: 'string',
        enum: ['people_tool.add', 'people_tool.update', 'people_tool.delete'],
        description: 'The write tool that will be called immediately after this explanation.'
      },
      action: {
        type: 'string',
        enum: ['add', 'update', 'delete'],
        description: 'The write action being explained.'
      },
      content: {
        type: 'string',
        description: 'Concise Markdown explanation shown to the user before the write tool runs.'
      }
    }
  },
  execute: async (input): Promise<AgentToolResult> => {
    const parsed = parseInput(input)

    return {
      observation: parsed.content,
      data: {
        kind: 'explain',
        ...parsed
      }
    }
  }
})
