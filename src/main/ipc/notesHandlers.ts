import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import type { NoteCreateInput, NoteUpdateInput } from '../db/schema'
import { createNotesService, type DatabaseConnection } from '../services/notesService'

/**
 * 注册 Notes IPC 处理器。
 */
export const registerNotesHandlers = (): void => {
  const notesService = createNotesService(getDatabase() as unknown as DatabaseConnection)

  ipcMain.handle('notes:list', () => notesService.list())
  ipcMain.handle('notes:create', (_, input: NoteCreateInput) => notesService.create(input))
  ipcMain.handle('notes:update', (_, id: string, input: NoteUpdateInput) => notesService.update(id, input))
  ipcMain.handle('notes:delete', (_, id: string) => {
    notesService.delete(id)
  })
}
