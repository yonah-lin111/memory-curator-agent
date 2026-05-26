# Notes SQLite CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project rule: do not run `git commit` unless explicitly requested.

**Goal:** Persist the Notes page to local SQLite and support CRUD through Electron IPC.

**Architecture:** Keep SQLite in the main process, expose a narrow `window.api.notes` preload bridge, and keep `NotesPage.tsx` as the UI owner of local view state. The database starts empty and is created in `app.getPath("userData")/curator.db`.

**Tech Stack:** Electron 39, TypeScript, React 19, better-sqlite3, Drizzle schema helpers, IPC, Vitest, `pnpm typecheck`.

---

## File Structure

- Create: `src/main/db/schema.ts` - define Note source union, row/input types, and Drizzle `notes` table.
- Create: `src/main/db/index.ts` - open `curator.db`, execute `CREATE TABLE IF NOT EXISTS`, expose the SQLite database handle.
- Create: `src/main/services/notesService.ts` - validate payloads, map rows, implement `listNotes`、`createNote`、`updateNote`、`deleteNote`.
- Create: `src/main/ipc/notesHandlers.ts` - register `ipcMain.handle` channels.
- Modify: `src/main/index.ts` - initialize DB and register Notes IPC before creating the window.
- Modify: `src/preload/index.ts` - expose `window.api.notes` with invoke wrappers.
- Modify: `src/renderer/src/env.d.ts` - declare shared renderer API types.
- Modify: `src/renderer/src/components/pages/NotesPage.tsx` - load notes from SQLite and call CRUD APIs.

## Task 1: Database Schema And Initialization

**Files:**
- Create: `src/main/db/schema.ts`
- Create: `src/main/db/index.ts`

- [ ] **Step 1: Create the schema file**

Add `src/main/db/schema.ts`:

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// 笔记来源类型。
export type NoteSource = '随手速记' | '聊天粘贴' | '截图文字' | '会议摘要'

// 笔记行数据类型。
export type NoteRow = {
  id: string
  title: string
  content: string
  source: NoteSource
  tags: string
  time: string
  is_curated: number
  clue: string | null
}

// 笔记创建输入类型。
export type NoteCreateInput = {
  title: string
  content: string
  source: NoteSource
  tags: string[]
}

// 笔记更新输入类型。
export type NoteUpdateInput = NoteCreateInput

// 页面使用的笔记类型。
export type NoteMaterialItem = {
  id: string
  title: string
  content: string
  source: NoteSource
  tags: string[]
  time: string
  isCurated: boolean
  clue?: string
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
```

- [ ] **Step 2: Create the database initializer**

Add `src/main/db/index.ts`:

```ts
import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// SQLite 数据库连接。
let sqlite: Database.Database | null = null

/**
 * 初始化 Notes 本地数据库。
 */
export const initDatabase = (): Database.Database => {
  if (sqlite) {
    return sqlite
  }

  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, { recursive: true })
  sqlite = new Database(join(userDataPath, 'curator.db'))
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      tags TEXT NOT NULL,
      time TEXT NOT NULL,
      is_curated INTEGER NOT NULL DEFAULT 0,
      clue TEXT
    );
  `)

  return sqlite
}

/**
 * 获取已初始化的 Notes 数据库。
 */
export const getDatabase = (): Database.Database => sqlite ?? initDatabase()
```

## Task 2: Notes Service CRUD

**Files:**
- Create: `src/main/services/notesService.ts`

- [ ] **Step 1: Add service implementation**

Add `src/main/services/notesService.ts`:

