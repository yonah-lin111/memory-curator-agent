import type { AgentMessage } from '../types'

// AI 对话 agent 标识。
export type AiChatAgentId = 'people' | 'todo' | 'snippets' | 'journal' | 'notes' | 'today'

// AI 对话 agent hint。
export type AiChatAgentHint = {
  // Agent 唯一标识。
  id: AiChatAgentId
  // 本轮 agent 优先级，数字越小越优先。
  priority: number
}

// Agent directive 配置。
type AiChatAgentDirectiveConfig = {
  // Agent 唯一标识。
  id: AiChatAgentId
  // 系统提示中展示的 token 名称。
  token: string
  // Agent 能力说明。
  description: string
  // 当前已可用的工具名。
  tools?: string[]
}

// Agent directive 配置表。
const AI_CHAT_AGENT_DIRECTIVE_CONFIGS: AiChatAgentDirectiveConfig[] = [
  {
    id: 'people',
    token: 'people_agent',
    description: 'Prefer People-related profile facts, relationship memory, and People tools first.',
    tools: ['people_tool.query', 'people_tool.add', 'people_tool.update', 'people_tool.delete']
  },
  {
    id: 'todo',
    token: 'todo_agent',
    description: 'Prefer Todo-related task, plan, and daily execution context first.'
  },
  {
    id: 'snippets',
    token: 'snippets_agent',
    description: 'Prefer Snippets-related idea, fragment, and capture context first.'
  },
  {
    id: 'journal',
    token: 'journal_agent',
    description: 'Prefer Journal-related diary, reflection, and review context first.'
  },
  {
    id: 'notes',
    token: 'notes_agent',
    description: 'Prefer Notes-related long-form knowledge and planning context first.'
  },
  {
    id: 'today',
    token: 'today_agent',
    description: 'Prefer Today-related daily input, current-day records, and short-term flow context first.'
  }
]

// Agent directive 配置索引。
const AI_CHAT_AGENT_DIRECTIVES_BY_ID = new Map(AI_CHAT_AGENT_DIRECTIVE_CONFIGS.map((config) => [config.id, config]))

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 判断字符串是否为支持的 agent 标识。
 */
export const isAiChatAgentId = (value: string): value is AiChatAgentId =>
  AI_CHAT_AGENT_DIRECTIVES_BY_ID.has(value as AiChatAgentId)

/**
 * 归一化渲染层传入的 agent hints。
 */
export const normalizeAiChatAgentHints = (value: unknown): AiChatAgentHint[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const candidates = value
    .flatMap((item): AiChatAgentHint[] => {
      if (!isRecord(item) || typeof item.id !== 'string' || !isAiChatAgentId(item.id)) {
        return []
      }

      if (typeof item.priority !== 'number' || !Number.isFinite(item.priority) || item.priority <= 0) {
        return []
      }

      return [
        {
          id: item.id,
          priority: item.priority
        }
      ]
    })
    .sort((a, b) => a.priority - b.priority)

  const seenAgentIds = new Set<AiChatAgentId>()
  const normalized: AiChatAgentHint[] = []

  for (const candidate of candidates) {
    if (seenAgentIds.has(candidate.id)) {
      continue
    }

    seenAgentIds.add(candidate.id)
    normalized.push({
      id: candidate.id,
      priority: normalized.length + 1
    })
  }

  return normalized
}

/**
 * 渲染单个 agent directive 行。
 */
const renderAgentDirectiveLine = (hint: AiChatAgentHint): string => {
  const config = AI_CHAT_AGENT_DIRECTIVES_BY_ID.get(hint.id)

  if (!config) {
    return ''
  }

  const toolText = config.tools?.length
    ? ` Current available tools: ${config.tools.join(', ')}.`
    : ' Current concrete tools may be unavailable; use matching context when relevant.'

  return `${hint.priority}. ${config.token}: ${config.description}${toolText}`
}

/**
 * 渲染本轮 agent 选择的可信系统提示。
 */
export const renderAiChatAgentDirective = (hints: unknown): string => {
  const normalizedHints = normalizeAiChatAgentHints(hints)

  if (normalizedHints.length === 0) {
    return ''
  }

  return [
    'Agent selection directive:',
    'The user selected these agent priorities for this turn:',
    ...normalizedHints.map(renderAgentDirectiveLine).filter(Boolean),
    'Rules:',
    '- Prefer selected agents in priority order when they are relevant to the user message.',
    '- If a selected agent has no relevant capability or data, use other available tools and context instead.',
    '- Do not force unrelated tools.'
  ].join('\n')
}

/**
 * 把 agent directive 追加到可信 system message。
 */
export const appendAiChatAgentDirectiveToSystemMessage = (
  systemMessage: AgentMessage,
  hints: unknown
): AgentMessage => {
  const directive = renderAiChatAgentDirective(hints)

  if (!directive) {
    return systemMessage
  }

  return {
    ...systemMessage,
    content: `${systemMessage.content}\n${directive}`
  }
}
