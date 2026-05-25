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
    vi.useRealTimers()
  })

  it('支持分别折叠左侧导航栏与右侧策展栏', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByText('MEMORY CURATOR')).toBeInTheDocument()
    expect(screen.getByText('建议、归类与记忆线索')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '折叠左侧导航栏' }))
    expect(screen.queryByText('MEMORY CURATOR')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开左侧导航栏' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '折叠右侧策展栏' }))
    expect(screen.queryByText('建议、归类与记忆线索')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开右侧策展栏' })).toBeInTheDocument()
  })

  it('使用更小的圆形折叠按钮', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: '折叠左侧导航栏' })).toHaveClass('h-6', 'w-6', 'rounded-full')
    expect(screen.getByRole('button', { name: '折叠右侧策展栏' })).toHaveClass('h-6', 'w-6', 'rounded-full')
  })

  it('长按拖拽右侧折叠按钮可在最小宽度与 35vw 之间调整右栏宽度', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    render(<App />)

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
    expect(screen.getByLabelText('待办内容')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择优先级高' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择计划时间 16:30' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: '新建每日待办计划' })).not.toBeInTheDocument()
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
