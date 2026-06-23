import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_AGENT_CONFIG, DEFAULT_MC_CONFIG_PATH } from '@/agent/providers/providerConfig'
import type { AgentConfig, ModelLimit, ModelModalities, ProviderTransportType } from '@/agent/types'

// Settings 页面模型选择配置。
export type AiSettingsModelSelection = {
  // 模型所属 provider 标识。
  provider: string
  // 模型标识。
  model: string
}

// Settings 页面模型配置。
export type AiSettingsModel = {
  // 模型唯一标识。
  id: string
  // 模型显示名。
  name: string
  // 模型能力限制。
  limit: ModelLimit
  // 模型输入输出模态。
  modalities: ModelModalities
}

// Settings 页面 provider 配置。
export type AiSettingsProvider = {
  // Provider 唯一标识。
  id: string
  // Provider 传输格式。
  type: ProviderTransportType
  // Provider 显示名。
  name: string
  // Provider 连接参数。
  options: {
    // API Key。
    apiKey: string
    // API 基础地址。
    baseURL: string
  }
  // Provider 可用模型。
  models: Record<string, AiSettingsModel>
}

// Settings 页面完整 AI 配置。
export type AiSettingsConfig = {
  // 配置文件绝对路径。
  configPath: string
  // 默认对话模型。
  defaultModel: AiSettingsModelSelection
  // 标题总结模型。
  titleSummary: AiSettingsModelSelection
  // 周度总结模型。
  weeklySummary: AiSettingsModelSelection
  // 已启用 provider 标识列表。
  enabledProviders: string[]
  // Provider 配置表。
  providers: Record<string, AiSettingsProvider>
  // Agent 非密钥行为配置。
  agent: AgentConfig
}

// 原始配置文件对象。
type RawConfigFile = Record<string, unknown>

// 原始 provider 配置。
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
  models?: Record<string, Partial<AiSettingsModel>>
}

// 原始 AI 配置。
type RawAiConfig = {
  // 默认 provider，兼容旧结构。
  defaultProvider?: string
  // 默认模型，兼容字符串与对象结构。
  defaultModel?: string | Partial<AiSettingsModelSelection>
  // 标题总结模型。
  titleSummary?: Partial<AiSettingsModelSelection>
  // 周度总结模型。
  weeklySummary?: Partial<AiSettingsModelSelection>
  // 已启用 provider 标识列表。
  enabled_providers?: string[]
  // Provider 配置表。
  providers?: Record<string, RawProviderConfig>
  // Agent 非密钥行为配置。
  agent?: Partial<AgentConfig>
}

