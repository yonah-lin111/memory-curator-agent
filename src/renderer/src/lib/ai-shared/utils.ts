import {
  CURATOR_INPUT_COMMANDS,
  PROMPT_HISTORY_LIMIT,
  SUPPORTED_TEXT_MIME_TYPES,
} from "@/lib/ai-shared/constants"
import type {
  AgentMentionPanelState,
  CuratorInputCommand,
  FileMentionDeletionRange,
} from "@/lib/ai-shared/types"

// 文件提及 token 匹配表达式：查找所有类似于 @path/to/file.ts 的字符串
export const FILE_MENTION_PATTERN = /(^|\s)(@[^\s]+)(?=$|\s)/g

/**
 * 判断输入文本是否处在斜杠命令模式。
 *
 * @param value 输入的文本内容
 * @returns 是否为斜杠命令
 */
export const isCommandInput = (value: string): boolean => value.startsWith("/")

/**
 * 使用子序列规则做命令模糊匹配，支持 /ce 命中 /clear。
 *
 * @param query 用户输入的查询
 * @param keyword 待匹配的关键词
 * @returns 是否模糊匹配成功
 */
export const isFuzzyCommandMatch = (query: string, keyword: string): boolean => {
  if (!query) {
    return true
  }

  let queryIndex = 0

  for (const character of keyword) {
    if (character === query[queryIndex]) {
      queryIndex += 1
    }

    if (queryIndex === query.length) {
      return true
    }
  }

  return false
}

/**
 * 获取当前输入可匹配的命令列表。
 *
 * @param value 输入的文本内容
 * @returns 匹配到的命令列表
 */
export const getMatchedCommands = (value: string): CuratorInputCommand[] => {
  if (!isCommandInput(value)) {
    return []
  }

  const normalizedValue = value.trim().toLowerCase()
  const normalizedQuery = normalizedValue.startsWith("/")
    ? normalizedValue.slice(1)
    : normalizedValue

  return CURATOR_INPUT_COMMANDS.filter((command) =>
    [command.name, ...command.aliases].some((keyword) =>
      isFuzzyCommandMatch(normalizedQuery, keyword.toLowerCase().replace(/^\//, "")),
    ),
  )
}

/**
 * 合并一条提示词历史，旧项在前，新项在后。
 *
 * @param history 现有的提示词历史列表
 * @param prompt 新的提示词内容
 * @returns 合并限制数量后的新历史列表
 */
export const mergePromptHistory = (history: string[], prompt: string): string[] => {
  const normalizedPrompt = prompt.trim()

  if (!normalizedPrompt) {
    return history
  }

  return [...history.filter((item) => item !== normalizedPrompt), normalizedPrompt].slice(
    -PROMPT_HISTORY_LIMIT,
  )
}

/**
 * 判断文本框光标是否折叠在指定位置。
 *
 * @param textarea 文本框 DOM 元素
 * @param position 指定的光标位置
 * @returns 是否在该位置
 */
export const isTextareaCursorAt = (textarea: HTMLTextAreaElement, position: number): boolean =>
  textarea.selectionStart === position && textarea.selectionEnd === position

/**
 * 解析当前光标是否处在 agent mention 查询区间。
 *
 * @param value 输入的文本内容
 * @param cursor 光标位置
 * @returns 解析出的面板状态或 null
 */
export const resolveAgentMentionPanelState = (
  value: string,
  cursor: number,
): AgentMentionPanelState | null => {
  if (isCommandInput(value)) {
    return null
  }

  const textBeforeCursor = value.slice(0, cursor)
  const lastAt = textBeforeCursor.lastIndexOf("@")
  if (lastAt < 0 || cursor <= lastAt) {
    return null
  }

  const previousCharacter = lastAt > 0 ? textBeforeCursor[lastAt - 1] : ""
  if (previousCharacter && !/\s/.test(previousCharacter)) {
    return null
  }

  const query = value.slice(lastAt + 1, cursor)
  if (/[\s\n]/.test(query)) {
    return null
  }

  return {
    start: lastAt,
    query,
  }
}

/**
 * 计算 @ 文件提及需要整块删除的范围。
 *
 * @param value 输入的文本内容
 * @param cursor 光标位置
 * @returns 删除范围或 null
 */
export const getFileMentionDeletionRange = (
  value: string,
  cursor: number,
): FileMentionDeletionRange | null => {
  const ranges: FileMentionDeletionRange[] = []
  FILE_MENTION_PATTERN.lastIndex = 0

  let match = FILE_MENTION_PATTERN.exec(value)
  while (match) {
    const prefix = match[1] ?? ""
    const token = match[2] ?? ""
    const start = match.index + prefix.length
    ranges.push({
      start,
      end: start + token.length,
    })
    match = FILE_MENTION_PATTERN.exec(value)
  }

  const directRange = ranges.find((range) => range.end === cursor)
  if (directRange) {
    // 1) 光标紧贴任意 @token 末尾（如 @historlist1|）时，普通 Backspace 必须遵循原生逐字删除，不能整段删除
    return null
  }

  // 2) 当光标位于该 @token 后一个或多个连续水平空白字符之后（如 @historlist1   |），普通 Backspace 应一次删除整块：@token 及其紧随的全部水平空白，光标回到 token 起点
  // 3) 仅支持空格、制表符等水平空白，绝不可吞换行
  const previousCharacter = value[cursor - 1]
  if (previousCharacter && /[ \t]/.test(previousCharacter)) {
    // 我们从 cursor - 1 开始向左搜索，跳过所有连续的水平空白字符
    let i = cursor - 1
    while (i >= 0 && /[ \t]/.test(value[i])) {
      i--
    }
    // 此时 i 停在非水平空白字符上，或者越界。我们看它是不是一个 token 的结尾
    const tokenEnd = i + 1
    const rangeBeforeSpaces = ranges.find((range) => range.end === tokenEnd)
    if (rangeBeforeSpaces) {
      return {
        start: rangeBeforeSpaces.start,
        end: cursor,
      }
    }
  }

  return null
}

/**
 * 判断文件是否为支持的文本类型。
 *
 * @param file 待校验的文件
 * @returns 是否为支持的文本文件
 */
export const isTextFile = (file: File): boolean => {
  if (SUPPORTED_TEXT_MIME_TYPES.has(file.type)) {
    return true
  }

  // MIME 回退时通过扩展名判断。
  const supportedExtensions = [
    ".txt",
    ".md",
    ".json",
    ".csv",
    ".log",
    ".xml",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".env",
    ".sh",
    ".bash",
    ".zsh",
    ".py",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".html",
    ".css",
    ".scss",
    ".less",
    ".sql",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".rs",
    ".go",
    ".rb",
    ".php",
    ".swift",
    ".kt",
    ".scala",
    ".r",
    ".lua",
    ".pl",
    ".pm",
    ".bat",
    ".ps1",
  ]

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()

  return supportedExtensions.includes(ext)
}
