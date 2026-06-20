import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { initDatabase } from '@/db'
import { registerNotesHandlers } from '@/ipc/notesHandlers'
import { registerDailyHandlers } from '@/ipc/dailyHandlers'
import { registerNoteCategoryHandlers } from '@/ipc/noteCategoryHandlers'
import { registerFilesHandlers } from '@/ipc/filesHandlers'
import { registerPeopleHandlers } from '@/ipc/peopleHandlers'
import { registerAiHandlers } from '@/ipc/aiHandlers'
import { registerPromptHistoryHandlers } from '@/ipc/promptHistoryHandlers'
import { registerConfigHandlers } from '@/ipc/configHandlers'
import { registerWeeklyHandlers } from '@/ipc/weeklyHandlers'
import { registerThemesHandlers } from '@/ipc/themesHandlers'
import { registerImageProtocolHandler, registerImageProtocolSchemes } from '@/protocols/imageProtocol'
import { createFilesService, type DatabaseConnection as FilesDatabaseConnection } from '@/services/filesService'
import { scheduleStartupMarkdownImageMaintenance } from '@/services/markdownImageMaintenance'
import { scheduleStartupAiChatImageMaintenance } from '@/services/aiChatImageMaintenance'

registerImageProtocolSchemes()

/**
 * 创建应用主窗口。
 */
const createWindow = (): void => {
  // 主窗口实例。
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#000000',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.memorycurator.agent')
  const database = initDatabase()
  registerNotesHandlers()
  registerNoteCategoryHandlers()
  registerDailyHandlers()
  registerFilesHandlers()
  registerPeopleHandlers()
  registerAiHandlers()
  registerPromptHistoryHandlers()
  registerConfigHandlers()
  registerWeeklyHandlers()
  registerThemesHandlers()
  registerImageProtocolHandler()
  scheduleStartupMarkdownImageMaintenance(
    createFilesService({ database: database as unknown as FilesDatabaseConnection })
  )
  scheduleStartupAiChatImageMaintenance(
    createFilesService({ database: database as unknown as FilesDatabaseConnection })
  )

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
