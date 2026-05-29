/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'

// 笔记来源类型。
type NoteSource = '随手速记' | '聊天粘贴' | '截图文字' | '会议摘要'

// 待办优先级类型。
type TodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

// 日记保存载荷类型。
type JournalSavePayload = {
  // 日记所属日期。
  entryDate: string
  // 日记正文.
  content: string
}

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
  id: number
  // 记录日期与时间。
  time: string
  // 是否已经被策展归档。
  isCurated: boolean
  // 主题线索提示。
  clue?: string
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

// 页面使用的待办类型。
type TodoItem = {
  // 待办唯一标识。
  id: number
  // 待办所属日期。
  entryDate: string
  // 待办文本。
  text: string
  // 是否完成。
  completed: boolean
  // 当前优先级。
  priority: TodoPriority
  // 排序序号。
  sortOrder: number
  // 创建时间。
  createdAt: string
  // 更新时间。
  updatedAt: string
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

// AI 对话启动载荷类型。
type AiChatStartPayload = {
  // Agent 运行 ID。
  runId?: string
  // 会话 ID。
  sessionId: string
  // 用户消息。
  message: string
  // 用户选择的 provider 标识。
  provider?: string
  // 用户选择的模型标识。
  model?: string
  // 本轮请求可用上下文。
  context?: Array<{
    // 上下文稳定去重键。
    key: string
    // 上下文来源类型。
    kind: 'message' | 'memory' | 'page' | 'file' | 'tool' | 'agent'
    // 展示标题。
    title: string
    // 参与模型请求的正文。
    content: string
    // 估算 token 数。
    tokens?: number
    // 创建顺序或时间戳。
    createdAt?: number
    // 来源相关补充信息。
    meta?: Record<string, string | number | boolean | undefined>
  }>
}

// AI 模型选项。
type AiModelOption = {
  // 模型唯一标识。
  id: string
  // 模型显示名。
  name: string
  // 模型限制。
  limit?: {
    // 上下文窗口 token 上限。
    context: number
    // 输出 token 上限。
    output: number
  }
  // 模型输入输出模态。
  modalities?: {
    // 支持的输入模态。
    input: string[]
    // 支持的输出模态。
    output: string[]
  }
}

// AI Provider 选项。
type AiModelProviderOption = {
  // Provider 唯一标识。
  id: string
  // Provider 显示名。
  name: string
  // Provider 下属模型列表。
  models: AiModelOption[]
}

// AI 模型配置响应。
type AiModelOptionsResponse = {
  // 默认 provider 标识。
  defaultProvider: string
  // 默认模型标识。
  defaultModel: string
  // 已启用 provider 与模型。
  providers: AiModelProviderOption[]
}

// AI 对话流式事件类型。
type AiChatEvent =
  | {
      // 事件类型。
      type: 'run_started' | 'assistant_message_started' | 'turn_finished' | 'done'
      // Agent 运行 ID。
      runId: string
      // 会话 ID。
      sessionId: string
    }
  | {
      // 事件类型。
      type: 'text_delta'
      // Agent 运行 ID。
      runId: string
      // 会话 ID。
      sessionId: string
      // 文本增量。
      delta: string
    }
  | {
      // 事件类型。
      type: 'tool_started'
      // Agent 运行 ID。
      runId: string
      // 会话 ID。
      sessionId: string
      // 工具步骤 ID。
      id: string
      // 工具名称。
      name: string
      // 工具输入。
      input: unknown
    }
  | {
      // 事件类型。
      type: 'tool_finished'
      // Agent 运行 ID。
      runId: string
      // 会话 ID。
      sessionId: string
      // 工具步骤 ID。
      id: string
      // 工具名称。
      name: string
      // 工具观察。
      observation: string
      // 工具数据。
      data: unknown
    }
  | {
      // 事件类型。
      type: 'error'
      // Agent 运行 ID。
      runId: string
      // 会话 ID。
      sessionId: string
      // 错误信息。
      message: string
    }

// 页面使用的关联人物类型。
type AssociatedPersonItem = AssociatedPersonPayload & {
  // 人物唯一标识。
  id: string
  // 创建时间。
  createdAt: string
  // 更新时间。
  updatedAt: string
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

// 页面使用的片段类型。
type SnippetItem = {
  // 片段唯一标识。
  id: number
  // 片段所属日期。
  entryDate: string
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // 片段标签列表。
  tags: string[]
  // 列表展示时间。
  time: string
  // 创建时间。
  createdAt: string
  // 更新时间。
  updatedAt: string
}

// 页面使用的日记类型。
type JournalItem = {
  // 日记所属日期。
  entryDate: string
  // 日记正文。
  content: string
  // 创建时间。
  createdAt: string
  // 更新时间。
  updatedAt: string
}

// 单日数据类型。
type DayData = {
  // 当日待办列表。
  todos: TodoItem[]
  // 当日片段列表。
  snippets: SnippetItem[]
  // 当日日记。
  journal: JournalItem | null
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

// 整月概览类型.
type MonthOverview = {
  // 所属月份。
  month: string
  // 当月有记录的日期概览。
  entries: MonthEntryOverview[]
}

// 渲染进程安全 API 类型。
type AppAPI = {
  // 文件 API。
  files: {
    // 保存 Markdown 图片。
    saveMarkdownImage: (payload: MarkdownImageSavePayload) => Promise<MarkdownImageSaveResult>
    // 保存人物头像。
    savePeopleAvatar?: (payload: MarkdownImageSavePayload) => Promise<MarkdownImageSaveResult>
  }
  // Notes 页面 API。
  notes: {
    // 读取全部笔记。
    list: () => Promise<NoteMaterialItem[]>
    // 创建笔记。
    create: (draft: NoteDraftPayload) => Promise<NoteMaterialItem>
    // 更新笔记。
    update: (id: number, draft: NoteDraftPayload) => Promise<NoteMaterialItem>
    // 删除笔记。
    delete: (id: number) => Promise<void>
  }
  // Daily 页面 API。
  daily: {
    // 读取指定日期的 Daily 数据。
    listDay: (entryDate: string) => Promise<DayData>
    // 读取指定月份的 Daily 概览。
    listMonthOverview: (month: string) => Promise<MonthOverview>
    // 保存日记。
    saveJournal: (draft: JournalSavePayload) => Promise<JournalItem>
    // 删除日记。
    deleteJournal: (entryDate: string) => Promise<void>
    // 创建待办。
    createTodo: (draft: TodoCreatePayload) => Promise<TodoItem>
    // 更新待办。
    updateTodo: (id: number, draft: TodoUpdatePayload) => Promise<TodoItem>
    // 删除待办。
    deleteTodo: (id: number) => Promise<void>
    // 重排待办。
    sortTodos: (draft: TodoSortPayload) => Promise<TodoItem[]>
    // 创建片段。
    createSnippet: (draft: SnippetCreatePayload) => Promise<SnippetItem>
    // 更新片段。
    updateSnippet: (id: number, draft: SnippetUpdatePayload) => Promise<SnippetItem>
    // 删除片段。
    deleteSnippet: (id: number) => Promise<void>
  }
  // People 页面 API。
  people?: {
    // 读取全部关联人物。
    list: () => Promise<AssociatedPersonItem[]>
    // 创建关联人物。
    create: (draft: AssociatedPersonPayload) => Promise<AssociatedPersonItem>
    // 更新关联人物。
    update: (id: string, draft: AssociatedPersonPayload) => Promise<AssociatedPersonItem>
    // 删除关联人物。
    delete: (id: string) => Promise<void>
  }
  // AI 对话 API。
  ai?: {
    // 获取启用的 AI 模型选项。
    getModelOptions: () => Promise<AiModelOptionsResponse>
    // 启动 AI 对话。
    startChat: (payload: AiChatStartPayload) => Promise<{ runId: string }>
    // 监听 AI 对话事件。
    onChatEvent: (listener: (event: AiChatEvent) => void) => () => void
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
