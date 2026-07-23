import { ipcMain } from "electron"
import { getDatabase } from "@/db"
import type { NoteCreateInput, NoteUpdateInput } from "@/db/schema"
import {
  createFilesService,
  type DatabaseConnection as FilesDatabaseConnection,
} from "@/services/filesService"
import { scheduleMarkdownImageMaintenance } from "@/services/markdownImageMaintenance"
import { createNotesService, type DatabaseConnection } from "@/services/notesService"

/**
 * 注册 Notes IPC 处理器。
 */
export const registerNotesHandlers = (): void => {
  const database = getDatabase()
  const notesService = createNotesService(database as unknown as DatabaseConnection)
  const filesService = createFilesService({
    database: database as unknown as FilesDatabaseConnection,
  })

  ipcMain.handle("notes:list", (_, categoryId?: number) => notesService.list(categoryId))
  ipcMain.handle("notes:create", (_, input: NoteCreateInput) => {
    const note = notesService.create(input)

    scheduleMarkdownImageMaintenance(filesService)

    return note
  })
  ipcMain.handle("notes:update", (_, id: number, input: NoteUpdateInput) => {
    const note = notesService.update(id, input)

    scheduleMarkdownImageMaintenance(filesService)

    return note
  })
  ipcMain.handle("notes:delete", (_, id: number) => {
    notesService.delete(id)
    scheduleMarkdownImageMaintenance(filesService)
  })
}
