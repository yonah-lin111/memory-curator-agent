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
    // 来源对象标识。
    sourceId?: string
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

// AI Agent 上下文治理选项。
type AiAgentContextPolicyOption = {
  // 单条工具 observation 最大字符数。
  toolOutputMaxChars: number
  // 最近保留完整工具结果的数量。
  recentToolResultLimit: number
}

// AI Agent 选项。
type AiAgentOption = {
  // 上下文治理选项。
  context: AiAgentContextPolicyOption
}

// AI 模型配置响应。
type AiModelOptionsResponse = {
  // 默认 provider 标识。
  defaultProvider: string
  // 默认模型标识。
  defaultModel: string
  // 已启用 provider 与模型。
  providers: AiModelProviderOption[]
  // Agent 非密钥行为配置。
  agent: AiAgentOption
}

// AI 工具步骤事件状态。
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
      type: 'tool_failed'
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
      // 工具错误信息。
      error: string
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

// AI 工具步骤状态类型。
type AiToolStepStatus = 'done' | 'failed' | 'running' | 'queued'

// AI 对话会话状态类型。
type AiChatSessionStatus = 'idle' | 'running' | 'completed' | 'failed'

// AI 工具步骤类型。
type AiToolStep = {
  // 工具步骤唯一标识。
  id: string
  // 工具步骤标题。
  title: string
  // 工具步骤状态。
  status: AiToolStepStatus
  // 工具名称。
  tool: string
  // 工具输入参数。
  input?: unknown
  // 面向用户展示的执行观察摘要。
  observation: string
  // 工具返回的结构化数据。
  data?: unknown
}

// AI 消息片段类型。
type AiChatMessagePart =
  | {
      // 片段唯一标识。
      id: string
      // 片段类型。
      kind: 'text'
      // Markdown 文本内容。
      content: string
    }
  | {
      // 片段唯一标识。
      id: string
      // 片段类型。
      kind: 'tool'
      // 对应工具步骤 ID。
      stepId: string
    }

// AI 对话消息类型。
type AiChatMessage = {
  // 消息唯一标识。
  id: string
  // 消息发送者。
  role: 'user' | 'assistant'
  // 消息正文。
  content: string
  // 消息显示时间。
  time: string
  // 工具调用摘要。
  toolSteps?: AiToolStep[]
  // 最终回答。
  answer?: string
  // 顺序片段。
  parts?: AiChatMessagePart[]
}

// AI 对话会话类型。
type AiChatSession = {
  // 会话唯一标识。
  id: string
  // 会话标题。
  title: string
  // 会话摘要。
  summary: string
  // 会话时间。
  time: string
  // 会话状态。
  status: AiChatSessionStatus
  // 会话消息列表。
  messages: AiChatMessage[]
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
  },
  ai: {
    listSessions: (): Promise<AiChatSession[]> => ipcRenderer.invoke('ai:sessions:list'),
    getSession: (sessionId: string): Promise<AiChatSession | null> =>
      ipcRenderer.invoke('ai:session:get', sessionId),
    updateSessionTitle: (sessionId: string, title: string): Promise<void> =>
      ipcRenderer.invoke('ai:session:title:update', sessionId, title),
    deleteSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke('ai:session:delete', sessionId),
    getModelOptions: (): Promise<AiModelOptionsResponse> =>
      ipcRenderer.invoke('ai:model-options:get'),
    startChat: (payload: AiChatStartPayload): Promise<{ runId: string }> =>
      ipcRenderer.invoke('ai:chat:start', payload),
    onChatEvent: (listener: (event: AiChatEvent) => void): (() => void) => {
      const wrappedListener = (_: Electron.IpcRendererEvent, event: AiChatEvent): void => {
        listener(event)
      }

      ipcRenderer.on('ai:chat:event', wrappedListener)

      return () => {
        ipcRenderer.removeListener('ai:chat:event', wrappedListener)
      }
    }
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
