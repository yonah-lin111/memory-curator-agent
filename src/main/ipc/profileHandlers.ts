import { ipcMain } from 'electron'
import { getProfile, updateProfile, clearProfile } from '@/services/profileService'
import type { PersonalProfileUpdateInput } from '@/db/schema'

export const registerProfileHandlers = (): void => {
  ipcMain.handle('profile:get', async () => {
    return getProfile()
  })

  ipcMain.handle('profile:update', async (_, payload: PersonalProfileUpdateInput) => {
    return updateProfile(payload)
  })

  ipcMain.handle('profile:clear', async () => {
    clearProfile()
  })
}
