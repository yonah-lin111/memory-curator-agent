import type { AgentTool } from '@/agent/types'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'
import fs from 'node:fs'
import path from 'node:path'

export const createFileWriteTool = (): AgentTool => {
  return {
    name: 'write_file',
    description: '在本地文件系统中新建或覆写文件。操作具有破坏性，执行前通常需要用户确认。',
    prompt: {
      summary: '创建或覆写文件',
      whenToUse: ['需要生成新的代码文件、配置文件或写入全新内容时'],
      whenNotToUse: ['只需局部修改文件时（此时应使用 edit_file）'],
      safety: ['需要通过界面提示用户确认写入操作，避免静默破坏代码库'],
      output: '操作成功消息或失败原因'
    },
    confirmation: {
      message: (input: unknown) => {
        const { filePath } = input as { filePath: string }
        return `是否允许向文件 ${filePath} 写入内容？（原文件内容将被完全覆盖）`
      }
    } as ToolConfirmationConfig,
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要写入的目标文件的绝对路径'
        },
        content: {
          type: 'string',
          description: '要写入的完整文件内容'
        }
      },
      required: ['filePath', 'content']
    },
    execute: async (input: unknown) => {
      const { filePath, content } = input as { filePath: string; content: string }
      try {
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(filePath, content, 'utf-8')
        return { observation: `Successfully wrote to ${filePath}`, data: { filePath } }
      } catch (err: any) {
        return { observation: `Failed to write file: ${err.message}`, data: null }
      }
    }
  }
}
