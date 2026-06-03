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
  onBatchDeleteChats?: (sessionIds: string[]) => Promise<boolean>
  onLoadMore?: () => Promise<void>
  hasMore?: boolean
  isLoadingMore?: boolean
}): void => {
  render(
    <AiChatHistoryList
      sessions={sessions}
      activeSessionId="s1"
      onSessionChange={() => undefined}
      onNewChat={() => undefined}
      onRenameChat={overrides?.onRenameChat ?? vi.fn(async () => true)}
      onDeleteChat={overrides?.onDeleteChat ?? vi.fn(async () => true)}
      onBatchDeleteChats={overrides?.onBatchDeleteChats ?? vi.fn(async () => true)}
      onLoadMore={overrides?.onLoadMore ?? vi.fn(async () => undefined)}
      hasMore={overrides?.hasMore ?? false}
      isLoadingMore={overrides?.isLoadingMore ?? false}
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

  it('搜索框可以通过标题与摘要搜索过滤历史会话', async () => {
    const user = userEvent.setup()
    renderHistoryList()
    const input = screen.getByPlaceholderText('搜索对话历史')

    await user.type(input, '第二')

    // 等待异步防抖搜索完成
    await waitFor(() => {
      expect(screen.queryByText('第一会话')).not.toBeInTheDocument()
      expect(screen.getByText('第二会话')).toBeInTheDocument()
    })

    await user.clear(input)
    await user.type(input, '第一条摘要')

    // 由于新的搜索功能支持摘要搜索，输入“第一条摘要”应该能搜索出“第一会话”
    await waitFor(() => {
      expect(screen.queryByText('第二会话')).not.toBeInTheDocument()
      expect(screen.getByText('第一会话')).toBeInTheDocument()
    })
  })

  it('滚动触底时加载更多历史会话', () => {
    const onLoadMore = vi.fn(async () => undefined)
    renderHistoryList({ onLoadMore, hasMore: true })
    const list = screen.getByLabelText('AI chat history sessions')

    Object.defineProperties(list, {
      scrollHeight: { configurable: true, value: 100 },
      scrollTop: { configurable: true, value: 76 },
      clientHeight: { configurable: true, value: 20 }
    })
    fireEvent.scroll(list)

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('批量模式选择多个会话后调用批量删除回调', async () => {
    const user = userEvent.setup()
    const onBatchDeleteChats = vi.fn(async () => true)
    renderHistoryList({ onBatchDeleteChats })

    await user.click(screen.getByRole('button', { name: 'Batch delete chats' }))
    await user.click(screen.getByText('第一会话'))
    await user.click(screen.getByText('第二会话'))
    await user.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(onBatchDeleteChats).toHaveBeenCalledWith(['s1', 's2'])
    })
  })
})
