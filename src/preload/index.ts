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

// 工作台待办优先级类型。
type WorkspaceTodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

// 工作台日记保存载荷类型。
type WorkspaceJournalSavePayload = {
  // 日记所属日期。
  entryDate: string
  // 日记正文。
  content: string
}

// 工作台待办创建载荷类型。
type WorkspaceTodoCreatePayload = {
  // 待办所属日期。
  entryDate: string
  // 待办文本。
  text: string
  // 待办优先级。
  priority: WorkspaceTodoPriority
}

// 工作台待办更新载荷类型。
type WorkspaceTodoUpdatePayload = {
  // 待办文本。
  text: string
  // 待办优先级。
  priority: WorkspaceTodoPriority
  // 是否完成。
  completed: boolean
}

// 工作台待办排序载荷类型。
type WorkspaceTodoSortPayload = {
  // 待办所属日期。
  entryDate: string
  // 排序后的待办 ID 列表。
  ids: number[]
}

// 工作台片段创建载荷类型。
type WorkspaceSnippetCreatePayload = {
  // 片段所属日期。
  entryDate: string
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // 片段标签列表。
  tags: string[]
}

// 工作台片段更新载荷类型。
type WorkspaceSnippetUpdatePayload = {
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // 片段标签列表。
  tags: string[]
}

// 渲染进程安全 API。
const api = {
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    create: (draft: NoteDraftPayload) => ipcRenderer.invoke('notes:create', draft),
    update: (id: number, draft: NoteDraftPayload) => ipcRenderer.invoke('notes:update', id, draft),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id)
  },
  workspace: {
    listDay: (entryDate: string) => ipcRenderer.invoke('workspace:list-day', entryDate),
    saveJournal: (draft: WorkspaceJournalSavePayload) => ipcRenderer.invoke('workspace:journal:save', draft),
    deleteJournal: (entryDate: string) => ipcRenderer.invoke('workspace:journal:delete', entryDate),
    createTodo: (draft: WorkspaceTodoCreatePayload) => ipcRenderer.invoke('workspace:todo:create', draft),
    updateTodo: (id: number, draft: WorkspaceTodoUpdatePayload) =>
      ipcRenderer.invoke('workspace:todo:update', id, draft),
    deleteTodo: (id: number) => ipcRenderer.invoke('workspace:todo:delete', id),
    sortTodos: (draft: WorkspaceTodoSortPayload) => ipcRenderer.invoke('workspace:todo:sort', draft),
    createSnippet: (draft: WorkspaceSnippetCreatePayload) => ipcRenderer.invoke('workspace:snippet:create', draft),
    updateSnippet: (id: number, draft: WorkspaceSnippetUpdatePayload) =>
      ipcRenderer.invoke('workspace:snippet:update', id, draft),
    deleteSnippet: (id: number) => ipcRenderer.invoke('workspace:snippet:delete', id)
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
