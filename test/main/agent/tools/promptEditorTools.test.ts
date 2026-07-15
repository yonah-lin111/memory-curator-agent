import { describe, expect, it } from 'vitest'
import { createPromptEditorTools } from '@/agent/tools/promptEditorTools'

describe('promptEditorTools', () => {
  it('连续 replace_lines 基于上一次结果返回累计正文', async () => {
    const tools = createPromptEditorTools('line1\nline2\nline3')
    const replaceLines = tools.find((tool) => tool.name === 'prompt_editor_replace_lines')!

    const first = await replaceLines.execute({ startLine: 1, content: 'updated1' })
    const second = await replaceLines.execute({ startLine: 2, content: 'updated2' })

    expect(first.data).toEqual({ content: 'updated1\nline2\nline3', operation: 'replace_lines' })
    expect(second.data).toEqual({ content: 'updated1\nupdated2\nline3', operation: 'replace_lines' })
  })

  it('不同编辑工具共享累计正文', async () => {
    const tools = createPromptEditorTools('line1\nline2\nline3')
    const replace = tools.find((tool) => tool.name === 'prompt_editor_replace')!
    const deleteLines = tools.find((tool) => tool.name === 'prompt_editor_delete_lines')!

    await replace.execute({ content: 'new1\nnew2\nnew3' })
    const result = await deleteLines.execute({ startLine: 2 })

    expect(result.data).toEqual({ content: 'new1\nnew3', operation: 'delete_lines' })
  })
})
