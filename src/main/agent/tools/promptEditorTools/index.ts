import type { AgentTool, AgentToolResult } from '@/agent/types'

// 编辑器内容更新结果。
type PromptEditorResult = AgentToolResult & {
  data: {
    content: string
    operation: 'replace' | 'replace_lines' | 'delete_lines'
  }
}

/**
 * 创建提示词编辑器工具集。
 * 工具调用按同一 run 的顺序共享累计正文，避免并行基于旧快照计算。
 */
export const createPromptEditorTools = (content: string): AgentTool[] => {
  let currentContent = content
  const updateContent = (nextContent: string, operation: PromptEditorResult['data']['operation']): PromptEditorResult => {
    currentContent = nextContent
    return {
      observation: 'Prompt editor content updated.',
      data: { content: currentContent, operation },
    }
  }

  return [
    createReplaceTool(updateContent),
    createReplaceLinesTool(() => currentContent, updateContent),
    createDeleteLinesTool(() => currentContent, updateContent),
  ]
}

/**
 * 创建全文替换工具。
 */
const createReplaceTool = (
  updateContent: (content: string, operation: PromptEditorResult['data']['operation']) => PromptEditorResult,
): AgentTool => ({
  name: 'prompt_editor_replace',
  description: 'Replace the entire Prompt Design Markdown editor content. Supports multi-line Markdown.',
  prompt: {
    summary: 'Replace the complete Prompt Design Markdown document.',
    alwaysAvailable: true,
    whenToUse: ['Use when the user asks to rewrite, optimize, or replace the whole prompt.'],
    safety: ['Always include the complete desired Markdown content.'],
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

    return updateContent(input.content, 'replace')
  }
})


/**
 * 创建按行替换工具。
 */
const createReplaceLinesTool = (
  getCurrentContent: () => string,
  updateContent: (content: string, operation: PromptEditorResult['data']['operation']) => PromptEditorResult,
): AgentTool => ({
  name: 'prompt_editor_replace_lines',
  description: 'Replace an inclusive 1-based line range in the Prompt Design Markdown editor with multi-line Markdown.',
  prompt: {
    summary: 'Replace an inclusive 1-based line range in the current Prompt Design Markdown document.',
    alwaysAvailable: true,
    whenToUse: ['Use when the user requests replacing specific known lines while preserving the remaining content.'],
    safety: ['Line numbers are 1-based and inclusive. Content may be multi-line.'],
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
    const currentContent = getCurrentContent()
    const lines = getValidatedLineRange(currentContent, input.startLine, endLine)
    const content = [
      ...lines.slice(0, input.startLine - 1),
      input.content,
      ...lines.slice(endLine),
    ].join('\n')
    return updateContent(content, 'replace_lines')
  }
})

const createDeleteLinesTool = (
  getCurrentContent: () => string,
  updateContent: (content: string, operation: PromptEditorResult['data']['operation']) => PromptEditorResult,
): AgentTool => ({
  name: 'prompt_editor_delete_lines',
  description: 'Delete an inclusive 1-based line range from the Prompt Design Markdown editor.',
  prompt: {
    summary: 'Delete an inclusive 1-based line range from the current Prompt Design Markdown document.',
    alwaysAvailable: true,
    whenToUse: ['Use only when the user explicitly requests deletion of a known line range.'],
    safety: ['Line numbers are 1-based and inclusive.'],
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
    const currentContent = getCurrentContent()
    const lines = getValidatedLineRange(currentContent, input.startLine, endLine)
    const content = [...lines.slice(0, input.startLine - 1), ...lines.slice(endLine)].join('\n')
    return updateContent(content, 'delete_lines')
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
