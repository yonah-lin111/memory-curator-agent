# Note 分类功能 & 策展代码清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 NotesPage 添加持久化分类 CRUD 功能，同时清理废弃的策展/主题线索代码。

**Architecture:** 新建 `note_categories` 独立表，通过 `notes.category_id` 外键关联。后端分层 schema → service → IPC → preload → agent tools 完整闭环。前端右侧面板从统计改为内联编辑的分类卡片列表。

**Tech Stack:** Electron, Drizzle ORM, BetterSQLite3, React, TypeScript

---

### Task 1: Schema — 新建 `note_categories` 表与更新 `notes` 表

**Files:**
- Modify: `src/main/db/schema.ts:354-557`

- [ ] **Step 1: 新增 `noteCategoryRow` 与 `NoteCategoryItem` 类型定义**

在 `NoteRow` 类型前面插入：

```ts
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
```

- [ ] **Step 2: 更新 `NoteMaterialItem` 类型**

将旧的：
```ts
export type NoteMaterialItem = {
  id: number
  title: string
  content: string
  source: NoteSource
  tags: string[]
  time: string
  isCurated: boolean
  clue?: string
}
```

改为：
```ts
export type NoteMaterialItem = {
  id: number
  title: string
  content: string
  source: NoteSource
  tags: string[]
  time: string
  categoryId?: number
  categoryName?: string
}
```

- [ ] **Step 3: 更新 `NoteRow` 类型**

将旧的：
```ts
export type NoteRow = {
  id: number
  title: string
  content: string
  source: NoteSource
  tags: string
  time: string
  is_curated: number
  clue: string | null
}
```

改为：
```ts
export type NoteRow = {
  id: number
  title: string
  content: string
  source: NoteSource
  tags: string
  time: string
  category_id: number | null
  category_name: string | null
}
```

- [ ] **Step 4: 更新 `notes` 表定义**

将旧的：
```ts
export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  source: text('source').$type<NoteSource>().notNull(),
  tags: text('tags').notNull(),
  time: timestamp('time').notNull(),
  isCurated: integer('is_curated').notNull().default(0),
  clue: text('clue')
})
```

改为：
```ts
export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  source: text('source').$type<NoteSource>().notNull(),
  tags: text('tags').notNull(),
  time: timestamp('time').notNull(),
  categoryId: integer('category_id')
})
```

- [ ] **Step 5: 在 `notes` 表定义之后新增 `note_categories` 表**

```ts
export const noteCategories = sqliteTable('note_categories', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0)
})
```

- [ ] **Step 6: 更新 `NoteCreateInput` 与 `NoteUpdateInput` 类型**

在已有定义后追加 `categoryId`：
```ts
export type NoteCreateInput = {
  title: string
  content: string
  source: NoteSource
  tags: string[]
  categoryId?: number
}

export type NoteUpdateInput = NoteCreateInput
```

---

### Task 2: Service — 新建 `noteCategoryService.ts`

**Files:**
- Create: `src/main/services/noteCategoryService.ts`

- [ ] **Step 1: 创建 service 文件**

```ts
import type { NoteCategoryItem, NoteCategoryRow } from '@/db/schema'

/** 数据库语句接口（最小依赖）。 */
type Statement = {
  all: (...values: unknown[]) => unknown[]
  get: (...values: unknown[]) => unknown
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

type DatabaseConnection = {
  prepare: (sql: string) => Statement
}

/** 分类服务方法集合。 */
export type NoteCategoryService = {
  list: () => NoteCategoryItem[]
  create: (name: string) => NoteCategoryItem
  update: (id: number, name: string) => NoteCategoryItem
  delete: (id: number) => void
  querySql: (sql: string) => unknown[]
}

/** 提取 SQLite 自增主键。 */
const getInsertedRowId = (result: unknown): number => {
  const rowId = (result as { lastInsertRowid?: number | bigint } | undefined)?.lastInsertRowid
  if (typeof rowId === 'bigint') return Number(rowId)
  if (typeof rowId === 'number') return rowId
  throw new Error('无法读取新建分类的主键')
}

/** 数据库行转页面项。 */
const mapRow = (row: NoteCategoryRow): NoteCategoryItem => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sort_order
})

/** 创建分类服务。 */
export const createNoteCategoryService = (database: DatabaseConnection): NoteCategoryService => ({
  list: () => {
    const rows = database
      .prepare('SELECT id, name, sort_order FROM note_categories ORDER BY sort_order ASC, id ASC')
      .all() as NoteCategoryRow[]
    return rows.map(mapRow)
  },
  create: (name) => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('分类名称不能为空')

    const maxResult = database
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM note_categories')
      .get() as { next_order: number }
    const nextOrder = maxResult.next_order

    const inserted = database
      .prepare('INSERT INTO note_categories (name, sort_order) VALUES (?, ?)')
      .run(trimmed, nextOrder)
    const row = database
      .prepare('SELECT id, name, sort_order FROM note_categories WHERE id = ?')
      .get(getInsertedRowId(inserted)) as NoteCategoryRow | undefined
    if (!row) throw new Error('新建分类后读取失败')
    return mapRow(row)
  },
  update: (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('分类名称不能为空')
    database
      .prepare('UPDATE note_categories SET name = ? WHERE id = ?')
      .run(trimmed, id)
    const row = database
      .prepare('SELECT id, name, sort_order FROM note_categories WHERE id = ?')
      .get(id) as NoteCategoryRow | undefined
    if (!row) throw new Error('分类不存在')
    return mapRow(row)
  },
  delete: (id) => {
    database.prepare('UPDATE notes SET category_id = NULL WHERE category_id = ?').run(id)
    database.prepare('DELETE FROM note_categories WHERE id = ?').run(id)
  },
  querySql: (sql) => database.prepare(sql).all()
})
```

---

### Task 3: Service — 修改 `notesService.ts` 支持分类

