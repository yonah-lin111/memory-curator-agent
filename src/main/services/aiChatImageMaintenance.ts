import type { FilesService } from "@/services/filesService"

// 自动清理延迟：给用户撤销删除保留缓冲窗口（30秒）。
export const AI_CHAT_IMAGE_CLEANUP_DELAY_MS = 30_000

// 启动清理延迟：避免应用启动阶段抢占资源。
export const AI_CHAT_IMAGE_STARTUP_DELAY_MS = 30_000

// 最近一次自动清理定时器。
let cleanupTimer: NodeJS.Timeout | null = null

/**
 * 执行 AI 聊天图片维护任务。
 */
const runAiChatImageMaintenance = async (filesService: FilesService): Promise<void> => {
  await filesService.restoreReferencedAiChatImages()
  await filesService.deleteUnusedAiChatImages({
    minUnusedAgeMs: AI_CHAT_IMAGE_CLEANUP_DELAY_MS,
  })
  await filesService.cleanExpiredTrash().catch(() => undefined)
}

/**
 * 调度 AI 聊天图片维护任务。
 */
export const scheduleAiChatImageMaintenance = (filesService: FilesService): void => {
  void filesService.restoreReferencedAiChatImages().catch(() => undefined)

  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
  }

  cleanupTimer = setTimeout(() => {
    cleanupTimer = null
    void runAiChatImageMaintenance(filesService).catch(() => undefined)
  }, AI_CHAT_IMAGE_CLEANUP_DELAY_MS)
}

/**
 * 调度应用启动后的 AI 聊天图片维护任务。
 */
export const scheduleStartupAiChatImageMaintenance = (filesService: FilesService): void => {
  setTimeout(() => {
    void runAiChatImageMaintenance(filesService).catch(() => undefined)
  }, AI_CHAT_IMAGE_STARTUP_DELAY_MS)
}
