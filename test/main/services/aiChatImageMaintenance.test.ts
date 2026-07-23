import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  AI_CHAT_IMAGE_CLEANUP_DELAY_MS,
  AI_CHAT_IMAGE_STARTUP_DELAY_MS,
  scheduleAiChatImageMaintenance,
  scheduleStartupAiChatImageMaintenance,
} from "@/services/aiChatImageMaintenance"
import type { FilesService } from "@/services/filesService"

// 测试用文件服务。
const filesService: FilesService = {
  saveMarkdownImage: vi.fn(),
  savePeopleAvatar: vi.fn(),
  deletePeopleAvatar: vi.fn(),
  savePersonalAvatar: vi.fn(),
  deletePersonalAvatar: vi.fn(),
  saveAiChatImage: vi.fn(),
  listUnusedMarkdownImages: vi.fn(),
  restoreReferencedMarkdownImages: vi.fn(),
  deleteUnusedMarkdownImages: vi.fn(),
  listUnusedAiChatImages: vi.fn(),
  restoreReferencedAiChatImages: vi.fn(),
  deleteUnusedAiChatImages: vi.fn(),
  saveAiChatTextFile: vi.fn(),
  deleteAiChatTextFile: vi.fn(),
  readAiChatTextFile: vi.fn(),
  cleanExpiredTrash: vi.fn(),
}

describe("aiChatImageMaintenance", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(filesService.restoreReferencedAiChatImages).mockResolvedValue({
      restoredCount: 0,
      restoredImages: [],
    })
    vi.mocked(filesService.deleteUnusedAiChatImages).mockResolvedValue({
      deletedCount: 0,
      deletedImages: [],
    })
    vi.mocked(filesService.cleanExpiredTrash).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("restores referenced images immediately and delays cleanup", async () => {
    scheduleAiChatImageMaintenance(filesService)

    await vi.runOnlyPendingTimersAsync()

    expect(filesService.restoreReferencedAiChatImages).toHaveBeenCalledTimes(2)
    expect(filesService.deleteUnusedAiChatImages).toHaveBeenCalledWith({
      minUnusedAgeMs: AI_CHAT_IMAGE_CLEANUP_DELAY_MS,
    })
    expect(filesService.cleanExpiredTrash).toHaveBeenCalled()
  })

  it("runs startup maintenance after startup delay", async () => {
    scheduleStartupAiChatImageMaintenance(filesService)

    await vi.advanceTimersByTimeAsync(AI_CHAT_IMAGE_STARTUP_DELAY_MS)

    expect(filesService.restoreReferencedAiChatImages).toHaveBeenCalledTimes(1)
    expect(filesService.deleteUnusedAiChatImages).toHaveBeenCalledWith({
      minUnusedAgeMs: AI_CHAT_IMAGE_CLEANUP_DELAY_MS,
    })
    expect(filesService.cleanExpiredTrash).toHaveBeenCalled()
  })
})
