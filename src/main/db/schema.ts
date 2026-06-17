import { customType, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// SQLite 时间戳字段类型。
const timestamp = customType<{ data: string; driverData: string }>({
  dataType: () => 'timestamp'
})

// 待办优先级类型。
export type TodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

// 笔记创建输入类型。
export type NoteCreateInput = {
  // 笔记标题。
  title: string
  // 笔记正文。
  content: string
  // 笔记标签列表。
  tags: string[]
  // 分类 ID。
  categoryId?: number
}

// 笔记更新输入类型。
export type NoteUpdateInput = NoteCreateInput

// 待办创建输入类型。
export type TodoCreateInput = {
  // 待办所属日期。
  entryDate: string
  // 待办文本。
  text: string
  // 待办优先级。
  priority: TodoPriority
}

// 待办更新输入类型。
export type TodoUpdateInput = {
  // 待办文本。
  text: string
  // 待办优先级。
  priority: TodoPriority
  // 是否完成。
  completed: boolean
  // 待办所属日期。可选，不传则保持原日期。
  entryDate?: string
  // 排序序号。可选，不传则保持原序号。
  sortOrder?: number
}

// 待办排序输入类型。
export type TodoReorderInput = {
  // 待办所属日期。
  entryDate: string
  // 排序后的待办 ID 列表。
  ids: number[]
}

// 片段创建输入类型。
export type SnippetCreateInput = {
  // 片段所属日期。
  entryDate: string
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // 片段标签列表。
  tags: string[]
}

// 片段更新输入类型。
export type SnippetUpdateInput = {
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // 片段标签列表。
  tags: string[]
}

// 日记保存输入类型。
export type JournalSaveInput = {
  // 日记所属日期。
  entryDate: string
  // 日记正文。
  content: string
}

// 人物关系类型。
export type PersonRelationship = '女朋友' | '家人' | '朋友' | '同事' | '其他'

// 关联人物创建输入类型。
export type AssociatedPersonCreateInput = {
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

// 关联人物更新输入类型。
export type AssociatedPersonUpdateInput = AssociatedPersonCreateInput

// 页面使用的笔记类型。
export type NoteMaterialItem = {
  // 笔记唯一标识。
  id: number
  // 笔记标题。
  title: string
  // 笔记正文。
  content: string
  // 笔记标签列表。
  tags: string[]
  // 记录日期与时间。
  time: string
  // 分类 ID。
  categoryId?: number
  // 分类名称。
  categoryName?: string
}

// 页面使用的待办类型。
export type TodoItem = {
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

// 页面使用的片段类型。
export type SnippetItem = {
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
export type JournalItem = {
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

// 页面使用的关联人物类型。
export type AssociatedPersonItem = AssociatedPersonCreateInput & {
  // 人物唯一标识。
  id: string
  // 创建时间。
  createdAt: string
  // 更新时间。
  updatedAt: string
}

// AI 对话消息角色。
export type AiChatMessageRole = 'user' | 'assistant'

// AI Agent run 状态。
export type AiAgentRunStatus = 'running' | 'completed' | 'failed'

// AI 对话会话状态。
export type AiChatSessionStatus = 'idle' | AiAgentRunStatus

// AI 工具调用状态。
export type AiAgentToolCallStatus = 'running' | 'done' | 'failed'

// AI 消息片段类型。
export type AiChatMessagePart =
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
      kind: 'reasoning'
      // Markdown 思考内容。
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
      fileName?: string
      // 文件大小（字节）。
      sizeBytes?: number
    }
  | {
      // 片段唯一标识。
      id: string
      // 片段类型。
      kind: 'agent'
      // Agent 唯一标识。
      agentId: 'people' | 'todo' | 'snippets' | 'journal' | 'notes' | 'today' | 'common'
    }

// AI 工具步骤类型。
export type AiToolStep = {
  // 工具步骤唯一标识。
  id: string
  // 工具步骤标题。
  title: string
  // 工具步骤状态。
  status: AiAgentToolCallStatus | 'cancelled'
  // 工具名称。
  tool: string
  // 工具输入参数。
  input?: unknown
  // 面向用户展示的执行观察摘要。
  observation: string
  // 工具返回的结构化数据。
  data?: unknown
}

// AI 对话会话类型。
export type AiChatSessionItem = {
  // 会话唯一标识。
  id: string
  // 会话标题。
  title: string
  // 会话时间。
  time: string
  // 会话状态。
  status: AiChatSessionStatus
  // 会话消息列表。
  messages: AiChatMessageItem[]
}

// AI 对话消息类型。
export type AiChatMessageItem = {
  // 消息唯一标识。
  id: string
  // 消息发送者。
  role: AiChatMessageRole
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
  // 是否已被用户主动取消。
  cancelled?: boolean
}

// 单日数据类型。
export type DayData = {
  // 当日待办列表。
  todos: TodoItem[]
  // 当日片段列表。
  snippets: SnippetItem[]
  // 当日日记。
  journal: JournalItem | null
}

// 单日聚合概览类型。
export type MonthEntryOverview = {
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
export type MonthOverview = {
  // 所属月份。
  month: string
  // 当月有记录的日期概览。
  entries: MonthEntryOverview[]
}

// 数据库分类行类型。
export type NoteCategoryRow = {
  // 分类唯一标识。
  id: number
  // 分类名称。
  name: string
  // 排序序号。
  sort_order: number
}

// 页面使用的分类类型。
export type NoteCategoryItem = {
  // 分类唯一标识。
  id: number
  // 分类名称。
  name: string
  // 排序序号。
  sortOrder: number
}

// 数据库笔记行类型。
export type NoteRow = {
  // 笔记唯一标识。
  id: number
  // 笔记标题。
  title: string
  // 笔记正文。
  content: string
  // JSON 字符串标签列表。
  tags: string
  // 记录日期与时间。
  time: string
  // 分类 ID。
  category_id: number | null
  // 分类名称（JOIN 填充）。
  category_name: string | null
}

// AI 对话会话数据库行。
export type AiChatSessionRow = {
  // 会话唯一标识。
  id: string
  // 会话标题。
  title: string
  // 会话状态。
  status: AiChatSessionStatus
  // 创建时间。
  created_at: string
  // 更新时间。
  updated_at: string
  // 最近消息时间。
  last_message_at: string
}

// AI 对话消息数据库行。
export type AiChatMessageRow = {
  // 消息唯一标识。
  id: string
  // 所属会话标识。
  session_id: string
  // 消息角色。
  role: AiChatMessageRole
  // 消息正文。
  content: string
  // 助手最终回答。
  answer: string | null
  // 顺序片段 JSON。
  parts_json: string
  // 工具步骤 JSON。
  tool_steps_json: string
  // 展示时间。
  time: string
  // 模型。
  model?: string | null
  // 创建时间。
  created_at: string
  // 更新时间。
  updated_at: string
  // 是否已被用户主动取消（0 = 否，1 = 是）。
  cancelled: number
}

// 待办数据库行类型。
export type TodoRow = {
  // 待办唯一标识。
  id: number
  // 待办所属日期。
  entry_date: string
  // 待办文本。
  text: string
  // 待办优先级。
  priority: TodoPriority
  // 是否完成。
  completed: number
  // 排序序号。
  sort_order: number
  // 创建时间。
  created_at: string
  // 更新时间。
  updated_at: string
}

// 片段数据库行类型。
export type SnippetRow = {
  // 片段唯一标识。
  id: number
  // 片段所属日期。
  entry_date: string
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // JSON 字符串标签列表。
  tags: string
  // 创建时间。
  created_at: string
  // 更新时间。
  updated_at: string
}

// 日记数据库行类型。
export type JournalRow = {
  // 日记唯一标识。
  id: number
  // 日记所属日期。
  entry_date: string
  // 日记正文。
  content: string
  // 创建时间。
  created_at: string
  // 更新时间。
  updated_at: string
}

// 关联人物数据库行类型。
export type AssociatedPersonRow = {
  // 人物业务标识。
  id: string
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
  // JSON 字符串标签列表。
  tags: string
  // Markdown 详细档案。
  details: string
  // 创建时间。
  created_at: string
  // 更新时间。
  updated_at: string
}

// 笔记 SQLite 表定义。
export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  tags: text('tags').notNull(),
  time: timestamp('time').notNull(),
  categoryId: integer('category_id')
})

// 笔记分类 SQLite 表定义。
export const noteCategories = sqliteTable('note_categories', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0)
})

// 待办 SQLite 表定义。
export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey(),
  entryDate: text('entry_date').notNull(),
  text: text('text').notNull(),
  priority: text('priority').$type<TodoPriority>().notNull(),
  completed: integer('completed').notNull().default(0),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
})

