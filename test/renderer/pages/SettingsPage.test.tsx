/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { SettingsPage } from '@/pages/settings/SettingsPage'

// Settings 页面完整 AI 配置。
type AiSettingsConfig = Awaited<ReturnType<NonNullable<Window['api']['config']>['ai']['get']>>

/**
 * 创建测试用 Settings 配置。
 */
const createSettings = (): AiSettingsConfig => ({
  configPath: '/Users/yonah/.mc/config.json',
  defaultModel: {
    provider: 'gemini',
    model: 'gemini-3.5-flash'
  },
  titleSummary: {
    provider: 'gemini',
    model: 'gemini-3.5-flash'
  },
  weeklySummary: {
    provider: 'gemini',
    model: 'gemini-3.5-flash'
  },
  suggestedQuestions: {
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  suggestedQuestionsEnabled: true,
  enabledProviders: ['gemini'],
  webSearch: {
    exaApiKey: 'exa-secret',
    tavilyApiKey: 'tavily-secret',
  },
  showAgentThinking: false,
  disabledSkillIds: [],
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
            input: ['text', 'image'],
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
})

/**
 * 渲染 Settings 页面并补齐 Toast 上下文。
 */
const renderSettingsPage = (): void => {
  render(
    <ToastProvider>
      <Header category="SYSTEM" activePage="SETTINGS" />
      <SettingsPage />
    </ToastProvider>
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    window.api = {
      config: {
        ai: {
          get: vi.fn().mockResolvedValue(createSettings()),
          save: vi.fn().mockImplementation(async (payload: AiSettingsConfig) => payload)
        }
      },
      skills: {
        list: vi.fn().mockResolvedValue([
          {
            id: 'grill-me',
            name: 'grill-me',
            description: '方案盘问',
            supportedAgents: ['prompt-design'],
            content: 'Skill content',
            location: '/app/resources/skills/grill-me/skill.md'
          }
        ]),
        getAvailableForAgent: vi.fn(),
        clearCache: vi.fn()
      }
    } as unknown as Window['api']
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('加载后展示配置路径与三个设置分区', async () => {
    renderSettingsPage()

    expect(await screen.findByText('/Users/yonah/.mc/config.json')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI 模型' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Providers' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agent' })).toBeInTheDocument()
  })

  it('修改 Agent 参数后保存新配置', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await screen.findByText('/Users/yonah/.mc/config.json')
    await user.click(screen.getByRole('button', { name: 'Agent' }))
    await user.clear(screen.getByLabelText('Tool output max chars'))
    await user.type(screen.getByLabelText('Tool output max chars'), '8192')
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(window.api.config?.ai.save).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: {
            context: {
              toolOutputMaxChars: 8192,
              recentToolResultLimit: 3
            }
          }
        })
      )
    })
  })

  it('开启显示 Agent 思考后保存设置', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await screen.findByText('/Users/yonah/.mc/config.json')
    await user.click(screen.getByRole('button', { name: 'Agent' }))
    expect(screen.getByRole('switch', { name: '显示 Agent 思考' })).not.toBeChecked()
    await user.click(screen.getByRole('switch', { name: '显示 Agent 思考' }))
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(window.api.config?.ai.save).toHaveBeenCalledWith(
        expect.objectContaining({ showAgentThinking: true })
      )
    })
  })

  it('修改联网搜索密钥后保存设置', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await screen.findByText('/Users/yonah/.mc/config.json')
    await user.click(screen.getByRole('button', { name: 'Agent' }))
    await user.clear(screen.getByLabelText('Exa API Key'))
    await user.type(screen.getByLabelText('Exa API Key'), 'new-exa-key')
    await user.clear(screen.getByLabelText('Tavily API Key'))
    await user.type(screen.getByLabelText('Tavily API Key'), 'new-tavily-key')
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(window.api.config?.ai.save).toHaveBeenCalledWith(
        expect.objectContaining({
          webSearch: {
            exaApiKey: 'new-exa-key',
            tavilyApiKey: 'new-tavily-key',
          },
        })
      )
    })
  })

  it('禁用 Skill 后保存禁用列表', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await screen.findByText('/Users/yonah/.mc/config.json')
    await user.click(screen.getByRole('button', { name: 'Agent 技能' }))
    await user.click(await screen.findByRole('switch', { name: '启用技能 grill-me' }))
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(window.api.config?.ai.save).toHaveBeenCalledWith(
        expect.objectContaining({ disabledSkillIds: ['grill-me'] })
      )
    })
  })

  it('新增 provider 后保存 payload 包含新增 provider', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await screen.findByText('/Users/yonah/.mc/config.json')
    await user.click(screen.getByRole('button', { name: 'Providers' }))
    await user.click(screen.getByRole('button', { name: '新增 Provider' }))
    await user.clear(screen.getByLabelText('Provider ID'))
    await user.type(screen.getByLabelText('Provider ID'), 'zhipu')
    await user.clear(screen.getByLabelText('Provider name'))
    await user.type(screen.getByLabelText('Provider name'), 'Zhipu')
    await user.clear(screen.getByLabelText('Base URL'))
    await user.type(screen.getByLabelText('Base URL'), 'https://open.bigmodel.cn/api/paas/v4')
    await user.clear(screen.getByLabelText('API Key'))
    await user.type(screen.getByLabelText('API Key'), 'zhipu-key')
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(window.api.config?.ai.save).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: expect.objectContaining({
            zhipu: expect.objectContaining({
              id: 'zhipu',
              name: 'Zhipu',
              options: expect.objectContaining({
                apiKey: 'zhipu-key'
              })
            })
          })
        })
      )
    })
  })

  it('支持在 tag 栏中点击删除按钮，并通过 Tooltip 确认来删除 provider', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await screen.findByText('/Users/yonah/.mc/config.json')
    await user.click(screen.getByRole('button', { name: 'Providers' }))
    
    const deleteButton = screen.getByRole('button', { name: '删除 Provider' })
    expect(deleteButton).toBeInTheDocument()

    await user.click(deleteButton)
    expect(screen.getByText('确定要删除该 Provider 吗？')).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', { name: '确认' })
    await user.click(confirmButton)

    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(window.api.config?.ai.save).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: {}
        })
      )
    })
  })
})
