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

// 待办优先级类型。
type TodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

// 日记保存载荷类型。
type JournalSavePayload = {
  // 日记所属日期。
  entryDate: string
  // 日记正文。
  content: string
}

// 待办创建载荷类型。
type TodoCreatePayload = {
  // 待办所属日期。
  entryDate: string
  // 待办文本。
  text: string
  // 待办优先级。
  priority: TodoPriority
}

// 待办更新载荷类型。
type TodoUpdatePayload = {
  // 待办文本。
  text: string
  // 待办优先级。
  priority: TodoPriority
  // 是否完成。
  completed: boolean
}

// 待办排序载荷类型。
type TodoSortPayload = {
  // 待办所属日期。
  entryDate: string
  // 排序后的待办 ID 列表。
  ids: number[]
}

// 片段创建载荷类型。
type SnippetCreatePayload = {
  // 片段所属日期。
  entryDate: string
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // 片段标签列表。
  tags: string[]
}

// 片段更新载荷类型。
type SnippetUpdatePayload = {
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // 片段标签列表。
  tags: string[]
}

// 人物关系类型。
type PersonRelationship = '女朋友' | '家人' | '朋友' | '同事' | '其他'

// 关联人物保存载荷类型。
type AssociatedPersonPayload = {
  // 头像地址。
  avatar: string
  // 姓名。
  name: string
  // 性别。
  gender: string
  // 关系分类。
  relationship: PersonRelationship
  // 一句话状态。
  status: string
  // 生日。
  birthday: string
  // 联系方式。
  contact: string
  // 特征标签列表。
  tags: string[]
  // Markdown 详细档案。
  details: string
}

// Markdown 图片保存载荷类型。
type MarkdownImageSavePayload = {
  // 原始文件名。
  name: string
  // 图片 MIME 类型。
  mimeType: string
  // 图片二进制内容。
  bytes: ArrayBuffer
}

// Markdown 图片保存结果类型。
type MarkdownImageSaveResult = {
  // 落盘文件名。
  fileName: string
  // 本机绝对路径。
  filePath: string
  // 可写入 Markdown 的应用图片 URL。
  url: string
}

// 单日聚合概览类型。
type MonthEntryOverview = {
  // 所属日期。
  entryDate: string
  // 当日待办数量。
  todoCount: number
  // 当日片段数量。
  snippetCount: number
  // 当日日记数量。
  journalCount: number
}

// 整月概览类型。
type MonthOverview = {
  // 所属月份。
  month: string
  // 当月有记录的日期概览。
  entries: MonthEntryOverview[]
}

// 渲染进程安全 API。
const api = {
  files: {
    saveMarkdownImage: (payload: MarkdownImageSavePayload): Promise<MarkdownImageSaveResult> =>
      ipcRenderer.invoke('files:markdown-image:save', payload),
    savePeopleAvatar: (payload: MarkdownImageSavePayload): Promise<MarkdownImageSaveResult> =>
      ipcRenderer.invoke('files:people-avatar:save', payload)
  },
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    create: (draft: NoteDraftPayload) => ipcRenderer.invoke('notes:create', draft),
    update: (id: number, draft: NoteDraftPayload) => ipcRenderer.invoke('notes:update', id, draft),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id)
  },
  daily: {
    listDay: (entryDate: string) => ipcRenderer.invoke('daily:list-day', entryDate),
    listMonthOverview: (month: string): Promise<MonthOverview> =>
      ipcRenderer.invoke('daily:list-month-overview', month),
    saveJournal: (draft: JournalSavePayload) => ipcRenderer.invoke('daily:journal:save', draft),
    deleteJournal: (entryDate: string) => ipcRenderer.invoke('daily:journal:delete', entryDate),
    createTodo: (draft: TodoCreatePayload) => ipcRenderer.invoke('daily:todo:create', draft),
    updateTodo: (id: number, draft: TodoUpdatePayload) =>
      ipcRenderer.invoke('daily:todo:update', id, draft),
    deleteTodo: (id: number) => ipcRenderer.invoke('daily:todo:delete', id),
    sortTodos: (draft: TodoSortPayload) => ipcRenderer.invoke('daily:todo:sort', draft),
    createSnippet: (draft: SnippetCreatePayload) => ipcRenderer.invoke('daily:snippet:create', draft),
    updateSnippet: (id: number, draft: SnippetUpdatePayload) =>
      ipcRenderer.invoke('daily:snippet:update', id, draft),
    deleteSnippet: (id: number) => ipcRenderer.invoke('daily:snippet:delete', id)
  },
  people: {
    list: () => ipcRenderer.invoke('people:list'),
    create: (draft: AssociatedPersonPayload) => ipcRenderer.invoke('people:create', draft),
    update: (id: string, draft: AssociatedPersonPayload) =>
      ipcRenderer.invoke('people:update', id, draft),
    delete: (id: string) => ipcRenderer.invoke('people:delete', id)
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
