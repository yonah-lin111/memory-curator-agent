import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createFilesService } from './filesService'

// 临时图片目录。
let tempImageDir: string | null = null

describe('filesService', () => {
  afterEach(() => {
    if (tempImageDir) {
      rmSync(tempImageDir, { recursive: true, force: true })
      tempImageDir = null
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
    expect(saved.url).toBe(pathToFileURL(saved.filePath).href)
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
})
