import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
} else {
  // 非隔离上下文仅用于兼容特殊运行环境。
  ;(window as unknown as Window & { electron: typeof electronAPI }).electron = electronAPI
}
