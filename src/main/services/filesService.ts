import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { createCompactUuid } from '@/id'
import { getAiChatImageDir, getAiChatImageTrashDir, getAiChatTextDir, getAiChatTextTrashDir, getMarkdownImageDir, getMarkdownImageTrashDir, getPeopleAvatarDir, getAppDataRoot } from '@/paths'
import { createAiChatImageUrl, createAiChatTextFileUrl, createMarkdownImageUrl, createPeopleAvatarUrl, resolveAiChatTextFileName } from '@/protocols/localImages'

// 数据库语句接口。
export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// 文件服务依赖的最小数据库接口。
export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
}

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
  // 可写入 Markdown 的应用图片 URL。
  url: string
}

// AI 聊天文本文件保存结果。
export type AiChatTextFileSaveResult = {
  // 落盘文件名。
  fileName: string
  // 本机绝对路径。
  filePath: string
  // 可访问文本文件的应用 URL。
  url: string
  // 原始文件名。
  originalName: string
  // 文件大小（字节）。
  sizeBytes: number
}

// Markdown 图片条目。
export type MarkdownImageItem = {
  // 文件名。
  fileName: string
  // 本机绝对路径。
  filePath: string
  // 可写入 Markdown 的应用图片 URL。
  url: string
  // 文件大小。
  sizeBytes: number
  // 修改时间戳。
  updatedAt: string
}

// Markdown 图片清理结果。
export type MarkdownImageCleanupResult = {
  // 删除数量。
  deletedCount: number
  // 已删除图片列表。
  deletedImages: MarkdownImageItem[]
}

// Markdown 图片清理选项。
export type MarkdownImageCleanupOptions = {
  // 距离最后修改时间的最小闲置时长。
  minUnusedAgeMs?: number
}

// Markdown 图片恢复结果。
export type MarkdownImageRestoreResult = {
  // 恢复数量。
  restoredCount: number
  // 已恢复图片列表。
  restoredImages: MarkdownImageItem[]
}

// 文件服务依赖。
type FilesServiceDeps = {
  // SQLite 数据库连接。
  database?: DatabaseConnection
  // Markdown 图片目录。
  markdownImageDir?: string
  // Markdown 图片回收目录。
  markdownImageTrashDir?: string
  // AI 聊天图片目录。
  aiChatImageDir?: string
  // AI 聊天图片回收目录。
  aiChatImageTrashDir?: string
  // 垃圾桶根目录。
  trashRootDir?: string
}

// 文件服务实例。
export type FilesService = {
  // 保存 Markdown 图片。
  saveMarkdownImage: (input: MarkdownImageSaveInput) => Promise<MarkdownImageSaveResult>
  // 保存人物头像。
  savePeopleAvatar: (input: MarkdownImageSaveInput) => Promise<MarkdownImageSaveResult>
  // 保存 AI 聊天图片。
  saveAiChatImage: (input: MarkdownImageSaveInput) => Promise<MarkdownImageSaveResult>
  // 列出未被 Markdown 引用的图片。
  listUnusedMarkdownImages: () => Promise<MarkdownImageItem[]>
  // 恢复已进入回收目录但仍被 Markdown 引用的图片。
  restoreReferencedMarkdownImages: () => Promise<MarkdownImageRestoreResult>
  // 删除未被 Markdown 引用的图片。
  deleteUnusedMarkdownImages: (options?: MarkdownImageCleanupOptions) => Promise<MarkdownImageCleanupResult>
  // 列出未被 AI 聊天引用的图片。
  listUnusedAiChatImages: () => Promise<MarkdownImageItem[]>
  // 恢复已进入回收目录但仍被 AI 聊天引用的图片。
  restoreReferencedAiChatImages: () => Promise<MarkdownImageRestoreResult>
  // 删除未被 AI 聊天引用的图片。
  deleteUnusedAiChatImages: (options?: MarkdownImageCleanupOptions) => Promise<MarkdownImageCleanupResult>
  // 保存 AI 聊天文本文件。
  saveAiChatTextFile: (input: MarkdownImageSaveInput) => Promise<AiChatTextFileSaveResult>
  // 删除 AI 聊天文本文件（移到回收站）。
  deleteAiChatTextFile: (fileName: string) => Promise<void>
  // 读取 AI 聊天文本文件内容。
  readAiChatTextFile: (url: string) => Promise<string>
  // 物理清理回收站中超过指定保留时间的过期文件。
  cleanExpiredTrash: (retentionMs?: number) => Promise<void>
}

// MIME 类型到扩展名的映射。
const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/bmp': '.bmp',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

