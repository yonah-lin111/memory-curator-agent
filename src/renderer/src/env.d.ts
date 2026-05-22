/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    // Electron 预加载桥接 API。
    electron: ElectronAPI
  }
}
