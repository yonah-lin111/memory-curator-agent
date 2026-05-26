/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'

// 笔记来源类型。
type NoteSource = '随手速记' | '聊天粘贴' | '截图文字' | '会议摘要'

// 笔记草稿载荷类型。
type NoteDraftPayload = {
  // 笔记标题。
  title: string
  // 笔记正文。
  content: string
  // 笔记来源。
  source: NoteSource
  // 笔记标签列表。
  tags: string[]
}

// 页面使用的笔记类型。
type NoteMaterialItem = NoteDraftPayload & {
  // 笔记唯一标识。
  id: string
  // 记录日期与时间。
  time: string
  // 是否已经被策展归档。
  isCurated: boolean
  // 主题线索提示。
  clue?: string
}

// 渲染进程安全 API 类型。
type AppAPI = {
  // Notes 页面 API。
  notes: {
    // 读取全部笔记。
    list: () => Promise<NoteMaterialItem[]>
    // 创建笔记。
    create: (draft: NoteDraftPayload) => Promise<NoteMaterialItem>
    // 更新笔记。
    update: (id: string, draft: NoteDraftPayload) => Promise<NoteMaterialItem>
    // 删除笔记。
    delete: (id: string) => Promise<void>
  }
}

declare global {
  interface Window {
    // Electron 预加载桥接 API。
    electron: ElectronAPI
    // 应用预加载桥接 API。
    api: AppAPI
  }
}
