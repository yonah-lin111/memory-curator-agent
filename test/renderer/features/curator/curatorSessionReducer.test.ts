import { describe, expect, it } from 'vitest'
import type { CuratorSession } from '@/features/curator/types'
import {
  curatorSessionReducer,
  type CuratorSessionState
} from '@/features/curator/core/curatorSessionReducer'

// 测试用会话构造参数。
type CreateSessionOptions = {
  // 会话状态。
  status: CuratorSession['status']
  // 会话更新时间。
  time: string
}

/**
 * 创建测试用 AI 会话。
 */
const createSession = ({ status, time }: CreateSessionOptions): CuratorSession => ({
  id: 's1',
  title: '女朋友是谁',
  time,
  status,
  messages: [
    {
      id: 'u1',
      role: 'user',
      content: '我的女朋友是谁',
      time: '10:00'
    },
    {
      id: 'a1',
      role: 'assistant',
      content: '处理中',
      answer: '',
      time: '10:00'
    }
  ]
})

describe('curatorSessionReducer', () => {
  it('忽略迟到的运行中详情，避免非激活会话完成状态被盖回 loading', () => {
    const completedSession = createSession({
      status: 'completed',
      time: '2026-06-03 10:02'
    })
    const staleRunningSession = createSession({
      status: 'running',
      time: '2026-06-03 10:03'
    })
    const state: CuratorSessionState = {
      sessions: [completedSession],
      activeId: 's2'
    }

    const nextState = curatorSessionReducer(state, {
      type: 'replace',
      session: staleRunningSession
    })

    expect(nextState.sessions[0]).toMatchObject({
      id: 's1',
      status: 'completed',
      time: '2026-06-03 10:02'
    })
  })
})
