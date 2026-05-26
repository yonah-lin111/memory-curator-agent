import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 笔记草稿载荷类型。
type NoteDraftPayload = {
  // 笔记标题。
  title: string
  // 笔记正文。
  content: string
  // 笔记来源。
  source: '随手速记' | '聊天粘贴' | '截图文字' | '会议摘要'
  // 笔记标签列表。
  tags: string[]
}

// 渲染进程安全 API。
const api = {
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    create: (draft: NoteDraftPayload) => ipcRenderer.invoke('notes:create', draft),
    update: (id: string, draft: NoteDraftPayload) => ipcRenderer.invoke('notes:update', id, draft),
    delete: (id: string) => ipcRenderer.invoke('notes:delete', id)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} else {
  // 非隔离上下文仅用于兼容特殊运行环境。
  ;(window as unknown as Window & { electron: typeof electronAPI; api: typeof api }).electron = electronAPI
  ;(window as unknown as Window & { electron: typeof electronAPI; api: typeof api }).api = api
}
