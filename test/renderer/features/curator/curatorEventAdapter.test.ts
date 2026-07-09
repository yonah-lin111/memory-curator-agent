import { describe, expect, it, vi } from 'vitest'
import {
  createCuratorEventHandler,
  type CuratorRunMessageMapping
} from '@/features/curator/core/curatorEventAdapter'
import type { CuratorSessionStatus } from '@/features/curator/types'

// 事件适配器测试夹具。
type EventHandlerFixture = {
  // 运行映射引用。
  runMessageMapRef: { current: Map<string, CuratorRunMessageMapping> }
  // 更新消息回调。
  updateAiMessage: ReturnType<typeof vi.fn>
  // 更新会话状态回调。
  updateChatSessionStatus: ReturnType<typeof vi.fn>
  // 确认标题回调。
  confirmOptimisticTitle: ReturnType<typeof vi.fn>
  // 事件处理函数。
  handleEvent: ReturnType<typeof createCuratorEventHandler>
}

/**
 * 创建事件适配器测试夹具。
 */
const createFixture = (mapping: CuratorRunMessageMapping): EventHandlerFixture => {
  const runMessageMapRef = {
    current: new Map<string, CuratorRunMessageMapping>([['run-1', mapping]])
  }
  const textBufferRef = {
    current: new Map<string, string>()
  }
  const typewriterTimerRef = {
    current: new Map()
  }
  const updateAiMessage = vi.fn()
  const updateChatSessionStatus = vi.fn(
    (_sessionId: string, _status: CuratorSessionStatus) => undefined
  )
  const confirmOptimisticTitle = vi.fn()
  const handleEvent = createCuratorEventHandler({
    runMessageMapRef,
    textBufferRef,
    typewriterTimerRef,
    updateAiMessage,
    updateChatSessionStatus,
    confirmOptimisticTitle
  })

  return {
    runMessageMapRef,
    updateAiMessage,
    updateChatSessionStatus,
    confirmOptimisticTitle,
    handleEvent
  }
}

describe('createCuratorEventHandler', () => {
  it('标题事件先于完成事件到达时仍然更新会话完成状态', () => {
    const {
      runMessageMapRef,
      updateChatSessionStatus,
      confirmOptimisticTitle,
      handleEvent
    } = createFixture({
      sessionId: 's1',
      messageId: 'a1',
      optimisticTitle: '我的女朋友是谁',
      runState: 'running',
      titleState: 'pending'
    })

    handleEvent({
      type: 'session_title_updated',
      runId: 'run-1',
      sessionId: 's1',
      title: '关系人物查询'
    })
    handleEvent({
      type: 'done',
      runId: 'run-1',
      sessionId: 's1'
    })

    expect(confirmOptimisticTitle).toHaveBeenCalledWith(
      's1',
      '我的女朋友是谁',
      '关系人物查询'
    )
    expect(updateChatSessionStatus).toHaveBeenCalledWith('s1', 'completed')
    expect(runMessageMapRef.current.has('run-1')).toBe(false)
  })

  it('完成事件先于标题事件到达时保留映射直到标题确认', () => {
    const {
      runMessageMapRef,
      updateChatSessionStatus,
      confirmOptimisticTitle,
      handleEvent
    } = createFixture({
      sessionId: 's1',
      messageId: 'a1',
      optimisticTitle: '我的女朋友是谁',
      runState: 'running',
      titleState: 'pending'
    })

    handleEvent({
      type: 'done',
      runId: 'run-1',
      sessionId: 's1'
    })

    expect(updateChatSessionStatus).toHaveBeenCalledWith('s1', 'completed')
    expect(runMessageMapRef.current.has('run-1')).toBe(true)

    handleEvent({
      type: 'session_title_updated',
      runId: 'run-1',
      sessionId: 's1',
      title: '关系人物查询'
    })

    expect(confirmOptimisticTitle).toHaveBeenCalledWith(
      's1',
      '我的女朋友是谁',
      '关系人物查询'
    )
    expect(runMessageMapRef.current.has('run-1')).toBe(false)
  })

  it('无需标题生成的完成事件会立即清理 run 映射', () => {
    const { runMessageMapRef, updateChatSessionStatus, handleEvent } = createFixture({
      sessionId: 's1',
      messageId: 'a1',
      runState: 'running',
      titleState: 'not-required'
    })

    handleEvent({
      type: 'done',
      runId: 'run-1',
      sessionId: 's1'
    })

    expect(updateChatSessionStatus).toHaveBeenCalledWith('s1', 'completed')
    expect(runMessageMapRef.current.has('run-1')).toBe(false)
  })

  it('工具确认被取消时将工具步骤展示为取消状态', () => {
    const { updateAiMessage, handleEvent } = createFixture({
      sessionId: 's1',
      messageId: 'a1',
      runState: 'running',
      titleState: 'not-required'
    })

    handleEvent({
      type: 'tool_failed',
      runId: 'run-1',
      sessionId: 's1',
      id: 'call-delete',
      name: 'people_tool_delete',
      input: { id: 'p1' },
      error: 'Tool confirmation request was cancelled.'
    })

    const updater = updateAiMessage.mock.calls[0]?.[2]
    const nextMessage = updater({
      id: 'a1',
      role: 'assistant',
      content: '',
      answer: '',
      time: '10:00',
      toolSteps: []
    })

    expect(nextMessage.toolSteps).toEqual([
      expect.objectContaining({
        id: 'call-delete',
        title: 'Tool cancelled: people_tool_delete',
        status: 'cancelled',
        observation: 'Tool confirmation was cancelled.'
      })
    ])
  })
})