**Files:**
- Modify: `src/main/services/notesService.ts`

- [ ] **Step 1: 更新 import 类型**

```ts
import type { NoteCreateInput, NoteMaterialItem, NoteRow, NoteUpdateInput } from '@/db/schema'
```
保持不变（因为 `NoteRow` 和 `NoteMaterialItem` 已在 Task 1 更新）。

- [ ] **Step 2: 更新 `NotesService` 类型签名**

```ts
export type NotesService = {
  list: (categoryId?: number) => NoteMaterialItem[]
  create: (input: NoteCreateInput) => NoteMaterialItem
  update: (id: number, input: NoteUpdateInput) => NoteMaterialItem
  delete: (id: number) => void
  querySql: (sql: string) => unknown[]
}
```

- [ ] **Step 3: 更新 `mapNoteRow` 函数**

将旧的：
```ts
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
```

改为：
```ts
const mapNoteRow = (row: NoteRow): NoteMaterialItem => ({
  id: row.id,
  title: row.title,
  content: row.content,
  source: row.source,
  tags: parseStoredTags(row.tags),
  time: row.time,
  categoryId: row.category_id ?? undefined,
  categoryName: row.category_name ?? undefined
})
```

- [ ] **Step 4: 更新 `list` 方法支持 categoryId 筛选**

将旧的 `list`:
```ts
list: () => {
    const rows = database
      .prepare(
        'SELECT id, title, content, source, tags, time, is_curated, clue FROM notes ORDER BY time DESC, id DESC'
      )
      .all() as NoteRow[]
    return rows.map(mapNoteRow)
  },
```

改为：
```ts
list: (categoryId?) => {
    const whereClause = categoryId !== undefined ? ' WHERE n.category_id = ?' : ''
    const stmt = database.prepare(
      `SELECT n.id, n.title, n.content, n.source, n.tags, n.time, n.category_id, nc.name AS category_name
       FROM notes n
       LEFT JOIN note_categories nc ON n.category_id = nc.id${whereClause}
       ORDER BY n.time DESC, n.id DESC`
    )
    const rows = categoryId !== undefined
      ? stmt.all(categoryId) as NoteRow[]
      : stmt.all() as NoteRow[]
    return rows.map(mapNoteRow)
  },
```

- [ ] **Step 5: 更新 `create` 方法**

将旧的：
```ts
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
```

改为：
```ts
create: (input) => {
    validateNoteInput(input)
    const inserted = database
      .prepare(
        'INSERT INTO notes (title, content, source, tags, time, category_id) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.title.trim(),
        input.content.trim(),
        input.source,
        JSON.stringify(input.tags),
        createDisplayTime(),
        input.categoryId ?? null
      )
    const row = database
      .prepare(
        `SELECT n.id, n.title, n.content, n.source, n.tags, n.time, n.category_id, nc.name AS category_name
         FROM notes n
         LEFT JOIN note_categories nc ON n.category_id = nc.id
         WHERE n.id = ?`
      )
      .get(getInsertedRowId(inserted)) as NoteRow | undefined
    if (!row) {
      throw new Error('新建笔记后读取失败')
    }
    return mapNoteRow(row)
  },
```

- [ ] **Step 6: 更新 `update` 方法**

将旧的：
```ts
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
```

改为：
```ts
update: (id, input) => {
    validateNoteInput(input)
    database
      .prepare('UPDATE notes SET title = ?, content = ?, source = ?, tags = ?, category_id = ? WHERE id = ?')
      .run(
        input.title.trim(),
        input.content.trim(),
        input.source,
        JSON.stringify(input.tags),
        input.categoryId ?? null,
        id
      )
    const row = database
      .prepare(
        `SELECT n.id, n.title, n.content, n.source, n.tags, n.time, n.category_id, nc.name AS category_name
         FROM notes n
         LEFT JOIN note_categories nc ON n.category_id = nc.id
         WHERE n.id = ?`
      )
      .get(id) as NoteRow | undefined
    if (!row) {
      throw new Error('笔记不存在')
    }
    return mapNoteRow(row)
  },
```

`delete` 和 `querySql` 方法保持不变。

---

### Task 4: IPC — 新建 `noteCategoryHandlers.ts`

**Files:**
- Create: `src/main/ipc/noteCategoryHandlers.ts`

- [ ] **Step 1: 创建 IPC handler 文件**

```ts
import { ipcMain } from 'electron'
import { getDatabase } from '@/db'
import { createNoteCategoryService, type DatabaseConnection as CatDbConn } from '@/services/noteCategoryService'

/** 注册分类 IPC 处理器。 */
export const registerNoteCategoryHandlers = (): void => {
  const database = getDatabase()
  const service = createNoteCategoryService(database as unknown as CatDbConn)

  ipcMain.handle('note-categories:list', () => service.list())
  ipcMain.handle('note-categories:create', (_, name: string) => service.create(name))
  ipcMain.handle('note-categories:update', (_, id: number, name: string) => service.update(id, name))
  ipcMain.handle('note-categories:delete', (_, id: number) => service.delete(id))
}
```

---

### Task 5: IPC — 修改 `notesHandlers.ts` 透传 categoryId

**Files:**
- Modify: `src/main/ipc/notesHandlers.ts`

- [ ] **Step 1: 更新 handler 类型签名**

`notesHandlers.ts` 第 17-22 行，note create/update handler 已通过 `NoteCreateInput` / `NoteUpdateInput` 类型传递 `categoryId`（schema 类型里已加），无需改 handler 代码本身，只需确认类型导入正确。

- [ ] **Step 2: 更新 `notes:list` handler 支持 categoryId 参数**

将：
```ts
ipcMain.handle('notes:list', () => notesService.list())
```
改为：
```ts
ipcMain.handle('notes:list', (_, categoryId?: number) => notesService.list(categoryId))
```

---

### Task 6: 主进程入口注册

**Files:**
- Modify: `src/main/index.ts:5`