// 默认可编辑设置。
const DEFAULT_AI_SETTINGS: Omit<AiSettingsConfig, 'configPath'> = {
  defaultModel: {
    provider: 'bailian',
    model: 'MiniMax-M2.5'
  },
  titleSummary: {
    provider: 'bailian',
    model: 'MiniMax-M2.5'
  },
  weeklySummary: {
    provider: 'bailian',
    model: 'MiniMax-M2.5'
  },
  enabledProviders: ['bailian'],
  providers: {
    bailian: {
      id: 'bailian',
      type: 'openai-compatible',
      name: 'Bailian',
      options: {
        apiKey: '',
        baseURL: ''
      },
      models: {
        'MiniMax-M2.5': {
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
      }
    }
  },
  agent: DEFAULT_AGENT_CONFIG
}

// 旧配置缺失模型限制时使用的保守默认值。
const DEFAULT_MODEL_LIMIT: ModelLimit = {
  context: 8192,
  output: 4096
}

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 读取原始配置文件，缺失时返回空对象。
 */
const readRawConfig = (configPath: string): RawConfigFile => {
  if (!existsSync(configPath)) {
    return {}
  }

  const rawText = readFileSync(configPath, 'utf8').trim()
  if (!rawText) {
    return {}
  }

  const parsed = JSON.parse(rawText) as unknown
  return isRecord(parsed) ? parsed : {}
}

/**
 * 推断 provider 传输格式。
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
 * 归一化模型限制。
 */
const normalizeLimit = (limit: Partial<ModelLimit> | undefined): ModelLimit => ({
  context: typeof limit?.context === 'number' ? limit.context : DEFAULT_MODEL_LIMIT.context,
  output: typeof limit?.output === 'number' ? limit.output : DEFAULT_MODEL_LIMIT.output
})

/**
 * 归一化模型模态。
 */
const normalizeModalities = (modalities: Partial<ModelModalities> | undefined): ModelModalities => ({
  input: Array.isArray(modalities?.input) ? modalities.input.map(String) : ['text'],
  output: Array.isArray(modalities?.output) ? modalities.output.map(String) : ['text']
})

/**
 * 归一化单个模型配置。
 */
const normalizeModel = (id: string, model: Partial<AiSettingsModel> | undefined): AiSettingsModel => ({
  id,
  name: model?.name ?? id,
  limit: normalizeLimit(model?.limit),
  modalities: normalizeModalities(model?.modalities)
})

/**
 * 归一化单个 provider 配置。
 */
const normalizeProvider = (id: string, provider: RawProviderConfig): AiSettingsProvider => ({
  id,
  type: inferProviderType(provider),
  name: provider.name ?? id,
  options: {
    apiKey: provider.options?.apiKey ?? '',
    baseURL: provider.options?.baseURL ?? ''
  },
  models: Object.fromEntries(
    Object.entries(provider.models ?? {}).map(([modelId, model]) => [
      modelId,
      normalizeModel(modelId, model)
    ])
  )
})

/**
 * 读取原始 AI 配置。
 */
const readRawAiConfig = (rawConfig: RawConfigFile): RawAiConfig => {
  const rawAi = rawConfig.ai
  if (isRecord(rawAi)) {
    return rawAi as RawAiConfig
  }

  if (isRecord(rawConfig.bailian)) {
    return {
      providers: {
        bailian: rawConfig.bailian as RawProviderConfig
      }
    }
  }

  return {}
}

/**
 * 选取存在的模型选择配置。
 */
const normalizeSelection = (
  value: string | Partial<AiSettingsModelSelection> | undefined,
  legacyProvider: string | undefined,
  providers: Record<string, AiSettingsProvider>,
  fallback?: AiSettingsModelSelection
): AiSettingsModelSelection => {
  const providerIds = Object.keys(providers)
  const requestedProvider = typeof value === 'object' ? value.provider : legacyProvider
  const provider = requestedProvider && providers[requestedProvider] ? requestedProvider : fallback?.provider ?? providerIds[0]
  const requestedModel = typeof value === 'string' ? value : value?.model
  const providerModels = provider ? providers[provider]?.models ?? {} : {}
  const model = requestedModel && providerModels[requestedModel] ? requestedModel : fallback?.model ?? Object.keys(providerModels)[0] ?? ''

  return {
    provider: provider ?? '',
    model
  }
}

/**
 * 归一化 Agent 配置。
 */
const normalizeAgent = (agent: Partial<AgentConfig> | undefined): AgentConfig => ({
  context: {
    toolOutputMaxChars:
      typeof agent?.context?.toolOutputMaxChars === 'number'
        ? agent.context.toolOutputMaxChars
        : DEFAULT_AGENT_CONFIG.context.toolOutputMaxChars,
    recentToolResultLimit:
      typeof agent?.context?.recentToolResultLimit === 'number' &&
      Number.isInteger(agent.context.recentToolResultLimit) &&
      agent.context.recentToolResultLimit >= 0
        ? agent.context.recentToolResultLimit
        : DEFAULT_AGENT_CONFIG.context.recentToolResultLimit,
    maxTurns:
      typeof agent?.context?.maxTurns === 'number' &&
      Number.isInteger(agent.context.maxTurns) &&
      agent.context.maxTurns > 0
        ? agent.context.maxTurns
        : undefined
  }
})

/**
 * 读取 AI Settings 配置。
 */
export const readAiSettingsConfig = (configPath = DEFAULT_MC_CONFIG_PATH): AiSettingsConfig => {
  const rawConfig = readRawConfig(configPath)
  const rawAi = readRawAiConfig(rawConfig)
  const rawProviders = rawAi.providers ?? (DEFAULT_AI_SETTINGS.providers as unknown as Record<string, RawProviderConfig>)
  const providers = Object.fromEntries(
    Object.entries(rawProviders).map(([providerId, provider]) => [
      providerId,
      normalizeProvider(providerId, provider)
    ])
  )
  const enabledProviders = (rawAi.enabled_providers ?? Object.keys(providers)).filter((providerId) =>
    Boolean(providers[providerId])
  )
  const defaultModel = normalizeSelection(rawAi.defaultModel, rawAi.defaultProvider, providers)

  return {
    configPath,
    defaultModel,
    titleSummary: normalizeSelection(rawAi.titleSummary, undefined, providers, defaultModel),
    weeklySummary: normalizeSelection(rawAi.weeklySummary, undefined, providers, defaultModel),
    enabledProviders: enabledProviders.length > 0 ? enabledProviders : Object.keys(providers),
    providers,
    agent: normalizeAgent(rawAi.agent)
  }
}

/**
 * 判断数值是否为正整数。
 */
const isPositiveInteger = (value: number): boolean => {
  return Number.isInteger(value) && value > 0
}

/**
 * 校验模型选择是否存在。
 */
const validateSelection = (
  label: string,
  selection: AiSettingsModelSelection,
  providers: Record<string, AiSettingsProvider>
): void => {
  if (!providers[selection.provider]) {
    throw new Error(`${label} provider 不存在`)
  }

  if (!providers[selection.provider].models[selection.model]) {
    throw new Error(`${label} model 不存在`)
  }
}

/**
 * 校验 AI Settings 配置。
 */
const validateSettings = (settings: AiSettingsConfig): void => {
  const providerIds = Object.keys(settings.providers)
  if (providerIds.length === 0) {
    throw new Error('至少配置一个 provider')
  }

  if (settings.enabledProviders.length === 0) {
    throw new Error('至少启用一个 provider')
  }

  const seenProviderIds = new Set<string>()
  providerIds.forEach((providerKey) => {
    const provider = settings.providers[providerKey]
    const providerId = provider.id.trim()
    if (!providerId) {
      throw new Error('provider id 不能为空')
    }
    if (seenProviderIds.has(providerId)) {
      throw new Error(`provider id 重复: ${providerId}`)
    }
    seenProviderIds.add(providerId)
    if (!provider.name.trim()) {
      throw new Error(`${providerId} name 不能为空`)
    }
    if (!provider.options.baseURL.trim()) {
      throw new Error(`${providerId} baseURL 不能为空`)
    }
    if (!provider.options.apiKey.trim()) {
      throw new Error(`${providerId} apiKey 不能为空`)
    }

    const seenModelIds = new Set<string>()
    Object.values(provider.models).forEach((model) => {
      const modelId = model.id.trim()
      if (!modelId) {
        throw new Error(`${providerId} model id 不能为空`)
      }
      if (seenModelIds.has(modelId)) {
        throw new Error(`${providerId} model id 重复: ${modelId}`)
      }
      seenModelIds.add(modelId)
      if (!model.name.trim()) {
        throw new Error(`${providerId}/${modelId} name 不能为空`)
      }
      if (!isPositiveInteger(model.limit.context)) {
        throw new Error(`${providerId}/${modelId} context 必须为正整数`)
      }
      if (!isPositiveInteger(model.limit.output)) {
        throw new Error(`${providerId}/${modelId} output 必须为正整数`)
      }
    })
    if (seenModelIds.size === 0) {
      throw new Error(`${providerId} 至少配置一个 model`)
    }
  })

  settings.enabledProviders.forEach((providerId) => {
    if (!seenProviderIds.has(providerId)) {
      throw new Error(`启用的 provider 不存在: ${providerId}`)
    }
  })
  validateSelection('默认模型', settings.defaultModel, settings.providers)
  validateSelection('标题总结模型', settings.titleSummary, settings.providers)
  validateSelection('周度总结模型', settings.weeklySummary, settings.providers)

  if (!isPositiveInteger(settings.agent.context.toolOutputMaxChars)) {
    throw new Error('toolOutputMaxChars 必须为正整数')
  }
  if (!isPositiveInteger(settings.agent.context.recentToolResultLimit) && settings.agent.context.recentToolResultLimit !== 0) {
    throw new Error('recentToolResultLimit 必须为正整数或 0（表示无限制）')
  }
  if (
    settings.agent.context.maxTurns !== undefined &&
    !isPositiveInteger(settings.agent.context.maxTurns)
  ) {
    throw new Error('maxTurns 必须为正整数或留空（表示无限制）')
  }
}

/**
 * 合并已有密钥，允许页面用空字符串表示不修改密钥。
 */
const preserveExistingApiKeys = (
  settings: AiSettingsConfig,
  existing: AiSettingsConfig
): AiSettingsConfig => ({
  ...settings,
  providers: Object.fromEntries(
    Object.entries(settings.providers).map(([providerKey, provider]) => {
      const existingApiKey = existing.providers[provider.id]?.options.apiKey ?? existing.providers[providerKey]?.options.apiKey
      return [
        providerKey,
        {
          ...provider,
          options: {
            ...provider.options,
            apiKey: provider.options.apiKey.trim() || existingApiKey || ''
          }
        }
      ]
    })
  )
})

/**
 * 转换为落盘 AI 配置。
 */
const serializeAiConfig = (settings: AiSettingsConfig): RawAiConfig => ({
  defaultModel: settings.defaultModel,
  titleSummary: settings.titleSummary,
  weeklySummary: settings.weeklySummary,
  enabled_providers: settings.enabledProviders,
  providers: Object.fromEntries(
    Object.values(settings.providers).map((provider) => [
      provider.id,
      {
        type: provider.type,
        name: provider.name,
        options: {
          apiKey: provider.options.apiKey,
          baseURL: provider.options.baseURL.replace(/\/$/, '')
        },
        models: Object.fromEntries(
          Object.values(provider.models).map((model) => [
            model.id,
            {
              name: model.name,
              limit: model.limit,
              modalities: model.modalities
            }
          ])
        )
      }
    ])
  ),
  agent: settings.agent
})

/**
 * 保存 AI Settings 配置。
 */
export const saveAiSettingsConfig = (
  settings: AiSettingsConfig,
  configPath = DEFAULT_MC_CONFIG_PATH
): AiSettingsConfig => {
  const rawConfig = readRawConfig(configPath)
  const existing = readAiSettingsConfig(configPath)
  const nextSettings = preserveExistingApiKeys(settings, existing)
  validateSettings(nextSettings)
  const nextRawConfig = {
    ...rawConfig,
    ai: serializeAiConfig(nextSettings)
  }

  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(nextRawConfig, null, 2)}\n`)
  return readAiSettingsConfig(configPath)
}
