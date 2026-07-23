import { ipcMain } from "electron"
import { getDatabase } from "@/db"
import type { ThemeCreateInput, ThemeItemsCreateInput, ThemeUpdateInput } from "@/db/schema"
import { updateThemeDescription } from "@/ipc/themeDescriptionUpdater"
import type { DatabaseConnection } from "@/services/themesService"
import { createThemesService } from "@/services/themesService"

/**
 * 注册主题 IPC 处理器。
 */
export const registerThemesHandlers = (): void => {
  const database = getDatabase()
  const themesService = createThemesService(database as unknown as DatabaseConnection)
  const updateDescriptionAsync = (themeExternalId: string): void => {
    void updateThemeDescription(themesService, themeExternalId)
  }

  ipcMain.handle("themes:list", (_, status?: string) => themesService.list(status))

  ipcMain.handle("themes:get", (_, externalId: string) => themesService.getByExternalId(externalId))

  ipcMain.handle("themes:create", (_, input: ThemeCreateInput) => themesService.create(input))

  ipcMain.handle("themes:update", (_, externalId: string, input: ThemeUpdateInput) =>
    themesService.update(externalId, input),
  )

  ipcMain.handle("themes:delete", (_, externalId: string) => {
    themesService.delete(externalId)
  })

  ipcMain.handle("themes:items:list", (_, themeExternalId: string) =>
    themesService.listItems(themeExternalId),
  )

  ipcMain.handle("themes:items:add", (_, input: ThemeItemsCreateInput) => {
    const result = themesService.addItem(input)
    updateDescriptionAsync(input.themeExternalId)
    return result
  })

  ipcMain.handle(
    "themes:items:remove",
    (_, themeExternalId: string, sourceType: string, sourceId: string) => {
      themesService.removeItem(themeExternalId, sourceType, sourceId)
      updateDescriptionAsync(themeExternalId)
    },
  )

  ipcMain.handle("themes:import-from-tags", (_, tags: string[]) =>
    themesService.batchCreateFromTags(tags),
  )

  ipcMain.handle("themes:timeline", (_, themeExternalId: string) =>
    themesService.getTimeline(themeExternalId),
  )

  ipcMain.handle("themes:update-description", async (_, themeExternalId: string) => {
    await updateThemeDescription(themesService, themeExternalId)
  })
}
