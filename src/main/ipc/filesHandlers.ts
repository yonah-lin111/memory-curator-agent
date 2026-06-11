import { ipcMain } from 'electron'
import { getDatabase } from '@/db'
import {
  createFilesService,
  type DatabaseConnection,
  type MarkdownImageSaveInput
} from '@/services/filesService'

/**
 * 注册文件 IPC 处理器。
 */
export const registerFilesHandlers = (): void => {
  const filesService = createFilesService({ database: getDatabase() as unknown as DatabaseConnection })

  ipcMain.handle('files:markdown-image:save', (_, input: MarkdownImageSaveInput) =>
    filesService.saveMarkdownImage(input)
  )

  ipcMain.handle('files:people-avatar:save', (_, input: MarkdownImageSaveInput) =>
    filesService.savePeopleAvatar(input)
  )

  ipcMain.handle('files:ai-chat-image:save', (_, input: MarkdownImageSaveInput) =>
    filesService.saveAiChatImage(input)
  )
}
