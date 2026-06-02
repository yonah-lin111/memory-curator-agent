import type {
  AgentMessage,
  AgentStreamEvent,
  AgentTool,
  ModelToolCallDoneEvent,
  ReactAgentRunInput
} from '../types'
import { prepareToolsForModel, selectToolsForTurn } from '../tools/toolRegistry'

// 默认最大 Agent 循环轮数。
const DEFAULT_MAX_TURNS = 5

/**
 * 解析模型输出的工具参数。
 */
const parseToolArguments = (toolCall: ModelToolCallDoneEvent): unknown => {
  const argumentsText = typeof toolCall.argumentsText === 'string' ? toolCall.argumentsText.trim() : ''

  if (!argumentsText || argumentsText === 'undefined') {
    return {}
  }

  return JSON.parse(argumentsText) as unknown
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
 * 序列化工具结构化数据。
 */
const stringifyToolData = (data: unknown): string => {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return JSON.stringify({
      error: 'Tool structured data is not serializable'
    })
  }
}

/**
 * 构造回灌模型的完整工具结果。
 */
const renderToolResultContent = (observation: string, data: unknown): string => {
  const dataText = stringifyToolData(data)

  return [`Tool observation:`, observation.trim(), `Tool data:`, dataText].join('\n')
}

/**
 * 提取可回灌给模型的工具错误信息。
 */
const getToolErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * 构造回灌模型的工具失败结果。
 */
const renderToolFailureContent = (toolName: string, error: string): string =>
  renderToolResultContent(
    [
      `Tool ${toolName} execution failed: ${error}`,
      'This is not the final answer. Fix the arguments and call the tool again first; only explain the failure to the user when the error is confirmed unrecoverable.'
    ].join('\n'),
    {
    error,
    tool: toolName
    }
  )

/**
 * 运行 Claude Code 风格的 ReAct Agent Loop。
 */
export async function* runReactAgent(input: ReactAgentRunInput): AsyncGenerator<AgentStreamEvent> {
  const messages: AgentMessage[] = [...input.messages]
  const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS

  yield {
    type: 'run_started'
  }

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const selectedTools = selectToolsForTurn(input.tools, messages)
    const tools = prepareToolsForModel(selectedTools)
    const toolsByName = new Map<string, AgentTool>(tools.map((tool) => [tool.name, tool]))
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
        throw new Error(`The model requested an unauthorized tool: ${toolCall.name || '<empty>'}`)
      }

      const toolInput = parseToolArguments(toolCall)
      yield {
        type: 'tool_started',
        id: toolCall.id,
        name: toolCall.name,
        input: toolInput
      }

      try {
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
          content: renderToolResultContent(result.observation, result.data)
        })
      } catch (error) {
        const errorMessage = getToolErrorMessage(error)

        yield {
          type: 'tool_failed',
          id: toolCall.id,
          name: toolCall.name,
          input: toolInput,
          error: errorMessage
        }

        messages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          name: toolCall.name,
          content: renderToolFailureContent(toolCall.name, errorMessage)
        })
      }
    }

    yield {
      type: 'turn_finished'
    }
  }

  throw new Error(`Agent exceeded the maximum turn count: ${maxTurns}`)
}
