/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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

  it('支持折叠左侧导航栏且不再渲染右侧策展栏', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByText('MEMORY CURATOR')).toBeInTheDocument()
    expect(screen.getByText('DAILY')).toBeInTheDocument()
    expect(screen.getByText('LIBRARY')).toBeInTheDocument()
    expect(screen.getByText('CURATION')).toBeInTheDocument()
    expect(screen.getByText('计划 / 随记 / 日记')).toBeInTheDocument()
    expect(screen.queryByLabelText('右侧策展栏')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '折叠左侧导航栏' }))
    expect(screen.queryByText('MEMORY CURATOR')).not.toBeInTheDocument()
    expect(screen.queryByText('DAILY')).not.toBeInTheDocument()
    expect(screen.queryByText('LIBRARY')).not.toBeInTheDocument()
    expect(screen.queryByText('CURATION')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开左侧导航栏' })).toBeInTheDocument()
  })

  it('使用更小的圆形折叠按钮', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: '折叠左侧导航栏' })).toHaveClass('h-6', 'w-6', 'rounded-full')
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

  it('中间内容容器保留克制的左右内边距', () => {
    render(<App />)

    expect(screen.getByLabelText('中间内容容器')).toHaveClass('px-1', 'lg:px-2')
  })

  it('待办快速录入框默认常驻，一键排序按钮可对列表进行排序', async () => {
    render(<App />)

    const input = screen.getByPlaceholderText('添加一个待办，回车保存')
    expect(input).toBeInTheDocument()

    const sortBtn = screen.getByRole('button', { name: '一键排序' })
    expect(sortBtn).toBeInTheDocument()
  })

  it('支持直接在输入框中添加新待办，并可点击切换优先级', async () => {
    const user = userEvent.setup()

    render(<App />)

    // 初始应该有 "已完成 3/5"
    expect(screen.getByText('已完成 3/5')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('添加一个待办，回车保存')
    // 默认优先级是 P1
    const priorityBtn = screen.getByRole('button', { name: /切换新待办优先级/ })
    expect(priorityBtn).toHaveTextContent('P1')

    // 点击循环切换优先级 P1 -> P2
    await user.click(priorityBtn)
    expect(priorityBtn).toHaveTextContent('P2')

    // 输入文本并按回车
    await user.type(input, '我的全新测试待办')
    await user.keyboard('{Enter}')

    // 成功添加，且输入框清空，已完成计数和待办计数更新
    expect(screen.getByText('我的全新测试待办')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(screen.getByText('已完成 3/6')).toBeInTheDocument()
  })

  it('支持点击切换待办完成状态', async () => {
    const user = userEvent.setup()

    render(<App />)

    // 初始：已完成 3/5
    expect(screen.getByText('已完成 3/5')).toBeInTheDocument()

    // 找一个未完成的待办，点击完成
    const todoText = screen.getByText('修复渲染层 TypeScript 编译错误与 Lint 规范冲突')
    const container = todoText.closest('.group')!
    const checkboxBtn = container.querySelector('button')!

    await user.click(checkboxBtn)

    // 完成状态发生改变，计数更新
    expect(screen.getByText('已完成 4/5')).toBeInTheDocument()
  })

  it('支持点击文本后行内编辑待办内容', async () => {
    const user = userEvent.setup()

    render(<App />)

    const todoText = screen.getByText('修复渲染层 TypeScript 编译错误与 Lint 规范冲突')

    // 点击文本开始编辑
    await user.click(todoText)

    // 应该出现输入框，包含原有内容
    const editInput = screen.getByDisplayValue('修复渲染层 TypeScript 编译错误与 Lint 规范冲突')
    expect(editInput).toBeInTheDocument()

    // 修改内容并回车保存
    await user.clear(editInput)
    await user.type(editInput, '修改后的待办内容')
    await user.keyboard('{Enter}')

    // 输入框消失，修改成功
    expect(screen.queryByDisplayValue('修改后的待办内容')).not.toBeInTheDocument()
    expect(screen.getByText('修改后的待办内容')).toBeInTheDocument()
  })

  it('支持直接点击优先级标签循环切换优先级', async () => {
    const user = userEvent.setup()

    render(<App />)

    const todoText = screen.getByText('完成 Today 工作台的三栏静态布局编码与视觉自审')
    const container = todoText.closest('.group')!

    const priorityBtn = container.querySelector('button[aria-label^="切换 "]')!
    expect(priorityBtn).toHaveTextContent('P2')

    // 点击切换优先级，P2 -> P3
    await user.click(priorityBtn)
    expect(priorityBtn).toHaveTextContent('P3')
  })

  it('支持删除待办项', async () => {
    const user = userEvent.setup()

    render(<App />)

    const todoText = screen.getByText('完成 Today 工作台的三栏静态布局编码与视觉自审')
    const container = todoText.closest('.group')!
    const deleteBtn = container.querySelector('button[aria-label="删除"]')!

    await user.click(deleteBtn)

    // 等待待办被实际移除并更新计数
    await waitFor(() => {
      expect(screen.queryByText('完成 Today 工作台的三栏静态布局编码与视觉自审')).not.toBeInTheDocument()
    })
    expect(screen.getByText('已完成 3/4')).toBeInTheDocument()
  })

  it('切换完成状态后不会自动重排，点击一键排序后才会重排', async () => {
    const user = userEvent.setup()

    render(<App />)

    const todoItemsBefore = screen.getAllByTestId('today-todo-item')
    const beforeIndex = todoItemsBefore.findIndex((item) =>
      item.textContent?.includes('修复渲染层 TypeScript 编译错误与 Lint 规范冲突'),
    )
    expect(beforeIndex).toBe(0)

    const todoText = screen.getByText('修复渲染层 TypeScript 编译错误与 Lint 规范冲突')
    const container = todoText.closest('.group')!
    const checkboxBtn = container.querySelector('button[aria-label="标记为已完成"]')!

    await user.click(checkboxBtn)

    // 验证完成状态已变，但在手动排序前，索引应该依旧保持在 0，不发生重排
    const todoItemsAfterToggle = screen.getAllByTestId('today-todo-item')
    const afterToggleIndex = todoItemsAfterToggle.findIndex((item) =>
      item.textContent?.includes('修复渲染层 TypeScript 编译错误与 Lint 规范冲突'),
    )
    expect(afterToggleIndex).toBe(0)

    // 点击一键排序按钮
    const sortBtn = screen.getByRole('button', { name: '一键排序' })
    await user.click(sortBtn)

    // 排序后，已完成的任务应该沉底，其索引应变大
    const todoItemsAfterSort = screen.getAllByTestId('today-todo-item')
    const afterSortIndex = todoItemsAfterSort.findIndex((item) =>
      item.textContent?.includes('修复渲染层 TypeScript 编译错误与 Lint 规范冲突'),
    )

    expect(afterSortIndex).toBeGreaterThan(beforeIndex)
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
    expect(screen.queryByRole('button', { name: '第 1 条待办选择优先级P0' })).not.toBeInTheDocument()
  })
})
