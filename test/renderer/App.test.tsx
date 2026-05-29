/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '@renderer/App'

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
    expect(screen.getAllByText('DAILY')[0]).toBeInTheDocument()
    expect(screen.getAllByText('LIBRARY')[0]).toBeInTheDocument()
    expect(screen.getAllByText('CURATION')[0]).toBeInTheDocument()
    expect(screen.getByText('计划 / 随记 / 日记')).toBeInTheDocument()
    expect(screen.queryByLabelText('右侧策展栏')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '折叠左侧导航栏' }))
    expect(screen.queryByText('MEMORY CURATOR')).not.toBeInTheDocument()
    expect(screen.getAllByText('DAILY')).toHaveLength(1)
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
    expect(screen.getByText('全部 (0)')).toBeInTheDocument()
    expect(screen.getByText('Notes').closest('[aria-current="page"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Journal/ }))
    expect(screen.getByRole('button', { name: /查看前一天/ })).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('侧边栏主导航')).getByRole('button', { name: /Journal/ })
    ).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /Weekly Review/ }))
    expect(screen.getByLabelText('Weekly Review 页面')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Weekly Review/ })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /Themes/ }))
    expect(screen.getByLabelText('Themes 页面')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Themes/ })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /Memories/ }))
    expect(screen.getByLabelText('Memories 页面')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Memories/ })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /People/ }))
    expect(screen.getByLabelText('People 页面')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /People/ })).toHaveAttribute('aria-current', 'page')
  })

  it('在切换侧栏 tab 时同步改变 URL pathname 路由，且支持通过改变 pathname 进行路由切换', async () => {
    const user = userEvent.setup()

    render(<App />)

    // 默认应该设置 pathname 为 /today (如果初始 pathname 为空或 /)
    expect(window.location.pathname).toBe('/today')

    // 点击 Notes，验证 pathname 发生改变
    await user.click(screen.getByRole('button', { name: /Notes/ }))
    expect(window.location.pathname).toBe('/notes')
    expect(screen.getByText('全部 (0)')).toBeInTheDocument()

    // 模拟浏览器前进/后退改变路由
    act(() => {
      window.history.pushState({}, '', '/journal')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(screen.getByRole('button', { name: /查看前一天/ })).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('侧边栏主导航')).getByRole('button', { name: /Journal/ })
    ).toHaveAttribute('aria-current', 'page')
  })

  it('Journal / Todo / Snippets 路由进入正式页面而不是占位文案', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Journal/ }))
    expect(screen.getByRole('button', { name: /查看前一天/ })).toBeInTheDocument()
    expect(screen.queryByText(/COMING SOON/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Todo/ }))
    expect(screen.getByPlaceholderText('添加一个待办，回车保存')).toBeInTheDocument()
    expect(screen.queryByText(/COMING SOON/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Snippets/ }))
    expect(screen.getByText('全部片段')).toBeInTheDocument()
    expect(screen.queryByText(/COMING SOON/)).not.toBeInTheDocument()
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
    const deleteBtn = container.querySelector('button[aria-label="删除待办 完成 Today 工作台的三栏静态布局编码与视觉自审"]')!

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

    await user.click(screen.getByRole('button', { name: '添加自由随记片段' }))

    const dialog = screen.getByRole('dialog', { name: '新建自由随记卡片' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByLabelText('随记标题')).toBeInTheDocument()
    expect(screen.getByLabelText('随记内容')).toBeInTheDocument()
    
    // 输入新标签并回车产生标签
    const tagInput = screen.getByLabelText('输入新标签')
    expect(tagInput).toBeInTheDocument()
    await user.type(tagInput, 'UX{Enter}')
    
    expect(within(dialog).getByText('UX')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '删除标签' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '第 1 条待办选择优先级P0' })).not.toBeInTheDocument()
  })

  it('支持点击随记卡片打开编辑弹窗，回显内容，并修改保存后更新卡片列表', async () => {
    const user = userEvent.setup()

    render(<App />)

    // 找到卡片并点击
    const cardTitle = screen.getByText('关于记忆持久化的思考')
    await user.click(cardTitle)

    // 弹窗应该显示编辑状态
    const dialog = screen.getByRole('dialog', { name: '编辑自由随记卡片' })
    expect(dialog).toBeInTheDocument()

    const titleInput = screen.getByLabelText('随记标题')
    const contentInput = screen.getByLabelText('随记内容')

    expect(titleInput).toHaveValue('关于记忆持久化的思考')
    expect(contentInput).toHaveValue('所有的临时闪念都不应该直接成为长期记忆，必须经过一个类似海马体的主动策展层。今天看到一个概念：信息不仅需要被存储，更需要主动被遗忘以保持高信噪比。')

    // 修改标题
    await user.clear(titleInput)
    await user.type(titleInput, '修改后的持久化思考')

    // 保存
    const saveBtn = screen.getByRole('button', { name: '保存随记卡片' })
    await user.click(saveBtn)

    // 弹窗关闭，卡片标题更新
    expect(dialog).not.toBeInTheDocument()
    expect(screen.getByText('修改后的持久化思考')).toBeInTheDocument()
    expect(screen.queryByText('关于记忆持久化的思考')).not.toBeInTheDocument()
  })

  it('支持在新建随记卡片弹窗中输入标题 and 内容并保存，成功添加到卡片列表', async () => {
    const user = userEvent.setup()

    render(<App />)

    // 点击添加
    await user.click(screen.getByRole('button', { name: '添加自由随记片段' }))

    const titleInput = screen.getByLabelText('随记标题')
    const contentInput = screen.getByLabelText('随记内容')

    await user.type(titleInput, '我的新闪念')
    await user.type(contentInput, '今天突然想到的一个设计细节')

    const saveBtn = screen.getByRole('button', { name: '保存随记卡片' })
    await user.click(saveBtn)

    // 随记卡片成功添加到列表
    expect(screen.getByText('我的新闪念')).toBeInTheDocument()
    expect(screen.getByText('今天突然想到的一个设计细节')).toBeInTheDocument()
  })

  it('支持删除自由随记卡片，并在动画后移除', async () => {
    const user = userEvent.setup()

    render(<App />)

    const cardTitle = screen.getByText('本地持久化方案表现')
    expect(cardTitle).toBeInTheDocument()

    const deleteBtn = screen.getByRole('button', { name: '删除片段 本地持久化方案表现' })
    expect(deleteBtn).toBeInTheDocument()

    await user.click(deleteBtn)

    // 应该在删除延时后彻底从 DOM 移除
    await waitFor(() => {
      expect(screen.queryByText('本地持久化方案表现')).not.toBeInTheDocument()
    })
  })

  it('点击 Header 聊天按钮后切换为 AI 对话模式，并可关闭恢复主导航', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(window.location.pathname).toBe('/today')

    await user.click(screen.getByRole('button', { name: '打开聊天' }))

    expect(screen.getByRole('button', { name: '关闭聊天' })).toBeInTheDocument()
    expect(screen.getByLabelText('对话历史列表')).toBeInTheDocument()
    expect(screen.getByLabelText('AI 对话主体')).toBeInTheDocument()
    expect(screen.getByText('AI DIALOGS')).toBeInTheDocument()
    expect(screen.getAllByText('整理今天的记忆线索')[0]).toBeInTheDocument()
    expect(window.location.pathname).toBe('/today')

    await user.click(screen.getByRole('button', { name: '关闭聊天' }))

    expect(screen.getByRole('button', { name: '打开聊天' })).toBeInTheDocument()
    expect(screen.getByLabelText('侧边栏主导航')).toBeInTheDocument()
    expect(screen.queryByLabelText('对话历史列表')).not.toBeInTheDocument()
  })

  it('AI 对话模式支持切换历史会话并展示工具调用摘要', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: '打开聊天' }))
    await user.click(screen.getByRole('button', { name: /周回顾行动拆解/ }))

    const chatMain = screen.getByLabelText('AI 对话主体')
    expect(within(chatMain).getByText('周回顾行动拆解')).toBeInTheDocument()
    expect(within(chatMain).getByText('ReAct 执行摘要')).toBeInTheDocument()
    expect(within(chatMain).getByText('读取 weekly review 草稿')).toBeInTheDocument()
    expect(screen.getAllByText('工具完成').length).toBeGreaterThan(0)
  })
})