- [ ] **Step 1: 注册分类 handler**

在第 6 行（`registerDailyHandlers` 导入之后）添加导入：
```ts
import { registerNoteCategoryHandlers } from '@/ipc/noteCategoryHandlers'
```

在第 56 行（`registerNotesHandlers()` 之后）添加调用：
```ts
registerNoteCategoryHandlers()
```

---

### Task 7: Preload API 更新

**Files:**
- Modify: `src/preload/index.ts:563-568`

- [ ] **Step 1: 更新 notes API 添加 categoryId**

将：
```ts
notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    create: (draft: NoteDraftPayload) => ipcRenderer.invoke('notes:create', draft),
    update: (id: number, draft: NoteDraftPayload) => ipcRenderer.invoke('notes:update', id, draft),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id)
  },
```

改为：
```ts
notes: {
    list: (categoryId?: number) => ipcRenderer.invoke('notes:list', categoryId),
    create: (draft: NoteDraftPayload & { categoryId?: number }) => ipcRenderer.invoke('notes:create', draft),
    update: (id: number, draft: NoteDraftPayload & { categoryId?: number }) => ipcRenderer.invoke('notes:update', id, draft),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id)
  },
```

- [ ] **Step 2: 新增 noteCategories API**

在 `notes` 块之后添加：
```ts
noteCategories: {
    list: () => ipcRenderer.invoke('note-categories:list'),
    create: (name: string) => ipcRenderer.invoke('note-categories:create', name),
    update: (id: number, name: string) => ipcRenderer.invoke('note-categories:update', id, name),
    delete: (id: number) => ipcRenderer.invoke('note-categories:delete', id)
  },
```

---

### Task 8: Agent Types — 更新 note 相关类型

**Files:**
- Modify: `src/main/agent/types.ts:485-513`

- [ ] **Step 1: 更新 `NoteQueryToolInput` 类型**

将旧的：
```ts
export type NoteQueryToolInput = {
  query?: string
  source?: string
  tag?: string
  isCurated?: boolean
  sql?: string
  limit?: number
}
```

改为：
```ts
export type NoteQueryToolInput = {
  query?: string
  source?: string
  tag?: string
  categoryId?: number
  sql?: string
  limit?: number
}
```

- [ ] **Step 2: 更新 `NoteQueryToolItem` 类型**

将旧的：
```ts
export type NoteQueryToolItem = Pick<
  NoteMaterialItem,
  'id' | 'title' | 'content' | 'source' | 'tags' | 'time' | 'isCurated' | 'clue'
>
```

改为：
```ts
export type NoteQueryToolItem = Pick<
  NoteMaterialItem,
  'id' | 'title' | 'content' | 'source' | 'tags' | 'time' | 'categoryId' | 'categoryName'
>
```

- [ ] **Step 3: 新增分类相关类型（在 `NoteQueryToolResult` 之后添加）**

```ts
// NoteCategory 查询工具入参。
export type NoteCategoryQueryToolInput = {
  query?: string
  sql?: string
  limit?: number
}

// NoteCategory 查询工具返回项。
export type NoteCategoryQueryToolItem = {
  id: number
  name: string
  sortOrder: number
}

// NoteCategory 查询工具返回结果。
export type NoteCategoryQueryToolResult = AgentToolResult & {
  items: NoteCategoryQueryToolItem[]
  rows?: unknown[]
}
```

---

### Task 9: Agent Tool — 修改 `noteTool.ts`

**Files:**
- Modify: `src/main/agent/tools/noteTool.ts`

- [ ] **Step 1: 更新 import 类型**

第 1 行 `import type` 保持不变，因为类型通过 `@/agent/types` 导出已更新。

- [ ] **Step 2: 更新 `NOTE_COLUMNS` 常量（第 51-52 行）**

```ts
const NOTE_COLUMNS =
  'n.id, n.title, n.content, n.source, n.tags, n.time, n.category_id, nc.name AS category_name'
```

- [ ] **Step 3: 更新 `NOTE_TABLE_NAME` 引用支持 JOIN（第 48 行不变，增加 FROM 子句常量）**

在 `NOTE_COLUMNS` 下方添加：
```ts
const NOTE_FROM_CLAUSE = 'notes n LEFT JOIN note_categories nc ON n.category_id = nc.id'
```

- [ ] **Step 4: 更新 `parseInput` 函数（第 155-168 行）**

将：
```ts
return {
    query: parseString(input.query),
    source: parseString(input.source),
    tag: parseString(input.tag),
    isCurated: typeof input.isCurated === 'boolean' ? input.isCurated : undefined,
    sql: parseString(input.sql),
    limit: typeof input.limit === 'number' ? input.limit : undefined
  }
```

改为：
```ts
return {
    query: parseString(input.query),
    source: parseString(input.source),
    tag: parseString(input.tag),
    categoryId: typeof input.categoryId === 'number' ? input.categoryId : undefined,
    sql: parseString(input.sql),
    limit: typeof input.limit === 'number' ? input.limit : undefined
  }
```

- [ ] **Step 5: 更新 `buildStructuredWhere` 函数（第 201-218 行）**

将 `isCurated` 行替换为 `categoryId`：
```ts
typeof parsed.categoryId === 'number'
      ? `n.category_id = ${parsed.categoryId}`
      : null,
```

同时，`source` 条件也需加 `n.` 前缀：
```ts
parsed.source
      ? `n.source = '${escapeSqlString(parsed.source.trim())}'`
      : null,
```

- [ ] **Step 6: 更新 `buildStructuredSql` 函数（第 223-224 行）**

```ts
const buildStructuredSql = (parsed: NoteQueryToolInput): string =>
  `SELECT ${NOTE_COLUMNS} FROM ${NOTE_FROM_CLAUSE}${buildStructuredWhere(parsed)} ORDER BY n.time DESC, n.id DESC`
```

