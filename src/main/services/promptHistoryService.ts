import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPromptHistoryDir } from '@/paths'

// 提示词历史作用域。
export type PromptHistoryScope = 'curator' | 'prompt-design'

// 提示词历史文件名。
const PROMPT_HISTORY_FILE_NAMES: Record<PromptHistoryScope, string> = {
  curator: 'ai-chat-prompts.json',
  'prompt-design': 'prompt-design-ai-chat-prompts.json'
}

// 提示词历史最大保留数量。
const PROMPT_HISTORY_LIMIT = 100

// 提示词历史服务依赖。
type PromptHistoryServiceDeps = {
  // 提示词历史目录。
  historyDir?: string
  // 提示词历史所属输入区域。
  scope?: PromptHistoryScope
}

// 提示词历史文件结构。
type PromptHistoryFile = {
  // 文件格式版本。
  version: 1
  // 最近输入的提示词列表，旧项在前，新项在后。
  prompts: string[]
}

// 提示词历史服务实例。
export type PromptHistoryService = {
  // 读取历史提示词列表。
  list: () => Promise<string[]>
  // 保存一条历史提示词。
  add: (prompt: string) => Promise<string[]>
}

/**
 * 从未知 JSON 中解析有效提示词列表。
 */
const parsePromptHistory = (value: unknown): string[] => {
  if (!value || typeof value !== 'object' || !('prompts' in value)) {
    return []
  }

  const prompts = (value as { prompts?: unknown }).prompts

  if (!Array.isArray(prompts)) {
    return []
  }

  return prompts
    .filter((prompt): prompt is string => typeof prompt === 'string')
    .map((prompt) => prompt.trim())
    .filter(Boolean)
}

/**
 * 创建提示词历史服务。
 */
export const createPromptHistoryService = (
  deps: PromptHistoryServiceDeps = {}
): PromptHistoryService => {
  const historyDir = deps.historyDir ?? getPromptHistoryDir()
  const scope = deps.scope ?? 'curator'
  const historyPath = join(historyDir, PROMPT_HISTORY_FILE_NAMES[scope])

  /**
   * 读取历史文件，文件不存在或损坏时返回空历史。
   */
  const readHistory = async (): Promise<string[]> => {
    try {
      const content = await readFile(historyPath, 'utf8')
      return parsePromptHistory(JSON.parse(content))
    } catch {
      return []
    }
  }

  /**
   * 原子约束由单文件覆盖保证，调用方无需关心目录初始化。
   */
  const writeHistory = async (prompts: string[]): Promise<void> => {
    await mkdir(historyDir, { recursive: true })

    const payload: PromptHistoryFile = {
      version: 1,
      prompts
    }

    await writeFile(historyPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  }

  return {
    list: readHistory,
    add: async (prompt: string): Promise<string[]> => {
      const normalizedPrompt = prompt.trim()

      if (!normalizedPrompt) {
        return readHistory()
      }

      const existingPrompts = await readHistory()
      const nextPrompts = [
        ...existingPrompts.filter((item) => item !== normalizedPrompt),
        normalizedPrompt
      ].slice(-PROMPT_HISTORY_LIMIT)

      await writeHistory(nextPrompts)
      return nextPrompts
    }
  }
}
