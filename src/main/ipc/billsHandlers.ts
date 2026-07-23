import { ipcMain } from "electron"
import { getDatabase } from "@/db"
import type { BillCreateInput, BillListFilters, BillUpdateInput } from "@/db/schema"
import { createBillsService, type DatabaseConnection } from "@/services/billsService"

/**
 * 注册 Bills IPC 处理器。
 */
export const registerBillsHandlers = (): void => {
  const database = getDatabase()
  const billsService = createBillsService(database as unknown as DatabaseConnection)

  ipcMain.handle("bills:list", (_, filters?: BillListFilters) => billsService.list(filters))

  ipcMain.handle("bills:create", (_, input: BillCreateInput) => billsService.create(input))

  ipcMain.handle("bills:update", (_, id: number, input: BillUpdateInput) =>
    billsService.update(id, input),
  )

  ipcMain.handle("bills:delete", (_, id: number) => {
    billsService.delete(id)
  })

  ipcMain.handle("bills:today-summary", (_, date?: string) => billsService.todaySummary(date))
}
