import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import type {
  JournalSaveInput,
  SnippetCreateInput,
  SnippetUpdateInput,
  TodoCreateInput,
  TodoReorderInput,
  TodoUpdateInput
} from '../db/schema'
import { createDailyService, type DatabaseConnection } from '../services/dailyService'

/**
 * 注册 Daily IPC 处理器。
 */
export const registerDailyHandlers = (): void => {
  const dailyService = createDailyService(getDatabase() as unknown as DatabaseConnection)

  ipcMain.handle('daily:list-day', (_, entryDate: string) => dailyService.listDay(entryDate))
  ipcMain.handle('daily:list-month-overview', (_, month: string) => dailyService.listMonthOverview(month))
  ipcMain.handle('daily:journal:save', (_, input: JournalSaveInput) => dailyService.saveJournal(input))
  ipcMain.handle('daily:journal:delete', (_, entryDate: string) => {
    dailyService.deleteJournal(entryDate)
  })
  ipcMain.handle('daily:todo:create', (_, input: TodoCreateInput) => dailyService.createTodo(input))
  ipcMain.handle('daily:todo:update', (_, id: number, input: TodoUpdateInput) =>
    dailyService.updateTodo(id, input)
  )
  ipcMain.handle('daily:todo:delete', (_, id: number) => {
    dailyService.deleteTodo(id)
  })
  ipcMain.handle('daily:todo:sort', (_, input: TodoReorderInput) => dailyService.reorderTodos(input))
  ipcMain.handle('daily:snippet:create', (_, input: SnippetCreateInput) =>
    dailyService.createSnippet(input)
  )
  ipcMain.handle('daily:snippet:update', (_, id: number, input: SnippetUpdateInput) =>
    dailyService.updateSnippet(id, input)
  )
  ipcMain.handle('daily:snippet:delete', (_, id: number) => {
    dailyService.deleteSnippet(id)
  })
}
