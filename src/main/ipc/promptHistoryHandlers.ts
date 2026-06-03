import { ipcMain } from 'electron'
import { createPromptHistoryService } from '../services/promptHistoryService'

/**
 * 注册提示词历史 IPC 处理器。
 */
export const registerPromptHistoryHandlers = (): void => {
  const promptHistoryService = createPromptHistoryService()

  ipcMain.handle('ai:prompt-history:list', () => promptHistoryService.list())
  ipcMain.handle('ai:prompt-history:add', (_, prompt: string) => promptHistoryService.add(prompt))
}