- [ ] **Step 7: 更新 `prepareNoteSql` 中的 FROM 白名单校验**

需要允许 SQL 查询 `notes n LEFT JOIN note_categories nc`。更新第 254-262 行的表名校验逻辑：

修改第 255 行：
```ts
if (
    !new RegExp(`\\bfrom\\s+${NOTE_TABLE_NAME}\\b`, 'i').test(normalizedSql) &&
    !new RegExp(`\\bfrom\\s+${NOTE_TABLE_NAME}\\s+[a-z]`, 'i').test(normalizedSql) &&
    !new RegExp(`\\bfrom\\s+notes\\s+n\\s+LEFT\\s+JOIN\\s+note_categories`, 'i').test(normalizedSql)
  ) {
    throw new Error(`Note SQL can only query the ${NOTE_TABLE_NAME} table`)
  }
```

同时允许 `note_categories` 出现在 JOIN 中：
```ts
const FORBIDDEN_FROM = /\bfrom\s+(?!notes\b|notes\s+n|notes\s+n\s+LEFT\s+JOIN\s+note_categories)[a-z_][\w]*/i
```

重新改 `prepareNoteSql` 内部校验逻辑：在 `FORBIDDEN_SQL_PATTERN` 中允许 `JOIN`（加上 `nc` 名称保护），简化处理：

将第 62 行：
```ts
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union|join)\b/i
```

改为允许 `LEFT JOIN` 但禁止其他 JOIN：
```ts
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union)\b/i
```

同时移除原独立 `JOIN` 禁止，改为在 `prepareNoteSql` 中额外校验：允许 `LEFT JOIN note_categories nc` 但不允许其他表 JOIN。

现在修改 `prepareNoteSql` 函数（第 229-266 行）：

将第 260 行：
```ts
if (/\bfrom\s+(?!notes\b)[a-z_][\w]*/i.test(normalizedSql)) {
    throw new Error(`Note SQL can only query the ${NOTE_TABLE_NAME} table`)
  }
```

改为允许 `notes n LEFT JOIN note_categories nc`：
```ts
const allowedFrom = /\bfrom\s+(notes\b|notes\s+n(\s+LEFT\s+JOIN\s+note_categories\s+nc)?)/i
  if (!allowedFrom.test(normalizedSql)) {
    throw new Error('Note SQL can only query the notes table (with optional LEFT JOIN note_categories nc)')
  }
```

**实际上更好的做法是不动 `FORBIDDEN_SQL_PATTERN`，而是在 prepareNoteSql 中修改 FROM 校验正则即可。** 因为 JOIN 关键字仍然需要通过 FROM 白名单校验具体表名。

最终方案：将第 254-262 行替换为：
```ts
if (
    !/\bfrom\s+notes\b/i.test(normalizedSql) &&
    !/\bfrom\s+notes\s+n\b/i.test(normalizedSql) &&
    !/\bfrom\s+notes\s+n\s+LEFT\s+JOIN\s+note_categories\b/i.test(normalizedSql)
  ) {
    throw new Error(`Note SQL can only query the notes table`)
  }

  if (/\bfrom\s+(?!notes\b|notes\s+n(\s+LEFT\s+JOIN\s+note_categories\s+nc)?)[a-z_][\w]*/i.test(normalizedSql)) {
    throw new Error(`Note SQL can only query the ${NOTE_TABLE_NAME} table`)
  }
```

- [ ] **Step 8: 更新 `toToolItem` 函数（第 74-83 行）**

```ts
const toToolItem = (note: NoteMaterialItem): NoteQueryToolItem => ({
  id: note.id,
  title: note.title,
  content: note.content,
  source: note.source,
  tags: note.tags,
  time: note.time,
  categoryId: note.categoryId,
  categoryName: note.categoryName
})
```

- [ ] **Step 9: 更新 `isNoteSqlRow` 函数（第 108-116 行）**

将 `is_curated` 检查替换为检查 `category_id` 可以为 null：
```ts
const isNoteSqlRow = (value: unknown): value is NoteSqlRow =>
  isRecord(value) &&
  typeof value.id === 'number' &&
  typeof value.title === 'string' &&
  typeof value.content === 'string' &&
  typeof value.source === 'string' &&
  typeof value.tags === 'string' &&
  typeof value.time === 'string'
```

- [ ] **Step 10: 更新 `sqlRowToToolItem` 函数（第 121-131 行）**

```ts
const sqlRowToToolItem = (row: NoteSqlRow): NoteQueryToolItem =>
  toToolItem({
    id: row.id as number,
    title: row.title as string,
    content: row.content as string,
    source: row.source as NoteSource,
    tags: parseSqlTags(row.tags as string),
    time: row.time as string,
    categoryId: (row.category_id as number | null) ?? undefined,
    categoryName: (row.category_name as string | null) ?? undefined
  })
```

- [ ] **Step 11: 更新 query tool parameters Schema（第 344-372 行）**

将 `isCurated` 参数替换为 `categoryId`：
```ts
categoryId: {
    type: 'number',
    description: 'Filter by category ID'
  },
```

- [ ] **Step 12: 更新 SQL example（第 341 行附近的 examples）**

将示例中的 `is_curated` 替换为 `category_id`。

- [ ] **Step 13: 更新 prompt 中的 `isCurated` 引用**

搜索整个文件，将 `isCurated` / `is_curated` 相关描述替换为 `categoryId` / `category_id`。

---

### Task 10: Agent Tool — 新建 `noteCategoryTool.ts`

**Files:**
- Create: `src/main/agent/tools/noteCategoryTool.ts`

- [ ] **Step 1: 创建分类工具文件**

