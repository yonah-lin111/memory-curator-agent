import type { AgentTool } from '@/agent/types'
import { globSync } from 'glob'

export const createFileGlobTool = (): AgentTool => {
  return {
    name: 'glob_files',
    description: '使用 glob 模式搜索匹配的文件路径，用于探查目录结构或寻找具有特定扩展名/命名模式的文件。',
    prompt: {
      summary: '模式匹配搜索文件',
      whenToUse: ['需要寻找某个目录下的所有特定后缀文件（如 src/**/*.ts）时', '不确定具体路径，需要根据命名模式查找时'],
      whenNotToUse: ['已知具体文件路径时'],
      safety: ['限制搜索范围和最大返回数量，避免过高消耗'],
      output: '匹配到的绝对路径列表'
    },
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'glob 匹配模式，例如 src/**/*.ts'
        },
        cwd: {
          type: 'string',
          description: '作为搜索起点的目录的绝对路径'
        }
      },
      required: ['pattern', 'cwd']
    },
    execute: async (input: unknown) => {
      const { pattern, cwd } = input as { pattern: string; cwd: string }
      try {
        const files = globSync(pattern, { cwd, absolute: true, nodir: true })
        if (files.length === 0) {
          return { observation: 'No files matched the given pattern.', data: { files: [] } }
        }
        return { 
          observation: `Found ${files.length} matching files:\n${files.slice(0, 50).join('\n')}${files.length > 50 ? '\n... (truncated)' : ''}`, 
          data: { files } 
        }
      } catch (err: any) {
        return { observation: `Failed to execute glob: ${err.message}`, data: null }
      }
    }
  }
}
