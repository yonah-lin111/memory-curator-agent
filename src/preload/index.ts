import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 笔记草稿载荷类型。
type NoteDraftPayload = {
  // 笔记标题。
  title: string
  // 笔记正文。
  content: string
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

// 账单分类类型。
type BillCategory = 
  | '餐饮' | '交通' | '购物' | '娱乐' | '居住' | '医疗' | '教育' | '其他'
  | '工资' | '兼职' | '理财' | '礼金' | '报销' | '奖金' | '退款'

// 收支类型。
type BillType = 'expense' | 'income'

// 账单列表筛选。
type BillListFilters = {
  billDate?: string
  category?: BillCategory
  billType?: BillType
}

// 账单创建载荷。
type BillCreatePayload = {
  amount: number
  category: BillCategory
  billType: BillType
  billDate: string
  note: string
  tags: string[]
}

// 账单更新载荷。
type BillUpdatePayload = Partial<BillCreatePayload>

// 账单页面项。
type BillItem = {
  id: number
  amount: number
  category: BillCategory
  billType: BillType
  billDate: string
  note: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

// 今日账单摘要。
type BillTodaySummary = {
  expenseTotal: number
  incomeTotal: number
  recentItems: BillItem[]
}

// AI 对话 agent hint 类型。
type AiChatAgentHint = {
  // Agent 唯一标识。
  id: 'people' | 'todo' | 'snippets' | 'journal' | 'notes' | 'today'
  // 本轮 agent 优先级，数字越小越优先。
  priority: number
}

// AI 对话启动载荷类型。
type AiChatStartPayload = {
  // Agent 运行 ID。
  runId?: string
  // 用户消息 ID。
  userMessageId?: string
  // 助手消息 ID。
  assistantMessageId?: string
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
  // 本轮优先使用的 agent hints。
  agents?: AiChatAgentHint[]
}

type AiChatSessionListPayload = {
  query?: string
  limit?: number
  offset?: number
}

// AI Ask 回答载荷类型。
type AiAskAnswerPayload = {
  // Ask 请求唯一标识。
  requestId: string
  // 每个问题对应的答案列表。
  answers: string[][]
}

// AI 工具确认回答载荷类型。
type AiToolConfirmationAnswerPayload = {
  // 工具确认请求唯一标识。
  requestId: string
  // 用户确认动作。
  action: 'confirm' | 'cancel'
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

// Settings 页面模型选择配置。
type AiSettingsModelSelection = {
  // 模型所属 provider 标识。
  provider: string
  // 模型标识。
  model: string
}

// Settings 页面模型配置。
type AiSettingsModel = {
  // 模型唯一标识。
  id: string
  // 模型显示名。
  name: string
  // 模型能力限制。
  limit: {
    // 上下文窗口 token 上限。
    context: number
    // 输出 token 上限。
    output: number
  }
  // 模型输入输出模态。
  modalities: {
    // 支持的输入模态。
    input: string[]
    // 支持的输出模态。
    output: string[]
  }
}

// Settings 页面 provider 配置。
type AiSettingsProvider = {
  // Provider 唯一标识。
  id: string
  // Provider 传输格式。
  type: 'openai-compatible' | 'openai' | 'anthropic' | 'google'
  // Provider 显示名。
  name: string
  // Provider 连接参数。
  options: {
    // API Key。
    apiKey: string
    // API 基础地址。
    baseURL: string
  }
  // Provider 可用模型。
  models: Record<string, AiSettingsModel>
}

// Settings 页面完整 AI 配置。
type AiSettingsConfig = {
  // 配置文件绝对路径。
  configPath: string
  // 默认对话模型。
  defaultModel: AiSettingsModelSelection
  // 标题总结模型。
  titleSummary: AiSettingsModelSelection
  // 周度总结模型。
  weeklySummary: AiSettingsModelSelection
  // 已启用 provider 标识列表。
  enabledProviders: string[]
  // Provider 配置表。
  providers: Record<string, AiSettingsProvider>
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
      type: 'session_title_updated'
      // Agent 运行 ID。
      runId: string
      // 会话 ID。
      sessionId: string
      // AI 总结后的会话标题。
      title: string
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
type AiToolStepStatus = 'done' | 'failed' | 'running' | 'queued' | 'cancelled'

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
  | {
      // 片段唯一标识。
      id: string
      // 片段类型.
      kind: 'image'
      // 图片的本地协议地址。
      url: string
    }
  | {
      // 片段唯一标识。
      id: string
      // 片段类型。
      kind: 'text-file'
      // 文本文件的本地协议地址。
      url: string
      // 原始文件名。
      fileName: string
      // 文件大小（字节）。
      sizeBytes: number
    }
  | {
      // 片段唯一标识。
      id: string
      // 片段类型。
      kind: 'agent'
      // Agent 唯一标识。
      agentId: 'people' | 'todo' | 'snippets' | 'journal' | 'notes' | 'today' | 'common'
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
  // 工具调用摘要.
  toolSteps?: AiToolStep[]
  // 最终回答。
  answer?: string
  // 顺序片段。
  parts?: AiChatMessagePart[]
  // 调用的模型。
  model?: string
}

// AI 对话会话类型。
type AiChatSession = {
  // 会话唯一标识。
  id: string
  // 会话标题。
  title: string
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

// AI 聊天文本文件保存结果类型。
type AiChatTextFileSaveResult = {
  // 落盘文件名。
  fileName: string
  // 本机绝对路径。
  filePath: string
  // 可访问文本文件的应用 URL。
  url: string
  // 原始文件名。
  originalName: string
  // 文件大小（字节）。
  sizeBytes: number
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

// 周度总结项类型（preload 本地声明，与 main 的 WeeklySummaryItem 对齐）。
type WeeklySummaryItem = {
  id: number
  weekStartDate: string
  title: string
  content: string
  modelUsed: string | null
  generatedAt: string
  isMeaningful: number
}

// 周度总结保存载荷类型。
type WeeklySummarySavePayload = {
  weekStartDate: string
  title: string
  content: string
  modelUsed?: string | null
  generatedAt: string
}

// 周度总结生成载荷类型。
type WeeklySummaryGeneratePayload = {
  weekStartDate: string
  model?: string
  provider?: string
}

// 周度总结 delta 事件。
type WeeklySummaryDeltaEvent = {
  weekStartDate: string
  text: string
}

// 主题项类型（preload 本地声明，与 main 对齐）。
type ThemeItem = {
  id: number
  externalId: string
  name: string
  description: string
  color: string | null
  status: string
  createdAt: string
  updatedAt: string
}

// 主题创建载荷。
type ThemeCreateInput = {
  name: string
  description?: string
  color?: string | null
  status?: string
  aiGenerated?: number
}

// 主题更新载荷。
type ThemeUpdateInput = {
  name?: string
  description?: string
  color?: string | null
  status?: string
}

// 主题关联项类型。
type ThemeItemsItem = {
  id: number
  externalId: string
  themeExternalId: string
  sourceType: string
  sourceId: string
  relevanceNote: string
  aiExtracted: number
  createdAt: string
  sourceTitle?: string
  sourceContent?: string
  sourceEntryDate?: string
}

// 主题关联项创建载荷。
type ThemeItemsCreateInput = {
  themeExternalId: string
  sourceType: string
  sourceId: string
  relevanceNote?: string
  aiExtracted?: number
}

// 主题时间线节点。
type ThemeTimelineItem = {
  weekStartDate: string
  itemCount: number
  mentionedInSummary: boolean
}

// 渲染进程安全 API。
const api = {
  config: {
    ai: {
      get: (): Promise<AiSettingsConfig> => ipcRenderer.invoke('config:ai:get'),
      save: (payload: AiSettingsConfig): Promise<AiSettingsConfig> =>
        ipcRenderer.invoke('config:ai:save', payload)
    }
  },
  files: {
    saveMarkdownImage: (payload: MarkdownImageSavePayload): Promise<MarkdownImageSaveResult> =>
      ipcRenderer.invoke('files:markdown-image:save', payload),
    savePeopleAvatar: (payload: MarkdownImageSavePayload): Promise<MarkdownImageSaveResult> =>
      ipcRenderer.invoke('files:people-avatar:save', payload),
    saveAiChatImage: (payload: MarkdownImageSavePayload): Promise<MarkdownImageSaveResult> =>
      ipcRenderer.invoke('files:ai-chat-image:save', payload),
    saveAiChatTextFile: (payload: MarkdownImageSavePayload): Promise<AiChatTextFileSaveResult> =>
      ipcRenderer.invoke('files:ai-chat-text:save', payload),
    deleteAiChatTextFile: (fileName: string): Promise<void> =>
      ipcRenderer.invoke('files:ai-chat-text:delete', fileName),
    readAiChatTextFile: (url: string): Promise<string> =>
      ipcRenderer.invoke('files:ai-chat-text:read', url)
  },
  notes: {
    list: (categoryId?: number) => ipcRenderer.invoke('notes:list', categoryId),
    create: (draft: NoteDraftPayload & { categoryId?: number }) => ipcRenderer.invoke('notes:create', draft),
    update: (id: number, draft: NoteDraftPayload & { categoryId?: number }) => ipcRenderer.invoke('notes:update', id, draft),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id)
  },
  noteCategories: {
    list: () => ipcRenderer.invoke('note-categories:list'),
    create: (name: string) => ipcRenderer.invoke('note-categories:create', name),
    update: (id: number, name: string) => ipcRenderer.invoke('note-categories:update', id, name),
    delete: (id: number) => ipcRenderer.invoke('note-categories:delete', id)
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
    listSessions: (payload?: AiChatSessionListPayload): Promise<AiChatSession[]> =>
      ipcRenderer.invoke('ai:sessions:list', payload),
    getSession: (sessionId: string): Promise<AiChatSession | null> =>
      ipcRenderer.invoke('ai:session:get', sessionId),
    updateSessionTitle: (sessionId: string, title: string): Promise<void> =>
      ipcRenderer.invoke('ai:session:title:update', sessionId, title),
    deleteSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke('ai:session:delete', sessionId),
    undoLastTurn: (sessionId: string): Promise<AiChatSession | null> =>
      ipcRenderer.invoke('ai:session:turn:undo', sessionId),
    deleteTurn: (sessionId: string, messageId: string): Promise<AiChatSession | null> =>
      ipcRenderer.invoke('ai:session:turn:delete', sessionId, messageId),
    getModelOptions: (): Promise<AiModelOptionsResponse> =>
      ipcRenderer.invoke('ai:model-options:get'),
    listPromptHistory: (): Promise<string[]> =>
      ipcRenderer.invoke('ai:prompt-history:list'),
    addPromptHistory: (prompt: string): Promise<string[]> =>
      ipcRenderer.invoke('ai:prompt-history:add', prompt),
    startChat: (payload: AiChatStartPayload): Promise<{ runId: string }> =>
      ipcRenderer.invoke('ai:chat:start', payload),
    cancelChat: (runId: string): Promise<void> =>
      ipcRenderer.invoke('ai:chat:cancel', runId),
    cancelAsk: (runId: string): Promise<void> =>
      ipcRenderer.invoke('ai:chat:ask-cancel', runId),
    submitAskAnswer: (payload: AiAskAnswerPayload): Promise<void> =>
      ipcRenderer.invoke('ai:chat:ask-answer', payload),
    submitToolConfirmationAnswer: (payload: AiToolConfirmationAnswerPayload): Promise<void> =>
      ipcRenderer.invoke('ai:chat:tool-confirmation-answer', payload),
    onChatEvent: (listener: (event: AiChatEvent) => void): (() => void) => {
      const wrappedListener = (_: Electron.IpcRendererEvent, event: AiChatEvent): void => {
        listener(event)
      }

      ipcRenderer.on('ai:chat:event', wrappedListener)

      return () => {
        ipcRenderer.removeListener('ai:chat:event', wrappedListener)
      }
    }
  },
  weekly: {
    summary: {
      get: (weekStartDate: string): Promise<WeeklySummaryItem | null> =>
        ipcRenderer.invoke('weekly:summary:get', weekStartDate),
      save: (payload: WeeklySummarySavePayload): Promise<WeeklySummaryItem> =>
        ipcRenderer.invoke('weekly:summary:save', payload),
      delete: (weekStartDate: string): Promise<void> =>
        ipcRenderer.invoke('weekly:summary:delete', weekStartDate),
      generate: (payload: WeeklySummaryGeneratePayload): Promise<WeeklySummaryItem> =>
        ipcRenderer.invoke('weekly:summary:generate', payload),
      onDelta: (listener: (event: WeeklySummaryDeltaEvent) => void): (() => void) => {
        const wrapped = (_: Electron.IpcRendererEvent, event: WeeklySummaryDeltaEvent): void => {
          listener(event)
        }
        ipcRenderer.on('weekly:summary:delta', wrapped)
        return () => ipcRenderer.removeListener('weekly:summary:delta', wrapped)
      },
      onDone: (listener: (item: WeeklySummaryItem) => void): (() => void) => {
        const wrapped = (_: Electron.IpcRendererEvent, item: WeeklySummaryItem): void => {
          listener(item)
        }
        ipcRenderer.on('weekly:summary:done', wrapped)
        return () => ipcRenderer.removeListener('weekly:summary:done', wrapped)
      }
    }
  },
  themes: {
    list: (status?: string): Promise<ThemeItem[]> =>
      ipcRenderer.invoke('themes:list', status),
    get: (externalId: string): Promise<ThemeItem | null> =>
      ipcRenderer.invoke('themes:get', externalId),
    create: (input: ThemeCreateInput): Promise<ThemeItem> =>
      ipcRenderer.invoke('themes:create', input),
    update: (externalId: string, input: ThemeUpdateInput): Promise<ThemeItem> =>
      ipcRenderer.invoke('themes:update', externalId, input),
    delete: (externalId: string): Promise<void> =>
      ipcRenderer.invoke('themes:delete', externalId),
    listItems: (themeExternalId: string): Promise<ThemeItemsItem[]> =>
      ipcRenderer.invoke('themes:items:list', themeExternalId),
    addItem: (input: ThemeItemsCreateInput): Promise<ThemeItemsItem> =>
      ipcRenderer.invoke('themes:items:add', input),
    removeItem: (themeExternalId: string, sourceType: string, sourceId: string): Promise<void> =>
      ipcRenderer.invoke('themes:items:remove', themeExternalId, sourceType, sourceId),
    importFromTags: (tags: string[]): Promise<ThemeItem[]> =>
      ipcRenderer.invoke('themes:import-from-tags', tags),
    timeline: (themeExternalId: string): Promise<ThemeTimelineItem[]> =>
      ipcRenderer.invoke('themes:timeline', themeExternalId),
    updateDescription: (themeExternalId: string): Promise<void> =>
      ipcRenderer.invoke('themes:update-description', themeExternalId)
  },
  bill: {
    list: (filters?: BillListFilters): Promise<BillItem[]> =>
      ipcRenderer.invoke('bills:list', filters),
    create: (input: BillCreatePayload): Promise<BillItem> =>
      ipcRenderer.invoke('bills:create', input),
    update: (id: number, input: BillUpdatePayload): Promise<BillItem> =>
      ipcRenderer.invoke('bills:update', id, input),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('bills:delete', id),
    todaySummary: (date?: string): Promise<BillTodaySummary> =>
      ipcRenderer.invoke('bills:today-summary', date)
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
