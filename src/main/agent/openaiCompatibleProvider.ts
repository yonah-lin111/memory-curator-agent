import type {
  AgentMessage,
  AgentTool,
  ModelProvider,
  ModelStreamEvent,
  ModelTurnInput,
  NormalizedProviderConfig
} from './types'

// OpenAI compatible 工具调用缓存。
type ToolCallBuffer = {
  // 工具调用 ID。
  id: string
  // 工具名称。
  name: string
  // 参数 JSON 片段。
  argumentsText: string
}

/**
 * 将 Agent 消息转换成 OpenAI compatible 消息。
 */
const toOpenAIMessage = (message: AgentMessage): Record<string, unknown> => {
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: 'function',
        function: {
          name: toolCall.name,
          arguments: toolCall.argumentsText
        }
      }))
    }
  }

  if (message.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: message.toolCallId,
      name: message.name,
      content: message.content
    }
  }

  return {
    role: message.role,
    content: message.content
  }
}

/**
 * 将 Agent 工具转换成 OpenAI compatible 工具定义。
 */
const toOpenAITool = (tool: AgentTool): Record<string, unknown> => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }
})

/**
 * 解析 OpenAI compatible SSE 文本。
 */
export async function* parseOpenAICompatibleSse(
  chunks: Iterable<string> | AsyncIterable<string>
): AsyncGenerator<ModelStreamEvent> {
  const toolCalls = new Map<number, ToolCallBuffer>()
  let buffer = ''

  for await (const chunk of chunks) {
    buffer += chunk
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const dataLines = part
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())

      for (const data of dataLines) {
        if (data === '[DONE]') {
          yield {
            type: 'done'
          }
          continue
        }

        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string
              tool_calls?: Array<{
                index: number
                id?: string
                function?: {
                  name?: string
                  arguments?: string
                }
              }>
            }
            finish_reason?: string
          }>
        }
        const choice = parsed.choices?.[0]
        const delta = choice?.delta

        if (delta?.content) {
          yield {
            type: 'text_delta',
            delta: delta.content
          }
        }

        for (const toolCallDelta of delta?.tool_calls ?? []) {
          const existing = toolCalls.get(toolCallDelta.index) ?? {
            id: toolCallDelta.id ?? `tool-${toolCallDelta.index}`,
            name: toolCallDelta.function?.name ?? '',
            argumentsText: ''
          }

          toolCalls.set(toolCallDelta.index, {
            id: toolCallDelta.id ?? existing.id,
            name: toolCallDelta.function?.name ?? existing.name,
            argumentsText: existing.argumentsText + (toolCallDelta.function?.arguments ?? '')
          })
        }

        if (choice?.finish_reason === 'tool_calls') {
          for (const toolCall of toolCalls.values()) {
            yield {
              type: 'tool_call_done',
              id: toolCall.id,
              name: toolCall.name,
              argumentsText: toolCall.argumentsText
            }
          }
          toolCalls.clear()
        }
      }
    }
  }
}

/**
 * 将 ReadableStream 解码为文本块。
 */
async function* decodeResponseBody(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  const reader = body.getReader()

  while (true) {
    const result = await reader.read()
    if (result.done) {
      break
    }

    yield decoder.decode(result.value, {
      stream: true
    })
  }
}

/**
 * 创建 OpenAI compatible provider。
 */
export const createOpenAICompatibleProvider = (
  config: NormalizedProviderConfig
): ModelProvider => ({
  id: config.id,
  type: config.type,
  streamTurn: async function* (input: ModelTurnInput) {
    const response = await fetch(`${config.options.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.options.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages.map(toOpenAIMessage),
        tools: input.tools.map(toOpenAITool),
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`模型请求失败：${response.status} ${await response.text()}`)
    }

    if (!response.body) {
      throw new Error('模型响应缺少流式 body')
    }

    yield* parseOpenAICompatibleSse(decodeResponseBody(response.body))
  }
})
