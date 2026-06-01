import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { loadProviderConfig } from '../../../src/main/agent/providerConfig'

describe('providerConfig', () => {
  it('从 mc 配置中读取默认 provider 和模型', () => {
    const directory = join(tmpdir(), `mc-config-${Date.now()}`)
    const configPath = join(directory, 'config.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultProvider: 'bailian',
          defaultModel: 'MiniMax-M2.5',
          providers: {
            bailian: {
              type: 'openai-compatible',
              name: 'Bailian',
              options: {
                apiKey: 'test-key',
                baseURL: 'https://example.com/v1'
              },
              models: {
                'MiniMax-M2.5': {
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
              }
            }
          }
        }
      })
    )

    const config = loadProviderConfig(configPath)

    expect(config.defaultProvider).toBe('bailian')
    expect(config.defaultModel).toBe('MiniMax-M2.5')
    expect(config.providers.bailian.type).toBe('openai-compatible')
    expect(config.providers.bailian.options.baseURL).toBe('https://example.com/v1')
    expect(config.agent.context).toEqual({
      toolOutputMaxChars: 8000,
      recentToolResultLimit: 6
    })

    rmSync(directory, { recursive: true, force: true })
  })

  it('读取 ai.agent.context 工具上下文治理配置', () => {
    const directory = join(tmpdir(), `mc-config-agent-${Date.now()}`)
    const configPath = join(directory, 'config.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultProvider: 'bailian',
          defaultModel: 'MiniMax-M2.5',
          agent: {
            context: {
              toolOutputMaxChars: 4096,
              recentToolResultLimit: 3
            }
          },
          providers: {
            bailian: {
              name: 'Bailian',
              options: {
                apiKey: 'test-key',
                baseURL: 'https://example.com/v1'
              },
              models: {
                'MiniMax-M2.5': {
                  name: 'MiniMax-M2.5'
                }
              }
            }
          }
        }
      })
    )

    const config = loadProviderConfig(configPath)

    expect(config.agent.context).toEqual({
      toolOutputMaxChars: 4096,
      recentToolResultLimit: 3
    })

    rmSync(directory, { recursive: true, force: true })
  })

  it('兼容顶层 provider 配置并默认选择 bailian MiniMax', () => {
    const directory = join(tmpdir(), `mc-config-legacy-${Date.now()}`)
    const configPath = join(directory, 'config.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        bailian: {
          name: 'Bailian',
          npm: '@ai-sdk/openai-compatible',
          options: {
            apiKey: 'test-key',
            baseURL: 'https://example.com/v1'
          },
          models: {
            'MiniMax-M2.5': {
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
          }
        }
      })
    )

    const config = loadProviderConfig(configPath)

    expect(config.defaultProvider).toBe('bailian')
    expect(config.defaultModel).toBe('MiniMax-M2.5')
    expect(config.providers.bailian.type).toBe('openai-compatible')

    rmSync(directory, { recursive: true, force: true })
  })

  it('只启用 enabled_providers 中声明的 provider 并修正默认模型', () => {
    const directory = join(tmpdir(), `mc-config-enabled-${Date.now()}`)
    const configPath = join(directory, 'config.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultProvider: 'bailian',
          defaultModel: 'MiniMax-M2.5',
          enabled_providers: ['gemini'],
          providers: {
            bailian: {
              name: 'Bailian',
              options: {
                apiKey: 'test-key',
                baseURL: 'https://example.com/v1'
              },
              models: {
                'MiniMax-M2.5': {
                  name: 'MiniMax-M2.5'
                }
              }
            },
            gemini: {
              name: 'Gemini',
              npm: '@ai-sdk/google',
              options: {
                apiKey: 'test-key',
                baseURL: 'https://generativelanguage.googleapis.com/v1beta'
              },
              models: {
                'gemini-3.5-flash': {
                  name: 'Gemini 3.5 Flash'
                }
              }
            }
          }
        }
      })
    )

    const config = loadProviderConfig(configPath)

    expect(Object.keys(config.providers)).toEqual(['gemini'])
    expect(config.defaultProvider).toBe('gemini')
    expect(config.defaultModel).toBe('gemini-3.5-flash')

    rmSync(directory, { recursive: true, force: true })
  })
})
