import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProviderConfig } from "@/agent/providers/providerConfig"

describe("providerConfig", () => {
  it("从 mc 配置中读取默认 provider 和模型", () => {
    const directory = join(tmpdir(), `mc-config-${Date.now()}`)
    const configPath = join(directory, "config.json")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultModel: {
            provider: "bailian",
            model: "MiniMax-M2.5",
          },
          providers: {
            bailian: {
              type: "openai-compatible",
              name: "Bailian",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "MiniMax-M2.5": {
                  name: "MiniMax-M2.5",
                  limit: {
                    context: 204800,
                    output: 131072,
                  },
                  modalities: {
                    input: ["text"],
                    output: ["text"],
                  },
                },
              },
            },
          },
        },
      }),
    )

    const config = loadProviderConfig(configPath)

    expect(config.defaultProvider).toBe("bailian")
    expect(config.defaultModel).toBe("MiniMax-M2.5")
    expect(config.titleSummary).toEqual({
      provider: "bailian",
      model: "MiniMax-M2.5",
    })
    expect(config.weeklySummary).toEqual({
      provider: "bailian",
      model: "MiniMax-M2.5",
    })
    expect(config.providers.bailian.type).toBe("openai-compatible")
    expect(config.providers.bailian.options.baseURL).toBe("https://example.com/v1")
    expect(config.agent.context).toEqual({
      toolOutputMaxChars: 8000,
      recentToolResultLimit: 6,
    })

    rmSync(directory, { recursive: true, force: true })
  })

  it("读取 ai.agent.context 工具上下文治理配置", () => {
    const directory = join(tmpdir(), `mc-config-agent-${Date.now()}`)
    const configPath = join(directory, "config.json")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultProvider: "bailian",
          defaultModel: "MiniMax-M2.5",
          agent: {
            context: {
              toolOutputMaxChars: 4096,
              recentToolResultLimit: 3,
            },
          },
          providers: {
            bailian: {
              name: "Bailian",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "MiniMax-M2.5": {
                  name: "MiniMax-M2.5",
                },
              },
            },
          },
        },
      }),
    )

    const config = loadProviderConfig(configPath)

    expect(config.agent.context).toEqual({
      toolOutputMaxChars: 4096,
      recentToolResultLimit: 3,
    })

    rmSync(directory, { recursive: true, force: true })
  })

  it("读取已启用的本地 MCP 服务配置", () => {
    const directory = join(tmpdir(), `mc-config-mcp-${Date.now()}`)
    const configPath = join(directory, "config.json")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultProvider: "bailian",
          defaultModel: "MiniMax-M2.5",
          providers: {
            bailian: {
              name: "Bailian",
              options: { apiKey: "test-key", baseURL: "https://example.com/v1" },
              models: { "MiniMax-M2.5": { name: "MiniMax-M2.5" } },
            },
          },
        },
        mcp: {
          "codebase-memory-mcp": {
            type: "local",
            enabled: true,
            name: "Codebase Memory",
            timeout: 15_000,
            command: ["/usr/local/bin/codebase-memory-mcp"],
          },
          codegraph: {
            type: "local",
            enabled: false,
            command: ["codegraph", "serve", "--mcp"],
          },
        },
      }),
    )

    expect(loadProviderConfig(configPath).mcp).toEqual([
      {
        id: "codebase-memory-mcp",
        name: "Codebase Memory",
        command: "/usr/local/bin/codebase-memory-mcp",
        args: [],
        timeout: 15_000,
      },
    ])

    rmSync(directory, { recursive: true, force: true })
  })

  it("兼容旧版 defaultProvider 与 defaultModel 字符串配置", () => {
    const directory = join(tmpdir(), `mc-config-legacy-default-${Date.now()}`)
    const configPath = join(directory, "config.json")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultProvider: "bailian",
          defaultModel: "MiniMax-M2.5",
          providers: {
            bailian: {
              name: "Bailian",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "MiniMax-M2.5": {
                  name: "MiniMax-M2.5",
                },
              },
            },
          },
        },
      }),
    )

    const config = loadProviderConfig(configPath)

    expect(config.defaultProvider).toBe("bailian")
    expect(config.defaultModel).toBe("MiniMax-M2.5")

    rmSync(directory, { recursive: true, force: true })
  })

  it("读取 ai.defaultModel 对象格式中的 provider 和模型", () => {
    const directory = join(tmpdir(), `mc-config-default-object-${Date.now()}`)
    const configPath = join(directory, "config.json")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultModel: {
            provider: "zhipu",
            model: "glm-4.7-flash",
          },
          providers: {
            bailian: {
              name: "Bailian",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "MiniMax-M2.5": {
                  name: "MiniMax-M2.5",
                },
              },
            },
            zhipu: {
              name: "Zhipu",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "glm-4.7-flash": {
                  name: "GLM-4.7-Flash",
                },
              },
            },
          },
        },
      }),
    )

    const config = loadProviderConfig(configPath)

    expect(config.defaultProvider).toBe("zhipu")
    expect(config.defaultModel).toBe("glm-4.7-flash")

    rmSync(directory, { recursive: true, force: true })
  })

  it("读取 ai.titleSummary 标题总结模型配置", () => {
    const directory = join(tmpdir(), `mc-config-title-${Date.now()}`)
    const configPath = join(directory, "config.json")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultProvider: "bailian",
          defaultModel: "MiniMax-M2.5",
          titleSummary: {
            provider: "zhipu",
            model: "glm-4.7-flash",
          },
          providers: {
            bailian: {
              name: "Bailian",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "MiniMax-M2.5": {
                  name: "MiniMax-M2.5",
                },
              },
            },
            zhipu: {
              name: "Zhipu",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "glm-4.7-flash": {
                  name: "GLM-4.7-Flash",
                },
              },
            },
          },
        },
      }),
    )

    const config = loadProviderConfig(configPath)

    expect(config.titleSummary).toEqual({
      provider: "zhipu",
      model: "glm-4.7-flash",
    })

    rmSync(directory, { recursive: true, force: true })
  })

  it("读取 ai.weeklySummary 周度总结模型配置", () => {
    const directory = join(tmpdir(), `mc-config-weekly-${Date.now()}`)
    const configPath = join(directory, "config.json")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultProvider: "bailian",
          defaultModel: "MiniMax-M2.5",
          weeklySummary: {
            provider: "zhipu",
            model: "glm-4.7-flash",
          },
          providers: {
            bailian: {
              name: "Bailian",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "MiniMax-M2.5": {
                  name: "MiniMax-M2.5",
                },
              },
            },
            zhipu: {
              name: "Zhipu",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "glm-4.7-flash": {
                  name: "GLM-4.7-Flash",
                },
              },
            },
          },
        },
      }),
    )

    const config = loadProviderConfig(configPath)

    expect(config.weeklySummary).toEqual({
      provider: "zhipu",
      model: "glm-4.7-flash",
    })

    rmSync(directory, { recursive: true, force: true })
  })

  it("兼容顶层 provider 配置并默认选择 bailian MiniMax", () => {
    const directory = join(tmpdir(), `mc-config-legacy-${Date.now()}`)
    const configPath = join(directory, "config.json")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        bailian: {
          name: "Bailian",
          npm: "@ai-sdk/openai-compatible",
          options: {
            apiKey: "test-key",
            baseURL: "https://example.com/v1",
          },
          models: {
            "MiniMax-M2.5": {
              name: "MiniMax-M2.5",
              limit: {
                context: 204800,
                output: 131072,
              },
              modalities: {
                input: ["text"],
                output: ["text"],
              },
            },
          },
        },
      }),
    )

    const config = loadProviderConfig(configPath)

    expect(config.defaultProvider).toBe("bailian")
    expect(config.defaultModel).toBe("MiniMax-M2.5")
    expect(config.providers.bailian.type).toBe("openai-compatible")

    rmSync(directory, { recursive: true, force: true })
  })

  it("只启用 enabled_providers 中声明的 provider 并修正默认模型", () => {
    const directory = join(tmpdir(), `mc-config-enabled-${Date.now()}`)
    const configPath = join(directory, "config.json")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      configPath,
      JSON.stringify({
        ai: {
          defaultProvider: "bailian",
          defaultModel: "MiniMax-M2.5",
          enabled_providers: ["gemini"],
          providers: {
            bailian: {
              name: "Bailian",
              options: {
                apiKey: "test-key",
                baseURL: "https://example.com/v1",
              },
              models: {
                "MiniMax-M2.5": {
                  name: "MiniMax-M2.5",
                },
              },
            },
            gemini: {
              name: "Gemini",
              npm: "@ai-sdk/google",
              options: {
                apiKey: "test-key",
                baseURL: "https://generativelanguage.googleapis.com/v1beta",
              },
              models: {
                "gemini-3.5-flash": {
                  name: "Gemini 3.5 Flash",
                },
              },
            },
          },
        },
      }),
    )

    const config = loadProviderConfig(configPath)

    expect(Object.keys(config.providers)).toEqual(["gemini"])
    expect(config.defaultProvider).toBe("gemini")
    expect(config.defaultModel).toBe("gemini-3.5-flash")

    rmSync(directory, { recursive: true, force: true })
  })
})
