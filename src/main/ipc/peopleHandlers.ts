import { ipcMain } from "electron"
import { getDatabase } from "@/db"
import type { AssociatedPersonCreateInput, AssociatedPersonUpdateInput } from "@/db/schema"
import { createPeopleService, type DatabaseConnection } from "@/services/peopleService"

/**
 * 注册 People IPC 处理器。
 */
export const registerPeopleHandlers = (): void => {
  const database = getDatabase()
  const peopleService = createPeopleService(database as unknown as DatabaseConnection)

  ipcMain.handle("people:list", () => peopleService.list())
  ipcMain.handle("people:create", (_, input: AssociatedPersonCreateInput) =>
    peopleService.create(input),
  )
  ipcMain.handle("people:update", (_, id: string, input: AssociatedPersonUpdateInput) =>
    peopleService.update(id, input),
  )
  ipcMain.handle("people:delete", (_, id: string) => {
    peopleService.delete(id)
  })
}
