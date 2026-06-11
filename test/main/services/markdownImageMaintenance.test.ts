import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MARKDOWN_IMAGE_CLEANUP_DELAY_MS,
  MARKDOWN_IMAGE_STARTUP_DELAY_MS,
  scheduleMarkdownImageMaintenance,
  scheduleStartupMarkdownImageMaintenance
} from '@/services/markdownImageMaintenance'
import type { FilesService } from '@/services/filesService'

// 测试用文件服务。
const filesService: FilesService = {
  saveMarkdownImage: vi.fn(),
  savePeopleAvatar: vi.fn(),
  saveAiChatImage: vi.fn(),
  listUnusedMarkdownImages: vi.fn(),
  restoreReferencedMarkdownImages: vi.fn(),
  deleteUnusedMarkdownImages: vi.fn()
}

describe('markdownImageMaintenance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(filesService.restoreReferencedMarkdownImages).mockResolvedValue({
      restoredCount: 0,
      restoredImages: []
    })
    vi.mocked(filesService.deleteUnusedMarkdownImages).mockResolvedValue({
      deletedCount: 0,
      deletedImages: []
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores referenced images immediately and delays cleanup', async () => {
    scheduleMarkdownImageMaintenance(filesService)

    await vi.runOnlyPendingTimersAsync()

    expect(filesService.restoreReferencedMarkdownImages).toHaveBeenCalledTimes(2)
    expect(filesService.deleteUnusedMarkdownImages).toHaveBeenCalledWith({
      minUnusedAgeMs: MARKDOWN_IMAGE_CLEANUP_DELAY_MS
    })
  })

  it('runs startup maintenance after startup delay', async () => {
    scheduleStartupMarkdownImageMaintenance(filesService)

    await vi.advanceTimersByTimeAsync(MARKDOWN_IMAGE_STARTUP_DELAY_MS)

    expect(filesService.restoreReferencedMarkdownImages).toHaveBeenCalledTimes(1)
    expect(filesService.deleteUnusedMarkdownImages).toHaveBeenCalledWith({
      minUnusedAgeMs: MARKDOWN_IMAGE_CLEANUP_DELAY_MS
    })
  })
})
