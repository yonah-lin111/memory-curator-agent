import { createAiSdkModelProvider, type AiSdkProviderRuntime } from './aiSdkProvider'
import type { ModelProvider, NormalizedProviderConfig } from '../types'

/**
 * 根据 provider 配置创建模型 provider。
 */
export const createModelProvider = (
  config: NormalizedProviderConfig,
  runtime?: AiSdkProviderRuntime
): Promise<ModelProvider> => createAiSdkModelProvider(config, runtime)
