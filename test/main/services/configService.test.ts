import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  type AiSettingsConfig,
  readAiSettingsConfig,
  saveAiSettingsConfig,
} from "@/services/configService"

// 测试过程创建的临时目录集合。
const tempDirectories: string[] = []

/**
 * 创建临时配置目录。
 */
const createTempDirectory = (): string => {
  const directory = join(
    tmpdir(),
    `mc-settings-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(directory, { recursive: true })
  tempDirectories.push(directory)
  return directory
}

/**
 * 写入临时配置文件并返回路径。
 */
const writeTempConfig = (config: Record<string, unknown>): string => {
  const directory = createTempDirectory()
  const configPath = join(directory, "config.json")
  writeFileSync(configPath, JSON.stringify(config, null, 2))
  return configPath
}

/**
 * 创建最小可保存 AI settings。
 */
const createSettings = (): AiSettingsConfig => ({
  configPath: "/tmp/config.json",
  defaultModel: {
    provider: "gemini",
    model: "gemini-3.5-flash",
  },
  titleSummary: {
    provider: "gemini",
    model: "gemini-3.5-flash",
  },
  weeklySummary: {
    provider: "gemini",
    model: "gemini-3.5-flash",
  },
  suggestedQuestions: {
    provider: "gemini",
    model: "gemini-3.5-flash",
  },
  suggestedQuestionsEnabled: true,
  enabledProviders: ["gemini"],
  webSearch: {
    exaApiKey: "exa-secret",
    tavilyApiKey: "tavily-secret",
  },
  showAgentThinking: false,
  disabledSkillIds: [],
  providers: {
    gemini: {
      id: "gemini",
      type: "google",
      name: "Gemini",
      options: {
        apiKey: "secret",
        baseURL: "https://example.com/v1",
      },
      models: {
        "gemini-3.5-flash": {
          id: "gemini-3.5-flash",
          name: "Gemini 3.5 Flash",
          limit: {
            context: 1000000,
            output: 65536,
          },
          modalities: {
            input: ["text", "image"],
            output: ["text"],
          },
        },
      },
    },
  },
  agent: {
    context: {
      toolOutputMaxChars: 4096,
      recentToolResultLimit: 3,
    },
  },
})

describe("configService", () => {
  afterEach(() => {
    tempDirectories.splice(0).forEach((directory) => {
      rmSync(directory, { recursive: true, force: true })
    })
  })

  it("读取 AI settings 并返回可编辑结构", () => {
    const configPath = writeTempConfig({
      ai: {
        defaultModel: {
          provider: "gemini",
          model: "gemini-3.5-flash",
        },
        titleSummary: {
          provider: "gemini",
          model: "gemini-3.5-flash",
        },
        weeklySummary: {
          provider: "gemini",
          model: "gemini-3.5-flash",
        },
        enabled_providers: ["gemini"],
        providers: {
          gemini: {
            name: "Gemini",
            npm: "@ai-sdk/google",
            options: {
              apiKey: "secret",
              baseURL: "https://example.com/v1",
            },
            models: {
              "gemini-3.5-flash": {
                name: "Gemini 3.5 Flash",
                limit: {
                  context: 1000000,
                  output: 65536,
                },
                modalities: {
                  input: ["text", "image"],
                  output: ["text"],
                },
              },
            },
          },
        },
        agent: {
          context: {
            toolOutputMaxChars: 4096,
            recentToolResultLimit: 3,
          },
        },
      },
    })

    const settings = readAiSettingsConfig(configPath)

    expect(settings.configPath).toBe(configPath)
    expect(settings.defaultModel).toEqual({
      provider: "gemini",
      model: "gemini-3.5-flash",
    })
    expect(settings.titleSummary).toEqual({
      provider: "gemini",
      model: "gemini-3.5-flash",
    })
    expect(settings.weeklySummary).toEqual({
      provider: "gemini",
      model: "gemini-3.5-flash",
    })
    expect(settings.enabledProviders).toEqual(["gemini"])
    expect(settings.showAgentThinking).toBe(false)
    expect(settings.providers.gemini.id).toBe("gemini")
    expect(settings.providers.gemini.type).toBe("google")
    expect(settings.providers.gemini.options.apiKey).toBe("secret")
    expect(settings.providers.gemini.models["gemini-3.5-flash"].id).toBe("gemini-3.5-flash")
    expect(settings.webSearch).toEqual({ exaApiKey: "", tavilyApiKey: "" })
    expect(settings.agent.context.toolOutputMaxChars).toBe(4096)
  })

  it("保存新增 provider 与模型并保留其他顶层配置", () => {
    const configPath = writeTempConfig({
      custom: {
        keep: true,
      },
      ai: {
        providers: {},
      },
    })
    const settings = createSettings()

    const saved = saveAiSettingsConfig(settings, configPath)
    const persisted = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>

    expect(saved.providers.gemini.models["gemini-3.5-flash"].name).toBe("Gemini 3.5 Flash")
    expect(persisted.custom).toEqual({ keep: true })
    expect(persisted.ai).toMatchObject({
      defaultModel: {
        provider: "gemini",
        model: "gemini-3.5-flash",
      },
      enabled_providers: ["gemini"],
      showAgentThinking: false,
    })
  })

  it("保存时空 API Key 会保留已有密钥", () => {
    const configPath = writeTempConfig({
      ai: {
        defaultModel: {
          provider: "gemini",
          model: "gemini-3.5-flash",
        },
        enabled_providers: ["gemini"],
        providers: {
          gemini: {
            name: "Gemini",
            options: {
              apiKey: "original-secret",
              baseURL: "https://example.com/v1",
            },
            models: {
              "gemini-3.5-flash": {
                name: "Gemini 3.5 Flash",
              },
            },
          },
        },
      },
    })
    const settings = readAiSettingsConfig(configPath)

    settings.providers.gemini.options.apiKey = ""
    saveAiSettingsConfig(settings, configPath)

    const persisted = JSON.parse(readFileSync(configPath, "utf8")) as {
      ai: {
        providers: {
          gemini: {
            options: {
              apiKey: string
            }
          }
        }
      }
    }
    expect(persisted.ai.providers.gemini.options.apiKey).toBe("original-secret")
  })

  it("保存时空联网搜索 API Key 会保留已有密钥", () => {
    const configPath = writeTempConfig({
      ai: {
        webSearch: {
          exaApiKey: "original-exa-secret",
          tavilyApiKey: "original-tavily-secret",
        },
      },
    })
    const settings = createSettings()
    settings.webSearch = { exaApiKey: "", tavilyApiKey: "" }

    saveAiSettingsConfig(settings, configPath)

    const persisted = JSON.parse(readFileSync(configPath, "utf8")) as {
      ai: { webSearch: { exaApiKey: string; tavilyApiKey: string } }
    }
    expect(persisted.ai.webSearch).toEqual({
      exaApiKey: "original-exa-secret",
      tavilyApiKey: "original-tavily-secret",
    })
  })

  it("缺失配置文件时返回默认可编辑配置", () => {
    const directory = createTempDirectory()
    const configPath = join(directory, "config.json")

    const settings = readAiSettingsConfig(configPath)

    expect(existsSync(configPath)).toBe(false)
    expect(settings.configPath).toBe(configPath)
    expect(Object.keys(settings.providers)).toEqual(["bailian"])
    expect(settings.enabledProviders).toEqual(["bailian"])
    expect(settings.showAgentThinking).toBe(false)
  })

  it("保存并读取 Agent 思考显示设置", () => {
    const configPath = writeTempConfig({ ai: { providers: {} } })
    const settings = createSettings()
    settings.showAgentThinking = true

    const saved = saveAiSettingsConfig(settings, configPath)
    const persisted = JSON.parse(readFileSync(configPath, "utf8")) as {
      ai: { showAgentThinking: boolean }
    }

    expect(saved.showAgentThinking).toBe(true)
    expect(persisted.ai.showAgentThinking).toBe(true)
    expect(readAiSettingsConfig(configPath).showAgentThinking).toBe(true)
  })

  it("拒绝没有启用 provider 的配置", () => {
    const configPath = writeTempConfig({})
    const settings = createSettings()
    settings.enabledProviders = []

    expect(() => saveAiSettingsConfig(settings, configPath)).toThrow("至少启用一个 provider")
  })

  it("拒绝没有 baseURL 或 API Key 的 provider", () => {
    const configPath = writeTempConfig({})
    const settings = createSettings()
    settings.providers.gemini.options.baseURL = ""

    expect(() => saveAiSettingsConfig(settings, configPath)).toThrow("baseURL")
  })

  it("拒绝非法模型 limit", () => {
    const configPath = writeTempConfig({})
    const settings = createSettings()
    settings.providers.gemini.models["gemini-3.5-flash"].limit.context = 0

    expect(() => saveAiSettingsConfig(settings, configPath)).toThrow("context")
  })
})
