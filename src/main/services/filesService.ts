import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getMarkdownImageDir } from '../paths'

// Markdown 图片保存输入。
export type MarkdownImageSaveInput = {
  // 原始文件名。
  name: string
  // 图片 MIME 类型。
  mimeType: string
  // 图片二进制内容。
  bytes: ArrayBuffer
}

// Markdown 图片保存结果。
export type MarkdownImageSaveResult = {
  // 落盘文件名。
  fileName: string
  // 本机绝对路径。
  filePath: string
  // 可写入 Markdown 的文件 URL。
  url: string
}

// 文件服务依赖。
type FilesServiceDeps = {
  // Markdown 图片目录。
  markdownImageDir?: string
}

// 文件服务实例。
type FilesService = {
  // 保存 Markdown 图片。
  saveMarkdownImage: (input: MarkdownImageSaveInput) => Promise<MarkdownImageSaveResult>
}

// MIME 类型到扩展名的映射。
const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/bmp': '.bmp',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

/**
 * 解析安全扩展名。
 */
const resolveImageExtension = (name: string, mimeType: string): string => {
  const mimeExtension = IMAGE_EXTENSION_BY_MIME[mimeType]

  if (mimeExtension) {
    return mimeExtension
  }

  const fileExtension = extname(name).toLowerCase()

  if (Object.values(IMAGE_EXTENSION_BY_MIME).includes(fileExtension)) {
    return fileExtension
  }

  return '.png'
}

/**
 * 生成安全文件名前缀。
 */
const createSafeFileStem = (name: string): string => {
  const rawStem = basename(name, extname(name)).trim().toLowerCase()
  const safeStem = rawStem.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

  return safeStem || 'image'
}

/**
 * 创建文件服务。
 */
export const createFilesService = (deps: FilesServiceDeps = {}): FilesService => {
  const markdownImageDir = deps.markdownImageDir ?? getMarkdownImageDir()

  return {
    saveMarkdownImage: async (input) => {
      if (!input.mimeType.startsWith('image/')) {
        throw new Error('仅支持保存图片文件')
      }

      const extension = resolveImageExtension(input.name, input.mimeType)
      const fileName = `${createSafeFileStem(input.name)}-${randomUUID()}${extension}`
      const filePath = join(markdownImageDir, fileName)

      await mkdir(markdownImageDir, { recursive: true })
      await writeFile(filePath, Buffer.from(new Uint8Array(input.bytes)))

      return {
        fileName,
        filePath,
        url: pathToFileURL(filePath).href
      }
    }
  }
}
