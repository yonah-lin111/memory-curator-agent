import { describe, expect, it } from 'vitest'
import {
  createExplainTool,
  isExplainToolData
} from '../../../../src/main/agent/tools/commonExplainTool'

describe('commonExplainTool', () => {
  it('创建 common_tool.explain 工具并声明写入前说明触发时机', () => {
    const tool = createExplainTool()

    expect(tool.name).toBe('common_tool.explain')
    expect(tool.description).toContain('Explain the pending write operation')
    expect(tool.prompt?.alwaysAvailable).toBe(true)
    expect(tool.prompt?.whenToUse.join('\n')).toContain('before people_tool.add')
    expect(tool.prompt?.whenToUse.join('\n')).toContain('before people_tool.update')
    expect(tool.prompt?.whenToUse.join('\n')).toContain('before people_tool.delete')
    expect(tool.parameters.required).toEqual(['targetTool', 'action', 'content'])
    expect(tool.parameters.properties?.targetTool.enum).toEqual([
      'people_tool.add',
      'people_tool.update',
      'people_tool.delete'
    ])
  })

  it('返回简洁 Markdown 说明并保留结构化数据', async () => {
    const tool = createExplainTool()

    const result = await tool.execute({
      targetTool: 'people_tool.delete',
      action: 'delete',
      content: '将删除人物资料：**阿明**（朋友）。'
    })

    expect(result.observation).toBe('将删除人物资料：**阿明**（朋友）。')
    expect(result.data).toEqual({
      kind: 'explain',
      targetTool: 'people_tool.delete',
      action: 'delete',
      content: '将删除人物资料：**阿明**（朋友）。'
    })
    expect(isExplainToolData(result.data)).toBe(true)
  })

  it('拒绝空说明内容', async () => {
    const tool = createExplainTool()

    await expect(
      tool.execute({
        targetTool: 'people_tool.add',
        action: 'add',
        content: '   '
      })
    ).rejects.toThrow('Explain content cannot be empty')
  })

  it('裁剪过长说明，避免工具输出变成长篇推理', async () => {
    const tool = createExplainTool()
    const longContent = '说明'.repeat(600)

    const result = await tool.execute({
      targetTool: 'people_tool.update',
      action: 'update',
      content: longContent
    })

    expect(result.observation.length).toBeLessThanOrEqual(800)
    expect((result.data as { content: string }).content.length).toBeLessThanOrEqual(800)
  })
})
