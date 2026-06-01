/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiChatWorkspace } from '@renderer/features/ai-chat/components/AiChatWorkspace'
import { useAiChatContextStore } from '@renderer/features/ai-chat/aiChatContextStore'
import type {
  AiChatSession,
  AiModelProviderOption,
  AiModelSelection
} from '@renderer/features/ai-chat/aiChatMock'

vi.mock('md-editor-rt', () => ({
  MdPreview: ({ modelValue }: { modelValue: string }) => <div>{modelValue}</div>
}))

const modelOptions: AiModelProviderOption[] = [
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

const selectedModel: AiModelSelection = {
  provider: 'bailian',
  model: 'MiniMax-M2.5'
}

const session: AiChatSession = {
  id: 's1',
  title: '上下文测试',
  summary: '摘要',
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

const secondSession: AiChatSession = {
  id: 's2',
  title: '第二会话',
  summary: '第二条摘要',
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

describe('AiChatWorkspace', () => {
  beforeEach(() => {
    useAiChatContextStore.getState().resetAll()
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
      <AiChatWorkspace
        session={session}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onModelChange={() => undefined}
      />
    )

    await waitFor(() => {
      expect(useAiChatContextStore.getState().getSessionItems('s1')).toHaveLength(2)
    })
    expect(screen.getByText('MiniMax-M2.5')).toBeInTheDocument()
    expect(screen.getByLabelText(/上下文使用 0% · 约 \d+ tokens \/ 204,800/)).toBeInTheDocument()
    expect(screen.queryByLabelText('AI 对话上下文')).not.toBeInTheDocument()
  })

  it('切换 active chat 后复用发送消息的最新 AI 回答定位效果', async () => {
    const { rerender } = render(
      <AiChatWorkspace
        session={session}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onModelChange={() => undefined}
      />
    )
    const messagesContainer = screen.getByLabelText('AI 对话主体').querySelector('.custom-scrollbar')!
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
      <AiChatWorkspace
        session={secondSession}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
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
    const { rerender } = render(
      <AiChatWorkspace
        session={session}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onModelChange={() => undefined}
      />
    )
    const messagesContainer = screen.getByLabelText('AI 对话主体').querySelector('.custom-scrollbar')!
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
      <AiChatWorkspace
        session={secondSession}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={() => undefined}
        onModelChange={() => undefined}
      />
    )

    await waitFor(() => {
      expect(scrollPositions.at(-1)).toBe(0)
    })
    const travelDistances = scrollPositions
      .slice(1)
      .map((position, index) => Math.abs(position - scrollPositions[index]))
      .filter((distance) => distance > 0)

    expect(travelDistances.length).toBeGreaterThanOrEqual(2)
    expect(travelDistances.at(-1)!).toBeGreaterThan(travelDistances[0])
  })
})
