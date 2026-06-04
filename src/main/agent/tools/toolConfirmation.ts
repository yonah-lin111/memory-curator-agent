import { createCompactUuid } from '../../id'
import type { AskQuestion } from './askTool'

// 工具确认动作类型。
export type ToolConfirmationAction = 'confirm' | 'cancel'

// 工具确认请求数据。
export type ToolConfirmationRequestData = {
  // 工具数据类型。
  kind: 'tool_confirmation_request'
  // 确认请求唯一标识。
  id: string
  // 待确认工具名称。
  tool: string
  // 待确认工具输入。
  input: unknown
  // 确认问题。
  questions: AskQuestion[]
}

// 工具确认回答数据。
export type ToolConfirmationAnswerData = {
  // 工具数据类型。
  kind: 'tool_confirmation_answer'
  // 确认请求唯一标识。
  id: string
  // 用户确认动作。
  action: ToolConfirmationAction
}

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 创建工具确认请求数据。
 */
export const createToolConfirmationRequestData = (
  tool: string,
  input: unknown,
  question: AskQuestion
): ToolConfirmationRequestData => ({
  kind: 'tool_confirmation_request',
  id: createCompactUuid(),
  tool,
  input,
  questions: [question]
})

/**
 * 创建工具确认回答数据。
 */
export const createToolConfirmationAnswerData = (
  request: ToolConfirmationRequestData,
  action: ToolConfirmationAction
): ToolConfirmationAnswerData => ({
  kind: 'tool_confirmation_answer',
  id: request.id,
  action
})

/**
 * 判断值是否为工具确认请求数据。
 */
export const isToolConfirmationRequestData = (value: unknown): value is ToolConfirmationRequestData =>
  isRecord(value) &&
  value.kind === 'tool_confirmation_request' &&
  typeof value.id === 'string' &&
  typeof value.tool === 'string' &&
  Array.isArray(value.questions)

/**
 * 判断值是否为工具确认回答数据。
 */
export const isToolConfirmationAnswerData = (value: unknown): value is ToolConfirmationAnswerData =>
  isRecord(value) &&
  value.kind === 'tool_confirmation_answer' &&
  typeof value.id === 'string' &&
  (value.action === 'confirm' || value.action === 'cancel')