```ts
import { getDatabase } from '../db'
import type { NoteCreateInput, NoteMaterialItem, NoteRow, NoteUpdateInput } from '../db/schema'

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
  return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : []
}

/**
 * 校验笔记输入。
 */
const validateNoteInput = (input: NoteCreateInput | NoteUpdateInput): void => {
  if (!input.title.trim() || !input.content.trim()) {
    throw new Error('笔记标题和正文不能为空')
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
 * 读取全部笔记。
 */
export const listNotes = (): NoteMaterialItem[] => {
  const rows = getDatabase()
    .prepare('SELECT id, title, content, source, tags, time, is_curated, clue FROM notes ORDER BY time DESC, id DESC')
    .all() as NoteRow[]

  return rows.map(mapNoteRow)
}

/**
 * 创建笔记。
 */
export const createNote = (input: NoteCreateInput): NoteMaterialItem => {
  validateNoteInput(input)

  const note: NoteMaterialItem = {
    id: `n-${Date.now()}`,
    title: input.title.trim(),
    content: input.content.trim(),
    source: input.source,
    tags: input.tags,
    time: createDisplayTime(),
    isCurated: false,
    clue: '可能关联主题「Markdown 新素材」'
  }

  getDatabase()
    .prepare('INSERT INTO notes (id, title, content, source, tags, time, is_curated, clue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(note.id, note.title, note.content, note.source, JSON.stringify(note.tags), note.time, 0, note.clue)

  return note
}

/**
 * 更新笔记。
 */
export const updateNote = (id: string, input: NoteUpdateInput): NoteMaterialItem => {
  validateNoteInput(input)

  getDatabase()
    .prepare('UPDATE notes SET title = ?, content = ?, source = ?, tags = ? WHERE id = ?')
    .run(input.title.trim(), input.content.trim(), input.source, JSON.stringify(input.tags), id)

  const row = getDatabase()
    .prepare('SELECT id, title, content, source, tags, time, is_curated, clue FROM notes WHERE id = ?')
    .get(id) as NoteRow | undefined

  if (!row) {
    throw new Error('笔记不存在')
  }

  return mapNoteRow(row)
}

/**
 * 删除笔记。
 */
export const deleteNote = (id: string): void => {
  getDatabase().prepare('DELETE FROM notes WHERE id = ?').run(id)
}
```

## Task 3: IPC And Preload Bridge

**Files:**
- Create: `src/main/ipc/notesHandlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`

- [ ] **Step 1: Register IPC handlers**

Create `src/main/ipc/notesHandlers.ts` with handlers for `notes:list`、`notes:create`、`notes:update`、`notes:delete` that call the service functions.

- [ ] **Step 2: Initialize database and handlers**

Modify `src/main/index.ts` to import `initDatabase` and `registerNotesHandlers`, then call both inside `app.whenReady().then()` before `createWindow()`.

- [ ] **Step 3: Expose preload API**

Modify `src/preload/index.ts` so `window.api.notes` invokes the four channels with typed payloads.

- [ ] **Step 4: Add renderer API types**

Modify `src/renderer/src/env.d.ts` to declare `NoteSource`、`NoteMaterialItem`、`NoteDraftPayload` and `Window.api.notes`.

## Task 4: Renderer Integration

**Files:**
- Modify: `src/renderer/src/components/pages/NotesPage.tsx`

- [ ] **Step 1: Remove static runtime dependency**

Change `useState<NoteMaterialItem[]>(INITIAL_NOTES)` to an empty array and remove `INITIAL_NOTES` after the page no longer references it.

- [ ] **Step 2: Load notes on mount**

Add `isLoadingNotes` and `notesError` state. In `useEffect`, call `window.api.notes.list()` and populate `notes`.

- [ ] **Step 3: Wire create/update/delete**

Change create/update/delete handlers to await `window.api.notes.create`、`update`、`delete`, then mutate local state only after success.

- [ ] **Step 4: Add loading and error UI**

Show a small black-theme loading state during first load. Show an error card with retry button when loading fails.

## Task 5: Verification

**Files:**
- No source edits unless verification exposes a defect.

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`

Expected: exit code 0.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: exit code 0.

- [ ] **Step 3: Run tests**

Run: `pnpm test`

Expected: exit code 0.

- [ ] **Step 4: Run build if native SQLite loads correctly**

Run: `pnpm build`

Expected: exit code 0. If `better-sqlite3` native ABI fails, report the exact native dependency error instead of masking it.

## Self Review

- Spec coverage: schema, empty first run, IPC API, renderer CRUD, error state, no Agent all have tasks.
- Placeholder scan: no unresolved `TBD` or deferred implementation markers.
- Type consistency: `NoteMaterialItem` uses `isCurated`; DB row uses `is_curated`; IPC payload excludes generated fields.
