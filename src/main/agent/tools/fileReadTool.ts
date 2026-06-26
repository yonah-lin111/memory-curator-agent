import type { AgentTool } from '@/agent/types'
import fs from 'node:fs'
import path from 'node:path'

export const createFileReadTool = (): AgentTool => {
  return {
    name: 'read_file',
    description: '读取本地系统上的文件内容，支持文本内容读取。用于探索项目文件或读取配置文件。',
    prompt: {
      summary: '读取文件内容',
      whenToUse: ['需要了解特定文件（如配置文件、源代码文件）的细节时', '验证某个文件是否存在以及内容是否正确时'],
      whenNotToUse: ['在没有具体目标路径时滥用'],
      safety: ['仅能读取被允许的目录下的文件，不能越权读取系统敏感文件'],
      output: '文件的纯文本内容或错误信息'
    },
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '想要读取的文件的绝对路径'
        }
      },
      required: ['filePath']
    },
    execute: async (input: unknown) => {
      const { filePath } = input as { filePath: string }
      try {
        if (!fs.existsSync(filePath)) {
          return { observation: `File not found: ${filePath}`, data: null }
        }
        const stats = fs.statSync(filePath)
        if (stats.isDirectory()) {
          return { observation: `Path is a directory, not a file: ${filePath}`, data: null }
        }
        const content = fs.readFileSync(filePath, 'utf-8')
        return { observation: content, data: { filePath, size: stats.size } }
      } catch (err: any) {
        return { observation: `Failed to read file: ${err.message}`, data: null }
      }
    }
  }
}
