import { ipcMain } from "electron"
import { promptDesignService } from "../services/promptDesignService"

export const registerPromptDesignHandlers = (): void => {
  // Projects
  ipcMain.handle("prompt-design:projects:list", () => {
    return promptDesignService.listProjects()
  })

  ipcMain.handle("prompt-design:projects:create", (_, input) => {
    return promptDesignService.createProject(input)
  })

  ipcMain.handle("prompt-design:projects:rename", (_, id, name) => {
    promptDesignService.renameProject(id, name)
  })

  ipcMain.handle("prompt-design:projects:update", (_, id, input) => {
    promptDesignService.updateProject(id, input)
  })

  ipcMain.handle("prompt-design:projects:delete", (_, id) => {
    promptDesignService.deleteProject(id)
  })

  // Designs
  ipcMain.handle("prompt-design:designs:list", (_, projectId) => {
    return promptDesignService.listDesigns(projectId)
  })

  ipcMain.handle("prompt-design:designs:create", (_, input) => {
    return promptDesignService.createDesign(input)
  })

  ipcMain.handle("prompt-design:designs:rename", (_, id, name) => {
    promptDesignService.renameDesign(id, name)
  })

  ipcMain.handle("prompt-design:designs:update", (_, id, input) => {
    promptDesignService.updateDesign(id, input)
  })

  ipcMain.handle("prompt-design:designs:delete", (_, id) => {
    promptDesignService.deleteDesign(id)
  })
}
