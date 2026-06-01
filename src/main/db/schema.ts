import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// 笔记来源类型。
export type NoteSource = '随手速记' | '聊天粘贴' | '截图文字' | '会议摘要'

// 待办优先级类型。
export type TodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

// 笔记创建输入类型。
export type NoteCreateInput = {
  // 笔记标题。
  title: string
  // 笔记正文。
  content: string
  // 笔记来源。
  source: NoteSource
  // 笔记标签列表。
  tags: string[]
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
  // 笔记来源。
  source: NoteSource
  // 笔记标签列表。
  tags: string[]
  // 记录日期与时间。
  time: string
  // 是否已经被策展归档。
  isCurated: boolean
  // 主题线索提示。
  clue?: string
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
      kind: 'tool'
      // 对应工具步骤 ID。
      stepId: string
    }

// AI 工具步骤类型。
export type AiToolStep = {
  // 工具步骤唯一标识。
  id: string
  // 工具步骤标题。
  title: string
  // 工具步骤状态。
  status: AiAgentToolCallStatus
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
  // 会话摘要。
  summary: string
  // 会话时间。
  time: string
  // 会话状态文案。
  status: string
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

// 数据库笔记行类型。
export type NoteRow = {
  // 笔记唯一标识。
  id: number
  // 笔记标题。
  title: string
  // 笔记正文。
  content: string
  // 笔记来源。
  source: NoteSource
  // JSON 字符串标签列表。
  tags: string
  // 记录日期与时间。
  time: string
  // 是否已经被策展归档。
  is_curated: number
  // 主题线索提示。
  clue: string | null
}

// AI 对话会话数据库行。
export type AiChatSessionRow = {
  // 会话唯一标识。
  id: string
  // 会话标题。
  title: string
  // 会话摘要。
  summary: string
  // 会话状态。
  status: string
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
  // 创建时间。
  created_at: string
  // 更新时间。
  updated_at: string
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
  // 人物唯一标识。
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
  source: text('source').$type<NoteSource>().notNull(),
  tags: text('tags').notNull(),
  time: text('time').notNull(),
  isCurated: integer('is_curated').notNull().default(0),
  clue: text('clue')
})

// 待办 SQLite 表定义。
export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey(),
  entryDate: text('entry_date').notNull(),
  text: text('text').notNull(),
  priority: text('priority').$type<TodoPriority>().notNull(),
  completed: integer('completed').notNull().default(0),
  sortOrder: integer('sort_order').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// 片段 SQLite 表定义。
export const snippets = sqliteTable('snippets', {
  id: integer('id').primaryKey(),
  entryDate: text('entry_date').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  tags: text('tags').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// 日记 SQLite 表定义。
export const journals = sqliteTable('journals', {
  entryDate: text('entry_date').primaryKey(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// 关联人物 SQLite 表定义。
export const associatedPeople = sqliteTable('associated_people', {
  id: text('id').primaryKey(),
  avatar: text('avatar').notNull(),
  name: text('name').notNull(),
  gender: text('gender').notNull(),
  relationship: text('relationship').$type<PersonRelationship>().notNull(),
  status: text('status').notNull(),
  birthday: text('birthday').notNull(),
  contact: text('contact').notNull(),
  tags: text('tags').notNull(),
  details: text('details').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})
