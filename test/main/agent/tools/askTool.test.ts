import { describe, expect, it } from 'vitest'
import { createAskTool } from '../../../../src/main/agent/tools/askTool'

// 无连接符 UUID 形态。
const UUID_PATTERN = /^[\da-f]{32}$/i

// Ask 工具数据类型。
type AskToolData = {
  // 工具数据类型。
  kind: 'ask_request'
  // Ask 请求唯一标识。
  id: string
}

describe('askTool', () => {
  it('创建结构化 ask_request', async () => {
    const tool = createAskTool()

    const result = await tool.execute({
      questions: [
        {
          header: '范围',
          question: '应该改哪个范围？',
          options: [
            {
              label: '当前项目',
              description: '只修改当前工作区。'
            },
            {
              label: '参考项目',
              description: '按参考项目实现。'
            }
          ],
          custom: true
        }
      ]
    })

    expect(result.observation).toContain('waiting for the user')
    const data = result.data as AskToolData

    expect(data).toMatchObject({
      kind: 'ask_request',
      questions: [
        {
          header: '范围',
          question: '应该改哪个范围？',
          options: [
            {
              label: '当前项目',
              description: '只修改当前工作区。'
            },
            {
              label: '参考项目',
              description: '按参考项目实现。'
            }
          ],
          multiple: false,
          custom: true
        }
      ]
    })
    expect(data.id).toMatch(UUID_PATTERN)
  })

  it('拒绝缺失问题列表的入参', async () => {
    const tool = createAskTool()

    await expect(tool.execute({})).rejects.toThrow('Ask input must include at least one question')
  })
})
