/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiChatInput } from '@renderer/features/ai-chat/components/AiChatInput'
import type {
  AiModelProviderOption,
  AiModelSelection
} from '@renderer/features/ai-chat/aiChatMock'

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

const renderAiChatInput = (): void => {
  render(
    <AiChatInput
      modelOptions={modelOptions}
      selectedModel={selectedModel}
      contextUsagePercent={0}
      contextTokens={0}
      contextLimit={204800}
      onSendMessage={() => undefined}
      onModelChange={() => undefined}
    />
  )
}

describe('AiChatInput', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('点击输入容器空白区域时聚焦文本框', () => {
    renderAiChatInput()

    fireEvent.click(screen.getByTestId('ai-chat-input-container'))

    expect(screen.getByLabelText('AI 对话输入框')).toHaveFocus()
  })

  it('输入多行内容时最多扩张到 6 行高度', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      lineHeight: '20px',
      paddingTop: '0px',
      paddingBottom: '0px'
    } as CSSStyleDeclaration)
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI 对话输入框')
    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      value: 180
    })

    fireEvent.change(textarea, {
      target: {
        value: '1\n2\n3\n4\n5\n6\n7'
      }
    })

    expect((textarea as HTMLTextAreaElement).style.height).toBe('120px')
    expect((textarea as HTMLTextAreaElement).style.overflowY).toBe('auto')
  })
})
