import { describe, expect, it, vi } from 'vitest'
import type { AiChatSession } from '@renderer/features/ai-chat/types'
import type { AiChatSessionAction } from '@renderer/features/ai-chat/core/aiChatSessionReducer'
import {
  deleteAiChatTurn,
  regenerateLatestAiChatAnswer,
  undoLastAiChatTurn
} from '@renderer/features/ai-chat/core/aiChatSessionCommands'

const createToast = () => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn()
})

const createDispatch = () => vi.fn<(action: AiChatSessionAction) => void>()

const createSession = (
  overrides: Partial<AiChatSession> = {}
): AiChatSession => ({
  id: 's1',
  title: '旧对话',
  time: '10:00',
  status: 'completed',
  messages: [
    {
      id: 'u1',
      role: 'user',
      content: '第一问',
      time: '10:00'
    },
    {
      id: 'a1',
      role: 'assistant',
      content: '处理中',
      answer: '第一答',
      time: '10:01'
    },
    {
      id: 'u2',
      role: 'user',
      content: '第二问',
      time: '10:02'
    },
    {
      id: 'a2',
      role: 'assistant',
      content: '处理中',
      answer: '第二答',
      time: '10:03'
    }
  ],
  ...overrides
})

describe('aiChatSessionCommands', () => {
  it('撤销最后一轮对话时使用本地 fallback 并回填原问题', async () => {
    const session = createSession()
    const dispatch = createDispatch()
    const toast = createToast()
    const removeRunMappingsByMessageIds = vi.fn()

    const result = await undoLastAiChatTurn({
      session,
      sessions: [session],
      activeId: session.id,
      removeRunMappingsByMessageIds,
      dispatch,
      toast
    })

    expect(result).toBe('第二问')
    expect(removeRunMappingsByMessageIds).toHaveBeenCalledWith(new Set(['u2', 'a2']))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'replace',
      session: expect.objectContaining({
        id: 's1',
        status: 'completed',
        messages: session.messages.slice(0, 2)
      })
    })
    expect(toast.success).toHaveBeenCalledWith('已撤销上一轮，对应问题已回填')
  })

  it('删除 QA 持久化失败时回滚会话列表', async () => {
    const session = createSession()
    const dispatch = createDispatch()
    const toast = createToast()
    const removeRunMappingsByMessageIds = vi.fn()

    await deleteAiChatTurn({
      messageId: 'a2',
      session,
      sessions: [session],
      activeId: session.id,
      deleteTurn: vi.fn().mockRejectedValue(new Error('db failed')),
      removeRunMappingsByMessageIds,
      dispatch,
      toast
    })

    expect(removeRunMappingsByMessageIds).toHaveBeenCalledWith(new Set(['u2', 'a2']))
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: 'replace',
      session: expect.objectContaining({
        messages: session.messages.slice(0, 2)
      })
    })
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'reset',
      sessions: [session],
      activeId: session.id
    })
    expect(toast.error).toHaveBeenCalledWith('删除 QA 失败')
  })

  it('运行中会话禁止删除 QA', async () => {
    const session = createSession({ status: 'running' })
    const dispatch = createDispatch()
    const toast = createToast()
    const removeRunMappingsByMessageIds = vi.fn()

    await deleteAiChatTurn({
      messageId: 'a2',
      session,
      sessions: [session],
      activeId: session.id,
      removeRunMappingsByMessageIds,
      dispatch,
      toast
    })

    expect(dispatch).not.toHaveBeenCalled()
    expect(removeRunMappingsByMessageIds).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith('AI 正在生成，不能删除 QA')
  })

  it('重新生成最新回答时先清理旧 QA 再重发原问题', async () => {
    const session = createSession()
    const dispatch = createDispatch()
    const toast = createToast()
    const removeRunMappingsByMessageIds = vi.fn()
    const startAiChatMessage = vi.fn()

    await regenerateLatestAiChatAnswer({
      session,
      sessions: [session],
      activeId: session.id,
      undoLastTurn: vi.fn().mockResolvedValue(null),
      removeRunMappingsByMessageIds,
      startAiChatMessage,
      dispatch,
      toast
    })

    const expectedCleanSession = expect.objectContaining({
      id: 's1',
      messages: session.messages.slice(0, 2)
    })
    const expectedCleanSessions = [expectedCleanSession]

    expect(removeRunMappingsByMessageIds).toHaveBeenCalledWith(new Set(['u2', 'a2']))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'reset',
      sessions: expectedCleanSessions,
      activeId: session.id
    })
    expect(startAiChatMessage).toHaveBeenCalledWith('第二问', 's1', expectedCleanSessions)
    expect(toast.success).toHaveBeenCalledWith('已重新生成回答')
  })
})
