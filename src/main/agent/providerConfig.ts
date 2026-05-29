import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type {
  ModelConfig,
  NormalizedAiConfig,
  NormalizedProviderConfig,
  ProviderTransportType
} from './types'

// 默认配置路径。
export const DEFAULT_MC_CONFIG_PATH = join(homedir(), '.mc', 'config.json')

// 原始 provider 配置形状。
type RawProviderConfig = {
  // Provider 传输格式。
  type?: ProviderTransportType
  // Provider 显示名。
  name?: string
  // 对应 npm 包名。
  npm?: string
  // Provider 连接参数。
  options?: {
    // API Key。
    apiKey?: string
    // API 基础地址。
    baseURL?: string
  }
  // Provider 可用模型。
  models?: Record<string, ModelConfig>
}

// 原始配置文件形状。
type RawConfigFile = {
  // 新版 AI 配置。
  ai?: {
    // 默认 provider。
    defaultProvider?: string
    // 默认模型。
    defaultModel?: string
    // 启用的 provider 标识列表。
    enabled_providers?: string[]
    // Provider 配置表。
    providers?: Record<string, RawProviderConfig>
  }
  // 兼容顶层 provider 配置。
  [key: string]: unknown
}

/**
 * 根据 npm 包名推断 provider 传输格式。
 */
const inferProviderType = (provider: RawProviderConfig): ProviderTransportType => {
  if (provider.type) {
    return provider.type
  }

  if (provider.npm === '@ai-sdk/google') {
    return 'google'
  }

  if (provider.npm === '@ai-sdk/anthropic') {
    return 'anthropic'
  }

  if (provider.npm === '@ai-sdk/openai') {
    return 'openai'
  }

  return 'openai-compatible'
}

/**
 * 归一化单个 provider 配置。
 */
const normalizeProvider = (id: string, provider: RawProviderConfig): NormalizedProviderConfig => {
  if (!provider.options?.apiKey) {
    throw new Error(`Provider ${id} 缺少 apiKey`)
  }

  if (!provider.options?.baseURL) {
    throw new Error(`Provider ${id} 缺少 baseURL`)
  }

  return {
    id,
    type: inferProviderType(provider),
    name: provider.name ?? id,
    npm: provider.npm,
    options: {
      apiKey: provider.options.apiKey,
      baseURL: provider.options.baseURL.replace(/\/$/, '')
    },
    models: provider.models ?? {}
  }
}

/**
 * 读取并归一化模型 provider 配置。
 */
export const loadProviderConfig = (configPath = DEFAULT_MC_CONFIG_PATH): NormalizedAiConfig => {
  if (!existsSync(configPath)) {
    throw new Error(`配置文件不存在：${configPath}`)
  }

  const rawText = readFileSync(configPath, 'utf8').trim()
  if (!rawText) {
    throw new Error(`配置文件为空：${configPath}`)
  }

  const rawConfig = JSON.parse(rawText) as RawConfigFile
  const rawProviders = rawConfig.ai?.providers ?? {
    bailian: rawConfig.bailian as RawProviderConfig
  }
  const normalizedProviders = Object.fromEntries(
    Object.entries(rawProviders).map(([id, provider]) => [id, normalizeProvider(id, provider)])
  )
  const enabledProviderIds = rawConfig.ai?.enabled_providers ?? Object.keys(normalizedProviders)
  const providers = Object.fromEntries(
    enabledProviderIds
      .filter((providerId) => Boolean(normalizedProviders[providerId]))
      .map((providerId) => [providerId, normalizedProviders[providerId]])
  )
  const providerIds = Object.keys(providers)
  const configuredDefaultProvider = rawConfig.ai?.defaultProvider ?? 'bailian'
  const defaultProvider = providers[configuredDefaultProvider] ? configuredDefaultProvider : providerIds[0]

  if (!defaultProvider) {
    throw new Error('未启用任何可用 Provider')
  }

  const defaultProviderModels = providers[defaultProvider].models
  const configuredDefaultModel = rawConfig.ai?.defaultModel
  const defaultModel =
    configuredDefaultModel && defaultProviderModels[configuredDefaultModel]
      ? configuredDefaultModel
      : Object.keys(defaultProviderModels)[0] ?? configuredDefaultModel ?? 'MiniMax-M2.5'

  return {
    defaultProvider,
    defaultModel,
    enabledProviders: providerIds,
    providers
  }
}
