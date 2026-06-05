import { createCompactUuid } from '@/id'
import type { AskQuestion } from '@/agent/tools/askTool'

// 工具确认动作类型。
export type ToolConfirmationAction = 'confirm' | 'cancel'

// 工具确认完成提示渲染结果。
export type ToolConfirmationCompletionResult = {
  // 工具观察文本。
  observation: string
  // 工具结构化数据。
  data: unknown
}

// 工具确认完成提示配置。
export type ToolConfirmationCompletionConfig = {
  /**
   * 根据工具入参和执行结果生成完成提示。
   */
  renderMessage: (input: unknown, result: ToolConfirmationCompletionResult) => string | null
}

// 工具确认配置。
export type ToolConfirmationConfig = {
  // 确认面板标题。
  header: string
  // 确认问题基础文案。
  question: string
  // 确认按钮文案。
  confirm: string
  // 取消按钮文案。
  cancel: string
  // 确认按钮说明。
  confirmDescription?: string
  // 取消按钮说明。
  cancelDescription?: string
  // 是否允许用户自定义回答。
  custom?: boolean
  // 工具确认执行成功后的完成提示配置。
  completion?: ToolConfirmationCompletionConfig
  /**
   * 根据工具入参生成写入前说明。
   */
  renderSummary: (input: unknown) => string | null
  /**
   * 根据工具入参生成确认问题中的目标名称。
   */
  renderTarget?: (input: unknown) => string | null
}

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
  // 写入前说明。
  summary?: string
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
  question: AskQuestion,
  summary?: string
): ToolConfirmationRequestData => ({
  kind: 'tool_confirmation_request',
  id: createCompactUuid(),
  tool,
  input,
  ...(summary ? { summary } : {}),
  questions: [question]
})

/**
 * 根据工具确认配置创建确认请求。
 */
export const createConfiguredToolConfirmationRequestData = (
  tool: string,
  input: unknown,
  config: ToolConfirmationConfig
): ToolConfirmationRequestData => {
  const target = config.renderTarget?.(input)?.trim() || null
  const summary = config.renderSummary(input)?.trim() || undefined
  const question = target ? `${config.question}：${target}？` : `${config.question}？`

  return createToolConfirmationRequestData(
    tool,
    input,
    {
      header: config.header,
      question,
      options: [
        {
          label: config.confirm,
          description: config.confirmDescription ?? '执行该写入操作。'
        },
        {
          label: config.cancel,
          description: config.cancelDescription ?? '不执行该写入操作。'
        }
      ],
      custom: config.custom ?? false
    },
    summary
  )
}

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
  (value.summary === undefined || typeof value.summary === 'string') &&
  Array.isArray(value.questions)

/**
 * 判断值是否为工具确认回答数据。
 */
export const isToolConfirmationAnswerData = (value: unknown): value is ToolConfirmationAnswerData =>
  isRecord(value) &&
  value.kind === 'tool_confirmation_answer' &&
  typeof value.id === 'string' &&
  (value.action === 'confirm' || value.action === 'cancel')
