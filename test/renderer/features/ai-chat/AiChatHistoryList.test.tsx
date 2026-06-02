/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiChatHistoryList } from '@renderer/features/ai-chat/components/AiChatHistoryList'
import type { AiChatSession } from '@renderer/features/ai-chat/types'

// 测试用 AI 会话列表。
const sessions: AiChatSession[] = [
  {
    id: 's1',
    title: '第一会话',
    summary: '第一条摘要',
    time: '10:00',
    status: 'idle',
    messages: []
  },
  {
    id: 's2',
    title: '第二会话',
    summary: '第二条摘要',
    time: '11:00',
    status: 'completed',
    messages: []
  }
]

// 渲染历史列表测试组件。
const renderHistoryList = (overrides?: {
  onRenameChat?: (sessionId: string, title: string) => Promise<boolean>
  onDeleteChat?: (sessionId: string) => Promise<boolean>
}): void => {
  render(
    <AiChatHistoryList
      sessions={sessions}
      activeSessionId="s1"
      onSessionChange={() => undefined}
      onNewChat={() => undefined}
      onRenameChat={overrides?.onRenameChat ?? vi.fn(async () => true)}
      onDeleteChat={overrides?.onDeleteChat ?? vi.fn(async () => true)}
    />
  )
}

describe('AiChatHistoryList', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('历史项切换高亮时不使用颜色过渡，避免旧高亮项闪烁', () => {
    renderHistoryList()

    expect(screen.getByText('第一会话').closest('[role="button"]')).not.toHaveClass('transition-colors')
  })

  it('右键打开历史项菜单，且视口内同一时间只渲染一个菜单', () => {
    renderHistoryList()

    fireEvent.contextMenu(screen.getByText('第一会话'), {
      clientX: 120,
      clientY: 140
    })
    expect(screen.getByRole('menu', { name: '第一会话 action menu' })).toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('第二会话'), {
      clientX: 160,
      clientY: 180
    })

    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(screen.getByRole('menu', { name: '第二会话 action menu' })).toBeInTheDocument()
  })

  it('点击编辑标题后直接在标题位置输入并提交', async () => {
    const user = userEvent.setup()
    const onRenameChat = vi.fn(async () => true)
    renderHistoryList({ onRenameChat })

    fireEvent.contextMenu(screen.getByText('第一会话'))
    await user.click(screen.getByRole('menuitem', { name: /编辑标题/ }))
    const input = screen.getByLabelText('Edit chat title 第一会话')

    await user.clear(input)
    await user.type(input, '新的标题{Enter}')

    await waitFor(() => {
      expect(onRenameChat).toHaveBeenCalledWith('s1', '新的标题')
    })
  })

  it('点击删除聊天后先进入确认态，再次点击才调用删除回调', async () => {
    const user = userEvent.setup()
    const onDeleteChat = vi.fn(async () => true)
    renderHistoryList({ onDeleteChat })

    fireEvent.contextMenu(screen.getByText('第二会话'))
    await user.click(screen.getByRole('menuitem', { name: /删除聊天/ }))

    expect(onDeleteChat).not.toHaveBeenCalled()
    expect(screen.getByRole('menuitem', { name: /确认删除/ })).toHaveClass('bg-rose-600')

    await user.click(screen.getByRole('menuitem', { name: /确认删除/ }))

    await waitFor(() => {
      expect(onDeleteChat).toHaveBeenCalledWith('s2')
    })
  })
})