```ts
import type { NoteCategoryService } from '@/services/noteCategoryService'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'
import type {
  AgentTool,
  AgentToolResult,
  NoteCategoryQueryToolInput,
  NoteCategoryQueryToolItem,
  NoteCategoryQueryToolResult
} from '@/agent/types'

type NoteCategoryQueryTool = Omit<AgentTool, 'execute'> & {
  execute: (input: unknown) => Promise<NoteCategoryQueryToolResult>
}

type NoteCategoryWriteTool = Omit<AgentTool, 'execute'> & {
  execute: (input: unknown) => Promise<AgentToolResult>
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const TABLE_NAME = 'note_categories'
const COLUMNS = 'id, name, sort_order'
const MAX_SQL_LENGTH = 800

const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union)\b/i
const SQL_COMMENT_PATTERN = /--|\/\*|\*\//

type CatSqlRow = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const parseString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const isCatSqlRow = (value: unknown): value is CatSqlRow =>
  isRecord(value) &&
  typeof value.id === 'number' &&
  typeof value.name === 'string' &&
  typeof value.sort_order === 'number'

const toToolItem = (row: CatSqlRow): NoteCategoryQueryToolItem => ({
  id: row.id as number,
  name: row.name as string,
  sortOrder: row.sort_order as number
})

const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

const escapeSqlLike = (value: string): string =>
  escapeSqlString(
    value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  )

const buildWhere = (parsed: NoteCategoryQueryToolInput): string => {
  const parts: (string | null)[] = [
    parsed.query
      ? `name LIKE '%${escapeSqlLike(parsed.query.trim())}%'`
      : null
  ]
  const filtered = parts.filter((c): c is string => Boolean(c))
  return filtered.length > 0 ? ` WHERE ${filtered.join(' AND ')}` : ''
}

const buildSql = (parsed: NoteCategoryQueryToolInput): string =>
  `SELECT ${COLUMNS} FROM ${TABLE_NAME}${buildWhere(parsed)} ORDER BY sort_order ASC, id ASC`

const prepareSql = (sql: string, limit: number): string => {
  const normalized = sql.trim()
  if (!normalized) throw new Error('Category SQL cannot be empty')
  if (normalized.length > MAX_SQL_LENGTH) throw new Error('Category SQL is too long')
  if (normalized.includes(';') || SQL_COMMENT_PATTERN.test(normalized))
    throw new Error('Category SQL only allows a single SELECT statement without comments')
  if (!/^select\b/i.test(normalized))
    throw new Error('Category SQL only allows SELECT queries')
  if (FORBIDDEN_SQL_PATTERN.test(normalized))
    throw new Error('Category SQL contains a forbidden keyword')
  if (!new RegExp(`\\bfrom\\s+${TABLE_NAME}\\b`, 'i').test(normalized))
    throw new Error(`Category SQL can only query the ${TABLE_NAME} table`)
  const hasLimit = /\blimit\s+\d+\b/i.test(normalized)
  return hasLimit ? normalized : `${normalized} LIMIT ${limit}`
}

/** 创建分类查询工具。 */
export const createNoteCategoryQueryTool = (
  service: Pick<NoteCategoryService, 'querySql'>
): NoteCategoryQueryTool => ({
  name: 'note_categories_query',
  description: 'Query note categories in the local database. Read-only.',
  prompt: {
    summary: 'Query note categories. Read-only; supports keyword search and controlled SQL.',
    intentKeywords: ['分类', '笔记分类', '类别', 'category', 'categories'],
    whenToUse: [
      'Use when the user asks about note categories.',
      'Use when the user wants to list or search categories.'
    ],
    whenNotToUse: [
      'Do not use for casual chat unrelated to note categories.',
      'Do not use when the user asks to create, update, or delete categories.'
    ],
    safety: [
      'Read only. Never write data.',
      `SQL must be a single SELECT against only the ${TABLE_NAME} table.`,
      'Never invent categories that the tool did not return.'
    ],
    output: 'Return the category facts needed to answer the user.',
    examples: ['{"limit":10}', '{"query":"工作"}']
  },
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search text contains (LIKE matching on name).'
      },
      sql: {
        type: 'string',
        description: `Controlled read-only SQL. Must SELECT FROM ${TABLE_NAME}.`
      },
      limit: {
        type: 'number',
        description: 'Maximum number of rows to return'
      }
    }
  },
  execute: async (input) => {
    const parsed = isRecord(input) ? input : {}
    const limit = Math.max(
      1,
      Math.min(
        typeof parsed.limit === 'number' ? parsed.limit : DEFAULT_LIMIT,
        MAX_LIMIT
      )
    )
    const sql = parseString(parsed.sql)
      ? prepareSql(parseString(parsed.sql)!, limit)
      : buildSql(parsed as NoteCategoryQueryToolInput)
    const rows = service.querySql(sql).slice(0, limit)
    const items = rows.filter(isCatSqlRow).map(toToolItem)
    return {
      observation: rows.length === 0
        ? 'SQL query returned no rows.'
        : `SQL query returned ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}.`,
      data: { rows, items },
      items,
      rows
    }
  }
})

const CATEGORY_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认创建分类',
  question: '确认创建笔记分类',
  confirm: '确认创建',
  cancel: '取消创建',
  renderTarget: (input) =>
    isRecord(input) ? (input.name as string | undefined) ?? null : null,
  renderSummary: (input) => {
    const name = isRecord(input) ? (input.name as string | undefined) : undefined
    return name ? `将创建分类：**${name}**。` : null
  },
  completion: {
    renderMessage: (input, _result) => {
      const name = isRecord(input) ? (input.name as string | undefined) : undefined
      return name ? `已创建分类：${name}。` : '已创建分类。'
    }
  }
}

const CATEGORY_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认更新分类',
  question: '确认更新笔记分类名称',
  confirm: '确认更新',
  cancel: '取消更新',
  renderTarget: (input) => {
    if (!isRecord(input)) return null
    return typeof input.id === 'number' ? `#${input.id}` : null
  },
  renderSummary: (input) => {
    if (!isRecord(input)) return null
    const name = parseString(input.name)
    return name ? `将重命名为：**${name}**。` : null
  },
  completion: {
    renderMessage: (input, _result) => {
      const name = isRecord(input) ? (input.name as string | undefined) : undefined
      return name ? `已更新分类：${name}。` : '已更新分类。'
    }
  }
}

