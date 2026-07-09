/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CuratorWorkspace } from '@/features/curator/components/CuratorWorkspace'
import { useCuratorContextStore } from '@/features/curator/curatorContextStore'

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    show: vi.fn()
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))
import type {
  CuratorSession,
  CuratorModelProviderOption,
  CuratorModelSelection
} from '@/features/curator/types'

vi.mock('md-editor-rt', () => ({
  MdPreview: ({ modelValue }: { modelValue: string }) => <div>{modelValue}</div>
}))

const modelOptions: CuratorModelProviderOption[] = [
  {
    id: 'bailian',
    name: 'Bailian',
    models: [
      {
        id: 'MiniMax-M2.5',
        name: 'MiniMax-M2.5',
        limit: {
          context: 204800,
          output: 131072
        },
        modalities: {
          input: ['text'],
          output: ['text']
        }
      }
    ]
  }
]

const selectedModel: CuratorModelSelection = {
  provider: 'bailian',
  model: 'MiniMax-M2.5'
}

const session: CuratorSession = {
  id: 's1',
  title: '上下文测试',
  time: '10:00',
  status: 'completed',
  messages: [
    {
      id: 'u1',
      role: 'user',
      content: '帮我整理上下文',
      time: '10:00'
    },
    {
      id: 'a1',
      role: 'assistant',
      content: '正在处理',
      answer: '上下文已经整理完成。',
      time: '10:01'
    }
  ]
}

const secondSession: CuratorSession = {
  id: 's2',
  title: '第二会话',
  time: '11:00',
  status: 'completed',
  messages: [
    {
      id: 'u2',
      role: 'user',
      content: '切换后滚动',
      time: '11:00'
    },
    {
      id: 'a2',
      role: 'assistant',
      content: '切换后的回答',
      answer: '切换后的回答',
      time: '11:01'
    }
  ]
}

