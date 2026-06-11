import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createFilesService, type DatabaseConnection, type DatabaseStatement } from '@/services/filesService'

// 临时图片目录。
let tempImageDir: string | null = null

// 临时回收目录。
let tempTrashDir: string | null = null

// 内存 Markdown 内容数据库。
class MemoryMarkdownDatabase implements DatabaseConnection {
  /**
   * 创建内存 Markdown 内容数据库。
   */
  constructor(private readonly contents: string[]) {}

  /**
   * 准备内存 SQL 语句。
   */
  prepare = (sql: string): DatabaseStatement => {
    if (sql.includes('SELECT content FROM notes')) {
      return {
        all: () => this.contents.map((content) => ({ content })),
        get: () => undefined,
        run: () => undefined
      }
    }

    throw new Error(`未支持的测试 SQL: ${sql}`)
  }
}

describe('filesService', () => {
  afterEach(() => {
    if (tempImageDir) {
      rmSync(tempImageDir, { recursive: true, force: true })
      tempImageDir = null
    }

    if (tempTrashDir) {
      rmSync(tempTrashDir, { recursive: true, force: true })
      tempTrashDir = null
    }
  })

  it('saves markdown images under the configured directory and returns a file url', async () => {
    tempImageDir = mkdtempSync(join(tmpdir(), 'mc-md-img-'))
    const service = createFilesService({ markdownImageDir: tempImageDir })

    const saved = await service.saveMarkdownImage({
      name: 'clipboard.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([137, 80, 78, 71]).buffer
    })

    expect(saved.fileName).toMatch(/^clipboard-[a-f0-9-]+\.png$/)
    expect(saved.filePath).toBe(join(tempImageDir, saved.fileName))
    expect(saved.url).toBe(`mc-img://md/${saved.fileName}`)
    expect(readFileSync(saved.filePath)).toEqual(Buffer.from([137, 80, 78, 71]))
  })

  it('saves ai chat images under the configured directory and returns a chat protocol url', async () => {
    tempImageDir = mkdtempSync(join(tmpdir(), 'mc-chat-img-'))
    const service = createFilesService({ aiChatImageDir: tempImageDir })

    const saved = await service.saveAiChatImage({
      name: 'chat-upload.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([137, 80, 78, 71]).buffer
    })

    expect(saved.fileName).toMatch(/^chat-upload-[a-f0-9-]+\.png$/)
    expect(saved.filePath).toBe(join(tempImageDir, saved.fileName))
    expect(saved.url).toBe(`mc-img://chat/${saved.fileName}`)
    expect(readFileSync(saved.filePath)).toEqual(Buffer.from([137, 80, 78, 71]))
  })

  it('rejects non-image files', async () => {
    tempImageDir = mkdtempSync(join(tmpdir(), 'mc-md-img-'))
    const service = createFilesService({ markdownImageDir: tempImageDir })

    await expect(
      service.saveMarkdownImage({
        name: 'notes.txt',
        mimeType: 'text/plain',
        bytes: new Uint8Array([1]).buffer
      })
    ).rejects.toThrow('仅支持保存图片文件')
  })

  it('lists only images unused by markdown content', async () => {
    tempImageDir = mkdtempSync(join(tmpdir(), 'mc-md-img-'))
    writeFileSync(join(tempImageDir, 'used.png'), Buffer.from([1]))
    writeFileSync(join(tempImageDir, 'legacy-used.png'), Buffer.from([2]))
    writeFileSync(join(tempImageDir, 'unused.png'), Buffer.from([3]))

    const service = createFilesService({
      database: new MemoryMarkdownDatabase([
        '![used](mc-img://md/used.png)',
        '![legacy](file:///Users/yonah/.mc/img/md/legacy-used.png)'
      ]),
      markdownImageDir: tempImageDir
    })

    await expect(service.listUnusedMarkdownImages()).resolves.toEqual([
      expect.objectContaining({
        fileName: 'unused.png',
        url: 'mc-img://md/unused.png',
        sizeBytes: 1
      })
    ])
  })

  it('moves unused markdown images to trash without touching referenced images', async () => {
    tempImageDir = mkdtempSync(join(tmpdir(), 'mc-md-img-'))
    tempTrashDir = mkdtempSync(join(tmpdir(), 'mc-md-trash-'))
    writeFileSync(join(tempImageDir, 'used.png'), Buffer.from([1]))
    writeFileSync(join(tempImageDir, 'unused.png'), Buffer.from([2]))

    const service = createFilesService({
      database: new MemoryMarkdownDatabase(['![used](mc-img://md/used.png)']),
      markdownImageDir: tempImageDir,
      markdownImageTrashDir: tempTrashDir
    })

    const result = await service.deleteUnusedMarkdownImages()

    expect(result.deletedCount).toBe(1)
    expect(result.deletedImages).toEqual([
      expect.objectContaining({
        fileName: 'unused.png',
        url: 'mc-img://md/unused.png'
      })
    ])
    expect(existsSync(join(tempImageDir, 'used.png'))).toBe(true)
    expect(existsSync(join(tempImageDir, 'unused.png'))).toBe(false)
    expect(existsSync(join(tempTrashDir, 'unused.png'))).toBe(true)
  })

  it('keeps recently changed unused images during delayed cleanup grace period', async () => {
    tempImageDir = mkdtempSync(join(tmpdir(), 'mc-md-img-'))
    tempTrashDir = mkdtempSync(join(tmpdir(), 'mc-md-trash-'))
    writeFileSync(join(tempImageDir, 'recent-unused.png'), Buffer.from([2]))

    const service = createFilesService({
      database: new MemoryMarkdownDatabase([]),
      markdownImageDir: tempImageDir,
      markdownImageTrashDir: tempTrashDir
    })

    const result = await service.deleteUnusedMarkdownImages({ minUnusedAgeMs: 60_000 })

    expect(result.deletedCount).toBe(0)
    expect(existsSync(join(tempImageDir, 'recent-unused.png'))).toBe(true)
    expect(existsSync(join(tempTrashDir, 'recent-unused.png'))).toBe(false)
  })

  it('restores referenced markdown images from trash after undo', async () => {
    tempImageDir = mkdtempSync(join(tmpdir(), 'mc-md-img-'))
    tempTrashDir = mkdtempSync(join(tmpdir(), 'mc-md-trash-'))
    writeFileSync(join(tempTrashDir, 'undo.png'), Buffer.from([8]))

    const service = createFilesService({
      database: new MemoryMarkdownDatabase(['![undo](mc-img://md/undo.png)']),
      markdownImageDir: tempImageDir,
      markdownImageTrashDir: tempTrashDir
    })

    const result = await service.restoreReferencedMarkdownImages()

    expect(result.restoredCount).toBe(1)
    expect(result.restoredImages).toEqual([
      expect.objectContaining({
        fileName: 'undo.png',
        url: 'mc-img://md/undo.png'
      })
    ])
    expect(existsSync(join(tempImageDir, 'undo.png'))).toBe(true)
    expect(existsSync(join(tempTrashDir, 'undo.png'))).toBe(false)
  })

  it('does not overwrite an existing trash file with the same name', async () => {
    tempImageDir = mkdtempSync(join(tmpdir(), 'mc-md-img-'))
    tempTrashDir = mkdtempSync(join(tmpdir(), 'mc-md-trash-'))
    writeFileSync(join(tempImageDir, 'unused.png'), Buffer.from([2]))
    writeFileSync(join(tempTrashDir, 'unused.png'), Buffer.from([9]))

    const service = createFilesService({
      database: new MemoryMarkdownDatabase([]),
      markdownImageDir: tempImageDir,
      markdownImageTrashDir: tempTrashDir
    })

    await service.deleteUnusedMarkdownImages()

    expect(readFileSync(join(tempTrashDir, 'unused.png'))).toEqual(Buffer.from([9]))
    expect(readdirSync(tempTrashDir).filter((fileName) => fileName.startsWith('unused'))).toHaveLength(2)
  })
})
