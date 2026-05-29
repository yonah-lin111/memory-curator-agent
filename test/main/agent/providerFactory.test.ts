import { describe, expect, it } from 'vitest'
import { createModelProvider } from '../../../src/main/agent/providerFactory'
import type { NormalizedProviderConfig } from '../../../src/main/agent/types'

describe('providerFactory', () => {
  it('按配置类型创建 OpenAI compatible provider', async () => {
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

    const provider = await createModelProvider(providerConfig, {
      loadPackage: async () => ({
        createOpenAICompatible: () => () => ({})
      }),
      streamText: () => ({
        stream: (async function* () {
          yield {
            type: 'finish'
          }
        })()
      })
    })

    expect(provider.id).toBe('bailian')
    expect(provider.type).toBe('openai-compatible')
  })

  it('支持 Google、OpenAI、Claude/Anthropic 的传输格式配置', async () => {
    const providerTypes: NormalizedProviderConfig['type'][] = ['google', 'openai', 'anthropic']

    const providers = providerTypes.map((type) =>
      createModelProvider({
        id: type,
        type,
        npm:
          type === 'google'
            ? '@ai-sdk/google'
            : type === 'anthropic'
              ? '@ai-sdk/anthropic'
              : '@ai-sdk/openai',
        name: type,
        options: {
          apiKey: 'test-key',
          baseURL: 'https://example.com'
        },
        models: {}
      }, {
        loadPackage: async (packageName) => {
          if (packageName === '@ai-sdk/google') {
            return {
              createGoogleGenerativeAI: () => () => ({})
            }
          }

          if (packageName === '@ai-sdk/anthropic') {
            return {
              createAnthropic: () => () => ({})
            }
          }

          return {
            createOpenAI: () => () => ({})
          }
        },
        streamText: () => ({
          stream: (async function* () {
            yield {
              type: 'finish'
            }
          })()
        })
      })
    )

    await expect(Promise.all(providers)).resolves.toEqual(
      providerTypes.map((type) =>
        expect.objectContaining({
          type
        })
      )
    )
  })
})
