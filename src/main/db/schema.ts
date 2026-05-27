import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// 笔记来源类型。
export type NoteSource = '随手速记' | '聊天粘贴' | '截图文字' | '会议摘要'

// 工作台待办优先级类型。
export type WorkspaceTodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

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

// 工作台待办创建输入类型。
export type WorkspaceTodoCreateInput = {
  // 待办所属日期。
  entryDate: string
  // 待办文本。
  text: string
  // 待办优先级。
  priority: WorkspaceTodoPriority
}

// 工作台待办更新输入类型。
export type WorkspaceTodoUpdateInput = {
  // 待办文本。
  text: string
  // 待办优先级。
  priority: WorkspaceTodoPriority
  // 是否完成。
  completed: boolean
}

// 工作台待办排序输入类型。
export type WorkspaceTodoReorderInput = {
  // 待办所属日期。
  entryDate: string
  // 排序后的待办 ID 列表。
  ids: string[]
}

// 工作台片段创建输入类型。
export type WorkspaceSnippetCreateInput = {
  // 片段所属日期。
  entryDate: string
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // 片段标签列表。
  tags: string[]
}

// 工作台片段更新输入类型。
export type WorkspaceSnippetUpdateInput = {
  // 片段标题。
  title: string
  // 片段正文。
  content: string
  // 片段标签列表。
  tags: string[]
}

// 工作台日记保存输入类型。
export type WorkspaceJournalSaveInput = {
  // 日记所属日期。
  entryDate: string
  // 日记正文。
  content: string
}

// 页面使用的笔记类型。
export type NoteMaterialItem = {
  // 笔记唯一标识。
  id: string
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

// 页面使用的工作台待办类型。
export type WorkspaceTodoItem = {
  // 待办唯一标识。
  id: string
  // 待办所属日期。
  entryDate: string
  // 待办文本。
  text: string
  // 是否完成。
  completed: boolean
  // 当前优先级。
  priority: WorkspaceTodoPriority
  // 排序序号。
  sortOrder: number
  // 创建时间。
  createdAt: string
  // 更新时间。
  updatedAt: string
}

// 页面使用的工作台片段类型。
export type WorkspaceSnippetItem = {
  // 片段唯一标识。
  id: string
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

// 页面使用的工作台日记类型。
export type WorkspaceJournalItem = {
  // 日记所属日期。
  entryDate: string
  // 日记正文。
  content: string
  // 创建时间。
  createdAt: string
  // 更新时间。
  updatedAt: string
}

// 工作台单日数据类型。
export type WorkspaceDayData = {
  // 当日待办列表。
  todos: WorkspaceTodoItem[]
  // 当日片段列表。
  snippets: WorkspaceSnippetItem[]
  // 当日日记。
  journal: WorkspaceJournalItem | null
}

// 数据库笔记行类型。
export type NoteRow = {
  // 笔记唯一标识。
  id: string
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

// 工作台待办数据库行类型。
export type WorkspaceTodoRow = {
  // 待办唯一标识。
  id: string
  // 待办所属日期。
  entry_date: string
  // 待办文本。
  text: string
  // 待办优先级。
  priority: WorkspaceTodoPriority
  // 是否完成。
  completed: number
  // 排序序号。
  sort_order: number
  // 创建时间。
  created_at: string
  // 更新时间。
  updated_at: string
}

// 工作台片段数据库行类型。
export type WorkspaceSnippetRow = {
  // 片段唯一标识。
  id: string
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

// 工作台日记数据库行类型。
export type WorkspaceJournalRow = {
  // 日记所属日期。
  entry_date: string
  // 日记正文。
  content: string
  // 创建时间。
  created_at: string
  // 更新时间。
  updated_at: string
}

// 笔记 SQLite 表定义。
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
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
  id: text('id').primaryKey(),
  entryDate: text('entry_date').notNull(),
  text: text('text').notNull(),
  priority: text('priority').$type<WorkspaceTodoPriority>().notNull(),
  completed: integer('completed').notNull().default(0),
  sortOrder: integer('sort_order').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// 片段 SQLite 表定义。
export const snippets = sqliteTable('snippets', {
  id: text('id').primaryKey(),
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
