import { describe, expect, it } from 'vitest'
import {
  appendAiChatAgentDirectiveToSystemMessage,
  normalizeAiChatAgentHints,
  renderAiChatAgentDirective
} from '@/agent/core/agentHints'

describe('agentHints', () => {
  it('只保留白名单 agent，按 priority 排序并去重', () => {
    expect(
      normalizeAiChatAgentHints([
        { id: 'todo', priority: 2 },
        { id: 'bills', priority: 1.5 },
        { id: 'people', priority: 1 },
        { id: 'people', priority: 3 },
        { id: 'unknown', priority: 4 },
        { id: 'notes', priority: Number.NaN }
      ])
    ).toEqual([
      { id: 'people', priority: 1 },
      { id: 'bills', priority: 2 },
      { id: 'todo', priority: 3 }
    ])
  })

  it('渲染包含 People 工具优先级的可信 system directive', () => {
    const directive = renderAiChatAgentDirective([
      { id: 'people', priority: 1 },
      { id: 'todo', priority: 2 }
    ])

    expect(directive).toContain('Agent selection directive')
    expect(directive).toContain('1. people_agent')
    expect(directive).toContain('people_tool_query')
    expect(directive).toContain('people_tool_add')
    expect(directive).toContain('2. todo_agent')
    expect(directive.indexOf('1. people_agent')).toBeLessThan(directive.indexOf('2. todo_agent'))
    expect(directive).toContain('Do not force unrelated tools')
  })

  it('渲染包含 Bills 工具优先级的可信 system directive', () => {
    const directive = renderAiChatAgentDirective([
      { id: 'bills', priority: 1 }
    ])

    expect(directive).toContain('1. bills_agent')
    expect(directive).toContain('bills_tool_list')
    expect(directive).toContain('bills_tool_summary')
  })

  it('没有 agent hint 时不修改 system message', () => {
    const systemMessage = {
      role: 'system' as const,
      content: 'base system prompt'
    }

    expect(appendAiChatAgentDirectiveToSystemMessage(systemMessage, [])).toBe(systemMessage)
    expect(renderAiChatAgentDirective([])).toBe('')
  })
})
