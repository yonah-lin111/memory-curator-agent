import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import readline from 'node:readline'
import type { AgentTool, AgentToolResult } from '@/agent/types'
import { assertInsideProject } from './pathGuard'

const execFileAsync = promisify(execFile)

// 最大返回结果数。
const MAX_RESULTS = 100
// 单行最大字符数。
const MAX_LINE_CHARS = 2000

/**
 * 使用 ripgrep 执行内容搜索。
 * rg --json --line-number pattern cwd
 */
const grepWithRipgrep = async (
  pattern: string,
  cwd: string,
  include?: string,
): Promise<Array<{ file: string; line: number; text: string }>> => {
  const args = ['--json', '--line-number']

  if (include) {
    args.push('--glob', include)
  }

  args.push(pattern, cwd)

  try {
    const { stdout } = await execFileAsync('rg', args, {
      timeout: 10_000,
      maxBuffer: 5 * 1024 * 1024,
    })

    const results: Array<{ file: string; line: number; text: string }> = []

    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue

      try {
        const parsed = JSON.parse(line)
        if (parsed.type === 'match') {
          results.push({
            file: parsed.data.path.text,
            line: parsed.data.line_number,
            text: parsed.data.lines.text.trimEnd(),
          })
        }
      } catch {
        // 跳过解析失败的行
      }

      if (results.length >= MAX_RESULTS) break
    }

    return results
  } catch {
    return []
  }
}

/**
 * Node.js fallback：读取文件内容并用正则搜索。
 */
const grepWithNode = async (
  pattern: string,
  cwd: string,
  include?: string,
): Promise<Array<{ file: string; line: number; text: string }>> => {
  const results: Array<{ file: string; line: number; text: string }> = []
  const regex = new RegExp(pattern, 'gi')

  // include 支持简单 glob 后缀匹配
  const includeExt = include?.replace(/^\*\./, '')

  const walk = async (dir: string): Promise<void> => {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (results.length >= MAX_RESULTS) return

      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (includeExt && !entry.name.endsWith(`.${includeExt}`)) continue

      // 跳过可能的二进制文件
      const ext = path.extname(entry.name).toLowerCase()
      if (['.png', '.jpg', '.gif', '.zip', '.exe', '.pdf', '.woff2'].includes(ext)) continue

      try {
        const content = await fs.promises.readFile(fullPath, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= MAX_RESULTS) return
          if (regex.test(lines[i])) {
            results.push({ file: fullPath, line: i + 1, text: lines[i].trimEnd() })
          }
          // 重置 lastIndex（g 标志）
          regex.lastIndex = 0
        }
      } catch {
        // 跳过不可读文件
      }
    }
  }

  await walk(cwd)
  return results
}

/**
 * 创建 Prompt Design AI 专用的内容搜索工具。
 * 优先使用 ripgrep，不可用时回退到 Node.js。
 */
export const createGrepTool = (projectRoot: string): AgentTool => ({
  name: 'prompt_grep',
  description: 'Search file contents using a regex pattern within the project. Returns matching lines grouped by file. Useful for finding code references, function usages, or text patterns.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regular expression pattern to search for.'
      },
      path: {
        type: 'string',
        description: 'Subdirectory to search in. Defaults to project root.'
      },
      include: {
        type: 'string',
        description: 'File filter pattern (e.g. "*.ts", "*.tsx"). Searches all files if omitted.'
      }
    },
    required: ['pattern']
  },
  execute: async (input: unknown): Promise<AgentToolResult> => {
    const { pattern, path: searchPath, include } = input as {
      pattern: string
      path?: string
      include?: string
    }

    const cwd = searchPath
      ? assertInsideProject(projectRoot, searchPath)
      : projectRoot

    // 优先 ripgrep，fallback 到 Node.js
    let results = await grepWithRipgrep(pattern, cwd, include)
    if (results.length === 0) {
      results = await grepWithNode(pattern, cwd, include)
    }

    if (results.length === 0) {
      return {
        observation: `No matches found for pattern: ${pattern}`,
        data: { pattern, cwd, totalFound: 0 }
      }
    }

    // 按文件分组并格式化
    const grouped = new Map<string, Array<{ line: number; text: string }>>()
    for (const r of results) {
      const relFile = path.relative(cwd, r.file)
      const arr = grouped.get(relFile) || []
      arr.push({ line: r.line, text: r.text.length > MAX_LINE_CHARS ? r.text.slice(0, MAX_LINE_CHARS) + '...' : r.text })
      grouped.set(relFile, arr)
    }

    const formatted: string[] = []
    for (const [file, matches] of grouped) {
      formatted.push(`${file}:`)
      for (const m of matches) {
        formatted.push(`  Line ${m.line}: ${m.text}`)
      }
    }

    return {
      observation: `Found ${results.length} matches for "${pattern}":\n${formatted.join('\n')}`,
      data: { pattern, cwd, totalFound: results.length, files: grouped.size, truncated: results.length >= MAX_RESULTS }
    }
  }
})
