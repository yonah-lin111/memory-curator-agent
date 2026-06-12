/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiChatInput, type AiChatInputCommandId } from '@/features/ai-chat/components/AiChatInput'
import type { AiChatSendPayload } from '@/features/ai-chat/aiChatAgentMentions'

const mockToastWarning = vi.fn()
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    warning: mockToastWarning,
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    show: vi.fn()
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))
import type {
  AiModelProviderOption,
  AiModelSelection
} from '@/features/ai-chat/types'

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
  onCommandExecute: (command: AiChatInputCommandId) => string | void | Promise<string | void> = () => undefined,
  isGenerating = false,
  onSendMessage: (payload: AiChatSendPayload) => void = () => undefined
): void => {
  render(
    <AiChatInput
      modelOptions={modelOptions}
      selectedModel={selectedModel}
      contextUsagePercent={0}
      contextTokens={0}
      contextLimit={204800}
      isGenerating={isGenerating}
      onSendMessage={onSendMessage}
      onCommandExecute={onCommandExecute}
      onModelChange={() => undefined}
    />
  )
}

describe('AiChatInput', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as { api?: unknown }).api
    cleanup()
  })

  it('点击输入容器空白区域时聚焦文本框', () => {
    renderAiChatInput()

    fireEvent.click(screen.getByTestId('ai-chat-input-container'))

    expect(screen.getByLabelText('AI Chat Input Area')).toHaveFocus()
  })

  it('输入多行内容时最多扩张到 6 行高度', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      lineHeight: '20px',
      paddingTop: '0px',
      paddingBottom: '0px'
    } as CSSStyleDeclaration)
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area')
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
    const textarea = screen.getByLabelText('AI Chat Input Area')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/'
      }
    })

    const commandPanel = screen.getByRole('listbox', {
      name: 'AI Command Input Panel'
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
    const textarea = screen.getByLabelText('AI Chat Input Area')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/new'
      }
    })

    const commandPanel = screen.getByRole('listbox', {
      name: 'AI Command Input Panel'
    })
    await waitFor(() => expect(commandPanel).toBeInTheDocument())
    expect(textarea).toHaveFocus()

    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    expect(onCommandExecute).toHaveBeenCalledWith('clear')
  })

  it('支持命令模糊匹配', async () => {
    const onCommandExecute = vi.fn()
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI Chat Input Area')
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
  })

  it('命令面板上下键在首/末项边界截断，不循环', async () => {
    const onCommandExecute = vi.fn()
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI Chat Input Area')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/'
      }
    })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/clear/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /\/undo/ })).toBeInTheDocument()
    })

    // 初始选中 /clear
    expect(screen.getByRole('option', { name: /\/clear/ })).toHaveAttribute('aria-selected', 'true')

    // 上键在首项截断，仍选中 /clear
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/clear/ })).toHaveAttribute('aria-selected', 'true')
    })

    // 下键移到 /undo
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/undo/ })).toHaveAttribute('aria-selected', 'true')
    })

    // 下键移到 /model
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/model/ })).toHaveAttribute('aria-selected', 'true')
    })

    // 下键在末项截断，仍选中 /model
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/model/ })).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('undo 命令返回文本时回填到输入框', async () => {
    renderAiChatInput((command) => (command === 'undo' ? '需要重新编辑的问题' : undefined))
    const textarea = screen.getByLabelText('AI Chat Input Area')
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

  it('命令面板未打开时仅在输入边界支持上下键切换历史提示词', async () => {
    const listPromptHistory = vi.fn().mockResolvedValue(['第一个问题', '第二个问题'])
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        ai: {
          listPromptHistory
        }
      }
    })
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement

    await waitFor(() => expect(listPromptHistory).toHaveBeenCalledTimes(1))

    fireEvent.keyDown(textarea, {
      key: 'ArrowDown'
    })
    expect(textarea).toHaveValue('')

    fireEvent.change(textarea, {
      target: {
        value: '当前草稿'
      }
    })
    textarea.setSelectionRange(2, 2)
    fireEvent.keyDown(textarea, {
      key: 'ArrowUp'
    })
    expect(textarea).toHaveValue('当前草稿')

    textarea.setSelectionRange(0, 0)
    fireEvent.keyDown(textarea, {
      key: 'ArrowUp'
    })
    expect(textarea).toHaveValue('第二个问题')
    await waitFor(() => expect(textarea.selectionStart).toBe(0))
    expect(textarea.selectionEnd).toBe(0)

    fireEvent.keyDown(textarea, {
      key: 'ArrowUp'
    })
    expect(textarea).toHaveValue('第一个问题')
    await waitFor(() => expect(textarea.selectionStart).toBe(0))

    fireEvent.keyDown(textarea, {
      key: 'ArrowUp'
    })
    expect(textarea).toHaveValue('第一个问题')

    textarea.setSelectionRange(0, 0)
    fireEvent.keyDown(textarea, {
      key: 'ArrowDown'
    })
    expect(textarea).toHaveValue('第一个问题')

    textarea.setSelectionRange(2, 2)
    fireEvent.keyDown(textarea, {
      key: 'ArrowDown'
    })
    expect(textarea).toHaveValue('第一个问题')

    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    fireEvent.keyDown(textarea, {
      key: 'ArrowDown'
    })
    expect(textarea).toHaveValue('第二个问题')
    await waitFor(() => expect(textarea.selectionStart).toBe('第二个问题'.length))
    expect(textarea.selectionEnd).toBe('第二个问题'.length)

    fireEvent.keyDown(textarea, {
      key: 'ArrowDown'
    })
    expect(textarea).toHaveValue('当前草稿')
    await waitFor(() => expect(textarea.selectionStart).toBe('当前草稿'.length))
  })

  it('历史提示词包含换行且光标在末尾时下键可切换到下一条', async () => {
    const listPromptHistory = vi.fn().mockResolvedValue(['1\n\n', '第二个问题'])
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        ai: {
          listPromptHistory
        }
      }
    })
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement

    await waitFor(() => expect(listPromptHistory).toHaveBeenCalledTimes(1))

    fireEvent.keyDown(textarea, {
      key: 'ArrowUp'
    })
    await waitFor(() => expect(textarea.selectionStart).toBe(0))
    fireEvent.keyDown(textarea, {
      key: 'ArrowUp'
    })
    expect(textarea).toHaveValue('1\n\n')

    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    fireEvent.keyDown(textarea, {
      key: 'ArrowDown'
    })

    expect(textarea).toHaveValue('第二个问题')
  })

  it('输入 @ 后打开 agent 面板并支持过滤选择', async () => {
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '@'
      }
    })

    expect(screen.getByRole('listbox', { name: 'AI Agent Mention Panel' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /people/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /today/ })).toBeInTheDocument()

    fireEvent.change(textarea, {
      target: {
        value: '@pe'
      }
    })

    expect(screen.getByRole('option', { name: /people/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /todo/ })).not.toBeInTheDocument()

    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    await waitFor(() => expect(textarea).toHaveValue('@people_agent '))
    expect(textarea).toHaveClass('text-white')
  })

  it('输入 @ 处于 composition 状态时按下 Enter 回车，不应执行 agent 选中', async () => {
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '@'
      }
    })

    expect(screen.getByRole('listbox', { name: 'AI Agent Mention Panel' })).toBeInTheDocument()

    // 触发 keydown，带 isComposing 为 true
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    })
    Object.defineProperty(event, 'isComposing', { value: true })
    fireEvent(textarea, event)

    // 输入框不应该被填入选中的 agent (仍然是原来输入的内容 '@')
    expect(textarea).toHaveValue('@')
    expect(screen.getByRole('listbox', { name: 'AI Agent Mention Panel' })).toBeInTheDocument()
  })

  it('发送时剥离 agent token 并保存包含 @ 命令的原始 prompt history', async () => {
    const onSendMessage = vi.fn()
    const addPromptHistory = vi.fn().mockResolvedValue(['查阿明'])
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        ai: {
          addPromptHistory
        }
      }
    })
    renderAiChatInput(() => undefined, false, onSendMessage)
    const textarea = screen.getByLabelText('AI Chat Input Area')

    fireEvent.change(textarea, {
      target: {
        value: '@people_agent  @todo_agent 查阿明'
      }
    })
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    expect(onSendMessage).toHaveBeenCalledWith({
      text: '查阿明',
      agents: [
        {
          id: 'people',
          token: '@people_agent',
          label: 'people',
          priority: 1
        },
        {
          id: 'todo',
          token: '@todo_agent',
          label: 'todo',
          priority: 2
        }
      ]
    })
    expect(addPromptHistory).toHaveBeenCalledWith('@people_agent  @todo_agent 查阿明')
    await waitFor(() => expect(textarea).toHaveValue(''))
  })

  it('输入框只有 agent token 时不发送', () => {
    const onSendMessage = vi.fn()
    renderAiChatInput(() => undefined, false, onSendMessage)
    const textarea = screen.getByLabelText('AI Chat Input Area')

    fireEvent.change(textarea, {
      target: {
        value: '@people_agent '
      }
    })
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    expect(onSendMessage).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('Backspace 在 token 后一次删除完整 agent token', () => {
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement

    fireEvent.change(textarea, {
      target: {
        value: '@people_agent 查阿明'
      }
    })
    textarea.setSelectionRange('@people_agent '.length, '@people_agent '.length)
    fireEvent.keyDown(textarea, {
      key: 'Backspace'
    })

    expect(textarea).toHaveValue('查阿明')
  })

  it('斜杠命令面板打开时不打开 agent 面板', () => {
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area')

    fireEvent.change(textarea, {
      target: {
        value: '/'
      }
    })

    expect(screen.getByRole('listbox', { name: 'AI Command Input Panel' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox', { name: 'AI Agent Mention Panel' })).not.toBeInTheDocument()
  })

  it('在 AI 正在输出时（isGenerating = true）尝试发送，会通过 Toast 提示并阻止发送', async () => {
    const onSendMessage = vi.fn()
    renderAiChatInput(() => undefined, true, onSendMessage)
    const textarea = screen.getByLabelText('AI Chat Input Area')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '新的测试问题'
      }
    })

    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    expect(mockToastWarning).toHaveBeenCalledWith('请等待 AI 输出完成')
    expect(onSendMessage).not.toHaveBeenCalled()
  })

  it('点击清空按钮时清空输入框并聚焦', () => {
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '待清空的内容'
      }
    })

    const clearButton = screen.getByRole('button', { name: 'Clear input' })
    expect(clearButton).not.toBeDisabled()

    fireEvent.click(clearButton)

    expect(textarea).toHaveValue('')
    expect(textarea).toHaveFocus()
  })

  it('当选择的模型支持图片输入时，最多一次性上传 6 张图片，超出则警告并截断', async () => {
    const mockSaveAiChatImage = vi.fn().mockImplementation(({ name }) => {
      return Promise.resolve({ url: `mc-img://chat/${name}` })
    })

    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        files: {
          saveAiChatImage: mockSaveAiChatImage
        }
      }
    })

    const modelOptionsWithImage: AiModelProviderOption[] = [
      {
        id: 'bailian',
        name: 'Bailian',
        models: [
          {
            id: 'multimodal-model',
            name: 'Multimodal Model',
            limit: {
              context: 204800,
              output: 131072
            },
            modalities: {
              input: ['text', 'image'],
              output: ['text']
            }
          }
        ]
      }
    ]

    const selectedModelWithImage: AiModelSelection = {
      provider: 'bailian',
      model: 'multimodal-model'
    }

    render(
      <AiChatInput
        modelOptions={modelOptionsWithImage}
        selectedModel={selectedModelWithImage}
        contextUsagePercent={0}
        contextTokens={0}
        contextLimit={204800}
        isGenerating={false}
        onSendMessage={() => undefined}
        onCommandExecute={() => undefined}
        onModelChange={() => undefined}
      />
    )

    // 查找并获取 file input
    const fileInput = screen.getByTestId('ai-chat-input-container').querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()

    // 模拟上传 7 张图片
    const files = Array.from({ length: 7 }, (_, i) => {
      const f = new File([''], `pic-${i}.png`, { type: 'image/png' })
      Object.defineProperty(f, 'size', { value: 1024 })
      return f
    })

    // 触发 file input change 事件
    fireEvent.change(fileInput, {
      target: { files }
    })

    // 校验 mockSaveAiChatImage 调用次数限制为 6（只保存了前 6 张）
    await waitFor(() => {
      expect(mockSaveAiChatImage).toHaveBeenCalledTimes(6)
    })

    // 校验是否弹出了正确的 toast 提示
    expect(mockToastWarning).toHaveBeenCalledWith('最多只能上传 6 张图片，已自动截取前 6 张')
  })

  it('模糊匹配斜杠命令执行时不以 / 开头命令记录提示词历史', async () => {
    const onCommandExecute = vi.fn()
    const addPromptHistory = vi.fn().mockResolvedValue([])
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        ai: {
          addPromptHistory
        }
      }
    })
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI Chat Input Area')
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
    expect(addPromptHistory).not.toHaveBeenCalled()
  })

  it('以 / 开头的草稿在历史导航回绕后下键不再循环', async () => {
    const listPromptHistory = vi.fn().mockResolvedValue(['第一个问题', '第二个问题'])
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        ai: {
          listPromptHistory
        }
      }
    })
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement

    await waitFor(() => expect(listPromptHistory).toHaveBeenCalledTimes(1))

    // 输入以 / 开头的草稿
    fireEvent.change(textarea, { target: { value: '/xyz' } })
    textarea.setSelectionRange(0, 0)

    // ArrowUp 正常进入历史
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('第二个问题')

    // 回绕到草稿
    textarea.setSelectionRange('第二个问题'.length, '第二个问题'.length)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea).toHaveValue('/xyz')

    // 再次下键停在草稿，不回绕到历史首项
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea).toHaveValue('/xyz')
  })

  it('执行 /clear 后，使用上键、下键切换历史不会显示已经执行的命令', async () => {
    const listPromptHistory = vi.fn().mockResolvedValue(['第一个问题', '第二个问题'])
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        ai: {
          listPromptHistory
        }
      }
    })
    const onCommandExecute = vi.fn().mockResolvedValue('')
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement
    textarea.focus()

    await waitFor(() => expect(listPromptHistory).toHaveBeenCalledTimes(1))

    // 输入以 /cl
    fireEvent.change(textarea, { target: { value: '/cl' } })
    
    // 等待命令面板显示并回车执行
    const commandPanel = screen.getByRole('listbox', {
      name: 'AI Command Input Panel'
    })
    await waitFor(() => expect(commandPanel).toBeInTheDocument())
    
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onCommandExecute).toHaveBeenCalledWith('clear')
    await waitFor(() => expect(textarea).toHaveValue(''))

    // 此时按上键（进入历史）
    textarea.setSelectionRange(0, 0)
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('第二个问题')

    // 此时按下键（回到草稿）
    textarea.setSelectionRange('第二个问题'.length, '第二个问题'.length)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea).toHaveValue('') // 应该是空，而不应该是 '/cl'
  })

  it('正确统计并显示历史提示词序号，在修改输入或清空时统计信息消失', async () => {
    const listPromptHistory = vi.fn().mockResolvedValue(['第一个问题', '第二个问题'])
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        ai: {
          listPromptHistory
        }
      }
    })
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement

    await waitFor(() => expect(listPromptHistory).toHaveBeenCalledTimes(1))

    // 初始状态下不应显示历史统计
    expect(screen.queryByText(/History:/)).not.toBeInTheDocument()

    // 按上键，进入最新历史 (1-based 应为 2/2)
    textarea.setSelectionRange(0, 0)
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('第二个问题')
    expect(screen.getByText('History: 2/2')).toBeInTheDocument()

    // 等待光标被移到起始位置 (0)
    await waitFor(() => expect(textarea.selectionStart).toBe(0))

    // 再次按上键，进入第一条历史 (1-based 应为 1/2)
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('第一个问题')
    expect(screen.getByText('History: 1/2')).toBeInTheDocument()

    // 等待光标重置到 0 处
    await waitFor(() => expect(textarea.selectionStart).toBe(0))

    // 要按下键往回切换，光标必须在文本末尾
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    // 按下键回到第二条历史 (2/2)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea).toHaveValue('第二个问题')
    expect(screen.getByText('History: 2/2')).toBeInTheDocument()

    // 等待光标重置到末尾位置
    await waitFor(() => expect(textarea.selectionStart).toBe('第二个问题'.length))

    // 按下键回到草稿状态，统计数字应消失
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea).toHaveValue('')
    expect(screen.queryByText(/History:/)).not.toBeInTheDocument()

    // 等待光标被同步
    await waitFor(() => expect(textarea.selectionStart).toBe(0))

    // 再次进入历史 (2/2)
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(screen.getByText('History: 2/2')).toBeInTheDocument()

    // 等待光标定位
    await waitFor(() => expect(textarea.selectionStart).toBe(0))

    // 手动修改输入内容，统计数字应消失
    fireEvent.change(textarea, { target: { value: '修改内容' } })
    expect(screen.queryByText(/History:/)).not.toBeInTheDocument()
  })
})
