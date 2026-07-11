import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AgentTool, AgentToolResult } from '@/agent/types'
import { assertInsideProject } from './pathGuard'

const execFileAsync = promisify(execFile)

// 最大返回结果数。
const MAX_RESULTS = 100

/**
 * 使用 ripgrep 执行 glob 匹配。
 * rg --files --glob pattern cwd
 */
const globWithRipgrep = async (pattern: string, cwd: string): Promise<string[]> => {
  try {
    const { stdout } = await execFileAsync('rg', ['--files', '--glob', pattern, cwd], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Node.js fallback：递归遍历目录 + picomatch 风格的简单 glob 匹配。
 * 仅支持 ** / * 通配符，适用于 rg 不可用时。
 */
const globWithNode = async (pattern: string, cwd: string): Promise<string[]> => {
  const results: string[] = []

  // 简化 glob → 正则（支持 ** 和 *）
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{DOUBLE_STAR\}\}/g, '.*')
  const regex = new RegExp(`^${regexStr}$`)

  const walk = async (dir: string): Promise<void> => {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      // 跳过隐藏目录和 node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const fullPath = path.join(dir, entry.name)
      const relPath = path.relative(cwd, fullPath)

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (regex.test(relPath)) {
        results.push(fullPath)
      }
    }
  }

  await walk(cwd)
  return results
}

/**
 * 按修改时间排序文件列表（最新在前）。
 */
const sortByMtime = async (files: string[]): Promise<string[]> => {
  const withMtime = await Promise.all(
    files.map(async (f) => {
      try {
        const stat = await fs.promises.stat(f)
        return { path: f, mtime: stat.mtimeMs }
      } catch {
        return { path: f, mtime: 0 }
      }
    })
  )
  return withMtime
    .sort((a, b) => b.mtime - a.mtime)
    .map((f) => f.path)
}

/**
 * 创建 Prompt Design AI 专用的文件名模式匹配工具。
 * 优先使用 ripgrep，不可用时回退到 Node.js 递归遍历。
 */
export const createGlobTool = (projectRoot: string): AgentTool => ({
  name: 'prompt_glob',
  description: 'Search for files matching a glob pattern within the project. Returns file paths sorted by modification time. Useful for finding files by name or extension.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match files. Examples: "**/*.ts", "src/**/*.tsx", "*.json".'
      },
      path: {
        type: 'string',
        description: 'Subdirectory to search in. Defaults to project root.'
      }
    },
    required: ['pattern']
  },
  execute: async (input: unknown): Promise<AgentToolResult> => {
    const { pattern, path: searchPath } = input as {
      pattern: string
      path?: string
    }

    let cwd: string
    try {
      cwd = searchPath
        ? assertInsideProject(projectRoot, searchPath)
        : projectRoot
    } catch (err: any) {
      return {
        observation: `Error: Access denied or directory path invalid.\n- Requested Path: "${searchPath}"\n- Project Root: "${projectRoot}"\n\nSuggestion: Please check the path and make sure it is inside the project root.`,
        data: {
          error: 'ACCESS_DENIED_OR_INVALID',
          requestedPath: searchPath,
          projectRoot,
          suggestion: 'Ensure the subdirectory path is valid and inside project root.'
        }
      }
    }

    // Check if cwd exists and is directory
    try {
      const stat = await fs.promises.stat(cwd)
      if (!stat.isDirectory()) {
        return {
          observation: `Error: The specified path is not a directory.\n- Requested Path: "${searchPath}"\n- Resolved Path: "${cwd}"\n- Project Root: "${projectRoot}"`,
          data: {
            error: 'NOT_A_DIRECTORY',
            requestedPath: searchPath,
            resolvedPath: cwd,
            projectRoot
          }
        }
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return {
          observation: `Error: The specified directory does not exist.\n- Requested Path: "${searchPath}"\n- Resolved Path: "${cwd}"\n- Project Root: "${projectRoot}"`,
          data: {
            error: 'ENOENT',
            requestedPath: searchPath,
            resolvedPath: cwd,
            projectRoot
          }
        }
      }
      throw err
    }

    // 优先 ripgrep，fallback 到 Node.js
    let results = await globWithRipgrep(pattern, cwd)
    if (results.length === 0) {
      results = await globWithNode(pattern, cwd)
    }

    // 按修改时间排序 + 截断
    const sorted = (await sortByMtime(results)).slice(0, MAX_RESULTS)

    if (sorted.length === 0) {
      return {
        observation: `No files found matching pattern: ${pattern}`,
        data: { pattern, cwd, totalFound: 0 }
      }
    }

    const formatted = sorted.map((f) => path.relative(cwd, f)).join('\n')
    return {
      observation: `Found ${sorted.length} files matching "${pattern}":\n${formatted}`,
      data: { pattern, cwd, totalFound: sorted.length, truncated: results.length > MAX_RESULTS }
    }
  }
})
