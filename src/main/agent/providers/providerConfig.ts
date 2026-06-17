import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type {
  AgentConfig,
  CompactionConfig,
  ModelConfig,
  NormalizedAiConfig,
  NormalizedProviderConfig,
  ProviderTransportType,
  TitleSummaryConfig
} from '@/agent/types'

// 默认配置路径。
export const DEFAULT_MC_CONFIG_PATH = join(homedir(), '.mc', 'config.json')

// 默认 Agent 配置。
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  context: {
    toolOutputMaxChars: 8000,
    recentToolResultLimit: 6
  }
}

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

// 原始 Agent 配置形状。
type RawAgentConfig = {
  // 上下文治理配置。
  context?: {
    // 单条工具 observation 最大字符数。
    toolOutputMaxChars?: number
    // 最近保留完整工具结果的数量。
    recentToolResultLimit?: number
  }
}

// 原始模型选择配置形状。
type RawModelSelectionConfig = {
  // 模型所属 provider 标识。
  provider?: string
  // 模型标识。
  model?: string
}

// 原始默认模型配置形状，兼容旧版字符串。
type RawDefaultModelConfig = string | RawModelSelectionConfig

// 原始配置文件形状。
type RawConfigFile = {
  // 新版 AI 配置。
  ai?: {
    // 默认 provider。
    defaultProvider?: string
    // 默认模型。
    defaultModel?: RawDefaultModelConfig
    // 标题总结模型配置。
    titleSummary?: RawModelSelectionConfig
    // 周度总结模型配置。
    weeklySummary?: RawModelSelectionConfig
    // Compaction 模型配置。
    compaction?: RawModelSelectionConfig
    // 启用的 provider 标识列表。
    enabled_providers?: string[]
    // Provider 配置表。
    providers?: Record<string, RawProviderConfig>
    // Agent 行为配置。
    agent?: RawAgentConfig
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
    throw new Error(`Provider ${id} is missing apiKey`)
  }

  if (!provider.options?.baseURL) {
    throw new Error(`Provider ${id} is missing baseURL`)
  }

  return {
    id,
    type: inferProviderType(provider),
    name: provider.name ?? id,
    options: {
      apiKey: provider.options.apiKey,
      baseURL: provider.options.baseURL.replace(/\/$/, '')
    },
    models: provider.models ?? {}
  }
}

/**
 * 归一化正整数配置，非法值回落到默认值。
 */
const normalizePositiveInteger = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback
}

/**
 * 归一化 Agent 配置。
 */
const normalizeAgentConfig = (agent: RawAgentConfig | undefined): AgentConfig => ({
  context: {
    toolOutputMaxChars: normalizePositiveInteger(
      agent?.context?.toolOutputMaxChars,
      DEFAULT_AGENT_CONFIG.context.toolOutputMaxChars
    ),
    recentToolResultLimit: normalizePositiveInteger(
      agent?.context?.recentToolResultLimit,
      DEFAULT_AGENT_CONFIG.context.recentToolResultLimit
    )
  }
})

/**
 * 归一化默认模型配置，兼容旧版 defaultProvider/defaultModel 字符串。
 */
const normalizeDefaultModelConfig = (
  value: RawDefaultModelConfig | undefined,
  legacyProvider: string | undefined,
  providers: Record<string, NormalizedProviderConfig>
): TitleSummaryConfig => {
  const providerIds = Object.keys(providers)
  const requestedProvider = typeof value === 'object' ? value.provider : legacyProvider
  const configuredProvider = requestedProvider ?? 'bailian'
  const provider = providers[configuredProvider] ? configuredProvider : providerIds[0]

  if (!provider) {
    throw new Error('No available provider is enabled')
  }

  const providerModels = providers[provider].models
  const requestedModel = typeof value === 'string' ? value : value?.model
  const model =
    requestedModel && providerModels[requestedModel]
      ? requestedModel
      : Object.keys(providerModels)[0] ?? requestedModel ?? 'MiniMax-M2.5'

  return {
    provider,
    model
  }
}

/**
 * 归一化标题总结模型配置。
 */
const normalizeTitleSummaryConfig = (
  value: RawModelSelectionConfig | undefined,
  providers: Record<string, NormalizedProviderConfig>,
  defaultProvider: string,
  defaultModel: string
): TitleSummaryConfig => {
  const provider = value?.provider && providers[value.provider] ? value.provider : defaultProvider
  const providerModels = providers[provider]?.models ?? {}
  const model = value?.model && providerModels[value.model] ? value.model : Object.keys(providerModels)[0] ?? defaultModel

  return {
    provider,
    model
  }
}

/**
 * 归一化 compaction 模型配置，未配置时 undefined。
 */
const normalizeCompactionConfig = (
  value: RawModelSelectionConfig | undefined,
  providers: Record<string, NormalizedProviderConfig>,
  defaultProvider: string,
  defaultModel: string
): CompactionConfig | undefined => {
  if (!value) {
    return undefined
  }
  const provider = value.provider && providers[value.provider] ? value.provider : defaultProvider
  const providerModels = providers[provider]?.models ?? {}
  const model = value.model && providerModels[value.model] ? value.model : Object.keys(providerModels)[0] ?? defaultModel

  return {
    provider,
    model
  }
}

/**
 * 读取并归一化模型 provider 配置。
 */
export const loadProviderConfig = (configPath = DEFAULT_MC_CONFIG_PATH): NormalizedAiConfig => {
  if (!existsSync(configPath)) {
    throw new Error(`Config file does not exist: ${configPath}`)
  }

  const rawText = readFileSync(configPath, 'utf8').trim()
  if (!rawText) {
    throw new Error(`Config file is empty: ${configPath}`)
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
  const defaultModelConfig = normalizeDefaultModelConfig(
    rawConfig.ai?.defaultModel,
    rawConfig.ai?.defaultProvider,
    providers
  )
  const defaultProvider = defaultModelConfig.provider
  const defaultModel = defaultModelConfig.model

  return {
    defaultProvider,
    defaultModel,
    titleSummary: normalizeTitleSummaryConfig(
      rawConfig.ai?.titleSummary,
      providers,
      defaultProvider,
      defaultModel
    ),
    weeklySummary: normalizeTitleSummaryConfig(
      rawConfig.ai?.weeklySummary,
      providers,
      defaultProvider,
      defaultModel
    ),
    enabledProviders: providerIds,
    providers,
    agent: normalizeAgentConfig(rawConfig.ai?.agent),
    compaction: rawConfig.ai?.compaction
      ? normalizeCompactionConfig(rawConfig.ai.compaction, providers, defaultProvider, defaultModel)
      : undefined
  }
}
