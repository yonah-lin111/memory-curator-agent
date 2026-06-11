/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/App'
import type {
  AiChatEvent,
  AiChatSession,
  AiChatStartPayload
} from '@/features/ai-chat/types'
import { useAiChatContextStore } from '@/features/ai-chat/aiChatContextStore'

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    useAiChatContextStore.getState().resetAll()
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

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.queryByText('MEMORY CURATOR')).not.toBeInTheDocument()
    expect(screen.getAllByText('DAILY')).toHaveLength(1)
    expect(screen.queryByText('LIBRARY')).not.toBeInTheDocument()
    expect(screen.queryByText('CURATION')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('使用更小的圆形折叠按钮', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveClass('h-6', 'w-6', 'rounded-full')
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
    expect(screen.getByRole('button', { name: /View previous day/ })).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Sidebar main navigation')).getByRole('button', { name: /Journal/ })
    ).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /Weekly Review/ }))
    expect(screen.getByLabelText('Weekly Review Page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Weekly Review/ })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /Themes/ }))
    expect(screen.getByLabelText('Themes Page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Themes/ })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /Memories/ }))
    expect(screen.getByLabelText('Memories Page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Memories/ })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: /People/ }))
    expect(screen.getByLabelText('People Page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /People/ })).toHaveAttribute('aria-current', 'page')
  })

  it('支持从左侧栏底部进入 Settings 页面', async () => {
    const user = userEvent.setup()

    window.api = {
      config: {
        ai: {
          get: vi.fn(async () => ({
            configPath: '/Users/yonah/.mc/config.json',
            defaultModel: {
              provider: 'gemini',
              model: 'gemini-3.5-flash'
            },
            titleSummary: {
              provider: 'gemini',
              model: 'gemini-3.5-flash'
            },
            enabledProviders: ['gemini'],
            providers: {
              gemini: {
                id: 'gemini',
                type: 'google',
                name: 'Gemini',
                options: {
                  apiKey: 'secret',
                  baseURL: 'https://example.com/v1'
                },
                models: {
                  'gemini-3.5-flash': {
                    id: 'gemini-3.5-flash',
                    name: 'Gemini 3.5 Flash',
                    limit: {
                      context: 1000000,
                      output: 65536
                    },
                    modalities: {
                      input: ['text'],
                      output: ['text']
                    }
                  }
                }
              }
            },
            agent: {
              context: {
                toolOutputMaxChars: 4096,
                recentToolResultLimit: 3
              }
            }
          })),
          save: vi.fn()
        }
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Settings/ }))

    expect(window.location.pathname).toBe('/settings')
    expect(await screen.findByText('/Users/yonah/.mc/config.json')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Settings/ })).toHaveAttribute('aria-current', 'page')
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

    expect(screen.getByRole('button', { name: /View previous day/ })).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Sidebar main navigation')).getByRole('button', { name: /Journal/ })
    ).toHaveAttribute('aria-current', 'page')
  })

  it('Journal / Todo / Snippets 路由进入正式页面而不是占位文案', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Journal/ }))
    expect(screen.getByRole('button', { name: /View previous day/ })).toBeInTheDocument()
    expect(screen.queryByText(/COMING SOON/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Todo/ }))
    expect(screen.getByRole('button', { name: 'Toggle add todo composer' })).toBeInTheDocument()
    expect(screen.queryByText(/COMING SOON/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Snippets/ }))
    expect(screen.getByText('全部片段')).toBeInTheDocument()
    expect(screen.queryByText(/COMING SOON/)).not.toBeInTheDocument()
  })

  it('中间内容容器保留克制的左右内边距', () => {
    render(<App />)

    expect(screen.getByLabelText('Main content container')).toHaveClass('px-1', 'lg:px-2')
  })

  it('点击添加按钮可显示待办录入框，一键排序按钮可对列表进行排序', async () => {
    const user = userEvent.setup()
    render(<App />)

    const toggleBtn = screen.getByRole('button', { name: 'Toggle add todo composer' })
    expect(toggleBtn).toBeInTheDocument()
    await user.click(toggleBtn)

    const input = screen.getByPlaceholderText('添加一个待办，回车保存')
    expect(input).toBeInTheDocument()

    const sortBtn = screen.getByRole('button', { name: 'One-click sort' })
    expect(sortBtn).toBeInTheDocument()
  })

  it('支持直接在输入框中添加新待办，并可点击切换优先级', async () => {
    const user = userEvent.setup()

    render(<App />)

    // 初始应该有 "已完成 3/5"
    expect(screen.getByText('已完成 3/5')).toBeInTheDocument()

    const toggleBtn = screen.getByRole('button', { name: 'Toggle add todo composer' })
    await user.click(toggleBtn)

    const input = screen.getByPlaceholderText('添加一个待办，回车保存')
    // 默认优先级是 P1
    const priorityBtn = screen.getByRole('button', { name: /Toggle new todo priority/ })
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

    const priorityBtn = container.querySelector('button[aria-label^="Toggle priority of "]')!
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
    const deleteBtn = container.querySelector('button[aria-label="Delete todo 完成 Today 工作台的三栏静态布局编码与视觉自审"]')!

    await user.click(deleteBtn)

    // 等待待办被实际移除并更新计数
    await waitFor(() => {
      expect(screen.queryByText('完成 Today 工作台的三栏静态布局编码与视觉自审')).not.toBeInTheDocument()
    })
    expect(screen.getByText('已完成 3/4')).toBeInTheDocument()
  })

  it('AI 对话支持流式文本和工具步骤更新', async () => {
    const user = userEvent.setup()
    const listeners: Array<(event: AiChatEvent) => void> = []
    let capturedPayload: AiChatStartPayload | null = null

    window.api = {
      ai: {
        startChat: vi.fn(async (payload: AiChatStartPayload) => {
          capturedPayload = payload
          return {
            runId: payload.runId ?? 'run-test'
          }
        }),
        onChatEvent: (listener: (event: AiChatEvent) => void) => {
          listeners.push(listener)
          return () => undefined
        }
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    await user.type(screen.getByLabelText('AI Chat Input Area'), '阿明是谁')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(window.api.ai?.startChat).toHaveBeenCalled()
    })
    expect(capturedPayload).toMatchObject({
      message: '阿明是谁'
    })

    act(() => {
      listeners.forEach((listener) =>
        listener({
          type: 'tool_started',
          runId: capturedPayload!.runId!,
          sessionId: capturedPayload!.sessionId,
          id: 'call-1',
          name: 'people_tool_query',
          input: {
            query: '阿明'
          }
        })
      )
    })
    expect(screen.getByText('Reading the local People table.')).toBeInTheDocument()

    act(() => {
      listeners.forEach((listener) =>
        listener({
          type: 'tool_finished',
          runId: capturedPayload!.runId!,
          sessionId: capturedPayload!.sessionId,
          id: 'call-1',
          name: 'people_tool_query',
          observation: '找到 1 位关联人物：阿明｜朋友｜技术狂热者',
          data: []
        })
      )
      listeners.forEach((listener) =>
        listener({
          type: 'text_delta',
          runId: capturedPayload!.runId!,
          sessionId: capturedPayload!.sessionId,
          delta: '阿明是朋友。'
        })
      )
    })

    expect(screen.getByText('找到 1 位关联人物：阿明｜朋友｜技术狂热者')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('阿明是朋友。')).toBeInTheDocument()
    })
  })

  it('AI 对话切换历史后继续使用持久化助手消息接收流式输出', async () => {
    const user = userEvent.setup()
    const listeners: Array<(event: AiChatEvent) => void> = []
    let capturedPayload: AiChatStartPayload | null = null
    const cancelAsk = vi.fn(async () => undefined)
    const cancelChat = vi.fn(async () => undefined)

    window.api = {
      ai: {
        listSessions: vi.fn(async () => [
          {
            id: 'today-memory',
            title: '整理今天的记忆线索',
            time: '10:24',
            status: 'completed',
            messages: []
          },
          {
            id: 'weekly-actions',
            title: '周回顾行动拆解',
            time: '09:12',
            status: 'completed',
            messages: []
          }
        ]),
        getSession: vi.fn(async (sessionId: string) => {
          if (sessionId === 'weekly-actions') {
            return {
              id: 'weekly-actions',
              title: '周回顾行动拆解',
              time: '09:12',
              status: 'completed',
              messages: []
            }
          }
          if (capturedPayload && sessionId === capturedPayload.sessionId) {
            return {
              id: capturedPayload.sessionId,
              title: '整理今天的记忆线索',
              time: '10:24',
              status: 'running',
              messages: [
                {
                  id: capturedPayload.userMessageId ?? 'fallback-user-message',
                  role: 'user',
                  content: capturedPayload.message,
                  time: '10:24'
                },
                {
                  id: capturedPayload.assistantMessageId ?? 'fallback-assistant-message',
                  role: 'assistant',
                  content: 'AI 已生成回答',
                  answer: '切换前',
                  parts: [
                    {
                      id: `${capturedPayload.assistantMessageId ?? 'fallback-assistant-message'}-text-0`,
                      kind: 'text',
                      content: '切换前'
                    }
                  ],
                  toolSteps: [],
                  time: '10:24'
                }
              ]
            }
          }
          return {
            id: 'today-memory',
            title: '整理今天的记忆线索',
            time: '10:24',
            status: 'completed',
            messages: []
          }
        }),
        startChat: vi.fn(async (payload: AiChatStartPayload) => {
          capturedPayload = payload
          return {
            runId: payload.runId ?? 'run-test'
          }
        }),
        cancelAsk,
        cancelChat,
        onChatEvent: (listener: (event: AiChatEvent) => void) => {
          listeners.push(listener)
          return () => undefined
        }
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    await user.type(screen.getByLabelText('AI Chat Input Area'), '切换不断流')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(window.api.ai?.startChat).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /周回顾行动拆解/ }))
    expect(cancelAsk).toHaveBeenCalledWith(capturedPayload!.runId)
    expect(cancelChat).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /整理今天的记忆线索/ }))

    await waitFor(() => {
      expect(screen.getByText('切换前')).toBeInTheDocument()
    })

    act(() => {
      listeners.forEach((listener) =>
        listener({
          type: 'text_delta',
          runId: capturedPayload!.runId!,
          sessionId: capturedPayload!.sessionId,
          delta: '继续输出'
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('切换前继续输出')).toBeInTheDocument()
    })
  })

  it('Ask 等待态收到标题更新后切换历史仍会取消当前 Ask', async () => {
    const user = userEvent.setup()
    const listeners: Array<(event: AiChatEvent) => void> = []
    let capturedPayload: AiChatStartPayload | null = null
    const cancelAsk = vi.fn(async () => undefined)

    window.api = {
      ai: {
        listSessions: vi.fn(async () => [
          {
            id: 'new-chat',
            title: '新建对话',
            time: '2026-06-03 10:00',
            status: 'idle',
            messages: []
          },
          {
            id: 'other-chat',
            title: '其他会话',
            time: '2026-06-03 09:00',
            status: 'completed',
            messages: []
          }
        ]),
        getSession: vi.fn(async (sessionId: string) => ({
          id: sessionId,
          title: sessionId === 'new-chat' ? '新建对话' : '其他会话',
          time: sessionId === 'new-chat' ? '2026-06-03 10:00' : '2026-06-03 09:00',
          status: sessionId === 'new-chat' ? 'idle' : 'completed',
          messages: []
        })),
        startChat: vi.fn(async (payload: AiChatStartPayload) => {
          capturedPayload = payload
          return {
            runId: payload.runId ?? 'run-test'
          }
        }),
        cancelAsk,
        onChatEvent: (listener: (event: AiChatEvent) => void) => {
          listeners.push(listener)
          return () => undefined
        }
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    await user.type(screen.getByLabelText('AI Chat Input Area'), '我的女朋友是谁')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(window.api.ai?.startChat).toHaveBeenCalled()
    })

    act(() => {
      listeners.forEach((listener) => {
        listener({
          type: 'tool_finished',
          runId: capturedPayload!.runId!,
          sessionId: capturedPayload!.sessionId,
          id: 'ask-1',
          name: 'common_tool_ask',
          observation: 'Ask request created: waiting for the user.',
          data: {
            kind: 'ask_request',
            id: 'ask-request-1',
            questions: [
              {
                header: '确认',
                question: '你指的是哪一位？',
                options: [
                  {
                    label: 'A',
                    description: '第一位'
                  }
                ]
              }
            ]
          }
        })
        listener({
          type: 'session_title_updated',
          runId: capturedPayload!.runId!,
          sessionId: capturedPayload!.sessionId,
          title: '关系人物查询'
        })
      })
    })

    await user.click(screen.getByRole('button', { name: /其他会话/ }))

    expect(cancelAsk).toHaveBeenCalledWith(capturedPayload!.runId)
  })

  it('启动时优先使用持久化 AI 会话', async () => {
    window.api = {
      ai: {
        listSessions: vi.fn(async () => [
          {
            id: 'persisted-s1',
            title: '持久化会话',
            time: '10:00',
            status: 'completed',
            messages: [
              {
                id: 'persisted-m1',
                role: 'user',
                content: '恢复一条历史',
                time: '10:00'
              }
            ]
          }
        ]),
        getSession: vi.fn(async (sessionId: string) => ({
          id: sessionId,
          title: '持久化会话',
          time: '10:00',
          status: 'completed',
          messages: [
            {
              id: 'persisted-m1',
              role: 'user',
              content: '恢复一条历史',
              time: '10:00'
            }
          ]
        })),
        getModelOptions: vi.fn(async () => ({
          defaultProvider: 'bailian',
          defaultModel: 'MiniMax-M2.5',
          providers: [],
          agent: { context: { toolOutputMaxChars: 4096, recentToolResultLimit: 3 } }
        })),
        startChat: vi.fn(),
        onChatEvent: vi.fn(() => () => undefined)
      }
    } as never

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('持久化会话')).toBeInTheDocument()
    })
  })

  it('AI 对话发送时使用当前选择的模型', async () => {
    const user = userEvent.setup()
    const startChat = vi.fn(async (payload: AiChatStartPayload) => ({
      runId: payload.runId ?? 'run-test'
    }))

    window.api = {
      ai: {
        getModelOptions: vi.fn(async () => ({
          defaultProvider: 'bailian',
          defaultModel: 'MiniMax-M2.5',
          agent: {
            context: {
              toolOutputMaxChars: 4096,
              recentToolResultLimit: 3
            }
          },
          providers: [
            {
              id: 'bailian',
              name: 'Bailian',
              models: [
                {
                  id: 'MiniMax-M2.5',
                  name: 'MiniMax-M2.5'
                }
              ]
            },
            {
              id: 'gemini',
              name: 'Gemini',
              models: [
                {
                  id: 'gemini-3.5-flash',
                  name: 'Gemini 3.5 Flash'
                }
              ]
            }
          ]
        })),
        startChat,
        onChatEvent: () => () => undefined
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    await user.click(await screen.findByRole('button', { name: /MiniMax-M2\.5/ }))
    await user.click(screen.getByRole('option', { name: 'Gemini 3.5 Flash' }))
    await user.type(screen.getByLabelText('AI Chat Input Area'), '使用 Gemini')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(startChat).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '使用 Gemini',
          provider: 'gemini',
          model: 'gemini-3.5-flash'
        })
      )
    })
  })

  it('AI 对话发送时剥离 agent token 并携带 agent hints', async () => {
    const user = userEvent.setup()
    const startChat = vi.fn(async (payload: AiChatStartPayload) => ({
      runId: payload.runId ?? 'run-test'
    }))

    window.api = {
      ai: {
        startChat,
        onChatEvent: () => () => undefined
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    const input = screen.getByLabelText('AI Chat Input Area')
    await user.type(input, '@pe')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(input).toHaveValue('@people_agent '))
    fireEvent.change(input, {
      target: {
        value: '@people_agent 查阿明'
      }
    })
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(startChat).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '查阿明',
          agents: [
            {
              id: 'people',
              priority: 1
            }
          ]
        })
      )
    })
    expect(screen.getAllByText('查阿明').length).toBeGreaterThan(0)
    expect(screen.queryByText('@people_agent 查阿明')).not.toBeInTheDocument()
  })

  it('AI 对话第二轮发送时携带上一轮消息上下文', async () => {
    const user = userEvent.setup()
    const listeners: Array<(event: AiChatEvent) => void> = []
    const startChat = vi.fn(async (payload: AiChatStartPayload) => ({
      runId: payload.runId ?? 'run-test'
    }))

    window.api = {
      ai: {
        startChat,
        onChatEvent: (listener: (event: AiChatEvent) => void) => {
          listeners.push(listener)
          return () => undefined
        }
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    await user.type(screen.getByLabelText('AI Chat Input Area'), '第一个问题是什么')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(startChat).toHaveBeenCalledTimes(1)
    })

    const firstPayload = startChat.mock.calls[0][0]

    act(() => {
      listeners.forEach((listener) => {
        listener({
          type: 'text_delta',
          runId: firstPayload.runId!,
          sessionId: firstPayload.sessionId,
          delta: '第一个问题是关于上下文。'
        })
        listener({
          type: 'done',
          runId: firstPayload.runId!,
          sessionId: firstPayload.sessionId
        })
      })
    })

    await waitFor(() => {
      expect(screen.getByText('第一个问题是关于上下文。')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('AI Chat Input Area'), '上一个问题是什么')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(startChat).toHaveBeenCalledTimes(2)
    })

    expect(startChat.mock.calls[1][0].context).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'message',
          content: '第一个问题是什么',
          meta: expect.objectContaining({
            role: 'user'
          })
        }),
        expect.objectContaining({
          kind: 'message',
          content: '第一个问题是关于上下文。',
          meta: expect.objectContaining({
            role: 'assistant'
          })
        })
      ])
    )
  })

  it('非激活会话输出完成后在历史列表显示完成提醒', async () => {
    const user = userEvent.setup()
    const listeners: Array<(event: AiChatEvent) => void> = []
    const startChat = vi.fn(async (payload: AiChatStartPayload) => ({
      runId: payload.runId ?? 'run-test'
    }))

    window.api = {
      ai: {
        listSessions: vi.fn(async () => [
          {
            id: 's-running',
            title: '运行会话',
            time: '2026-05-31 10:00',
            status: 'completed',
            messages: []
          },
          {
            id: 's-other',
            title: '其他会话',
            time: '2026-05-31 09:00',
            status: 'completed',
            messages: []
          }
        ]),
        getSession: vi.fn(async (sessionId: string) => ({
          id: sessionId,
          title: sessionId === 's-running' ? '运行会话' : '其他会话',
          time: sessionId === 's-running' ? '2026-05-31 10:00' : '2026-05-31 09:00',
          status: 'completed',
          messages: []
        })),
        startChat,
        onChatEvent: (listener: (event: AiChatEvent) => void) => {
          listeners.push(listener)
          return () => undefined
        }
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    const historyList = screen.getByLabelText('AI chat history sessions')
    await within(historyList).findByText('运行会话')
    await user.type(screen.getByLabelText('AI Chat Input Area'), '后台完成提醒')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(startChat).toHaveBeenCalledTimes(1)
    })

    const payload = startChat.mock.calls[0][0]
    await user.click(within(historyList).getByText('其他会话'))

    act(() => {
      listeners.forEach((listener) => {
        listener({
          type: 'done',
          runId: payload.runId!,
          sessionId: payload.sessionId
        })
      })
    })

    await waitFor(() => {
      expect(within(historyList).getByText('运行会话').closest('[role="button"]')).toHaveClass(
        'text-emerald-300'
      )
    })
  })

  it('AI 对话第二轮发送时携带上一轮工具查询上下文', async () => {
    const user = userEvent.setup()
    const listeners: Array<(event: AiChatEvent) => void> = []
    const startChat = vi.fn(async (payload: AiChatStartPayload) => ({
      runId: payload.runId ?? 'run-test'
    }))

    window.api = {
      ai: {
        startChat,
        onChatEvent: (listener: (event: AiChatEvent) => void) => {
          listeners.push(listener)
          return () => undefined
        }
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    await user.type(screen.getByLabelText('AI Chat Input Area'), '查一下阿明')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(startChat).toHaveBeenCalledTimes(1)
    })

    const firstPayload = startChat.mock.calls[0][0]

    act(() => {
      listeners.forEach((listener) => {
        listener({
          type: 'tool_finished',
          runId: firstPayload.runId!,
          sessionId: firstPayload.sessionId,
          id: 'call-1',
          name: 'people_tool_query',
          observation: '找到 1 位关联人物：阿明｜朋友｜技术狂热者',
          data: []
        })
        listener({
          type: 'done',
          runId: firstPayload.runId!,
          sessionId: firstPayload.sessionId
        })
      })
    })
    await waitFor(() => {
      expect(screen.getByText('找到 1 位关联人物：阿明｜朋友｜技术狂热者')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('AI Chat Input Area'), '刚才工具查到了什么')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(startChat).toHaveBeenCalledTimes(2)
    })

    expect(startChat.mock.calls[1][0].context).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: expect.stringMatching(/^tool:.*:call-1$/),
          kind: 'tool',
          title: 'Tool result: people_tool_query',
          content: expect.stringContaining('找到 1 位关联人物：阿明｜朋友｜技术狂热者'),
          meta: expect.objectContaining({
            tool: 'people_tool_query',
            messageId: expect.any(String)
          })
        })
      ])
    )
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
    const checkboxBtn = container.querySelector('button[aria-label="Mark as completed"]')!

    await user.click(checkboxBtn)

    // 验证完成状态已变，但在手动排序前，索引应该依旧保持在 0，不发生重排
    const todoItemsAfterToggle = screen.getAllByTestId('today-todo-item')
    const afterToggleIndex = todoItemsAfterToggle.findIndex((item) =>
      item.textContent?.includes('修复渲染层 TypeScript 编译错误与 Lint 规范冲突'),
    )
    expect(afterToggleIndex).toBe(0)

    // 点击一键排序按钮
    const sortBtn = screen.getByRole('button', { name: 'One-click sort' })
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

    await user.click(screen.getByRole('button', { name: 'Add free snippet' }))

    const dialog = screen.getByRole('dialog', { name: '新建自由随记卡片' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByLabelText('Snippet title')).toBeInTheDocument()
    expect(screen.getByLabelText('Snippet content')).toBeInTheDocument()
    
    // 输入新标签并回车产生标签
    const tagInput = screen.getByLabelText('Input new tag')
    expect(tagInput).toBeInTheDocument()
    await user.type(tagInput, 'UX{Enter}')
    
    expect(within(dialog).getByText('UX')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete tag' })).toBeInTheDocument()
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

    const titleInput = screen.getByLabelText('Snippet title')
    const contentInput = screen.getByLabelText('Snippet content')

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
    await user.click(screen.getByRole('button', { name: 'Add free snippet' }))

    const titleInput = screen.getByLabelText('Snippet title')
    const contentInput = screen.getByLabelText('Snippet content')

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

    const deleteBtn = screen.getByRole('button', { name: 'Delete snippet 本地持久化方案表现' })
    expect(deleteBtn).toBeInTheDocument()

    await user.click(deleteBtn)

    // 应该在删除延时后彻底从 DOM 移除
    await waitFor(() => {
      expect(screen.queryByText('本地持久化方案表现')).not.toBeInTheDocument()
    })
  })

  it('点击 Header 聊天按钮后切换为 AI 对话模式，并可关闭恢复主导航', async () => {
    const user = userEvent.setup()

    window.api = {
      ai: {
        listSessions: vi.fn(async () => [
          {
            id: 'session-1',
            title: '整理今天的记忆线索',
            time: '10:24',
            status: 'completed',
            messages: []
          }
        ]),
        getSession: vi.fn(async (id: string) => ({
          id,
          title: '整理今天的记忆线索',
          time: '10:24',
          status: 'completed',
          messages: []
        })),
        onChatEvent: () => () => undefined
      }
    } as never

    render(<App />)

    expect(window.location.pathname).toBe('/today')

    await user.click(screen.getByRole('button', { name: 'Open chat' }))

    expect(screen.getByRole('button', { name: 'Close chat' })).toBeInTheDocument()
    expect(screen.getByLabelText('Chat history list')).toBeInTheDocument()
    expect(screen.getByLabelText('AI Chat Workspace')).toBeInTheDocument()
    expect(screen.getByText('AI DIALOGS')).toBeInTheDocument()
    expect(screen.getAllByText('整理今天的记忆线索')[0]).toBeInTheDocument()
    expect(window.location.pathname).toBe('/today')

    await user.click(screen.getByRole('button', { name: 'Close chat' }))

    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument()
    expect(screen.getByLabelText('Sidebar main navigation')).toBeInTheDocument()
    expect(screen.getByLabelText('Chat history list')).toHaveAttribute('aria-hidden', 'true')
  })

  it('Header 聊天按钮左侧展示上下文记录 tooltip 按钮和工具策略详情', async () => {
    const user = userEvent.setup()

    window.api = {
      ai: {
        getModelOptions: vi.fn(async () => ({
          defaultProvider: 'bailian',
          defaultModel: 'MiniMax-M2.5',
          agent: {
            context: {
              toolOutputMaxChars: 4096,
              recentToolResultLimit: 3
            }
          },
          providers: [
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
                  }
                }
              ]
            }
          ]
        })),
        onChatEvent: () => () => undefined
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))

    const contextButton = await screen.findByRole('button', { name: 'View AI context records' })
    const chatButton = screen.getByRole('button', { name: 'Close chat' })
    expect(contextButton.compareDocumentPosition(chatButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(contextButton)

    expect(screen.getByRole('dialog', { name: 'AI context record details' })).toBeInTheDocument()
    expect(screen.queryByText('单条工具输出上限')).not.toBeInTheDocument()
    expect(screen.queryByText('4,096 chars')).not.toBeInTheDocument()
    expect(screen.queryByText('最近完整工具结果')).not.toBeInTheDocument()
    expect(screen.queryByText(/只保留占位摘要/)).not.toBeInTheDocument()
  })

  it('AI 对话模式支持切换历史会话并展示工具调用摘要', async () => {
    const user = userEvent.setup()

    window.api = {
      ai: {
        listSessions: vi.fn(async () => [
          {
            id: 'session-1',
            title: '整理今天的记忆线索',
            time: '10:24',
            status: 'completed',
            messages: []
          },
          {
            id: 'session-2',
            title: '周回顾行动拆解',
            time: '09:12',
            status: 'completed',
            messages: []
          }
        ]),
        getSession: vi.fn(async (id: string) => {
          if (id === 'session-2') {
            return {
              id: 'session-2',
              title: '周回顾行动拆解',
              time: '09:12',
              status: 'completed',
              messages: [
                {
                  id: 'm1',
                  role: 'user',
                  content: '读取 weekly review 草稿，然后给我三条明天能执行的动作。',
                  time: '09:06'
                },
                {
                  id: 'm2',
                  role: 'assistant',
                  content: '我会先定位周回顾草稿，再把模糊事项压缩成具体动作。',
                  time: '09:12',
                  toolSteps: [
                    {
                      id: 'step-1',
                      title: 'Load weekly review draft',
                      status: 'done',
                      tool: 'weekly_review.load',
                      observation: 'The draft contains 4 themes.'
                    }
                  ],
                  answer: '本周回顾行动拆解已完成。'
                }
              ]
            }
          }
          return {
            id,
            title: '整理今天的记忆线索',
            time: '10:24',
            status: 'completed',
            messages: []
          };
        }),
        onChatEvent: () => () => undefined
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    await user.click(screen.getByRole('button', { name: /周回顾行动拆解/ }))

    const chatMain = screen.getByLabelText('AI Chat Workspace')
    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('周回顾行动拆解')).toBeInTheDocument()
    expect(within(chatMain).getByText('weekly_review.load')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Tool completed').length).toBeGreaterThan(0)
  })

  it('首次加载持久化历史摘要后点击新建对话直接创建空白会话', async () => {
    const user = userEvent.setup()
    const persistedSessions: AiChatSession[] = [
      {
        id: 'persisted-one',
        title: '历史一',
        time: '10:00',
        status: 'completed',
        messages: []
      },
      {
        id: 'persisted-two',
        title: '历史二',
        time: '11:00',
        status: 'completed',
        messages: []
      }
    ]

    window.api = {
      ai: {
        listSessions: vi.fn(async () => persistedSessions),
        getSession: vi.fn(async (sessionId: string) => ({
          ...persistedSessions.find((session) => session.id === sessionId)!,
          messages: [
            {
              id: `${sessionId}-user`,
              role: 'user',
              content: '已有消息',
              time: '10:00'
            }
          ]
        })),
        onChatEvent: () => () => undefined
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    const historyList = screen.getByLabelText('Chat history list')
    await within(historyList).findByText('历史一')

    await user.click(screen.getByRole('button', { name: 'New chat' }))

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('新建对话')).toBeInTheDocument()
    expect(within(historyList).getByText('新建对话').closest('[aria-current="true"]')).toBeInTheDocument()
  })
})
