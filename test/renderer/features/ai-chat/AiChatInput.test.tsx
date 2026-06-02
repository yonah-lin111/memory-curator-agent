/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const renderAiChatInput = (
  onCommandExecute: (command: 'clear' | 'undo') => string | void | Promise<string | void> = () => undefined
): void => {
  render(
    <AiChatInput
      modelOptions={modelOptions}
      selectedModel={selectedModel}
      contextUsagePercent={0}
      contextTokens={0}
      contextLimit={204800}
      onSendMessage={() => undefined}
      onCommandExecute={onCommandExecute}
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

  it('输入 / 后保持输入框聚焦并支持键盘选择执行命令', async () => {
    const onCommandExecute = vi.fn()
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI 对话输入框')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/'
      }
    })

    const commandPanel = screen.getByRole('listbox', {
      name: 'AI 输入命令面板'
    })
    await waitFor(() => expect(commandPanel).toBeInTheDocument())
    expect(textarea).toHaveFocus()
    expect(screen.queryByText('不加入上下文')).not.toBeInTheDocument()

    fireEvent.keyDown(textarea, {
      key: 'ArrowDown'
    })
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    expect(onCommandExecute).toHaveBeenCalledWith('undo')
    await waitFor(() => expect(textarea).toHaveValue(''))
  })

  it('输入 /new 时匹配新建对话命令', async () => {
    const onCommandExecute = vi.fn()
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI 对话输入框')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/new'
      }
    })

    const commandPanel = screen.getByRole('listbox', {
      name: 'AI 输入命令面板'
    })
    await waitFor(() => expect(commandPanel).toBeInTheDocument())
    expect(textarea).toHaveFocus()

    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    expect(onCommandExecute).toHaveBeenCalledWith('clear')
  })

  it('支持命令模糊匹配和上下循环切换', async () => {
    const onCommandExecute = vi.fn()
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI 对话输入框')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/ce'
      }
    })

    await waitFor(() => expect(screen.getByRole('option', { name: /\/clear/ })).toBeInTheDocument())
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })
    expect(onCommandExecute).toHaveBeenCalledWith('clear')

    fireEvent.change(textarea, {
      target: {
        value: '/'
      }
    })
    fireEvent.keyDown(textarea, {
      key: 'ArrowUp'
    })
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    expect(onCommandExecute).toHaveBeenLastCalledWith('undo')
  })

  it('undo 命令返回文本时回填到输入框', async () => {
    renderAiChatInput((command) => (command === 'undo' ? '需要重新编辑的问题' : undefined))
    const textarea = screen.getByLabelText('AI 对话输入框')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/undo'
      }
    })
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    await waitFor(() => expect(textarea).toHaveValue('需要重新编辑的问题'))
    expect(textarea).toHaveFocus()
  })
})
