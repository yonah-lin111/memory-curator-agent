import { ipcMain } from 'electron'
import { getDatabase } from '@/db'
import type { DatabaseConnection } from '@/services/themesService'
import { createThemesService } from '@/services/themesService'
import type { ThemeCreateInput, ThemeItemsCreateInput, ThemeUpdateInput } from '@/db/schema'

/**
 * 注册主题 IPC 处理器。
 */
export const registerThemesHandlers = (): void => {
  const database = getDatabase()
  const themesService = createThemesService(database as unknown as DatabaseConnection)

  ipcMain.handle('themes:list', (_, status?: string) => themesService.list(status))

  ipcMain.handle('themes:get', (_, externalId: string) =>
    themesService.getByExternalId(externalId)
  )

  ipcMain.handle('themes:create', (_, input: ThemeCreateInput) =>
    themesService.create(input)
  )

  ipcMain.handle('themes:update', (_, externalId: string, input: ThemeUpdateInput) =>
    themesService.update(externalId, input)
  )

  ipcMain.handle('themes:delete', (_, externalId: string) => {
    themesService.delete(externalId)
  })

  ipcMain.handle('themes:items:list', (_, themeExternalId: string) =>
    themesService.listItems(themeExternalId)
  )

  ipcMain.handle('themes:items:add', (_, input: ThemeItemsCreateInput) =>
    themesService.addItem(input)
  )

  ipcMain.handle(
    'themes:items:remove',
    (_, themeExternalId: string, sourceType: string, sourceId: string) => {
      themesService.removeItem(themeExternalId, sourceType, sourceId)
    }
  )

  ipcMain.handle('themes:import-from-tags', (_, tags: string[]) =>
    themesService.batchCreateFromTags(tags)
  )

  ipcMain.handle('themes:timeline', (_, themeExternalId: string) =>
    themesService.getTimeline(themeExternalId)
  )
}