const CATEGORY_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认删除分类',
  question: '确认永久删除笔记分类',
  confirm: '确认删除',
  cancel: '取消删除',
  renderTarget: (input) => {
    if (!isRecord(input)) return null
    return typeof input.id === 'number' ? `#${input.id}` : null
  },
  renderSummary: () => '删除分类后，关联笔记的分类将被清空。',
  completion: {
    renderMessage: () => '已删除分类。'
  }
}

/** 创建分类添加工具。 */
export const createNoteCategoryAddTool = (
  service: Pick<NoteCategoryService, 'create'>
): NoteCategoryWriteTool => ({
  name: 'note_categories_add',
  description: 'Create a new note category.',
  confirmation: CATEGORY_ADD_CONFIRMATION,
  prompt: {
    summary: 'Create a new note category.',
    intentKeywords: ['新建分类', '创建分类', '添加分类', 'add category', 'create category'],
    whenToUse: ['Use when the user asks to create a note category.'],
    whenNotToUse: ['Do not use for read-only category queries.'],
    safety: [
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'confirmationSummary must include the category name.'
    ],
    output: 'Include confirmationSummary in the tool arguments.',
    examples: [
      '{"confirmationSummary":"将创建分类：**工作笔记**。","name":"工作笔记"}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['name', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description: 'Concise Markdown Chinese explanation shown above the internal confirmation.'
      },
      name: {
        type: 'string',
        description: 'Category name'
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || typeof input.name !== 'string') {
      throw new Error('Category create requires name string')
    }
    const created = service.create(input.name)
    return {
      observation: `Created category: ${created.name}.`,
      data: { item: created }
    }
  }
})

/** 创建分类更新工具。 */
export const createNoteCategoryUpdateTool = (
  service: Pick<NoteCategoryService, 'update'>
): NoteCategoryWriteTool => ({
  name: 'note_categories_update',
  description: 'Update an existing note category name.',
  confirmation: CATEGORY_UPDATE_CONFIRMATION,
  prompt: {
    summary: 'Update an existing note category name.',
    intentKeywords: ['重命名分类', '修改分类', '更新分类', 'rename category', 'update category'],
    whenToUse: [
      'Use when the user asks to rename a note category.',
      'Use after note_categories_query to resolve the category id.'
    ],
    whenNotToUse: ['Do not use for creating new categories.'],
    safety: [
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'Require the numeric category id.'
    ],
    output: 'Include confirmationSummary in the tool arguments.',
    examples: [
      '{"confirmationSummary":"将重命名分类为：**工作笔记**。","id":1,"name":"工作笔记"}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'name', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description: 'Concise Markdown Chinese explanation.'
      },
      id: {
        type: 'number',
        description: 'Category id'
      },
      name: {
        type: 'string',
        description: 'New category name'
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || typeof input.id !== 'number' || typeof input.name !== 'string') {
      throw new Error('Category update requires id and name')
    }
    const updated = service.update(input.id, input.name)
    return {
      observation: `Updated category: ${updated.name}.`,
      data: { item: updated }
    }
  }
})

/** 创建分类删除工具。 */
export const createNoteCategoryDeleteTool = (
  service: Pick<NoteCategoryService, 'delete'>
): NoteCategoryWriteTool => ({
  name: 'note_categories_delete',
  description: 'Delete a note category.',
  confirmation: CATEGORY_DELETE_CONFIRMATION,
  prompt: {
    summary: 'Delete a note category. Associated notes will have their category cleared.',
    intentKeywords: ['删除分类', '移除分类', 'delete category', 'remove category'],
    whenToUse: ['Use when the user asks to delete a note category.'],
    whenNotToUse: ['Do not use for temporary filtering.'],
    safety: [
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'Require the exact numeric category id.',
      'Deletion clears the category on associated notes — it is NOT reversible.'
    ],
    output: 'Include confirmationSummary in the tool arguments.',
    examples: [
      '{"confirmationSummary":"将删除分类 #1，关联笔记的分类将被清空。","id":1}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['id', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description: 'Concise Markdown Chinese explanation.'
      },
      id: {
        type: 'number',
        description: 'Category id'
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || typeof input.id !== 'number') {
      throw new Error('Category delete requires numeric id')
    }
    service.delete(input.id)
    return {
      observation: `Deleted category: ${input.id}.`,
      data: { id: input.id }
    }
  }
})

/** 创建完整分类工具组。 */
export const createNoteCategoryTools = (
  service: Pick<NoteCategoryService, 'querySql' | 'create' | 'update' | 'delete'>
): AgentTool[] => [
  createNoteCategoryQueryTool(service),
  createNoteCategoryAddTool(service),
  createNoteCategoryUpdateTool(service),
  createNoteCategoryDeleteTool(service)
]
```

---

### Task 11: Tool Registry — 注册分类工具

**Files:**
- Modify: `src/main/agent/tools/toolRegistry.ts`

- [ ] **Step 1: 导入分类工具**

在第 6 行之后添加：
```ts
import { createNoteCategoryTools } from '@/agent/tools/noteCategoryTool'
```

- [ ] **Step 2: 导入分类服务类型**

在第 13 行之后添加：
```ts
import type { NoteCategoryService } from '@/services/noteCategoryService'
```

- [ ] **Step 3: 更新 `AgentToolRegistryContext` 类型**

在 `snippetsService` 行之后添加：
```ts
noteCategoryService: Pick<NoteCategoryService, 'querySql' | 'create' | 'update' | 'delete'>
```

- [ ] **Step 4: 在 `builtinToolFactories` 中添加分类工具工厂**

在第 59 行之后添加：
```ts
({ noteCategoryService }) => createNoteCategoryTools(noteCategoryService),
```

---

### Task 12: AI Session — 注入 `noteCategoryService` 到 registry context

**Files:**
- Modify: AI session 创建位置（需要查找 agent 初始化逻辑）

- [ ] **Step 1: 找到 registry context 的构造位置**

需要搜索 `createAgentToolRegistry` 的调用处，在其中注入 `noteCategoryService`。

运行搜索后再实施。

---

### Task 13: 前端组件 — 新建 `NoteCategoryPanel.tsx`

**Files:**
- Create: `src/renderer/src/pages/notes/components/NoteCategoryPanel.tsx`

- [ ] **Step 1: 创建分类面板组件**

```tsx
import { useState, useRef, useEffect } from "react"
import { Folder, Check, Pencil, Trash2, Plus } from "lucide-react"
import { Tooltip } from "@/components/ui/Tooltip"

