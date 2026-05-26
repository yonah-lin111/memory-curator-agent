/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
  })

  it('支持分别折叠左侧导航栏与右侧策展栏', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByText('MEMORY CURATOR')).toBeInTheDocument()
    expect(screen.getByText('DAILY')).toBeInTheDocument()
    expect(screen.getByText('LIBRARY')).toBeInTheDocument()
    expect(screen.getByText('CURATION')).toBeInTheDocument()
    expect(screen.getByText('计划 / 随记 / 日记')).toBeInTheDocument()
    expect(screen.queryByText('建议、归类与记忆线索')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展开右侧策展栏' }))
    expect(screen.getByText('建议、归类与记忆线索')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '折叠右侧策展栏' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '折叠左侧导航栏' }))
    expect(screen.queryByText('MEMORY CURATOR')).not.toBeInTheDocument()
    expect(screen.queryByText('DAILY')).not.toBeInTheDocument()
    expect(screen.queryByText('LIBRARY')).not.toBeInTheDocument()
    expect(screen.queryByText('CURATION')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开左侧导航栏' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '折叠右侧策展栏' }))
    expect(screen.queryByText('建议、归类与记忆线索')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开右侧策展栏' })).toBeInTheDocument()
  })

  it('使用更小的圆形折叠按钮', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: '折叠左侧导航栏' })).toHaveClass('h-6', 'w-6', 'rounded-full')
    expect(screen.getByRole('button', { name: '展开右侧策展栏' })).toHaveClass('h-6', 'w-6', 'rounded-full')
  })

  it('默认将 Today 标记为当前侧栏页面', () => {
    render(<App />)

    expect(screen.getByText('Today').closest('[aria-current="page"]')).toBeInTheDocument()
  })

  it('支持从左侧栏切换到其他静态页面', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Notes/ }))
    expect(screen.getByRole('heading', { name: '自由笔记素材池' })).toBeInTheDocument()
    expect(screen.getByText('Notes').closest('[aria-current="page"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Journal/ }))
    expect(screen.getByRole('heading', { name: '历史日记条目' })).toBeInTheDocument()
    expect(screen.getByText('Journal').closest('[aria-current="page"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Weekly Review/ }))
    expect(screen.getByRole('heading', { name: '周度策展复盘' })).toBeInTheDocument()
    expect(screen.getByText('Weekly Review').closest('[aria-current="page"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Themes/ }))
    expect(screen.getByRole('heading', { name: '长期主题追踪' })).toBeInTheDocument()
    expect(screen.getByText('Themes').closest('[aria-current="page"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Memories/ }))
    expect(screen.getByRole('heading', { name: '记忆片段关联墙' })).toBeInTheDocument()
    expect(screen.getByText('Memories').closest('[aria-current="page"]')).toBeInTheDocument()
  })

  it('在切换侧栏 tab 时同步改变 URL pathname 路由，且支持通过改变 pathname 进行路由切换', async () => {
    const user = userEvent.setup()

    render(<App />)

    // 默认应该设置 pathname 为 /today (如果初始 pathname 为空或 /)
    expect(window.location.pathname).toBe('/today')

    // 点击 Notes，验证 pathname 发生改变
    await user.click(screen.getByRole('button', { name: /Notes/ }))
    expect(window.location.pathname).toBe('/notes')
    expect(screen.getByRole('heading', { name: '自由笔记素材池' })).toBeInTheDocument()

    // 模拟浏览器前进/后退改变路由
    act(() => {
      window.history.pushState({}, '', '/journal')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(screen.getByRole('heading', { name: '历史日记条目' })).toBeInTheDocument()
    expect(screen.getByText('Journal').closest('[aria-current="page"]')).toBeInTheDocument()
  })

  it('长按拖拽右侧折叠按钮可在最小宽度与 35vw 之间调整右栏宽度', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    render(<App />)

    // 首先展开右侧栏以便测试长按拖拽
    fireEvent.click(screen.getByRole('button', { name: '展开右侧策展栏' }))

    const agentPanel = screen.getByLabelText('右侧策展栏')
    const resizeButton = screen.getByRole('button', { name: '折叠右侧策展栏' })

    expect(agentPanel).toHaveStyle({ width: '360px' })

    fireEvent.pointerDown(resizeButton, { clientX: 840, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 780, pointerId: 1 })
    expect(agentPanel).toHaveStyle({ width: '360px' })

    act(() => {
      vi.advanceTimersByTime(280)
    })
    fireEvent.pointerMove(window, { clientX: 780, pointerId: 1 })
    expect(agentPanel).toHaveStyle({ width: '420px' })

    fireEvent.pointerMove(window, { clientX: 900, pointerId: 1 })
    expect(agentPanel).toHaveStyle({ width: '360px' })

    fireEvent.pointerUp(window, { pointerId: 1 })
  })

  it('中间内容容器保留克制的左右内边距', () => {
    render(<App />)

    expect(screen.getByLabelText('中间内容容器')).toHaveClass('px-1', 'lg:px-2')
  })

  it('点击每日待办计划添加按钮后打开对应弹窗并可用 Escape 关闭', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: '添加每日待办计划' }))

    expect(screen.getByRole('dialog', { name: '新建每日待办计划' })).toBeInTheDocument()
    expect(screen.getByTestId('add-entry-modal-overlay')).toHaveClass('items-center', 'justify-center')
    expect(screen.getByLabelText('第 1 条待办内容')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 1 条待办选择优先级高' })).toBeInTheDocument()
    expect(screen.getByLabelText('第 1 条待办时间')).toHaveAttribute('type', 'time')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: '新建每日待办计划' })).not.toBeInTheDocument()
  })

  it('每日待办弹窗支持一次添加多条待办且每条拥有独立优先级和时间选择器', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: '添加每日待办计划' }))
    await user.click(screen.getByRole('button', { name: '添加一条待办' }))

    expect(screen.getByLabelText('第 1 条待办内容')).toBeInTheDocument()
    expect(screen.getByLabelText('第 2 条待办内容')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 1 条待办选择优先级高' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 2 条待办选择优先级高' })).toBeInTheDocument()
    expect(screen.getByLabelText('第 1 条待办时间')).toHaveAttribute('type', 'time')
    expect(screen.getByLabelText('第 2 条待办时间')).toHaveAttribute('type', 'time')
    expect(screen.getByLabelText('第 1 条待办时间')).toHaveClass('todo-time-picker')
    expect(screen.getByLabelText('第 2 条待办时间')).toHaveClass('todo-time-picker')
    expect(screen.getByRole('button', { name: '打开第 1 条待办时间选择器' })).toHaveClass('text-white/70')
    expect(screen.getByRole('button', { name: '打开第 2 条待办时间选择器' })).toHaveClass('text-white/70')
  })

  it('新增待办后滚动到最新一条待办', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: '添加每日待办计划' }))
    await user.click(screen.getByRole('button', { name: '添加一条待办' }))

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'end', behavior: 'smooth' })
  })

  it('点击时间图标可打开对应时间选择器', async () => {
    const user = userEvent.setup()
    const showPicker = vi.fn()

    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: '添加每日待办计划' }))
    await user.click(screen.getByRole('button', { name: '打开第 1 条待办时间选择器' }))

    expect(screen.getByLabelText('第 1 条待办时间')).toHaveFocus()
    expect(showPicker).toHaveBeenCalledTimes(1)
  })

  it('每日待办弹窗内的待办草稿可删除', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: '添加每日待办计划' }))
    await user.click(screen.getByRole('button', { name: '添加一条待办' }))
    await user.click(screen.getByRole('button', { name: '删除第 1 条待办' }))

    expect(screen.queryByLabelText('第 2 条待办内容')).not.toBeInTheDocument()
    expect(screen.getByLabelText('第 1 条待办内容')).toBeInTheDocument()
  })

  it('点击自由随记卡片添加按钮后打开对应弹窗', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: '添加自由随记卡片' }))

    expect(screen.getByRole('dialog', { name: '新建自由随记卡片' })).toBeInTheDocument()
    expect(screen.getByLabelText('随记标题')).toBeInTheDocument()
    expect(screen.getByLabelText('随记内容')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加随记标签 UX' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加随记标签 AI-Agent' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择优先级高' })).not.toBeInTheDocument()
  })
})
