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
  status: '运行完成',
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

describe('AiChatWorkspace', () => {
  beforeEach(() => {
    useAiChatContextStore.getState().resetAll()
  })

  afterEach(() => {
    cleanup()
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
})
