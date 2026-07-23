import * as fs from "node:fs/promises"
import { join } from "node:path"
import { electronApp, is, optimizer } from "@electron-toolkit/utils"
import { app, BrowserWindow, dialog, ipcMain } from "electron"
import { closePromptDesignMcpConnections } from "@/agent/tools/mcpToolService"
import { initDatabase } from "@/db"
import { registerAiHandlers } from "@/ipc/aiHandlers"
import { registerBillsHandlers } from "@/ipc/billsHandlers"
import { registerConfigHandlers } from "@/ipc/configHandlers"
import { registerDailyHandlers } from "@/ipc/dailyHandlers"
import { registerFilesHandlers } from "@/ipc/filesHandlers"
import { registerNoteCategoryHandlers } from "@/ipc/noteCategoryHandlers"
import { registerNotesHandlers } from "@/ipc/notesHandlers"
import { registerPeopleHandlers } from "@/ipc/peopleHandlers"
import { registerProfileHandlers } from "@/ipc/profileHandlers"
import { registerPromptAiHandlers } from "@/ipc/promptAiHandlers"
import { registerPromptDesignHandlers } from "@/ipc/promptDesignHandlers"
import { registerPromptHistoryHandlers } from "@/ipc/promptHistoryHandlers"
import { registerSkillsHandlers } from "@/ipc/skillsHandlers"
import { registerThemesHandlers } from "@/ipc/themesHandlers"
import { registerWeeklyHandlers } from "@/ipc/weeklyHandlers"
import {
  registerImageProtocolHandler,
  registerImageProtocolSchemes,
} from "@/protocols/imageProtocol"
import { scheduleStartupAiChatImageMaintenance } from "@/services/aiChatImageMaintenance"
import {
  createFilesService,
  type DatabaseConnection as FilesDatabaseConnection,
} from "@/services/filesService"
import { scheduleStartupMarkdownImageMaintenance } from "@/services/markdownImageMaintenance"

registerImageProtocolSchemes()

/**
 * 创建应用主窗口。
 */
const createWindow = (): void => {
  // 主窗口实例。
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 1240,
    minHeight: 780,
    backgroundColor: "#000000",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.memorycurator.agent")
  const database = initDatabase()
  registerNotesHandlers()
  registerNoteCategoryHandlers()
  registerDailyHandlers()
  registerFilesHandlers()
  registerPeopleHandlers()
  registerProfileHandlers()
  registerAiHandlers()
  registerPromptHistoryHandlers()
  registerConfigHandlers()
  registerWeeklyHandlers()
  registerThemesHandlers()
  registerBillsHandlers()
  registerPromptDesignHandlers()
  registerPromptAiHandlers()
  registerSkillsHandlers()
  registerImageProtocolHandler()
  scheduleStartupMarkdownImageMaintenance(
    createFilesService({
      database: database as unknown as FilesDatabaseConnection,
    }),
  )
  scheduleStartupAiChatImageMaintenance(
    createFilesService({
      database: database as unknown as FilesDatabaseConnection,
    }),
  )

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  ipcMain.handle("dialog:showSaveDialog", async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      throw new Error("Cannot find window for dialog")
    }
    const result = await dialog.showSaveDialog(window, options)
    return result
  })

  ipcMain.handle("dialog:showOpenDialog", async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      throw new Error("Cannot find window for dialog")
    }
    const result = await dialog.showOpenDialog(window, options)
    return result
  })

  ipcMain.handle("fs:writeFile", async (_, filePath, content) => {
    await fs.writeFile(filePath, content, "utf-8")
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", () => {
  void closePromptDesignMcpConnections()
})
