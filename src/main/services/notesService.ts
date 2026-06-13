import type { NoteCreateInput, NoteMaterialItem, NoteRow, NoteUpdateInput } from '@/db/schema'

// 数据库语句接口。
export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// Notes 服务依赖的最小数据库接口。
export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
}

// Notes 服务方法集合。
export type NotesService = {
  // 读取全部笔记。
  list: () => NoteMaterialItem[]
  // 创建笔记。
  create: (input: NoteCreateInput) => NoteMaterialItem
  // 更新笔记。
  update: (id: number, input: NoteUpdateInput) => NoteMaterialItem
  // 删除笔记。
  delete: (id: number) => void
  // 执行只读 SQL 查询。
  querySql: (sql: string) => unknown[]
}

/**
 * 提取 SQLite 自增主键。
 */
const getInsertedRowId = (result: unknown): number => {
  const rowId = (result as { lastInsertRowid?: number | bigint } | undefined)?.lastInsertRowid

  if (typeof rowId === 'bigint') {
    return Number(rowId)
  }

  if (typeof rowId === 'number') {
    return rowId
  }

  throw new Error('无法读取新建笔记的主键')
}

/**
 * 生成页面显示时间。
 */
const createDisplayTime = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${date} ${hours}:${minutes}`
}

/**
 * 解析数据库标签字段。
 */
const parseStoredTags = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.filter((tag): tag is string => typeof tag === 'string')
}

/**
 * 校验笔记输入。
 */
const validateNoteInput = (input: NoteCreateInput | NoteUpdateInput): void => {
  if (!input.title.trim() || !input.content.trim()) {
    throw new Error('笔记标题和正文不能为空')
  }

  if (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error('笔记标签格式不正确')
  }
}

/**
 * 将数据库行映射为页面笔记。
 */
const mapNoteRow = (row: NoteRow): NoteMaterialItem => ({
  id: row.id,
  title: row.title,
  content: row.content,
  source: row.source,
  tags: parseStoredTags(row.tags),
  time: row.time,
  isCurated: row.is_curated === 1,
  clue: row.clue ?? undefined
})

/**
 * 创建 Notes 服务。
 */
export const createNotesService = (database: DatabaseConnection): NotesService => ({
  list: () => {
    const rows = database
      .prepare(
        'SELECT id, title, content, source, tags, time, is_curated, clue FROM notes ORDER BY time DESC, id DESC'
      )
      .all() as NoteRow[]

    return rows.map(mapNoteRow)
  },
  create: (input) => {
    validateNoteInput(input)

    const inserted = database
      .prepare(
        'INSERT INTO notes (title, content, source, tags, time, is_curated, clue) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.title.trim(),
        input.content.trim(),
        input.source,
        JSON.stringify(input.tags),
        createDisplayTime(),
        0,
        '可能关联主题「Markdown 新素材」'
      )
    const row = database
      .prepare('SELECT id, title, content, source, tags, time, is_curated, clue FROM notes WHERE id = ?')
      .get(getInsertedRowId(inserted)) as NoteRow | undefined

    if (!row) {
      throw new Error('新建笔记后读取失败')
    }

    return mapNoteRow(row)
  },
  update: (id, input) => {
    validateNoteInput(input)

    database
      .prepare('UPDATE notes SET title = ?, content = ?, source = ?, tags = ? WHERE id = ?')
      .run(input.title.trim(), input.content.trim(), input.source, JSON.stringify(input.tags), id)

    const row = database
      .prepare('SELECT id, title, content, source, tags, time, is_curated, clue FROM notes WHERE id = ?')
      .get(id) as NoteRow | undefined

    if (!row) {
      throw new Error('笔记不存在')
    }

    return mapNoteRow(row)
  },
  delete: (id) => {
    database.prepare('DELETE FROM notes WHERE id = ?').run(id)
  },
  querySql: (sql) => {
    return database.prepare(sql).all()
  }
})
