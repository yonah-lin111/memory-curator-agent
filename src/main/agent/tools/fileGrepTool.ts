import type { AgentTool } from '@/agent/types'
import { execSync } from 'node:child_process'

export const createFileGrepTool = (): AgentTool => {
  return {
    name: 'grep_search',
    description: '在特定目录下使用正则表达式搜索文件内容，返回包含匹配字符串的文件及其上下文行。',
    prompt: {
      summary: '全局正则搜索代码',
      whenToUse: ['想要找出所有使用某个函数、变量、组件的地方时', '通过关键字搜索报错来源或具体定义时'],
      whenNotToUse: ['只搜索文件名时（此时应使用 glob_files）'],
      safety: ['防范正则回溯问题；限制输出长度，防止日志撑爆'],
      output: '匹配到的代码行片段及其所在文件与行号'
    },
    parameters: {
      type: 'object',
      properties: {
        regex: {
          type: 'string',
          description: '要搜索的正则表达式或关键字'
        },
        cwd: {
          type: 'string',
          description: '搜索根目录绝对路径'
        },
        filePattern: {
          type: 'string',
          description: '可选：限定搜索哪些文件（例如 *.ts）'
        }
      },
      required: ['regex', 'cwd']
    },
    execute: async (input: unknown) => {
      const { regex, cwd, filePattern } = input as { regex: string; cwd: string; filePattern?: string }
      try {
        // 使用 ripgrep (rg) 或者 fallback 到普通的 grep
        // 简单实现调用系统 grep（Mac/Linux）或通过 node 脚本遍历
        // 为了跨平台，这里使用 git grep 或系统 grep 模拟。建议实际项目使用专门库
        const includeArg = filePattern ? `--include="${filePattern}"` : ''
        const command = `grep -rnE ${includeArg} "${regex.replace(/"/g, '\\"')}" . | head -n 100`
        const output = execSync(command, { cwd, encoding: 'utf-8' })
        
        if (!output.trim()) {
          return { observation: 'No matches found.', data: null }
        }
        return { observation: output, data: null }
      } catch (err: any) {
        // grep exit code 1 means no match
        if (err.status === 1) {
            return { observation: 'No matches found.', data: null }
        }
        return { observation: `Grep execution failed: ${err.message}`, data: null }
      }
    }
  }
}
