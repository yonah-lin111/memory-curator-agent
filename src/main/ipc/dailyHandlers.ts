import { ipcMain } from 'electron'
import { getDatabase } from '@/db'
import type {
  JournalSaveInput,
  SnippetCreateInput,
  SnippetUpdateInput,
  TodoCreateInput,
  TodoReorderInput,
  TodoUpdateInput
} from '@/db/schema'
import { createDailyService, type DatabaseConnection } from '@/services/dailyService'
import { createFilesService, type DatabaseConnection as FilesDatabaseConnection } from '@/services/filesService'
import { scheduleMarkdownImageMaintenance } from '@/services/markdownImageMaintenance'

/**
 * 注册 Daily IPC 处理器。
 */
export const registerDailyHandlers = (): void => {
  const database = getDatabase()
  const dailyService = createDailyService(database as unknown as DatabaseConnection)
  const filesService = createFilesService({ database: database as unknown as FilesDatabaseConnection })

  ipcMain.handle('daily:list-day', (_, entryDate: string) => dailyService.listDay(entryDate))
  ipcMain.handle('daily:list-month-overview', (_, month: string) => dailyService.listMonthOverview(month))
  ipcMain.handle('daily:journal:save', (_, input: JournalSaveInput) => {
    const journal = dailyService.saveJournal(input)

    scheduleMarkdownImageMaintenance(filesService)

    return journal
  })
  ipcMain.handle('daily:journal:delete', (_, entryDate: string) => {
    dailyService.deleteJournal(entryDate)
    scheduleMarkdownImageMaintenance(filesService)
  })
  ipcMain.handle('daily:todo:create', (_, input: TodoCreateInput) => dailyService.createTodo(input))
  ipcMain.handle('daily:todo:update', (_, id: number, input: TodoUpdateInput) =>
    dailyService.updateTodo(id, input)
  )
  ipcMain.handle('daily:todo:delete', (_, id: number) => {
    dailyService.deleteTodo(id)
  })
  ipcMain.handle('daily:todo:sort', (_, input: TodoReorderInput) => dailyService.reorderTodos(input))
  ipcMain.handle('daily:snippet:create', (_, input: SnippetCreateInput) => {
    const snippet = dailyService.createSnippet(input)

    scheduleMarkdownImageMaintenance(filesService)

    return snippet
  })
  ipcMain.handle('daily:snippet:update', (_, id: number, input: SnippetUpdateInput) => {
    const snippet = dailyService.updateSnippet(id, input)

    scheduleMarkdownImageMaintenance(filesService)

    return snippet
  })
  ipcMain.handle('daily:snippet:delete', (_, id: number) => {
    dailyService.deleteSnippet(id)
    scheduleMarkdownImageMaintenance(filesService)
  })
}
