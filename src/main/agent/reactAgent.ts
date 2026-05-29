import type {
  AgentMessage,
  AgentStreamEvent,
  AgentTool,
  ModelToolCallDoneEvent,
  ReactAgentRunInput
} from './types'
import { prepareToolsForModel } from './toolRegistry'

// 默认最大 Agent 循环轮数。
const DEFAULT_MAX_TURNS = 5

/**
 * 解析模型输出的工具参数。
 */
const parseToolArguments = (toolCall: ModelToolCallDoneEvent): unknown => {
  if (!toolCall.argumentsText.trim()) {
    return {}
  }

  return JSON.parse(toolCall.argumentsText) as unknown
}

/**
 * 解析工具名，兼容部分流式 provider 丢失唯一工具名称的情况。
 */
const resolveToolName = (toolCall: ModelToolCallDoneEvent, tools: AgentTool[]): string => {
  if (toolCall.name.trim()) {
    return toolCall.name
  }

  if (tools.length === 1) {
    return tools[0].name
  }

  return toolCall.name
}

/**
 * 运行 Claude Code 风格的 ReAct Agent Loop。
 */
export async function* runReactAgent(input: ReactAgentRunInput): AsyncGenerator<AgentStreamEvent> {
  const messages: AgentMessage[] = [...input.messages]
  const tools = prepareToolsForModel(input.tools)
  const toolsByName = new Map<string, AgentTool>(tools.map((tool) => [tool.name, tool]))
  const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS

  yield {
    type: 'run_started'
  }

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const toolCalls: ModelToolCallDoneEvent[] = []
    let emittedText = false

    for await (const event of input.provider.streamTurn({
      model: input.model,
      messages,
      tools
    })) {
      if (event.type === 'text_delta') {
        if (!emittedText) {
          emittedText = true
          yield {
            type: 'assistant_message_started'
          }
        }

        yield {
          type: 'text_delta',
          delta: event.delta
        }
      }

      if (event.type === 'tool_call_done') {
        toolCalls.push(event)
      }
    }

    if (toolCalls.length === 0) {
      yield {
        type: 'turn_finished'
      }
      yield {
        type: 'done'
      }
      return
    }

    const normalizedToolCalls = toolCalls.map((toolCall) => ({
      ...toolCall,
      name: resolveToolName(toolCall, tools)
    }))

    messages.push({
      role: 'assistant',
      content: '',
      toolCalls: normalizedToolCalls
    })

    for (const toolCall of normalizedToolCalls) {
      const tool = toolsByName.get(toolCall.name)
      if (!tool) {
        throw new Error(`模型请求了未授权工具：${toolCall.name || '<empty>'}`)
      }

      const toolInput = parseToolArguments(toolCall)
      yield {
        type: 'tool_started',
        id: toolCall.id,
        name: toolCall.name,
        input: toolInput
      }

      const result = await tool.execute(toolInput)
      yield {
        type: 'tool_finished',
        id: toolCall.id,
        name: toolCall.name,
        observation: result.observation,
        data: result.data
      }

      messages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolCall.name,
        content: result.observation
      })
    }

    yield {
      type: 'turn_finished'
    }
  }

  throw new Error(`Agent 超过最大循环轮数：${maxTurns}`)
}