// 支持清理的图片扩展名集合。
const SUPPORTED_IMAGE_EXTENSIONS = new Set(Object.values(IMAGE_EXTENSION_BY_MIME))

// Markdown 图片引用正则。
const MARKDOWN_IMAGE_URL_PATTERN = /(?:mc-img:\/\/md\/|file:\/\/[^\s"'()]*\/img\/md\/)([^)\s"'#?]+)/g

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
 * 读取全部 Markdown 正文。
 */
const listMarkdownContents = (database?: DatabaseConnection): string[] => {
  if (!database) {
    return []
  }

  const rows = database
    .prepare(
      `
      SELECT content FROM notes
      UNION ALL
      SELECT content FROM journals
      UNION ALL
      SELECT content FROM snippets
      `
    )
    .all() as Array<{ content?: unknown }>

  return rows
    .map((row) => row.content)
    .filter((content): content is string => typeof content === 'string')
}

/**
 * 提取 Markdown 正文引用的图片文件名。
 */
const extractReferencedImageNames = (contents: string[]): Set<string> => {
  const referencedNames = new Set<string>()

  contents.forEach((content) => {
    for (const match of content.matchAll(MARKDOWN_IMAGE_URL_PATTERN)) {
      const fileName = basename(decodeURIComponent(match[1] ?? ''))

      if (fileName) {
        referencedNames.add(fileName)
      }
    }
  })

  return referencedNames
}

// AI 聊天图片引用正则。
const AI_CHAT_IMAGE_URL_PATTERN = /(?:mc-img:\/\/chat\/|file:\/\/[^\s"'()]*\/img\/chat\/)([^)\s"'#?]+)/g

/**
 * 读取全部 AI 聊天正文。
 */
const listAiChatContents = (database?: DatabaseConnection): string[] => {
  if (!database) {
    return []
  }

  const rows = database
    .prepare(
      `
      SELECT content FROM ai_chat_messages
      UNION ALL
      SELECT parts_json AS content FROM ai_chat_messages
      `
    )
    .all() as Array<{ content?: unknown }>

  return rows
    .map((row) => row.content)
    .filter((content): content is string => typeof content === 'string')
}

/**
 * 提取 AI 聊天正文引用的图片文件名。
 */
const extractReferencedAiChatImageNames = (contents: string[]): Set<string> => {
  const referencedNames = new Set<string>()

  contents.forEach((content) => {
    for (const match of content.matchAll(AI_CHAT_IMAGE_URL_PATTERN)) {
      const fileName = basename(decodeURIComponent(match[1] ?? ''))

      if (fileName) {
        referencedNames.add(fileName)
      }
    }
  })

  return referencedNames
}

/**
 * 列出目录内的 Markdown 图片。
 */
const listMarkdownImageFiles = async (markdownImageDir: string): Promise<MarkdownImageItem[]> => {
  try {
    const names = await readdir(markdownImageDir)
    const images = await Promise.all(
      names.map(async (fileName) => {
        if (!SUPPORTED_IMAGE_EXTENSIONS.has(extname(fileName).toLowerCase())) {
          return null
        }

        const filePath = join(markdownImageDir, fileName)
        const fileStat = await stat(filePath)

        if (!fileStat.isFile()) {
          return null
        }

        return {
          fileName,
          filePath,
          url: createMarkdownImageUrl(fileName),
          sizeBytes: fileStat.size,
          updatedAt: fileStat.mtime.toISOString()
        }
      })
    )

    return images
      .filter((image): image is MarkdownImageItem => Boolean(image))
      .sort((left, right) => left.fileName.localeCompare(right.fileName))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

/**
 * 创建不覆盖既有文件的回收路径。
 */
const createTrashTargetPath = async (trashDir: string, fileName: string): Promise<string> => {
  const initialPath = join(trashDir, fileName)

  try {
    await access(initialPath)
  } catch {
    return initialPath
  }

  const extension = extname(fileName)
  const stem = basename(fileName, extension)

  return join(trashDir, `${stem}-${createCompactUuid()}${extension}`)
}

/**
 * 判断文件是否存在。
 */
const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 读取指定 Markdown 图片文件条目。
 */
const getMarkdownImageItem = async (markdownImageDir: string, fileName: string): Promise<MarkdownImageItem> => {
  const filePath = join(markdownImageDir, fileName)
  const fileStat = await stat(filePath)

  return {
    fileName,
    filePath,
    url: createMarkdownImageUrl(fileName),
    sizeBytes: fileStat.size,
    updatedAt: fileStat.mtime.toISOString()
  }
}

/**
 * 创建文件服务。
 */
export const createFilesService = (deps: FilesServiceDeps = {}): FilesService => {
  const markdownImageDir = deps.markdownImageDir ?? getMarkdownImageDir()
  const markdownImageTrashDir = deps.markdownImageTrashDir ?? getMarkdownImageTrashDir()
  const peopleAvatarDir = getPeopleAvatarDir()
  const aiChatImageDir = deps.aiChatImageDir ?? getAiChatImageDir()
  const aiChatImageTrashDir = deps.aiChatImageTrashDir ?? getAiChatImageTrashDir()
  const aiChatTextDir = getAiChatTextDir()
  const aiChatTextTrashDir = getAiChatTextTrashDir()
  const trashRootDir = deps.trashRootDir ?? join(getAppDataRoot(), 'trash')

  return {
    saveMarkdownImage: async (input) => {
      if (!input.mimeType.startsWith('image/')) {
        throw new Error('仅支持保存图片文件')
      }

      const extension = resolveImageExtension(input.name, input.mimeType)
      const fileName = `${createSafeFileStem(input.name)}-${createCompactUuid()}${extension}`
      const filePath = join(markdownImageDir, fileName)

      await mkdir(markdownImageDir, { recursive: true })
      await writeFile(filePath, Buffer.from(new Uint8Array(input.bytes)))

      return {
        fileName,
        filePath,
        url: createMarkdownImageUrl(fileName)
      }
    },
    savePeopleAvatar: async (input) => {
      if (!input.mimeType.startsWith('image/')) {
        throw new Error('仅支持保存图片文件')
      }

      const extension = resolveImageExtension(input.name, input.mimeType)
      const fileName = `${createSafeFileStem(input.name)}-${createCompactUuid()}${extension}`
      const filePath = join(peopleAvatarDir, fileName)

      await mkdir(peopleAvatarDir, { recursive: true })
      await writeFile(filePath, Buffer.from(new Uint8Array(input.bytes)))

      return {
        fileName,
        filePath,
        url: createPeopleAvatarUrl(fileName)
      }
    },
    saveAiChatImage: async (input) => {
      if (!input.mimeType.startsWith('image/')) {
        throw new Error('仅支持保存图片文件')
      }

      const extension = resolveImageExtension(input.name, input.mimeType)
      const fileName = `${createSafeFileStem(input.name)}-${createCompactUuid()}${extension}`
      const filePath = join(aiChatImageDir, fileName)

      await mkdir(aiChatImageDir, { recursive: true })
      await writeFile(filePath, Buffer.from(new Uint8Array(input.bytes)))

      return {
        fileName,
        filePath,
        url: createAiChatImageUrl(fileName)
      }
    },
    listUnusedMarkdownImages: async () => {
      const referencedNames = extractReferencedImageNames(listMarkdownContents(deps.database))
      const images = await listMarkdownImageFiles(markdownImageDir)

      return images.filter((image) => !referencedNames.has(image.fileName))
    },
    restoreReferencedMarkdownImages: async () => {
      const referencedNames = extractReferencedImageNames(listMarkdownContents(deps.database))
      const restoredImages: MarkdownImageItem[] = []

      await mkdir(markdownImageDir, { recursive: true })
      await Promise.all(
        [...referencedNames].map(async (fileName) => {
          const livePath = join(markdownImageDir, fileName)

          if (await pathExists(livePath)) {
            return
          }

          const trashPath = join(markdownImageTrashDir, fileName)

          if (!(await pathExists(trashPath))) {
            return
          }

          await rename(trashPath, livePath)
          restoredImages.push(await getMarkdownImageItem(markdownImageDir, fileName))
        })
      )

      return {
        restoredCount: restoredImages.length,
        restoredImages: restoredImages.sort((left, right) => left.fileName.localeCompare(right.fileName))
      }
    },
    deleteUnusedMarkdownImages: async (options = {}) => {
      const unusedImages = await (async () => {
        const referencedNames = extractReferencedImageNames(listMarkdownContents(deps.database))
        const images = await listMarkdownImageFiles(markdownImageDir)
        const now = Date.now()

        return images.filter((image) => {
          if (referencedNames.has(image.fileName)) {
            return false
          }

          const minUnusedAgeMs = options.minUnusedAgeMs ?? 0

          if (minUnusedAgeMs <= 0) {
            return true
          }

          return now - new Date(image.updatedAt).getTime() >= minUnusedAgeMs
        })
      })()

      await mkdir(markdownImageTrashDir, { recursive: true })
      await Promise.all(
        unusedImages.map(async (image) => {
          const targetPath = await createTrashTargetPath(markdownImageTrashDir, image.fileName)

          await rename(image.filePath, targetPath)
        })
      )

      return {
        deletedCount: unusedImages.length,
        deletedImages: unusedImages
      }
    },
    listUnusedAiChatImages: async () => {
      const referencedNames = extractReferencedAiChatImageNames(listAiChatContents(deps.database))
      const images = await listMarkdownImageFiles(aiChatImageDir)

      return images.filter((image) => !referencedNames.has(image.fileName))
    },
    restoreReferencedAiChatImages: async () => {
      const referencedNames = extractReferencedAiChatImageNames(listAiChatContents(deps.database))
      const restoredImages: MarkdownImageItem[] = []

      await mkdir(aiChatImageDir, { recursive: true })
      await Promise.all(
        [...referencedNames].map(async (fileName) => {
          const livePath = join(aiChatImageDir, fileName)

          if (await pathExists(livePath)) {
            return
          }

          const trashPath = join(aiChatImageTrashDir, fileName)

          if (!(await pathExists(trashPath))) {
            return
          }

          await rename(trashPath, livePath)
          restoredImages.push(await getMarkdownImageItem(aiChatImageDir, fileName))
        })
      )

      return {
        restoredCount: restoredImages.length,
        restoredImages: restoredImages.sort((left, right) => left.fileName.localeCompare(right.fileName))
      }
    },
    deleteUnusedAiChatImages: async (options = {}) => {
      const unusedImages = await (async () => {
        const referencedNames = extractReferencedAiChatImageNames(listAiChatContents(deps.database))
        const images = await listMarkdownImageFiles(aiChatImageDir)
        const now = Date.now()

        return images.filter((image) => {
          if (referencedNames.has(image.fileName)) {
            return false
          }

          const minUnusedAgeMs = options.minUnusedAgeMs ?? 0

          if (minUnusedAgeMs <= 0) {
            return true
          }

          return now - new Date(image.updatedAt).getTime() >= minUnusedAgeMs
        })
      })()

      await mkdir(aiChatImageTrashDir, { recursive: true })
      await Promise.all(
        unusedImages.map(async (image) => {
          const targetPath = await createTrashTargetPath(aiChatImageTrashDir, image.fileName)

          await rename(image.filePath, targetPath)
        })
      )

      return {
        deletedCount: unusedImages.length,
        deletedImages: unusedImages
      }
    },
    saveAiChatTextFile: async (input) => {
      const extension = extname(input.name).toLowerCase() || '.txt'
      const fileName = `${createSafeFileStem(input.name)}-${createCompactUuid()}${extension}`
      const filePath = join(aiChatTextDir, fileName)

      await mkdir(aiChatTextDir, { recursive: true })
      await writeFile(filePath, Buffer.from(new Uint8Array(input.bytes)))

      const fileStat = await stat(filePath)

      return {
        fileName,
        filePath,
        url: createAiChatTextFileUrl(fileName),
        originalName: input.name,
        sizeBytes: fileStat.size
      }
    },
    deleteAiChatTextFile: async (fileName) => {
      const filePath = join(aiChatTextDir, fileName)

      if (!(await pathExists(filePath))) {
        return
      }

      await mkdir(aiChatTextTrashDir, { recursive: true })
      const targetPath = await createTrashTargetPath(aiChatTextTrashDir, fileName)
      await rename(filePath, targetPath)
    },
    readAiChatTextFile: async (url) => {
      const fileName = resolveAiChatTextFileName(url)
      if (!fileName) {
        throw new Error('Invalid text file URL')
      }

      const filePath = join(aiChatTextDir, fileName)
      if (!(await pathExists(filePath))) {
        throw new Error('File does not exist')
      }

      return readFile(filePath, 'utf-8')
    },
    cleanExpiredTrash: async (retentionMs = 7 * 24 * 60 * 60 * 1000) => {
      const now = Date.now()

      const cleanFolder = async (dirPath: string): Promise<void> => {
        let entries: string[] = []
        try {
          entries = await readdir(dirPath)
        } catch (err) {
          return
        }

        await Promise.all(
          entries.map(async (entry) => {
            const fullPath = join(dirPath, entry)
            try {
              const stats = await stat(fullPath)
              if (stats.isDirectory()) {
                await cleanFolder(fullPath)
                const subEntries = await readdir(fullPath)
                if (subEntries.length === 0) {
                  await rm(fullPath, { recursive: true, force: true }).catch(() => {})
                }
              } else {
                if (now - stats.mtimeMs >= retentionMs) {
                  await rm(fullPath, { force: true }).catch(() => {})
                }
              }
            } catch (err) {
              // 忽略单个文件处理错误，防止阻断整体清理
            }
          })
        )
      }

      await cleanFolder(trashRootDir)
    }
  }
}