// 片段 SQLite 表定义。
export const snippets = sqliteTable('snippets', {
  id: integer('id').primaryKey(),
  entryDate: text('entry_date').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  tags: text('tags').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
})

// 日记 SQLite 表定义。
export const journals = sqliteTable('journals', {
  id: integer('id').primaryKey(),
  entryDate: text('entry_date').notNull().unique(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
})

// 关联人物 SQLite 表定义。
// 周度总结数据库行类型。
export type WeeklySummaryRow = {
  // 自增主键。
  id: number
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  week_start_date: string
  // 总结类型：'summary' 周度总结 | 'interpersonal' 人际策展。
  type: string
  // 总结标题。
  title: string
  // 总结正文，Markdown 格式。
  content: string
  // 生成所用模型标识。
  model_used: string | null
  // 生成时间，格式 'YYYY-MM-DD HH:mm'。
  generated_at: string
  // 是否为有意义内容（1=有，0=无），用于前端兜底展示。
  is_meaningful: number
}

// 页面使用的周度总结类型。
export type WeeklySummaryItem = {
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

// 周度总结保存输入类型。
export type WeeklySummarySaveInput = {
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  weekStartDate: string
  // 总结类型：'summary' | 'interpersonal'，默认 'summary'。
  type?: string
  // 总结标题。
  title: string
  // 总结正文，Markdown 格式。
  content: string
  // 生成所用模型标识。
  modelUsed?: string | null
  // 生成时间，格式 'YYYY-MM-DD HH:mm'。
  generatedAt: string
  // 是否为有意义内容（1=有，0=无）。
  isMeaningful?: number
}

export const associatedPeople = sqliteTable('associated_people', {
  id: integer('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  avatar: text('avatar').notNull(),
  name: text('name').notNull(),
  gender: text('gender').notNull(),
  relationship: text('relationship').$type<PersonRelationship>().notNull(),
  status: text('status').notNull(),
  birthday: text('birthday').notNull(),
  contact: text('contact').notNull(),
  tags: text('tags').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
})