/** 分类项类型。 */
export interface NoteCategory {
  id: number
  name: string
  sortOrder: number
}

/** 分类面板 props。 */
interface NoteCategoryPanelProps {
  categories: NoteCategory[]
  activeCategoryId: number | null
  onSelectCategory: (id: number | null) => void
  onCreate: (name: string) => Promise<void>
  onUpdate: (id: number, name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export const NoteCategoryPanel = ({
  categories,
  activeCategoryId,
  onSelectCategory,
  onCreate,
  onUpdate,
  onDelete
}: NoteCategoryPanelProps): React.JSX.Element => {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if ((editingId !== null || creating) && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId, creating])

  const handleEdit = (id: number, name: string) => {
    setEditingId(id)
    setEditValue(name)
    setCreating(false)
  }

  const handleSave = async () => {
    const trimmed = editValue.trim()
    if (!trimmed) return

    if (editingId !== null) {
      await onUpdate(editingId, trimmed)
      setEditingId(null)
    } else if (creating) {
      await onCreate(trimmed)
      setCreating(false)
    }

    setEditValue("")
  }

  const handleCancel = () => {
    setEditingId(null)
    setCreating(false)
    setEditValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      void handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  const handleNewCategory = () => {
    setCreating(true)
    setEditingId(null)
    setEditValue("")
  }

  return (
    <aside className="flex min-h-0 flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white/80">分类管理</p>
        <button
          type="button"
          className="rounded-[6px] border border-white/10 bg-black/25 p-1 text-white/50 hover:border-white/20 hover:text-white transition-all duration-150"
          onClick={handleNewCategory}
          aria-label="新建分类"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        className={`rounded-[6px] border px-3 py-2 text-left text-xs transition-colors ${
          activeCategoryId === null
            ? "border-white/18 bg-white/12 text-white"
            : "border-white/8 bg-black/25 text-white/84 hover:border-white/16 hover:bg-black/35"
        }`}
        onClick={() => onSelectCategory(null)}
      >
        全部笔记
      </button>

      <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto custom-scrollbar pr-0.5">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`group flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5 transition-all duration-150 ${
              activeCategoryId === cat.id
                ? "border-white/18 bg-white/12 text-white"
                : "border-white/8 bg-black/25 text-white/62 hover:border-white/16 hover:text-white"
            }`}
          >
            <Folder className="h-3 w-3 flex-shrink-0" />

            {editingId === cat.id ? (
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-xs text-white outline-none border-none p-0"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleCancel}
              />
            ) : (
              <button
                type="button"
                className="flex-1 text-left text-xs truncate"
                onClick={() => onSelectCategory(cat.id)}
              >
                {cat.name}
              </button>
            )}

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {editingId === cat.id ? (
                <button
                  type="button"
                  className="p-0.5 text-white/60 hover:text-white"
                  onMouseDown={(e) => { e.preventDefault(); void handleSave() }}
                  aria-label="确认"
                >
                  <Check className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="button"
                  className="p-0.5 text-white/40 hover:text-white"
                  onClick={() => handleEdit(cat.id, cat.name)}
                  aria-label="编辑分类"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              <Tooltip
                title="确认删除该分类？"
                description="删除后，关联笔记的分类将被清空。"
                onConfirm={() => void onDelete(cat.id)}
                variant="danger"
              >
                <button
                  type="button"
                  className="p-0.5 text-white/40 hover:text-white"
                  aria-label="删除分类"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Tooltip>
            </div>
          </div>
        ))}

        {creating && (
          <div className="flex items-center gap-2 rounded-[6px] border border-white/18 bg-black/35 px-2.5 py-1.5">
            <Folder className="h-3 w-3 flex-shrink-0 text-white/50" />
            <input
              ref={inputRef}
              className="flex-1 bg-transparent text-xs text-white outline-none border-none p-0"
              placeholder="输入分类名，回车确认"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleCancel}
            />
            <button
              type="button"
              className="p-0.5 text-white/60 hover:text-white"
              onMouseDown={(e) => { e.preventDefault(); void handleSave() }}
              aria-label="确认创建"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
```

---

### Task 14: 前端 — 修改 `NotesPage.tsx` 删除策展代码并集成分类

**Files:**
- Modify: `src/renderer/src/pages/notes/NotesPage.tsx`

- [ ] **Step 1: 更新 import**

删除不再需要的图标和组件导入，增加分类面板导入：

```tsx
import { Folder, FileText, Plus, Tag as TagIcon, X, Clock, Pencil, Trash2, Check } from "lucide-react"
```
新增：
```tsx
import { NoteCategoryPanel, type NoteCategory } from "@/pages/notes/components/NoteCategoryPanel"
```

- [ ] **Step 2: 更新 `NoteMaterialItem` 接口**

删除 `isCurated`、`clue`，新增 `categoryId`、`categoryName`。

- [ ] **Step 3: 删除 `StatsSummaryItem` 类型和 `createStatsItems` 函数**

- [ ] **Step 4: 删除 `NotesFilter` 类型和 `NotesSidebar` 组件（整个组件 + props 接口）**

- [ ] **Step 5: 更新主组件状态**

删除：
```tsx
const [activeFilter, setActiveFilter] = useState<NotesFilter>("all")
```

新增：
```tsx
const [categories, setCategories] = useState<NoteCategory[]>([])
const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
```

- [ ] **Step 6: 更新 `filterNotes` 函数**

将 `activeFilter` 替换为 `activeCategoryId`：
```tsx
const filterNotes = (
  notes: NoteMaterialItem[],
  activeCategoryId: number | null,
  activeTag: string | null
): NoteMaterialItem[] => {
  let filtered = notes
  if (activeCategoryId !== null) {
    filtered = filtered.filter((note) => note.categoryId === activeCategoryId)
  }
  if (activeTag) {
    filtered = filtered.filter((note) => note.tags.includes(activeTag))
  }
  return filtered
}
```

- [ ] **Step 7: 更新 `visibleNotes` 计算**

```tsx
const visibleNotes = filterNotes(notes, activeCategoryId, activeTag)
```

- [ ] **Step 8: 删除 `statsItems` 计算**

- [ ] **Step 9: 添加分类加载逻辑**

```tsx
const loadCategories = async (): Promise<void> => {
  try {
    const cats = await window.api.noteCategories.list()
    setCategories(cats)
  } catch {
    // ignore
  }
}

useEffect(() => {
  void loadCategories()
}, [])
```

- [ ] **Step 10: 添加分类操作方法**

```tsx
const handleCreateCategory = async (name: string): Promise<void> => {
  try {
    const created = await window.api.noteCategories.create(name)
    setCategories((prev) => [...prev, created])
    toast.success("分类已创建")
  } catch {
    toast.error("创建分类失败")
  }
}

const handleUpdateCategory = async (id: number, name: string): Promise<void> => {
  try {
    const updated = await window.api.noteCategories.update(id, name)
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)))
    toast.success("分类已更新")
  } catch {
    toast.error("更新分类失败")
  }
}

const handleDeleteCategory = async (id: number): Promise<void> => {
  try {
    await window.api.noteCategories.delete(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
    if (activeCategoryId === id) {
      setActiveCategoryId(null)
    }
    toast.success("分类已删除")
  } catch {
    toast.error("删除分类失败")
  }
}
```

- [ ] **Step 11: 删除左侧的 filter tabs (pending/curated)**

删除第 402-430 行的 filter 按钮组，替换为保留"全部"计数标签：
```tsx
<span className="text-sm font-bold text-white/80">素材列表</span>
<span className="text-[11px] text-white/30">({notes.length})</span>
```

- [ ] **Step 12: 删除右侧 `NotesSidebar` 替换为 `NoteCategoryPanel`**

将第 592-597 行的：
```tsx
<NotesSidebar
    stats={statsItems}
    tags={tagItems}
    activeTag={activeTag}
    onTagChange={setActiveTag}
  />
```

替换为：
```tsx
<NoteCategoryPanel
    categories={categories}
    activeCategoryId={activeCategoryId}
    onSelectCategory={setActiveCategoryId}
    onCreate={handleCreateCategory}
    onUpdate={handleUpdateCategory}
    onDelete={handleDeleteCategory}
  />
```

- [ ] **Step 13: 删除卡片中 clue 提示区域（第 566-583 行）**

移除整段 clue 条件渲染代码。

- [ ] **Step 14: 删除卡片 `isCurated` 相关样式**

第 506-510 行合并为统一样式：
```tsx
className={"group h-[258px] overflow-hidden rounded-[6px] border border-white/10 p-3.5 flex flex-col gap-3 transition-all duration-150 hover:border-white/20 bg-white/[0.03]"}
```

- [ ] **Step 15: 删除未使用的 import**

删除 `Brain`, `CheckCircle2`, `HelpCircle`, `Sparkles` 等不再使用的图标导入。

- [ ] **Step 16: 删除 left sidebar 中的 activeTag 显示（第 431-443 行）**

保留 activeTag 筛选 UI（因为标签功能还在），但移除未使用的代码。

实际上 activeTag 功能保留，只删除策展相关代码。

- [ ] **Step 17: 删除 `pendingLabels` 模板字面量中的 `isCurated` 引用**

第 410 行和第 414 行的 `notes.filter((n) => !n.isCurated).length` 和 `notes.filter((n) => n.isCurated).length` 全部删除（整个 filter tabs 区域）。

- [ ] **Step 18: 删除 create/update 中对 `isCurated`/`clue` 的隐式依赖**

这些在主进程层面已处理（Task 2/3 中 service 层已删除），前端无需改动。

---

### Task 15: AI Session 注入 noteCategoryService

**Files:**
- Modify: 搜索 agent session 初始化位置

- [ ] **Step 1: 找到 agent 初始化逻辑**

搜索 `createAgentToolRegistry` 调用处并注入 `noteCategoryService`。

运行命令：
```bash
rg "createAgentToolRegistry" src/main --files-with-matches
```

- [ ] **Step 2: 在找到的文件中添加 noteCategoryService 实例化**

以 `src/main/ipc/aiHandlers.ts` 为例（需确认实际路径），在 context 中添加：
```ts
const noteCategoryService = createNoteCategoryService(database as unknown as CatDbConn)
```

并在 `createAgentToolRegistry` 调用时传入：
```ts
noteCategoryService
```

---

### Task 16: 验证与清理

- [ ] **Step 1: TypeScript 编译检查**

运行项目的 typecheck 命令（需确认确切命令）。

- [ ] **Step 2: Lint 检查**

运行项目的 lint 命令。

- [ ] **Step 3: 删除数据库旧表**

由于删除了 `isCurated` 和 `clue` 列，旧数据库需要重建或手动 ALTER。在开发环境中直接删除 `*.sqlite` 文件即可。不需要做迁移脚本。

---
