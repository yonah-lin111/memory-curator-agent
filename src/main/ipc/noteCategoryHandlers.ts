import { ipcMain } from 'electron'
import { getDatabase } from '@/db'
import { createNoteCategoryService, type DatabaseConnection } from '@/services/noteCategoryService'

/** 注册分类 IPC 处理器。 */
export const registerNoteCategoryHandlers = (): void => {
  const database = getDatabase()
  const service = createNoteCategoryService(database as unknown as DatabaseConnection)

  ipcMain.handle('note-categories:list', () => service.list())
  ipcMain.handle('note-categories:create', (_, name: string) => service.create(name))
  ipcMain.handle('note-categories:update', (_, id: number, name: string) => service.update(id, name))
  ipcMain.handle('note-categories:delete', (_, id: number) => service.delete(id))
}
