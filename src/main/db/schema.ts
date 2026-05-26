import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// 笔记来源类型。
export type NoteSource = '随手速记' | '聊天粘贴' | '截图文字' | '会议摘要'

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
