/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CuratorHistoryList } from "@/components/layout/Sidebar/components/CuratorHistoryList"
import type { CuratorSession } from "@/features/curator/types"

// 测试用 AI 会话列表。
const sessions: CuratorSession[] = [
  {
    id: "s1",
    title: "第一会话",
    time: "2026-05-31 10:00",
    status: "idle",
    messages: [],
  },
  {
    id: "s2",
    title: "第二会话",
    time: "2026-05-31 11:00",
    status: "completed",
    messages: [],
  },
]

// 渲染历史列表测试组件。
const renderHistoryList = (overrides?: {
  onRenameChat?: (sessionId: string, title: string) => Promise<boolean>
  onDeleteChat?: (sessionId: string) => Promise<boolean>
  onBatchDeleteChats?: (sessionIds: string[]) => Promise<boolean>
  onLoadMore?: () => Promise<void>
  hasMore?: boolean
  isLoadingMore?: boolean
  completionNoticeSessionIds?: Set<string>
  onCompletionNoticeClear?: (sessionId: string) => void
}): void => {
  render(
    <CuratorHistoryList
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
      completionNoticeSessionIds={overrides?.completionNoticeSessionIds}
      onCompletionNoticeClear={overrides?.onCompletionNoticeClear}
    />,
  )
}

