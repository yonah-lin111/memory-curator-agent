import { describe, expect, it } from 'vitest'
import {
  AI_CHAT_AGENT_MENTION_OPTIONS,
  createAiChatSendPayload,
  getAiChatAgentMentionDeletionRange,
  getMatchedAiChatAgentMentions,
  parseAiChatAgentMentionText
} from '@/features/ai-chat/aiChatAgentMentions'

describe('aiChatAgentMentions', () => {
  it('声明 8 个内置 agent mention 选项', () => {
    expect(AI_CHAT_AGENT_MENTION_OPTIONS.map((option) => option.id)).toEqual([
      'people',
      'todo',
      'snippets',
      'journal',
      'notes',
      'today',
      'bills',
      'common'
    ])
    expect(AI_CHAT_AGENT_MENTION_OPTIONS.map((option) => option.token)).toEqual([
      '@people_agent',
      '@todo_agent',
      '@snippets_agent',
      '@journal_agent',
      '@notes_agent',
      '@today_agent',
      '@bills_agent',
      '@common_agent'
    ])
  })

  it('按完整 token 提取 agent 并剥离用户正文', () => {
    const parsed = parseAiChatAgentMentionText('@people_agent  查一下阿明 @todo_agent')

    expect(parsed.text).toBe('查一下阿明')
    expect(parsed.agents).toEqual([
      {
        id: 'people',
        token: '@people_agent',
        label: 'people',
        priority: 1
      },
      {
        id: 'todo',
        token: '@todo_agent',
        label: 'todo',
        priority: 2
      }
    ])
  })

  it('重复 token 只按首次出现生成优先级', () => {
    const parsed = parseAiChatAgentMentionText('@todo_agent 做计划 @people_agent @todo_agent')

    expect(parsed.text).toBe('做计划')
    expect(parsed.agents.map((agent) => `${agent.priority}:${agent.id}`)).toEqual(['1:todo', '2:people'])
  })

  it('不把邮箱和不完整 token 当成 agent', () => {
    const parsed = parseAiChatAgentMentionText('发到 a@people_agent.com，并看看 @people')

    expect(parsed.text).toBe('发到 a@people_agent.com，并看看 @people')
    expect(parsed.agents).toEqual([])
  })

  it('支持 agent 面板模糊匹配', () => {
    expect(getMatchedAiChatAgentMentions('').map((option) => option.id)).toHaveLength(8)
    expect(getMatchedAiChatAgentMentions('pe').map((option) => option.id)).toEqual(['people', 'snippets'])
    expect(getMatchedAiChatAgentMentions('peo').map((option) => option.id)).toEqual(['people'])
    expect(getMatchedAiChatAgentMentions('peo_').map((option) => option.id)).toEqual(['people'])
    expect(getMatchedAiChatAgentMentions('people_').map((option) => option.id)).toEqual(['people'])
    expect(getMatchedAiChatAgentMentions('people_agent').map((option) => option.id)).toEqual(['people'])
    expect(getMatchedAiChatAgentMentions('eo').map((option) => option.id)).toEqual(['people'])
    expect(getMatchedAiChatAgentMentions('ty').map((option) => option.id)).toEqual(['today'])
    expect(getMatchedAiChatAgentMentions('todo').map((option) => option.id)).toEqual(['todo'])
    expect(getMatchedAiChatAgentMentions('bi').map((option) => option.id)).toEqual(['bills'])
    expect(getMatchedAiChatAgentMentions('co').map((option) => option.id)).toEqual(['common'])
  })

  it('计算 Backspace 删除完整 token 的范围', () => {
    const value = '@people_agent 查阿明'

    expect(getAiChatAgentMentionDeletionRange(value, '@people_agent'.length)).toEqual({
      start: 0,
      end: '@people_agent'.length
    })
    expect(getAiChatAgentMentionDeletionRange(value, '@people_agent '.length)).toEqual({
      start: 0,
      end: '@people_agent '.length
    })
    expect(getAiChatAgentMentionDeletionRange(value, 3)).toBeNull()
  })

  it('创建发送 payload 时只保留干净正文和 agent 元数据', () => {
    expect(createAiChatSendPayload('@people_agent @todo_agent 查阿明')).toEqual({
      text: '查阿明',
      agents: [
        {
          id: 'people',
          token: '@people_agent',
          label: 'people',
          priority: 1
        },
        {
          id: 'todo',
          token: '@todo_agent',
          label: 'todo',
          priority: 2
        }
      ]
    })
  })
})
