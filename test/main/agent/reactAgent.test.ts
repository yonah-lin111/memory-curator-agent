import { describe, expect, it } from 'vitest'
import { runReactAgent } from '../../../src/main/agent/reactAgent'
import type { AgentTool, ModelProvider, ModelTurnInput } from '../../../src/main/agent/types'

describe('reactAgent', () => {
  it('执行模型请求的工具并把观察结果回灌到下一轮', async () => {
    const providerInputs: ModelTurnInput[] = []
    const provider: ModelProvider = {
      id: 'fake',
      type: 'openai-compatible',
      streamTurn: async function* (input) {
        providerInputs.push(input)

        if (providerInputs.length === 1) {
          yield {
            type: 'tool_call_done',
            id: 'call-1',
            name: 'people_list',
            argumentsText: '{"query":"阿明"}'
          }
          yield {
            type: 'done'
          }
          return
        }

        yield {
          type: 'text_delta',
          delta: '阿明是朋友。'
        }
        yield {
          type: 'done'
        }
      }
    }
    const peopleTool: AgentTool = {
      name: 'people_list',
      description: '查询 People 表',
      parameters: {
        type: 'object',
        properties: {}
      },
      execute: async () => ({
        observation: '找到 1 位关联人物：阿明｜朋友｜技术狂热者',
        data: []
      })
    }

    const events = await Array.fromAsync(
      runReactAgent({
        provider,
        model: 'fake-model',
        messages: [
          {
            role: 'user',
            content: '阿明是谁'
          }
        ],
        tools: [peopleTool],
        maxTurns: 3
      })
    )

    expect(events.map((event) => event.type)).toEqual([
      'run_started',
      'tool_started',
      'tool_finished',
      'turn_finished',
      'assistant_message_started',
      'text_delta',
      'turn_finished',
      'done'
    ])
    expect(providerInputs).toHaveLength(2)
    expect(providerInputs[1].messages.at(-1)).toMatchObject({
      role: 'tool',
      toolCallId: 'call-1',
      name: 'people_list',
      content: '找到 1 位关联人物：阿明｜朋友｜技术狂热者'
    })
  })

  it('当模型流丢失工具名且只有一个授权工具时使用唯一工具兜底', async () => {
    let turnCount = 0
    const provider: ModelProvider = {
      id: 'fake',
      type: 'openai-compatible',
      streamTurn: async function* () {
        turnCount += 1
        if (turnCount > 1) {
          yield {
            type: 'text_delta',
            delta: '查询完成。'
          }
          yield {
            type: 'done'
          }
          return
        }

        yield {
          type: 'tool_call_done',
          id: 'call-1',
          name: '',
          argumentsText: '{}'
        }
        yield {
          type: 'done'
        }
      }
    }
    const peopleTool: AgentTool = {
      name: 'people_list',
      description: '查询 People 表',
      parameters: {
        type: 'object',
        properties: {}
      },
      execute: async () => ({
        observation: '找到 0 位关联人物',
        data: []
      })
    }

    const events = await Array.fromAsync(
      runReactAgent({
        provider,
        model: 'fake-model',
        messages: [
          {
            role: 'user',
            content: '查一下人物'
          }
        ],
        tools: [peopleTool],
        maxTurns: 2
      })
    )

    expect(events).toContainEqual({
      type: 'tool_started',
      id: 'call-1',
      name: 'people_list',
      input: {}
    })
  })

  it('普通闲聊不会向模型注入不相关工具', async () => {
    const providerInputs: ModelTurnInput[] = []
    const provider: ModelProvider = {
      id: 'fake',
      type: 'openai-compatible',
      streamTurn: async function* (input) {
        providerInputs.push(input)
        yield {
          type: 'text_delta',
          delta: '你好。'
        }
        yield {
          type: 'done'
        }
      }
    }
    const peopleTool: AgentTool = {
      name: 'people_list',
      description: '查询 People 表',
      prompt: {
        summary: '查询本地 People 表。',
        intentKeywords: ['人物', '关系'],
        whenToUse: ['用户询问人物关系时使用。']
      },
      parameters: {
        type: 'object',
        properties: {}
      },
      execute: async () => ({
        observation: '找到 0 位关联人物',
        data: []
      })
    }

    await Array.fromAsync(
      runReactAgent({
        provider,
        model: 'fake-model',
        messages: [
          {
            role: 'user',
            content: '你好'
          }
        ],
        tools: [peopleTool],
        maxTurns: 1
      })
    )

    expect(providerInputs[0].tools).toEqual([])
  })
})
