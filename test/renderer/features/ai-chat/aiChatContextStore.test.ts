import { beforeEach, describe, expect, it } from 'vitest'
import { useAiChatContextStore } from '@renderer/features/ai-chat/aiChatContextStore'

const item = {
  key: 'message:m1',
  sessionId: 's1',
  kind: 'message' as const,
  sourceId: 'm1',
  title: '用户消息',
  summary: '摘要',
  content: '内容',
  tokens: 1,
  createdAt: 1,
  meta: { role: 'user' }
}

describe('aiChatContextStore', () => {
  beforeEach(() => useAiChatContextStore.getState().resetAll())

  it('按会话隔离并按 key 去重', () => {
    const store = useAiChatContextStore.getState()
    store.addItem(item)
    store.addItem(item)
    store.addItem({ ...item, key: 'message:m2', sourceId: 'm2', sessionId: 's2' })

    expect(useAiChatContextStore.getState().getSessionItems('s1')).toHaveLength(1)
    expect(useAiChatContextStore.getState().getSessionItems('s2')).toHaveLength(1)
  })

  it('同步消息上下文时保留非消息上下文', () => {
    const store = useAiChatContextStore.getState()
    store.addItem({ ...item, kind: 'memory', key: 'memory:m1' })
    store.syncMessageItems('s1', [{ ...item, key: 'message:m2', sourceId: 'm2' }])

    const items = useAiChatContextStore.getState().getSessionItems('s1')
    expect(items.map((value) => value.key)).toEqual(['memory:m1', 'message:m2'])
  })

  it('支持删除和清空会话', () => {
    const store = useAiChatContextStore.getState()
    store.addItem(item)
    store.removeItem('s1', 'message:m1')
    expect(useAiChatContextStore.getState().getSessionItems('s1')).toHaveLength(0)

    store.addItem(item)
    store.clearSession('s1')
    expect(useAiChatContextStore.getState().getSessionItems('s1')).toHaveLength(0)
  })

  it('限制全局会话上下文缓存数量并保留最近会话', () => {
    const store = useAiChatContextStore.getState()

    for (let index = 1; index <= 21; index += 1) {
      store.addItem({
        ...item,
        key: `message:m${index}`,
        sourceId: `m${index}`,
        sessionId: `s${index}`,
        createdAt: index
      })
    }

    expect(useAiChatContextStore.getState().getSessionItems('s1')).toHaveLength(0)
    expect(useAiChatContextStore.getState().getSessionItems('s2')).toHaveLength(1)
    expect(Object.keys(useAiChatContextStore.getState().sessionItems)).toHaveLength(20)
  })
})
