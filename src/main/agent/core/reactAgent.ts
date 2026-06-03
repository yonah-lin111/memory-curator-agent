import type {
  AgentMessage,
  AgentStreamEvent,
  AgentTool,
  ModelToolCallDoneEvent,
  ReactAgentRunInput
} from '../types'
import { prepareToolsForModel, selectToolsForTurn } from '../tools/toolRegistry'
import {
  formatAskAnswerObservation,
  isAskRequestData
} from '../tools/askTool'

// 默认最大 Agent 循环轮数。
const DEFAULT_MAX_TURNS = 5

// Ask 被用户界面作废时的固定错误文本。
const ASK_CANCELLED_MESSAGE = 'Ask request was cancelled.'

/**
 * 如果当前 run 已取消，直接中断 Agent 循环。
 */
const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('AI chat request was cancelled')
  }
}

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

  throwIfAborted(input.signal)

  yield {
    type: 'run_started'
  }

  for (let turn = 0; turn < maxTurns; turn += 1) {
    throwIfAborted(input.signal)

    const selectedTools = selectToolsForTurn(input.tools, messages)
    const tools = prepareToolsForModel(selectedTools)
    const toolsByName = new Map<string, AgentTool>(tools.map((tool) => [tool.name, tool]))
    const toolCalls: ModelToolCallDoneEvent[] = []
    let emittedText = false

    for await (const event of input.provider.streamTurn({
      model: input.model,
      messages,
      tools,
      signal: input.signal
    })) {
      throwIfAborted(input.signal)

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

      if (event.type === 'reasoning_delta') {
        yield {
          type: 'reasoning_delta',
          id: event.id,
          delta: event.delta
        }
      }

      if (event.type === 'tool_call_done') {
        toolCalls.push(event)
      }
    }

    throwIfAborted(input.signal)

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
      throwIfAborted(input.signal)

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
        throwIfAborted(input.signal)

        yield {
          type: 'tool_finished',
          id: toolCall.id,
          name: toolCall.name,
          observation: result.observation,
          data: result.data
        }

        if (isAskRequestData(result.data)) {
          if (!input.askAnswerProvider) {
            throw new Error('Ask answer provider is not configured')
          }

          const answerData = await input.askAnswerProvider(result.data)
          throwIfAborted(input.signal)
          const answerObservation = formatAskAnswerObservation(answerData)

          yield {
            type: 'tool_finished',
            id: toolCall.id,
            name: toolCall.name,
            observation: answerObservation,
            data: answerData
          }

          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            name: toolCall.name,
            content: renderToolResultContent(answerObservation, answerData)
          })

          continue
        }

        messages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          name: toolCall.name,
          content: renderToolResultContent(result.observation, result.data)
        })

        if (result.terminal) {
          yield {
            type: 'turn_finished'
          }
          yield {
            type: 'done'
          }
          return
        }
      } catch (error) {
        const errorMessage = getToolErrorMessage(error)
        const isAskCancelled = toolCall.name === 'ask_user' && errorMessage === ASK_CANCELLED_MESSAGE

        yield {
          type: 'tool_failed',
          id: toolCall.id,
          name: toolCall.name,
          input: toolInput,
          error: errorMessage
        }

        if (isAskCancelled) {
          yield {
            type: 'turn_finished'
          }
          yield {
            type: 'done'
          }
          return
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