describe('CuratorWorkspace', () => {
  beforeEach(() => {
    useCuratorContextStore.getState().resetAll()
    let animationFrameTime = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameTime += 120
      callback(animationFrameTime)
      return animationFrameTime
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('同步当前会话消息上下文且不在消息区渲染记录栏', async () => {
    render(
      <CuratorWorkspace
        session={session}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )

    await waitFor(() => {
      expect(useCuratorContextStore.getState().getSessionItems('s1')).toHaveLength(2)
    })
    expect(screen.getByText('MiniMax-M2.5')).toBeInTheDocument()
    expect(screen.getByLabelText(/Context usage 0% · ~\d+ tokens \/ 204,800/)).toBeInTheDocument()
    expect(screen.queryByLabelText('AI Chat Context')).not.toBeInTheDocument()
  })

  it('切换 active chat 后复用发送消息的最新 AI 回答定位效果', async () => {
    const { rerender } = render(
      <CuratorWorkspace
        session={session}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )
    const messagesContainer = screen.getByLabelText('AI Chat Workspace').querySelector('.custom-scrollbar')!
    const scrollTo = vi.fn()
    messagesContainer.scrollTop = 480
    Object.defineProperty(messagesContainer, 'scrollHeight', {
      configurable: true,
      value: 480
    })
    Object.defineProperty(messagesContainer, 'scrollTo', {
      configurable: true,
      value: scrollTo.mockImplementation(({ top }: ScrollToOptions) => {
        messagesContainer.scrollTop = Number(top ?? messagesContainer.scrollTop)
      })
    })
    scrollTo.mockClear()

    rerender(
      <CuratorWorkspace
        session={secondSession}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: 'auto'
      })
    })
  })

  it('切换 active chat 后滚动速度逐帧递增', async () => {
    const offsetTopSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
      .mockImplementation(function getOffsetTop(this: HTMLElement) {
        return this.textContent?.includes('切换后滚动') ? 120 : 0
      })

    const { rerender } = render(
      <CuratorWorkspace
        session={session}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )
    const messagesContainer = screen.getByLabelText('AI Chat Workspace').querySelector('.custom-scrollbar')!
    const scrollPositions: number[] = []
    messagesContainer.scrollTop = 480
    Object.defineProperty(messagesContainer, 'scrollTo', {
      configurable: true,
      value: ({ top }: ScrollToOptions) => {
        const nextTop = Number(top ?? messagesContainer.scrollTop)
        messagesContainer.scrollTop = nextTop
        scrollPositions.push(nextTop)
      }
    })

    rerender(
      <CuratorWorkspace
        session={secondSession}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )

    await waitFor(() => {
      expect(scrollPositions.at(-1)).toBe(116)
    })
    const travelDistances = scrollPositions
      .slice(1)
      .map((position, index) => Math.abs(position - scrollPositions[index]))
      .filter((distance) => distance > 0)

    expect(travelDistances.length).toBeGreaterThanOrEqual(2)
    expect(travelDistances[1]).toBeGreaterThan(travelDistances[0])
    offsetTopSpy.mockRestore()
  })

  it('重新生成导致最新 AI 消息变化但消息数量不变时仍置顶显示', async () => {
    const regeneratedSession: CuratorSession = {
      ...session,
      messages: [
        {
          id: 'u3',
          role: 'user',
          content: '重新生成原问题',
          time: '10:02'
        },
        {
          id: 'a3',
          role: 'assistant',
          content: '重新生成后的回答',
          answer: '重新生成后的回答',
          time: '10:03'
        }
      ]
    }
    const { rerender } = render(
      <CuratorWorkspace
        session={session}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )
    const messagesContainer = screen.getByLabelText('AI Chat Workspace').querySelector('.custom-scrollbar')!
    const scrollTo = vi.fn()
    messagesContainer.scrollTop = 520
    Object.defineProperty(messagesContainer, 'scrollTo', {
      configurable: true,
      value: scrollTo.mockImplementation(({ top }: ScrollToOptions) => {
        messagesContainer.scrollTop = Number(top ?? messagesContainer.scrollTop)
      })
    })
    scrollTo.mockClear()

    rerender(
      <CuratorWorkspace
        session={regeneratedSession}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: 'auto'
      })
    })
  })

  it('删除最新 QA 导致最新 AI 消息回退时不触发置顶滚动', () => {
    const twoTurnSession: CuratorSession = {
      ...session,
      messages: [
        ...session.messages,
        {
          id: 'u2-delete',
          role: 'user',
          content: '准备删除的问题',
          time: '10:02'
        },
        {
          id: 'a2-delete',
          role: 'assistant',
          content: '准备删除的回答',
          answer: '准备删除的回答',
          time: '10:03'
        }
      ]
    }
    const deletedSession: CuratorSession = {
      ...twoTurnSession,
      messages: session.messages
    }
    const { rerender } = render(
      <CuratorWorkspace
        session={session}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )
    const messagesContainer = screen.getByLabelText('AI Chat Workspace').querySelector('.custom-scrollbar')!
    const scrollTo = vi.fn()
    Object.defineProperty(messagesContainer, 'scrollTo', {
      configurable: true,
      value: scrollTo
    })
    scrollTo.mockClear()

    rerender(
      <CuratorWorkspace
        session={twoTurnSession}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )

    expect(scrollTo).toHaveBeenCalled()
    scrollTo.mockClear()

    rerender(
      <CuratorWorkspace
        session={deletedSession}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('AI 回复内容未超出视口时动态收缩底部间距，避免继续滚到底部', async () => {
    const resizeObserverCallbacks: ResizeObserverCallback[] = []
    const originalResizeObserver = globalThis.ResizeObserver

    globalThis.ResizeObserver = class ResizeObserverMock implements ResizeObserver {
      private callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        resizeObserverCallbacks.push(callback)
      }

      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn().mockImplementation(() => {
        const index = resizeObserverCallbacks.indexOf(this.callback)
        if (index >= 0) {
          resizeObserverCallbacks.splice(index, 1)
        }
      })
    }

    let contentHeight = 240
    const offsetTopSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
      .mockImplementation(function getOffsetTop(this: HTMLElement) {
        return this.textContent?.includes('切换后滚动') ? 120 : 0
      })
    const { rerender } = render(
      <CuratorWorkspace
        session={session}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )
    const messagesContainer = screen.getByLabelText('AI Chat Workspace').querySelector('.custom-scrollbar')!
    Object.defineProperty(messagesContainer, 'clientHeight', {
      configurable: true,
      value: 600
    })
    Object.defineProperty(messagesContainer, 'scrollHeight', {
      configurable: true,
      get: () => {
        const spacer = messagesContainer.querySelector('[data-curator-bottom-spacer="true"]') as HTMLElement | null
        const spacerHeight =
          spacer instanceof HTMLElement ? Number.parseFloat(spacer.style.height) || 0 : 0

        return contentHeight + spacerHeight
      }
    })

    rerender(
      <CuratorWorkspace
        session={secondSession}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onSubmitAskAnswer={() => undefined}
        onRegenerateLatestAnswer={() => undefined}
        onDeleteChatTurn={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )

    const getSpacerHeight = () => {
      const spacer = messagesContainer.querySelector('[data-curator-bottom-spacer="true"]') as HTMLElement | null

      return spacer ? Number.parseFloat(spacer.style.height) : 0
    }

    await waitFor(() => {
      expect(getSpacerHeight()).toBe(476)
    })

    contentHeight = 500
    await act(async () => {
      for (const callback of resizeObserverCallbacks) {
        callback([], {} as ResizeObserver)
      }
    })

    await waitFor(() => {
      expect(getSpacerHeight()).toBe(216)
    })

    globalThis.ResizeObserver = originalResizeObserver
    offsetTopSpy.mockRestore()
  })
})
