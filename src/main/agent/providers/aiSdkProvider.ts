import { jsonSchema, streamText, tool, type ModelMessage } from 'ai'
import type {
  AgentMessage,
  AgentTool,
  ModelProvider,
  ModelStreamEvent,
  ModelTurnInput,
  NormalizedProviderConfig
} from '../types'
import { prepareToolsForModel } from '../tools/toolRegistry'

// AI SDK provider 模块。
type AiSdkProviderModule = Record<string, unknown>

// AI SDK 模型工厂。
type AiSdkModelFactory = (model: string) => unknown

// AI SDK streamText 兼容函数。
type AiSdkStreamText = (input: Record<string, unknown>) => {
  // AI SDK 完整事件流。
  stream?: AsyncIterable<Record<string, unknown>>
  // AI SDK 6 的完整事件流。
  fullStream?: AsyncIterable<Record<string, unknown>>
}

// AI SDK provider 运行时依赖。
export type AiSdkProviderRuntime = {
  // 加载配置中 npm 指定的 provider 包。
  loadPackage?: (packageName: string) => Promise<AiSdkProviderModule>
  // AI SDK streamText 函数。
  streamText?: AiSdkStreamText
}

// 常见 AI SDK provider 工厂导出名。
const PROVIDER_FACTORY_EXPORTS = [
  'createOpenAICompatible',
  'createOpenAI',
  'createAnthropic',
  'createGoogleGenerativeAI'
]

/**
 * 动态加载 provider npm 包。
 */
const loadProviderPackage = async (packageName: string): Promise<AiSdkProviderModule> => {
  try {
    return (await import(packageName)) as AiSdkProviderModule
  } catch (error) {
    throw new Error(
      `Provider dependency is not installed or cannot be loaded: ${packageName}. Install the npm package first. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

/**
 * 从 provider 模块中解析模型工厂创建函数。
 */
const resolveProviderFactory = (
  module: AiSdkProviderModule,
  packageName: string
): ((options: Record<string, unknown>) => AiSdkModelFactory) => {
  for (const exportName of PROVIDER_FACTORY_EXPORTS) {
    const candidate = module[exportName]
    if (typeof candidate === 'function') {
      return candidate as (options: Record<string, unknown>) => AiSdkModelFactory
    }
  }

  const fallbackEntry = Object.entries(module).find(
    ([exportName, value]) => exportName.startsWith('create') && typeof value === 'function'
  )
  if (fallbackEntry) {
    return fallbackEntry[1] as (options: Record<string, unknown>) => AiSdkModelFactory
  }

  throw new Error(`Provider dependency ${packageName} does not export a recognized create* factory function`)
}

/**
 * 解析工具参数 JSON。
 */
const parseToolArguments = (argumentsText: string): unknown => {
  if (!argumentsText.trim()) {
    return {}
  }

  return JSON.parse(argumentsText) as unknown
}

/**
 * 转换为 AI SDK 模型消息。
 */
const toAiSdkMessage = (message: AgentMessage): ModelMessage => {
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.toolCalls.map((toolCall) => ({
        type: 'tool-call',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        input: parseToolArguments(toolCall.argumentsText)
      }))
    }
  }

  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: message.toolCallId ?? '',
          toolName: message.name ?? '',
          output: {
            type: 'text',
            value: message.content
          }
        }
      ]
    }
  }

  return {
    role: message.role,
    content: message.content
  } as ModelMessage
}

/**
 * 转换为 AI SDK 工具集合。
 */
const toAiSdkTools = (tools: AgentTool[]): Record<string, unknown> =>
  Object.fromEntries(
    prepareToolsForModel(tools).map((agentTool) => [
      agentTool.name,
      tool({
        description: agentTool.description,
        inputSchema: jsonSchema(agentTool.parameters as never)
      })
    ])
  )

/**
 * 创建由 npm 字段驱动的 AI SDK 模型 provider。
 */
export const createAiSdkModelProvider = async (
  config: NormalizedProviderConfig,
  runtime: AiSdkProviderRuntime = {}
): Promise<ModelProvider> => {
  if (!config.npm) {
    throw new Error(`Provider ${config.id} is missing the npm field, so the AI SDK provider cannot be loaded`)
  }

  const providerModule = await (runtime.loadPackage ?? loadProviderPackage)(config.npm)
  const createProvider = resolveProviderFactory(providerModule, config.npm)
  const provider = createProvider({
    name: config.name,
    apiKey: config.options.apiKey,
    baseURL: config.options.baseURL
  })
  const runStreamText = runtime.streamText ?? (streamText as unknown as AiSdkStreamText)

  return {
    id: config.id,
    type: config.type,
    streamTurn: async function* (input: ModelTurnInput): AsyncGenerator<ModelStreamEvent> {
      const result = runStreamText({
        model: provider(input.model),
        messages: input.messages.map(toAiSdkMessage),
        tools: toAiSdkTools(input.tools),
        abortSignal: input.signal
      })

      const eventStream = result.fullStream ?? result.stream
      if (!eventStream) {
        throw new Error('AI SDK streamText did not return fullStream or stream')
      }

      for await (const part of eventStream) {
        if (part.type === 'text-delta' && typeof part.text === 'string') {
          yield {
            type: 'text_delta',
            delta: part.text
          }
        }

        if (
          part.type === 'reasoning-delta' &&
          typeof part.id === 'string' &&
          typeof part.text === 'string'
        ) {
          yield {
            type: 'reasoning_delta',
            id: part.id,
            delta: part.text
          }
        }

        if (
          part.type === 'tool-call' &&
          typeof part.toolCallId === 'string' &&
          typeof part.toolName === 'string'
        ) {
          yield {
            type: 'tool_call_done',
            id: part.toolCallId,
            name: part.toolName,
            argumentsText: JSON.stringify(part.input ?? {})
          }
        }

        if (part.type === 'error') {
          throw part.error instanceof Error ? part.error : new Error(String(part.error))
        }

        if (part.type === 'finish') {
          yield {
            type: 'done'
          }
        }
      }
    }
  }
}