describe("CuratorHistoryList", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("历史项切换高亮时不使用颜色过渡，避免旧高亮项闪烁", () => {
    renderHistoryList()

    expect(screen.getByText("第一会话").closest('[role="button"]')).not.toHaveClass(
      "transition-colors",
    )
  })

  it("右键打开历史项菜单，且视口内同一时间只渲染一个菜单", () => {
    renderHistoryList()

    fireEvent.contextMenu(screen.getByText("第一会话"), {
      clientX: 120,
      clientY: 140,
    })
    expect(screen.getByRole("menu", { name: "第一会话 action menu" })).toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText("第二会话"), {
      clientX: 160,
      clientY: 180,
    })

    expect(screen.getAllByRole("menu")).toHaveLength(1)
    expect(screen.getByRole("menu", { name: "第二会话 action menu" })).toBeInTheDocument()
  })

  it("点击编辑标题后直接在标题位置输入并提交", async () => {
    const user = userEvent.setup()
    const onRenameChat = vi.fn(async () => true)
    renderHistoryList({ onRenameChat })

    fireEvent.contextMenu(screen.getByText("第一会话"))
    await user.click(screen.getByRole("menuitem", { name: /编辑标题/ }))
    const input = screen.getByLabelText("Edit chat title 第一会话")

    await user.clear(input)
    await user.type(input, "新的标题{Enter}")

    await waitFor(() => {
      expect(onRenameChat).toHaveBeenCalledWith("s1", "新的标题")
    })
  })

  it("点击删除聊天后先进入确认态，再次点击才调用删除回调", async () => {
    const user = userEvent.setup()
    const onDeleteChat = vi.fn(async () => true)
    renderHistoryList({ onDeleteChat })

    fireEvent.contextMenu(screen.getByText("第二会话"))
    await user.click(screen.getByRole("menuitem", { name: /删除聊天/ }))

    expect(onDeleteChat).not.toHaveBeenCalled()
    expect(screen.getByRole("menuitem", { name: /确认删除/ })).toHaveClass("bg-rose-600")

    await user.click(screen.getByRole("menuitem", { name: /确认删除/ }))

    await waitFor(() => {
      expect(onDeleteChat).toHaveBeenCalledWith("s2")
    })
  })

  it("搜索框可以通过标题搜索过滤历史会话", async () => {
    const user = userEvent.setup()
    renderHistoryList()
    const input = screen.getByPlaceholderText("搜索对话历史")

    await user.type(input, "第二")

    // 等待异步防抖搜索完成
    await waitFor(() => {
      expect(screen.queryByText("第一会话")).not.toBeInTheDocument()
      expect(screen.getByText("第二会话")).toBeInTheDocument()
    })
  })

  it("历史项只展示标题和年月日时分，不再展示摘要", () => {
    renderHistoryList()

    expect(screen.getByText("第一会话")).toBeInTheDocument()
    expect(screen.getByText("2026-05-31 10:00")).toBeInTheDocument()
    expect(screen.queryByText("第一条摘要")).not.toBeInTheDocument()
  })

  it("历史项按照更新时间倒序展示", () => {
    renderHistoryList()
    const titles = screen
      .getAllByRole("button")
      .map((item) => item.textContent ?? "")
      .filter((text) => text.includes("会话"))

    expect(titles[0]).toContain("第二会话")
    expect(titles[1]).toContain("第一会话")
  })

  it("空白新建对话始终展示在历史顶部", () => {
    render(
      <CuratorHistoryList
        sessions={[
          {
            id: "old-empty",
            title: "新建对话",
            time: "2026-05-30 09:00",
            status: "idle",
            messages: [],
          },
          {
            id: "latest",
            title: "最新会话",
            time: "2026-05-31 12:00",
            status: "completed",
            messages: [],
          },
        ]}
        activeSessionId="old-empty"
        onSessionChange={() => undefined}
        onNewChat={() => undefined}
        onRenameChat={vi.fn(async () => true)}
        onDeleteChat={vi.fn(async () => true)}
        onBatchDeleteChats={vi.fn(async () => true)}
        onLoadMore={vi.fn(async () => undefined)}
        hasMore={false}
        isLoadingMore={false}
      />,
    )
    const titles = screen
      .getAllByRole("button")
      .map((item) => item.textContent ?? "")
      .filter((text) => text.includes("对话") || text.includes("会话"))

    expect(titles[0]).toContain("新建对话")
    expect(titles[1]).toContain("最新会话")
  })

  it("外部完成提醒会高亮非激活会话，点击后清理提醒", async () => {
    const user = userEvent.setup()
    const onCompletionNoticeClear = vi.fn()
    renderHistoryList({
      completionNoticeSessionIds: new Set(["s2"]),
      onCompletionNoticeClear,
    })

    expect(screen.getByText("第二会话").closest('[role="button"]')).toHaveClass("text-emerald-300")

    await user.click(screen.getByText("第二会话"))

    expect(onCompletionNoticeClear).toHaveBeenCalledWith("s2")
  })

  it("滚动触底时加载更多历史会话", () => {
    const onLoadMore = vi.fn(async () => undefined)
    renderHistoryList({ onLoadMore, hasMore: true })
    const list = screen.getByLabelText("AI chat history sessions")

    Object.defineProperties(list, {
      scrollHeight: { configurable: true, value: 100 },
      scrollTop: { configurable: true, value: 76 },
      clientHeight: { configurable: true, value: 20 },
    })
    fireEvent.scroll(list)

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it("批量模式选择多个会话后调用批量删除回调", async () => {
    const user = userEvent.setup()
    const onBatchDeleteChats = vi.fn(async () => true)
    renderHistoryList({ onBatchDeleteChats })

    await user.click(screen.getByRole("button", { name: "Batch delete chats" }))
    await user.click(screen.getByText("第一会话"))
    await user.click(screen.getByText("第二会话"))
    await user.click(screen.getByRole("button", { name: "删除" }))

    await waitFor(() => {
      expect(onBatchDeleteChats).toHaveBeenCalledWith(["s1", "s2"])
    })
  })

  it("在展开状态下渲染折叠按钮，点击时调用 onCollapsedChange(true)", async () => {
    const user = userEvent.setup()
    const onCollapsedChange = vi.fn()
    render(
      <CuratorHistoryList
        sessions={sessions}
        activeSessionId="s1"
        onSessionChange={() => undefined}
        onNewChat={() => undefined}
        onRenameChat={vi.fn(async () => true)}
        onDeleteChat={vi.fn(async () => true)}
        onBatchDeleteChats={vi.fn(async () => true)}
        onLoadMore={vi.fn(async () => undefined)}
        hasMore={false}
        isLoadingMore={false}
        isCollapsed={false}
        onCollapsedChange={onCollapsedChange}
      />,
    )

    const button = screen.getByRole("button", { name: "Collapse sidebar" })
    expect(button).toBeInTheDocument()
    await user.click(button)
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
  })

  it("在折叠状态下仅渲染展开和新建对话按钮", async () => {
    const user = userEvent.setup()
    const onCollapsedChange = vi.fn()
    const onNewChat = vi.fn()
    render(
      <CuratorHistoryList
        sessions={sessions}
        activeSessionId="s1"
        onSessionChange={() => undefined}
        onNewChat={onNewChat}
        onRenameChat={vi.fn(async () => true)}
        onDeleteChat={vi.fn(async () => true)}
        onBatchDeleteChats={vi.fn(async () => true)}
        onLoadMore={vi.fn(async () => undefined)}
        hasMore={false}
        isLoadingMore={false}
        isCollapsed={true}
        onCollapsedChange={onCollapsedChange}
      />,
    )

    // 不应渲染搜索框和对话列表等
    expect(screen.queryByPlaceholderText("搜索对话历史")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("AI chat history sessions")).not.toBeInTheDocument()

    // 应该渲染展开按钮
    const expandButton = screen.getByRole("button", { name: "Expand sidebar" })
    expect(expandButton).toBeInTheDocument()
    await user.click(expandButton)
    expect(onCollapsedChange).toHaveBeenCalledWith(false)

    // 应该渲染新建对话按钮
    const newChatButton = screen.getByRole("button", { name: "New chat" })
    expect(newChatButton).toBeInTheDocument()
    await user.click(newChatButton)
    expect(onNewChat).toHaveBeenCalled()
  })
})
