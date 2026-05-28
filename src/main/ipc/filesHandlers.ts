import { ipcMain } from 'electron'
import { createFilesService, type MarkdownImageSaveInput } from '../services/filesService'

/**
 * 注册文件 IPC 处理器。
 */
export const registerFilesHandlers = (): void => {
  const filesService = createFilesService()

  ipcMain.handle('files:markdown-image:save', (_, input: MarkdownImageSaveInput) =>
    filesService.saveMarkdownImage(input)
  )
}
