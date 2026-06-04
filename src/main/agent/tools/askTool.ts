import { createCompactUuid } from '../../id'
import type { AgentTool, AgentToolResult } from '../types'

// Ask 选项。
export type AskOption = {
  // 选项标签。
  label: string
  // 选项说明。
  description: string
}

// Ask 问题。
export type AskQuestion = {
  // 问题短标题。
  header: string
  // 需要用户回答的问题。
  question: string
  // 预设选项列表。
  options: AskOption[]
  // 是否允许多选。
  multiple?: boolean
  // 是否允许自定义输入。
  custom?: boolean
}

// Ask 工具入参。
type AskToolInput = {
  // Ask 用途，只允许澄清缺失信息。
  purpose: 'clarification'
  // 问题列表。
  questions: AskQuestion[]
}

// Ask 工具结构化数据。
export type AskRequestData = {
  // 工具数据类型。
  kind: 'ask_request'
  // Ask 请求唯一标识。
  id: string
  // 问题列表。
  questions: AskQuestion[]
}

// Ask 工具结果。
// Ask 回答。
export type AskAnswer = {
  // 问题文本。
  question: string
  // 回答列表。
  answers: string[]
}

// Ask 回答数据。
export type AskAnswerData = {
  // 工具数据类型。
  kind: 'ask_answer'
  // Ask 请求唯一标识。
  id: string
  // 回答列表。
  answers: AskAnswer[]
}

// Ask 工具结果。
type AskToolResult = AgentToolResult & {
  // Ask 工具结构化数据。
  data: AskRequestData
}

// 单次 ask 最大问题数。
const MAX_ASK_QUESTIONS = 3

// 单个问题最大选项数。
const MAX_ASK_OPTIONS = 4

// Ask 文本最大长度。
const MAX_ASK_TEXT_LENGTH = 160

// Ask 自定义选项值。
const CUSTOM_OPTION_LABEL = '自定义'

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 解析非空字符串。
 */
const parseRequiredText = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`Ask ${field} must be a string`)
  }

  const text = value.trim()
  if (!text) {
    throw new Error(`Ask ${field} cannot be empty`)
  }

  return text.slice(0, MAX_ASK_TEXT_LENGTH)
}

/**
 * 解析布尔值参数。
 */
const parseBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

/**
 * 解析 Ask 选项。
 */
const parseOption = (value: unknown, index: number): AskOption => {
  if (!isRecord(value)) {
    throw new Error(`Ask option ${index + 1} must be an object`)
  }

  return {
    label: parseRequiredText(value.label, `option ${index + 1}.label`),
    description: parseRequiredText(value.description, `option ${index + 1}.description`)
  }
}

/**
 * 解析 Ask 问题。
 */
const parseQuestion = (value: unknown, index: number): AskQuestion => {
  if (!isRecord(value)) {
    throw new Error(`Ask question ${index + 1} must be an object`)
  }

  if (!Array.isArray(value.options) || value.options.length === 0) {
    throw new Error(`Ask question ${index + 1} must include options`)
  }

  const options = value.options.slice(0, MAX_ASK_OPTIONS).map(parseOption)
  const custom = parseBoolean(value.custom) ?? true
  const normalizedOptions = custom
    ? options.filter((option) => option.label !== CUSTOM_OPTION_LABEL)
    : options

  return {
    header: parseRequiredText(value.header, `question ${index + 1}.header`),
    question: parseRequiredText(value.question, `question ${index + 1}.question`),
    options: normalizedOptions,
    multiple: parseBoolean(value.multiple) ?? false,
    custom
  }
}

/**
 * 解析 Ask 工具入参。
 */
const parseInput = (input: unknown): AskToolInput => {
  if (!isRecord(input)) {
    throw new Error('Ask input must be an object')
  }

  if (input.purpose !== 'clarification') {
    throw new Error('Ask purpose must be clarification')
  }

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new Error('Ask input must include at least one question')
  }

  return {
    purpose: 'clarification',
    questions: input.questions.slice(0, MAX_ASK_QUESTIONS).map(parseQuestion)
  }
}

/**
 * 创建 Ask 请求 ID。
 */
const createAskId = (): string => {
  return createCompactUuid()
}

/**
 * 判断值是否为 Ask 请求数据。
 */
