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
})
