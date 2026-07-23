import type { FilesService } from "@/services/filesService"

// 自动清理延迟，给用户撤回删除保留缓冲窗口。
export const MARKDOWN_IMAGE_CLEANUP_DELAY_MS = 30_000

// 启动清理延迟，避免应用启动阶段抢资源。
export const MARKDOWN_IMAGE_STARTUP_DELAY_MS = 30_000

// 最近一次自动清理计时器。
let cleanupTimer: NodeJS.Timeout | null = null

/**
 * 执行 Markdown 图片维护任务。
 */
const runMarkdownImageMaintenance = async (filesService: FilesService): Promise<void> => {
  await filesService.restoreReferencedMarkdownImages()
  await filesService.deleteUnusedMarkdownImages({
    minUnusedAgeMs: MARKDOWN_IMAGE_CLEANUP_DELAY_MS,
  })
}

/**
 * 调度 Markdown 图片维护任务。
 */
export const scheduleMarkdownImageMaintenance = (filesService: FilesService): void => {
  void filesService.restoreReferencedMarkdownImages().catch(() => undefined)

  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
  }

  cleanupTimer = setTimeout(() => {
    cleanupTimer = null
    void runMarkdownImageMaintenance(filesService).catch(() => undefined)
  }, MARKDOWN_IMAGE_CLEANUP_DELAY_MS)
}

/**
 * 调度应用启动后的 Markdown 图片维护任务。
 */
export const scheduleStartupMarkdownImageMaintenance = (filesService: FilesService): void => {
  setTimeout(() => {
    void runMarkdownImageMaintenance(filesService).catch(() => undefined)
  }, MARKDOWN_IMAGE_STARTUP_DELAY_MS)
}
