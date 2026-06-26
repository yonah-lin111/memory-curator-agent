import type { AgentTool } from '@/agent/types'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'
import fs from 'node:fs'

export const createFileEditTool = (): AgentTool => {
  return {
    name: 'edit_file',
    description: '通过字符串替换的方式局部修改文件。如果新内容为空且原内容存在，则表现为删除原内容。',
    prompt: {
      summary: '修改文件局部内容',
      whenToUse: ['在已知文件结构的情况下，需要微调配置、修改部分函数逻辑时'],
      whenNotToUse: ['大幅度重构文件或替换文件大部分内容时（应直接覆写），目标字符串在文件中存在多次导致歧义时'],
      safety: ['需要确认目标字符串在文件中的唯一性，以防错误替换；修改前需用户确认'],
      output: '修改结果或错误提示'
    },
    confirmation: {
      message: (input: unknown) => {
        const { filePath } = input as { filePath: string }
        return `是否允许局部修改文件 ${filePath}？`
      }
    } as ToolConfirmationConfig,
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要修改的文件的绝对路径'
        },
        oldString: {
          type: 'string',
          description: '要被替换的原字符串内容（必须在文件内唯一）'
        },
        newString: {
          type: 'string',
          description: '替换后的新字符串内容'
        }
      },
      required: ['filePath', 'oldString', 'newString']
    },
    execute: async (input: unknown) => {
      const { filePath, oldString, newString } = input as { filePath: string; oldString: string; newString: string }
      try {
        if (!fs.existsSync(filePath)) {
          return { observation: `File not found: ${filePath}`, data: null }
        }
        let content = fs.readFileSync(filePath, 'utf-8')
        const occurrences = content.split(oldString).length - 1
        
        if (occurrences === 0) {
          return { observation: `Error: oldString not found in file`, data: null }
        }
        if (occurrences > 1) {
          return { observation: `Error: oldString appears multiple times in file. Please provide more context to make it unique.`, data: null }
        }

        content = content.replace(oldString, newString)
        fs.writeFileSync(filePath, content, 'utf-8')
        return { observation: `Successfully edited ${filePath}`, data: { filePath } }
      } catch (err: any) {
        return { observation: `Failed to edit file: ${err.message}`, data: null }
      }
    }
  }
}
