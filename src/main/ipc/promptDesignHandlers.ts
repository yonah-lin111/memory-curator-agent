import { ipcMain } from "electron"
import fs from "fs"
import path from "path"
import { promptDesignService } from "../services/promptDesignService"
import { getMatchScore } from "@/lib/promptDesignUtils"

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
  // 文件
  ipcMain.handle("prompt-design:files:search", (_, { directory, query }: { directory: string, query: string }) => {
    const results: { path: string; isDirectory: boolean; score: number }[] = []
    const maxResults = 100

    const cleanQuery = query.toLowerCase().replace(/^@/, "").trim()

    function walk(currentDir: string) {
      let entries
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true })
      } catch (err) {
        return
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        const relativePath = path.relative(directory, fullPath)
        const normalizedRelativePath = relativePath.split(path.sep).join("/")

        if (entry.isSymbolicLink()) {
          continue
        }

        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
            const directoryPath = `${normalizedRelativePath}/`
            const score = getMatchScore(normalizedRelativePath, cleanQuery)
            if (score > 0) {
              results.push({ path: directoryPath, isDirectory: true, score })
            }
            walk(fullPath)
          }
        } else if (entry.isFile()) {
          if (entry.name === ".DS_Store") continue

          const score = getMatchScore(normalizedRelativePath, cleanQuery)
          if (score > 0) {
            results.push({ path: normalizedRelativePath, isDirectory: false, score })
          }
        }
      }
    }

    try {
      walk(directory)
    } catch (err) {
      console.error("Error walking directory:", err)
    }

    // 按得分降序排序，若得分相同按字母升序，取前 maxResults 个
    return results
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score
        }
        return a.path.localeCompare(b.path)
      })
      .slice(0, maxResults)
      .map(({ path: itemPath, isDirectory }) => ({ path: itemPath, isDirectory }))
  })

  // 项目
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

  // 模块
  ipcMain.handle("prompt-design:modules:list", (_, projectId) => {
    return promptDesignService.listModules(projectId)
  })

  ipcMain.handle("prompt-design:modules:create", (_, input) => {
    return promptDesignService.createModule(input)
  })

  ipcMain.handle("prompt-design:modules:rename", (_, id, name) => {
    promptDesignService.renameModule(id, name)
  })

  ipcMain.handle("prompt-design:modules:update", (_, id, input) => {
    promptDesignService.updateModule(id, input)
  })

  ipcMain.handle("prompt-design:modules:delete", (_, id) => {
    promptDesignService.deleteModule(id)
  })

  // 设计
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