export const isAskRequestData = (value: unknown): value is AskRequestData =>
  isRecord(value) &&
  value.kind === 'ask_request' &&
  typeof value.id === 'string' &&
  Array.isArray(value.questions)

/**
 * 将 Ask 回答格式化为模型观察文本。
 */
export const formatAskAnswerObservation = (data: AskAnswerData): string => {
  const formatted = data.answers
    .map((item) => `"${item.question}"="${item.answers.length > 0 ? item.answers.join(', ') : 'Unanswered'}"`)
    .join(', ')

  return `User has answered your clarification questions: ${formatted}. Continue the task using these answers.`
}

/**
 * 从请求和二维答案构造 Ask 回答数据。
 */
export const createAskAnswerData = (request: AskRequestData, answers: string[][]): AskAnswerData => ({
  kind: 'ask_answer',
  id: request.id,
  answers: request.questions.map((question, index) => ({
    question: question.question,
    answers: answers[index] ?? []
  }))
})

/**
 * 创建用户澄清工具。
 */
export const createAskTool = (): AgentTool => ({
  name: 'common_tool.ask',
  description: 'Ask the user structured clarification questions when critical information is missing.',
  prompt: {
    summary: 'Ask the user structured clarification questions when critical information is missing.',
    alwaysAvailable: true,
    whenToUse: [
      'Use when the task cannot continue safely because a required choice, constraint, scope, or preference is missing.',
      'Use when guessing would likely waste work, produce the wrong result, or touch the wrong data.',
      'Ask one to three concise questions. Prefer two or three strong options per question, with the recommended option first when there is a clear default.'
    ],
    whenNotToUse: [
      'Do not use for casual conversation, rhetorical questions, or information you can infer safely from context.',
      'Do not use when you can make a conservative local assumption and proceed.',
      'Do not use as a substitute for reading available project files, tool results, or prior conversation.',
      'Do not use to confirm People add, update, or delete operations; call the relevant People write tool directly and let the system handle internal confirmation.'
    ],
    safety: [
      'Only ask for the minimum information needed to unblock the current task.',
      'Never ask the user for secrets, passwords, API keys, private tokens, or full personal identifiers.',
      'Do not present more than three questions or four options per question.'
    ],
    output:
      'Return an ask_request with purpose="clarification". After the user answers, the answer is returned as this tool result; continue in the same assistant response and do not ask the same question again unless the answer is contradictory.',
    examples: [
      '{"purpose":"clarification","questions":[{"header":"Scope","question":"Which data source should I update?","options":[{"label":"Current project","description":"Only change files in the active workspace."},{"label":"Reference project","description":"Use the reference project as the source of truth."}],"custom":true}]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['purpose', 'questions'],
    properties: {
      purpose: {
        type: 'string',
        enum: ['clarification'],
        description: 'Must be "clarification". This tool is not a confirmation mechanism.'
      },
      questions: {
        type: 'array',
        description: 'One to three concise clarification questions.',
        items: {
          type: 'object',
          required: ['header', 'question', 'options'],
          properties: {
            header: {
              type: 'string',
              description: 'Short label for this question.'
            },
            question: {
              type: 'string',
              description: 'The exact question to show to the user.'
            },
            options: {
              type: 'array',
              description: 'Two or three preferred answers. Four is the hard maximum.',
              items: {
                type: 'object',
                required: ['label', 'description'],
                properties: {
                  label: {
                    type: 'string',
                    description: 'Short option label.'
                  },
                  description: {
                    type: 'string',
                    description: 'One sentence explaining the impact or tradeoff.'
                  }
                }
              }
            },
            multiple: {
              type: 'boolean',
              description: 'Whether the user may choose multiple options.'
            },
            custom: {
              type: 'boolean',
              description: 'Whether the user may provide a custom answer. Defaults to true.'
            }
          }
        }
      }
    }
  },
  execute: async (input): Promise<AskToolResult> => {
    const parsed = parseInput(input)
    const questionLabel = parsed.questions.length === 1 ? 'question' : 'questions'

    return {
      observation: `Ask request created: waiting for the user to answer ${parsed.questions.length} ${questionLabel}.`,
      data: {
        kind: 'ask_request',
        id: createAskId(),
        questions: parsed.questions
      }
    }
  }
})
