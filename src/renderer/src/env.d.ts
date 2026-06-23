/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'

// 待办优先级类型。
type TodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

/** 主题项 */
type ThemeItem = {
  id: number
  externalId: string
  name: string
  description: string
  color: string | null
  status: string
  createdAt: string
  updatedAt: string
  itemCount?: number
}

/** 主题创建输入 */
type ThemeCreateInput = {
  name: string
  description?: string
  color?: string | null
  status?: string
}

/** 主题更新输入 */
type ThemeUpdateInput = {
  name?: string
  description?: string
  color?: string | null
  status?: string
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

/** 主题素材关联项 */
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

/** 主题素材关联创建输入 */
type ThemeItemsCreateInput = {
  themeExternalId: string
  sourceType: string
  sourceId: string
  relevanceNote?: string
  aiExtracted?: number
}

/** 主题时间线节点 */
type ThemeTimelineItem = {
  weekStartDate: string
  itemCount: number
  mentionedInSummary: boolean
}

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
  // 笔记标签列表。
  tags: string[]
  // 分类 ID。
  categoryId?: number
}

// 页面使用的笔记类型。
type NoteMaterialItem = NoteDraftPayload & {
  // 笔记唯一标识。
  id: number
  // 记录日期与时间。
  time: string
  // 分类名称。
  categoryName?: string
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

// AI 对话 agent hint 类型。
type AiChatAgentHint = {
  // Agent 唯一标识。
  id: 'people' | 'todo' | 'snippets' | 'journal' | 'notes' | 'today' | 'common'
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
  // 用户消息片段。
  parts?: AiChatMessagePart[]
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

// AI 会话列表查询载荷。
type AiChatSessionListPayload = {
  // 搜索标题或摘要的关键词。
  query?: string
  // 最大返回数量。
  limit?: number
  // 跳过数量。
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
      // 上游 reasoning 事件标识，用于合并同一连续流式段。
      sourceId?: string
      // 片段类型。
      kind: 'reasoning'
      // Markdown 思考内容。
      content: string
      // 思考片段状态。
      status?: 'streaming' | 'done'
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
      // 片段类型。
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
  // 工具调用摘要。
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
  // 日记唯一标识。
  id: number
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

// 周度总结项类型（与 main/preload 对齐）。
type WeeklySummaryItem = {
  // 自增主键。
  id: number
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  weekStartDate: string
  // 总结类型：'summary' | 'interpersonal'。
  type: string
  // 总结标题。
  title: string
  // 总结正文，Markdown 格式。
  content: string
  // 生成所用模型标识。
  modelUsed: string | null
  // 生成时间，格式 'YYYY-MM-DD HH:mm'。
  generatedAt: string
  // 是否为有意义内容（1=有，0=无），用于前端兜底展示。
  isMeaningful: number
}

// 周度总结保存载荷类型。
type WeeklySummarySavePayload = {
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  weekStartDate: string
  // 总结标题。
  title: string
  // 总结正文，Markdown 格式。
  content: string
  // 生成所用模型标识。
  modelUsed?: string | null
  // 生成时间，格式 'YYYY-MM-DD HH:mm'。
  generatedAt: string
}

// 周度总结生成载荷类型。
type WeeklySummaryGeneratePayload = {
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  weekStartDate: string
  // 可选模型标识。
  model?: string
  // 可选 provider 标识。
  provider?: string
}

// 周度总结 delta 事件。
type WeeklySummaryDeltaEvent = {
  // delta 文本。
  text: string
}

// 渲染进程安全 API 类型。
type AppAPI = {
  // 配置文件 API。
  config?: {
    // AI Settings 配置 API。
    ai: {
      // 读取 AI Settings。
      get: () => Promise<AiSettingsConfig>
      // 保存 AI Settings。
      save: (payload: AiSettingsConfig) => Promise<AiSettingsConfig>
    }
  }
  // 文件 API。
  files: {
    // 保存 Markdown 图片。
    saveMarkdownImage: (payload: MarkdownImageSavePayload) => Promise<MarkdownImageSaveResult>
    // 保存人物头像。
    savePeopleAvatar?: (payload: MarkdownImageSavePayload) => Promise<MarkdownImageSaveResult>
    // 保存 AI 聊天图片。
    saveAiChatImage?: (payload: MarkdownImageSavePayload) => Promise<MarkdownImageSaveResult>
    // 保存 AI 聊天文本文件。
    saveAiChatTextFile?: (payload: MarkdownImageSavePayload) => Promise<AiChatTextFileSaveResult>
    // 删除 AI 聊天文本文件。
    deleteAiChatTextFile?: (fileName: string) => Promise<void>
    // 读取 AI 聊天文本文件内容。
    readAiChatTextFile?: (url: string) => Promise<string>
  }
  // Notes 页面 API。
  notes: {
    // 读取笔记，可按分类筛选。
    list: (categoryId?: number) => Promise<NoteMaterialItem[]>
    // 创建笔记。
    create: (draft: NoteDraftPayload) => Promise<NoteMaterialItem>
    // 更新笔记。
    update: (id: number, draft: NoteDraftPayload) => Promise<NoteMaterialItem>
    // 删除笔记。
    delete: (id: number) => Promise<void>
  }
  // Note 分类 API。
  noteCategories: {
    // 读取全部分类。
    list: () => Promise<Array<{ id: number; name: string; sortOrder: number }>>
    // 创建分类。
    create: (name: string) => Promise<{ id: number; name: string; sortOrder: number }>
    // 更新分类名称。
    update: (id: number, name: string) => Promise<{ id: number; name: string; sortOrder: number }>
    // 删除分类。
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
    // 读取持久化 AI 会话列表。
    listSessions?: (payload?: AiChatSessionListPayload) => Promise<AiChatSession[]>
    // 读取持久化 AI 会话详情。
    getSession?: (sessionId: string) => Promise<AiChatSession | null>
    // 更新持久化 AI 会话标题。
    updateSessionTitle?: (sessionId: string, title: string) => Promise<void>
    // 删除持久化 AI 会话。
    deleteSession?: (sessionId: string) => Promise<void>
    // 撤销当前会话最后一轮对话。
    undoLastTurn?: (sessionId: string) => Promise<AiChatSession | null>
    // 删除指定消息所属的一轮 QA。
    deleteTurn?: (sessionId: string, messageId: string) => Promise<AiChatSession | null>
    // 获取启用的 AI 模型选项。
    getModelOptions: () => Promise<AiModelOptionsResponse>
    // 读取历史提示词列表。
    listPromptHistory?: () => Promise<string[]>
    // 保存历史提示词。
    addPromptHistory?: (prompt: string) => Promise<string[]>
    // 启动 AI 对话。
    startChat: (payload: AiChatStartPayload) => Promise<{ runId: string }>
    // 取消 AI 对话。
    cancelChat?: (runId: string) => Promise<void>
    // 取消 AI 对话中等待用户回答的 Ask。
    cancelAsk?: (runId: string) => Promise<void>
    // 提交 Ask 回答。
    submitAskAnswer?: (payload: AiAskAnswerPayload) => Promise<void>
    // 提交工具确认回答。
    submitToolConfirmationAnswer?: (payload: AiToolConfirmationAnswerPayload) => Promise<void>
    // 监听 AI 对话事件。
    onChatEvent: (listener: (event: AiChatEvent) => void) => () => void
  }
  // 周度总结 API。
  weekly?: {
    // 周度总结服务。
    summary: {
      // 按周起始日期查询总结。
      get: (weekStartDate: string) => Promise<WeeklySummaryItem | null>
      // 保存（upsert）总结。
      save: (payload: WeeklySummarySavePayload) => Promise<WeeklySummaryItem>
      // 删除总结。
      delete: (weekStartDate: string) => Promise<void>
      // AI 流式生成总结。
      generate: (payload: WeeklySummaryGeneratePayload) => Promise<WeeklySummaryItem>
      // 监听流式生成 delta 事件。
      onDelta: (listener: (event: WeeklySummaryDeltaEvent) => void) => () => void
      // 监听流式生成完成事件。
      onDone: (listener: (item: WeeklySummaryItem) => void) => () => void
    }
  }
  /** 主题追踪 API */
  themes?: {
    /** 列出所有主题 */
    list: (status?: string) => Promise<ThemeItem[]>
    /** 获取单个主题 */
    get: (externalId: string) => Promise<ThemeItem | null>
    /** 创建主题 */
    create: (input: ThemeCreateInput) => Promise<ThemeItem>
    /** 更新主题 */
    update: (externalId: string, input: ThemeUpdateInput) => Promise<ThemeItem>
    /** 删除主题 */
    delete: (externalId: string) => Promise<void>
    /** 获取某主题的所有关联素材 */
    listItems: (themeExternalId: string) => Promise<ThemeItemsItem[]>
    /** 添加主题素材关联 */
    addItem: (input: ThemeItemsCreateInput) => Promise<ThemeItemsItem>
    /** 移除主题素材关联 */
    removeItem: (themeExternalId: string, sourceType: string, sourceId: string) => Promise<void>
    /** 从标签批量导入主题种子 */
    importFromTags: (tags: string[]) => Promise<ThemeItem[]>
    /** 获取某主题跨周时间线 */
    timeline: (themeExternalId: string) => Promise<ThemeTimelineItem[]>
    /** 用 AI 更新主题描述 */
    updateDescription: (themeExternalId: string) => Promise<void>
  }
  /** 账单 API */
  bill?: {
    /** 列出账单 */
    list: (filters?: BillListFilters) => Promise<BillItem[]>
    /** 创建账单 */
    create: (input: BillCreatePayload) => Promise<BillItem>
    /** 更新账单 */
    update: (id: number, input: BillUpdatePayload) => Promise<BillItem>
    /** 删除账单 */
    delete: (id: number) => Promise<void>
    /** 指定日期账单摘要，不传则取今日 */
    todaySummary: (date?: string) => Promise<BillTodaySummary>
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
