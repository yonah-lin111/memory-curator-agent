import { describe, expect, it } from 'vitest'
import { parseOpenAICompatibleSse } from '../../../src/main/agent/openaiCompatibleProvider'

describe('openaiCompatibleProvider', () => {
  it('解析 OpenAI compatible SSE 文本增量', async () => {
    const events = await Array.fromAsync(
      parseOpenAICompatibleSse([
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"，世界"}}]}\n\n',
        'data: [DONE]\n\n'
      ])
    )

    expect(events).toEqual([
      {
        type: 'text_delta',
        delta: '你好'
      },
      {
        type: 'text_delta',
        delta: '，世界'
      },
      {
        type: 'done'
      }
    ])
  })

  it('组装流式工具调用参数', async () => {
    const events = await Array.fromAsync(
      parseOpenAICompatibleSse([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"people_list","arguments":"{\\"query\\""}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"阿明\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"finish_reason":"tool_calls","delta":{}}]}\n\n',
        'data: [DONE]\n\n'
      ])
    )

    expect(events).toEqual([
      {
        type: 'tool_call_done',
        id: 'call-1',
        name: 'people_list',
        argumentsText: '{"query":"阿明"}'
      },
      {
        type: 'done'
      }
    ])
  })

})
