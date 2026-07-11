import type { AgentTool, AgentToolResult } from '@/agent/types'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'

// 编辑器内容更新结果。
type PromptEditorResult = AgentToolResult & {
  data: {
    content: string
    operation: 'replace' | 'replace_lines' | 'delete_lines'
  }
}

/**
 * 创建提示词编辑器工具集。
 * 工具仅处理本轮快照，实际写入由渲染进程确认后完成。
 */
export const createPromptEditorTools = (content: string): AgentTool[] => [
  createReplaceTool(),
  createReplaceLinesTool(content),
  createDeleteLinesTool(content),
]

/**
 * 创建全文替换工具。
 */
const createReplaceTool = (): AgentTool => ({
  name: 'prompt_editor_replace',
  description: 'Replace the entire Prompt Design Markdown editor content. Supports multi-line Markdown.',
  confirmation: buildConfirmation('确认替换提示词', '确认用新内容替换全部提示词', '确认替换', '取消替换'),
  prompt: {
    summary: 'Replace the complete Prompt Design Markdown document.',
    alwaysAvailable: true,
    whenToUse: ['Use when the user asks to rewrite, optimize, or replace the whole prompt.'],
    safety: ['Always include the complete desired Markdown content. A confirmation is required before applying it.'],
    output: 'Put the complete replacement Markdown in content.'
  },
  parameters: {
    type: 'object',
    required: ['content'],
    properties: {
      content: {
        type: 'string',
        description: 'Complete replacement Markdown content. Multi-line content is supported.'
      }
    }
  },
  execute: async (input): Promise<PromptEditorResult> => {
    if (!isRecord(input) || typeof input.content !== 'string') {
      throw new Error('Prompt editor replacement requires content string')
    }

    return {
      observation: 'Prompt editor content replaced.',
      data: { content: input.content, operation: 'replace' }
    }
  }
})


/**
 * 创建按行替换工具。
 */
const createReplaceLinesTool = (currentContent: string): AgentTool => ({
  name: 'prompt_editor_replace_lines',
  description: 'Replace an inclusive 1-based line range in the Prompt Design Markdown editor with multi-line Markdown.',
  confirmation: buildConfirmation('确认替换提示词行', '确认替换指定提示词行', '确认替换', '取消替换'),
  prompt: {
    summary: 'Replace an inclusive 1-based line range in the current Prompt Design Markdown document.',
    alwaysAvailable: true,
    whenToUse: ['Use when the user requests replacing specific known lines while preserving the remaining content.'],
    safety: ['Line numbers are 1-based and inclusive. Content may be multi-line. A confirmation is required before applying the replacement.'],
    output: 'Provide startLine, optional endLine, and replacement content.'
  },
  parameters: {
    type: 'object',
    required: ['startLine', 'content'],
    properties: {
      startLine: { type: 'number', description: 'First line to replace, 1-based and inclusive.' },
      endLine: { type: 'number', description: 'Last line to replace, 1-based and inclusive. Defaults to startLine.' },
      content: { type: 'string', description: 'Replacement Markdown content. Multi-line content is supported.' }
    }
  },
  execute: async (input): Promise<PromptEditorResult> => {
    if (!isRecord(input) || !isPositiveInteger(input.startLine) || typeof input.content !== 'string') {
      throw new Error('Prompt editor line replacement requires startLine and content')
    }

    const endLine = input.endLine === undefined ? input.startLine : input.endLine
    if (!isPositiveInteger(endLine)) {
      throw new Error('Prompt editor line replacement requires a positive integer endLine')
    }
    const lines = getValidatedLineRange(currentContent, input.startLine, endLine)
    const content = [
      ...lines.slice(0, input.startLine - 1),
      input.content,
      ...lines.slice(endLine),
    ].join('\n')
    return {
      observation: `Replaced lines ${input.startLine}-${endLine}.`,
      data: { content, operation: 'replace_lines' }
    }
  }
})

const createDeleteLinesTool = (currentContent: string): AgentTool => ({
  name: 'prompt_editor_delete_lines',
  description: 'Delete an inclusive 1-based line range from the Prompt Design Markdown editor.',
  confirmation: buildConfirmation('确认删除提示词行', '确认删除指定提示词行', '确认删除', '取消删除'),
  prompt: {
    summary: 'Delete an inclusive 1-based line range from the current Prompt Design Markdown document.',
    alwaysAvailable: true,
    whenToUse: ['Use only when the user explicitly requests deletion of a known line range.'],
    safety: ['Line numbers are 1-based and inclusive. A confirmation is required before applying the deletion.'],
    output: 'Provide startLine and endLine.'
  },
  parameters: {
    type: 'object',
    required: ['startLine'],
    properties: {
      startLine: { type: 'number', description: 'First line to delete, 1-based and inclusive.' },
      endLine: { type: 'number', description: 'Last line to delete, 1-based and inclusive. Defaults to startLine.' }
    }
  },
  execute: async (input): Promise<PromptEditorResult> => {
    if (!isRecord(input) || !isPositiveInteger(input.startLine)) {
      throw new Error('Prompt editor line deletion requires a positive integer startLine')
    }

    const endLine = input.endLine === undefined ? input.startLine : input.endLine
    if (!isPositiveInteger(endLine)) {
      throw new Error('Prompt editor line deletion requires a positive integer endLine')
    }
    const lines = getValidatedLineRange(currentContent, input.startLine, endLine)
    const content = [...lines.slice(0, input.startLine - 1), ...lines.slice(endLine)].join('\n')
    return {
      observation: `Deleted lines ${input.startLine}-${endLine}.`,
      data: { content, operation: 'delete_lines' }
    }
  }
})

/**
 * 构造编辑器变更确认配置。
 */
const buildConfirmation = (
  header: string,
  question: string,
  confirm: string,
  cancel: string,
): ToolConfirmationConfig => ({
  header,
  question,
  confirm,
  cancel,
  renderSummary: (input) => {
    if (!isRecord(input)) return null
    if (typeof input.content === 'string' && isPositiveInteger(input.startLine)) {
      const endLine = isPositiveInteger(input.endLine) ? input.endLine : input.startLine
      return `将替换第 ${input.startLine}-${endLine} 行。`
    }
    if (typeof input.content === 'string') return '将替换 Markdown 编辑器的全部内容。'
    if (isPositiveInteger(input.startLine)) {
      const endLine = isPositiveInteger(input.endLine) ? input.endLine : input.startLine
      return `将删除第 ${input.startLine}-${endLine} 行。`
    }
    return null
  },
  completion: {
    renderMessage: (_, result) => result.observation
  }
})

/**
 * 校验并获取 1-based 行范围。
 */
const getValidatedLineRange = (
  currentContent: string,
  startLine: number,
  endLine: unknown,
): string[] => {
  if (!isPositiveInteger(endLine) || endLine < startLine) {
    throw new Error('Prompt editor line range requires endLine >= startLine')
  }

  const lines = currentContent.split('\n')
  if (startLine > lines.length || endLine > lines.length) {
    throw new Error(`Line range must be within 1-${lines.length}`)
  }
  return lines
}

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 判断值是否为正整数。
 */
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1
