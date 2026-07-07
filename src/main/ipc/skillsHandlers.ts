import { ipcMain } from 'electron'
import { loadSkills, getAvailableSkillsForAgent, clearSkillsCache } from '@/services/skillsService'

/**
 * 注册 Agent Skills 相关 IPC 处理器。
 */
export const registerSkillsHandlers = (): void => {
  ipcMain.handle('skills:list', async (_, forceRefresh?: boolean) => {
    return loadSkills(forceRefresh)
  })

  ipcMain.handle('skills:available-for-agent', async (_, agentId: string) => {
    return getAvailableSkillsForAgent(agentId)
  })

  ipcMain.handle('skills:clear-cache', async () => {
    return clearSkillsCache()
  })
}
