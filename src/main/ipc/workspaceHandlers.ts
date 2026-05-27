import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import type {
  WorkspaceJournalSaveInput,
  WorkspaceSnippetCreateInput,
  WorkspaceSnippetUpdateInput,
  WorkspaceTodoCreateInput,
  WorkspaceTodoReorderInput,
  WorkspaceTodoUpdateInput
} from '../db/schema'
import { createWorkspaceService, type DatabaseConnection } from '../services/workspaceService'

/**
 * 注册 Workspace IPC 处理器。
 */
export const registerWorkspaceHandlers = (): void => {
  const workspaceService = createWorkspaceService(getDatabase() as unknown as DatabaseConnection)

  ipcMain.handle('workspace:list-day', (_, entryDate: string) => workspaceService.listDay(entryDate))
  ipcMain.handle('workspace:journal:save', (_, input: WorkspaceJournalSaveInput) => workspaceService.saveJournal(input))
  ipcMain.handle('workspace:journal:delete', (_, entryDate: string) => {
    workspaceService.deleteJournal(entryDate)
  })
  ipcMain.handle('workspace:todo:create', (_, input: WorkspaceTodoCreateInput) => workspaceService.createTodo(input))
  ipcMain.handle('workspace:todo:update', (_, id: string, input: WorkspaceTodoUpdateInput) =>
    workspaceService.updateTodo(id, input)
  )
  ipcMain.handle('workspace:todo:delete', (_, id: string) => {
    workspaceService.deleteTodo(id)
  })
  ipcMain.handle('workspace:todo:sort', (_, input: WorkspaceTodoReorderInput) => workspaceService.reorderTodos(input))
  ipcMain.handle('workspace:snippet:create', (_, input: WorkspaceSnippetCreateInput) =>
    workspaceService.createSnippet(input)
  )
  ipcMain.handle('workspace:snippet:update', (_, id: string, input: WorkspaceSnippetUpdateInput) =>
    workspaceService.updateSnippet(id, input)
  )
  ipcMain.handle('workspace:snippet:delete', (_, id: string) => {
    workspaceService.deleteSnippet(id)
  })
}
