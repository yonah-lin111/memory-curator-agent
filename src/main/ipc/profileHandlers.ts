import { ipcMain } from "electron"
import type { PersonalProfileUpdateInput } from "@/db/schema"
import { clearProfile, getProfile, updateProfile } from "@/services/profileService"

export const registerProfileHandlers = (): void => {
  ipcMain.handle("profile:get", async () => {
    return getProfile()
  })

  ipcMain.handle("profile:update", async (_, payload: PersonalProfileUpdateInput) => {
    return updateProfile(payload)
  })

  ipcMain.handle("profile:clear", async () => {
    clearProfile()
  })
}
