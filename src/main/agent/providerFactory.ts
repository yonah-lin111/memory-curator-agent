import { createOpenAICompatibleProvider } from './openaiCompatibleProvider'
import type { ModelProvider, NormalizedProviderConfig } from './types'

/**
 * 创建暂未执行流式请求的 provider 占位实现。
 */
const createConfiguredProvider = (config: NormalizedProviderConfig): ModelProvider => ({
  id: config.id,
  type: config.type,
  streamTurn: async function* () {
    throw new Error(`Provider ${config.type} 已支持配置识别，流式执行尚未接入`)
  }
})

/**
 * 根据 provider 配置创建模型 provider。
 */
export const createModelProvider = (config: NormalizedProviderConfig): ModelProvider => {
  if (config.type === 'openai-compatible' || config.type === 'openai') {
    return createOpenAICompatibleProvider(config)
  }

  return createConfiguredProvider(config)
}
