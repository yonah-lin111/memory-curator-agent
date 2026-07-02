import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import type { AgentTool, AgentToolResult } from '@/agent/types'
import { assertInsideProject } from './pathGuard'

// 默认最大读取行数。
const DEFAULT_LIMIT = 2000
// 单行最大字符数。
const MAX_LINE_CHARS = 2000
// 输出总大小上限（字节）。
const MAX_OUTPUT_BYTES = 50_000
// 不可打印字符占比阈值（超过视为二进制）。
const NON_PRINTABLE_THRESHOLD = 0.3

// 二进制文件扩展名黑名单。
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pyc', '.pyo', '.class', '.o', '.obj',
])

/**
 * 检测文件是否为二进制类型。
 * 通过扩展名黑名单 + 空字节检测 + 不可打印字符比例判定。
 */
const isBinaryFile = async (filePath: string): Promise<boolean> => {
  const ext = path.extname(filePath).toLowerCase()
  if (BINARY_EXTENSIONS.has(ext)) return true

  try {
    const fd = await fs.promises.open(filePath, 'r')
    const buffer = Buffer.alloc(4096)
    const { bytesRead } = await fd.read(buffer, 0, 4096, 0)
    await fd.close()

    if (bytesRead === 0) return false

    const chunk = buffer.subarray(0, bytesRead)

    // 空字节检测
    if (chunk.includes(0)) return true

    // 不可打印字符比例检测
    let nonPrintable = 0
    for (const byte of chunk) {
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        nonPrintable += 1
      }
    }
    return nonPrintable / bytesRead > NON_PRINTABLE_THRESHOLD
  } catch {
    return false
  }
}

/**
 * 读取目录内容，返回排序后的条目列表。
 * 目录条目追加 / 后缀。
 */
const readDirectory = async (dirPath: string): Promise<string> => {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  const names = entries
    .map((e) => e.name + (e.isDirectory() ? '/' : ''))
    .sort()

  return names.join('\n')
}

/**
 * 逐行流式读取文件内容，带行号前缀。
 * 支持 offset/limit 分页和输出大小截断。
 */
const readFileContent = async (
  filePath: string,
  offset: number,
  limit: number,
): Promise<string> => {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  const lines: string[] = []
  let lineNo = 0
  let totalBytes = 0
  let truncated = false

  for await (const rawLine of rl) {
    lineNo += 1

    // 跳过 offset 之前的行
    if (lineNo < offset) continue
    // 超过 limit 停止读取
    if (lineNo >= offset + limit) {
      truncated = true
      break
    }

    // 单行截断
    const line = rawLine.length > MAX_LINE_CHARS
      ? rawLine.slice(0, MAX_LINE_CHARS) + '... (truncated)'
      : rawLine

    const formatted = `${lineNo}\t${line}`

    // 总输出大小检查
    totalBytes += Buffer.byteLength(formatted, 'utf-8') + 1
    if (totalBytes > MAX_OUTPUT_BYTES) {
      truncated = true
      break
    }

    lines.push(formatted)
  }

  if (truncated) {
    lines.push(`... (truncated at line ${lineNo}, use offset/limit to read more)`)
  }

  return lines.join('\n')
}

/**
 * 创建 Prompt Design AI 专用的文件/目录读取工具。
 * 限定在 projectRoot 目录内访问。
 */
export const createReadTool = (projectRoot: string): AgentTool => ({
  name: 'prompt_file_read',
  description: 'Read files or list directory contents within the project. Supports offset/limit for large files. Returns file content with line numbers.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute or relative path to the file or directory to read.'
      },
      offset: {
        type: 'number',
        description: 'Starting line number (1-indexed). Default: 1.'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read. Default: 2000.'
      }
    },
    required: ['filePath']
  },
  execute: async (input: unknown): Promise<AgentToolResult> => {
    const { filePath, offset = 1, limit = DEFAULT_LIMIT } = input as {
      filePath: string
      offset?: number
      limit?: number
    }

    const resolved = assertInsideProject(projectRoot, filePath)
    const stat = await fs.promises.stat(resolved)

    // 二进制文件拒绝读取
    if (stat.isFile() && await isBinaryFile(resolved)) {
      return {
        observation: `Binary file detected: ${filePath}. Content not displayed.`,
        data: { type: 'binary', path: resolved }
      }
    }

    // 目录读取
    if (stat.isDirectory()) {
      const content = await readDirectory(resolved)
      return {
        observation: `<path>${resolved}</path>\n<type>directory</type>\n<content>\n${content}\n</content>`,
        data: { type: 'directory', path: resolved, entries: content.split('\n').length }
      }
    }

    // 文件读取
    const content = await readFileContent(resolved, offset, limit)
    return {
      observation: `<path>${resolved}</path>\n<type>file</type>\n<content>\n${content}\n</content>`,
      data: { type: 'file', path: resolved }
    }
  }
})
