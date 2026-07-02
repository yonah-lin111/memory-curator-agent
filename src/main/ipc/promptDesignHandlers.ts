import { ipcMain } from "electron"
import fs from "fs"
import path from "path"
import { promptDesignService } from "../services/promptDesignService"

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".idea",
  ".vscode"
])

export const registerPromptDesignHandlers = (): void => {
  // Files
  ipcMain.handle("prompt-design:files:search", (_, { directory, query }: { directory: string, query: string }) => {
    const results: string[] = []
    const maxResults = 50

    function walk(currentDir: string) {
      if (results.length >= maxResults) return

      let entries
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true })
      } catch (err) {
        return
      }

      for (const entry of entries) {
        if (results.length >= maxResults) return

        const fullPath = path.join(currentDir, entry.name)
        const relativePath = path.relative(directory, fullPath)

        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
            walk(fullPath)
          }
        } else if (entry.isFile()) {
          if (entry.name === ".DS_Store") continue

          if (!query || relativePath.toLowerCase().includes(query.toLowerCase())) {
            results.push(relativePath.split(path.sep).join("/"))
          }
        }
      }
    }

    try {
      walk(directory)
    } catch (err) {
      console.error("Error walking directory:", err)
    }

    return results
  })

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
