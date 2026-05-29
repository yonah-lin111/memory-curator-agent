import { describe, expect, it } from 'vitest'
import { createModelProvider } from '../../../src/main/agent/providerFactory'
import type { NormalizedProviderConfig } from '../../../src/main/agent/types'

describe('providerFactory', () => {
  it('按配置类型创建 OpenAI compatible provider', () => {
    const providerConfig: NormalizedProviderConfig = {
      id: 'bailian',
      type: 'openai-compatible',
      name: 'Bailian',
      npm: '@ai-sdk/openai-compatible',
      options: {
        apiKey: 'test-key',
        baseURL: 'https://example.com/v1'
      },
      models: {}
    }

    const provider = createModelProvider(providerConfig)

    expect(provider.id).toBe('bailian')
    expect(provider.type).toBe('openai-compatible')
  })

  it('支持 Google、OpenAI、Claude/Anthropic 的传输格式配置', () => {
    const providerTypes: NormalizedProviderConfig['type'][] = ['google', 'openai', 'anthropic']

    const providers = providerTypes.map((type) =>
      createModelProvider({
        id: type,
        type,
        name: type,
        options: {
          apiKey: 'test-key',
          baseURL: 'https://example.com'
        },
        models: {}
      })
    )

    expect(providers.map((provider) => provider.type)).toEqual(providerTypes)
  })
})
