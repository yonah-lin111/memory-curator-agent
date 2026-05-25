# Memory Curator MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP for a local-first memory curator desktop app with persistent todo, note, journal, daily input, settings, and basic LLM input classification.

**Architecture:** Keep durable data and secrets in Electron main process, expose a small typed preload API, and keep React as a renderer-only UI. Replace static mock memory UI with a Today-first workflow while preserving the existing black workspace style.

**Tech Stack:** Electron, electron-vite, React, TypeScript, SQLite, better-sqlite3, Zod, Vitest, Tailwind CSS.

**Project Rule:** Do not run `git commit` unless the user explicitly asks. Each task ends with `git status --short` as a checkpoint instead.

---

## Scope

This plan implements only the MVP section from `docs/superpowers/specs/2026-05-22-memory-curator-requirements-design.md`.

Included:

1. Local SQLite storage.
2. Todo, note, journal, input item, and settings models.
3. Typed IPC and preload API.
4. Today view with daily records and unified text input.
5. Notes and Journal history pages.
6. Settings page for OpenAI-compatible LLM provider config.
7. Basic LLM input classification with Zod validation and manual fallback.

Deferred:

1. Weekly review generation.
2. Long-term theme extraction.
3. Memory fragment naming and association.
4. Screenshot OCR and image input.
5. Change comparison, pattern detection, and conflict detection.

---

## File Structure

Create these files:

1. `src/shared/memoryTypes.ts` - shared domain types and Zod schemas used by main, preload, renderer, and tests.
2. `src/main/db/schema.ts` - SQLite table creation SQL.
3. `src/main/db/connection.ts` - database path resolution and singleton connection.
4. `src/main/services/memoryRepository.ts` - CRUD functions over SQLite.
5. `src/main/llm/classifier.ts` - provider request, classification prompt, response validation, and fallback result.
6. `src/main/ipc/memoryHandlers.ts` - typed IPC handlers for repository and classifier operations.
7. `src/preload/memoryApi.ts` - contextBridge API wrapper.
8. `src/preload/types.ts` - global `window.memoryApi` declaration.
9. `src/renderer/src/lib/memoryApi.ts` - renderer-side typed API access.
10. `src/renderer/src/lib/date.ts` - local date formatting helpers.
11. `src/renderer/src/stores/navigationStore.ts` - current view and selected date state.
12. `src/renderer/src/components/TodayView.tsx` - daily MVP workflow.
13. `src/renderer/src/components/NotesView.tsx` - note history.
14. `src/renderer/src/components/JournalView.tsx` - journal history.
15. `src/renderer/src/components/SettingsView.tsx` - LLM settings.
16. `src/shared/memoryTypes.test.ts` - schema validation tests.
17. `src/main/services/memoryRepository.test.ts` - repository integration tests against temporary SQLite database.
18. `src/main/llm/classifier.test.ts` - classifier parsing and fallback tests.

Modify these files:

1. `src/main/index.ts` - initialize database and register IPC handlers.
2. `src/preload/index.ts` - expose `memoryApi`.
3. `src/renderer/src/App.tsx` - switch from static memory detail workspace to MVP routed workspace.
4. `src/renderer/src/components/Sidebar.tsx` - replace mock navigation labels with MVP pages.
5. `src/renderer/src/env.d.ts` - reference preload global types.
6. `package.json` - add a `test:unit` script if needed.

Do not modify these files unless a task explicitly says so:

1. `docs/project-development.md`.
2. `docs/electron-tech-stack.md`.
3. Existing superpowers spec documents.

---

## Task 1: Shared Domain Types And Validation

**Files:**

- Create: `src/shared/memoryTypes.ts`
- Create: `src/shared/memoryTypes.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing schema tests**

Create `src/shared/memoryTypes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  classificationResultSchema,
  createInputPayloadSchema,
  isoDateSchema,
  llmSettingsSchema
} from './memoryTypes'

describe('memory shared schemas', () => {
  it('accepts local ISO date values', () => {
    expect(isoDateSchema.parse('2026-05-22')).toBe('2026-05-22')
  })

  it('rejects malformed date values', () => {
    expect(() => isoDateSchema.parse('2026/05/22')).toThrow()
  })

  it('accepts text input payloads with a source', () => {
    const payload = createInputPayloadSchema.parse({
      content: '今天整理周报，并记录焦虑来源。',
      source: 'manual',
      entryDate: '2026-05-22'
    })

    expect(payload.source).toBe('manual')
  })

  it('accepts a validated classification result', () => {
    const result = classificationResultSchema.parse({
      suggestedType: 'note',
      confidence: 0.82,
      reason: '内容是事实记录，不包含明确执行状态。',
      structured: {
        title: '整理周报',
        content: '今天整理周报，并记录焦虑来源。'
      }
    })

    expect(result.suggestedType).toBe('note')
  })

  it('accepts disabled LLM settings without an API key', () => {
    const settings = llmSettingsSchema.parse({
      enabled: false,
      baseUrl: '',
      apiKey: '',
      model: ''
    })

    expect(settings.enabled).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/shared/memoryTypes.test.ts
```

Expected result:

```txt
FAIL src/shared/memoryTypes.test.ts
Error: Failed to resolve import "./memoryTypes"
```

- [ ] **Step 3: Implement shared domain types**

Create `src/shared/memoryTypes.ts`:

```ts
import { z } from 'zod'

// 本地日期字符串，格式为 YYYY-MM-DD。
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// 记录来源类型。
export const inputSourceSchema = z.enum(['manual', 'chat', 'screenshot_text'])

// Agent 建议的记录类型。
export const classificationTypeSchema = z.enum(['todo', 'note', 'journal', 'memory_clue', 'theme_clue', 'unknown'])

// 创建原始输入的渲染层请求。
export const createInputPayloadSchema = z.object({
  content: z.string().trim().min(1),
  source: inputSourceSchema,
  entryDate: isoDateSchema
})

// 创建 todo 的渲染层请求。
export const createTodoPayloadSchema = z.object({
  title: z.string().trim().min(1),
  note: z.string().optional().default(''),
  entryDate: isoDateSchema
})

// 创建自由笔记的渲染层请求。
export const createNotePayloadSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  entryDate: isoDateSchema,
  sourceInputId: z.string().optional()
})

// 创建日记的渲染层请求。
export const createJournalPayloadSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  entryDate: isoDateSchema,
  sourceInputId: z.string().optional()
})

// Todo 实体。
export const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string(),
  entryDate: isoDateSchema,
  completed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
})

// 自由笔记实体。
export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  entryDate: isoDateSchema,
  sourceInputId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})

// 日记实体。
export const journalSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  entryDate: isoDateSchema,
  sourceInputId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})

// 原始输入实体。
export const inputItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  source: inputSourceSchema,
  entryDate: isoDateSchema,
  createdAt: z.string()
})

// LLM 归类结构化输出。
export const classificationResultSchema = z.object({
  suggestedType: classificationTypeSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  structured: z.object({
    title: z.string().default(''),
    content: z.string().default('')
  })
})

// LLM 设置。
export const llmSettingsSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string()
})

// 当日聚合视图数据。
export const dailyRecordSchema = z.object({
  entryDate: isoDateSchema,
  todos: z.array(todoSchema),
  notes: z.array(noteSchema),
  journals: z.array(journalSchema),
  inputs: z.array(inputItemSchema)
})

export type InputSource = z.infer<typeof inputSourceSchema>
export type ClassificationType = z.infer<typeof classificationTypeSchema>
export type CreateInputPayload = z.infer<typeof createInputPayloadSchema>
export type CreateTodoPayload = z.infer<typeof createTodoPayloadSchema>
export type CreateNotePayload = z.infer<typeof createNotePayloadSchema>
export type CreateJournalPayload = z.infer<typeof createJournalPayloadSchema>
export type Todo = z.infer<typeof todoSchema>
export type Note = z.infer<typeof noteSchema>
export type Journal = z.infer<typeof journalSchema>
export type InputItem = z.infer<typeof inputItemSchema>
export type ClassificationResult = z.infer<typeof classificationResultSchema>
export type LlmSettings = z.infer<typeof llmSettingsSchema>
export type DailyRecord = z.infer<typeof dailyRecordSchema>
```

Modify `package.json` scripts to make the unit command explicit:

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "pnpm typecheck && electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "lint": "pnpm typecheck",
    "test": "vitest run --passWithNoTests",
    "test:unit": "vitest run"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm vitest run src/shared/memoryTypes.test.ts
```

Expected result:

```txt
PASS src/shared/memoryTypes.test.ts
```

- [ ] **Step 5: Checkpoint**

Run:

```bash
pnpm typecheck
git status --short
```

Expected result:

```txt
untracked src/shared/memoryTypes.ts
untracked src/shared/memoryTypes.test.ts
```

---

## Task 2: SQLite Schema And Repository

**Files:**

- Create: `src/main/db/schema.ts`
- Create: `src/main/db/connection.ts`
- Create: `src/main/services/memoryRepository.ts`
- Create: `src/main/services/memoryRepository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Create `src/main/services/memoryRepository.test.ts`:

```ts
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryRepository } from './memoryRepository'
import { applySchema } from '../db/schema'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  applySchema(db)
})

afterEach(() => {
  db.close()
})

describe('memoryRepository', () => {
  it('creates and reads a daily record', () => {
    const repo = createMemoryRepository(db)

    const todo = repo.createTodo({ title: '整理周报', note: '', entryDate: '2026-05-22' })
    const note = repo.createNote({ title: '会议片段', content: '聊到长期主题追踪。', entryDate: '2026-05-22' })
    const journal = repo.createJournal({ title: '今日感受', content: '有压力，但方向清楚。', entryDate: '2026-05-22' })
    const input = repo.createInput({ content: '明天继续拆数据库 schema。', source: 'manual', entryDate: '2026-05-22' })

    const daily = repo.getDailyRecord('2026-05-22')

    expect(daily.todos).toEqual([todo])
    expect(daily.notes).toEqual([note])
    expect(daily.journals).toEqual([journal])
    expect(daily.inputs).toEqual([input])
  })

  it('toggles todo completion', () => {
    const repo = createMemoryRepository(db)
    const todo = repo.createTodo({ title: '完成 MVP 计划', note: '先过类型检查', entryDate: '2026-05-22' })

    const completed = repo.setTodoCompleted(todo.id, true)
    const reopened = repo.setTodoCompleted(todo.id, false)

    expect(completed.completed).toBe(true)
    expect(reopened.completed).toBe(false)
  })

  it('stores and reads LLM settings', () => {
    const repo = createMemoryRepository(db)

    repo.saveLlmSettings({
      enabled: true,
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'secret-key',
      model: 'gpt-compatible'
    })

    expect(repo.getLlmSettings()).toEqual({
      enabled: true,
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'secret-key',
      model: 'gpt-compatible'
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/main/services/memoryRepository.test.ts
```

Expected result:

```txt
FAIL src/main/services/memoryRepository.test.ts
Error: Failed to resolve import './memoryRepository'
```

- [ ] **Step 3: Implement database schema**

Create `src/main/db/schema.ts`:

```ts
import type Database from 'better-sqlite3'

/**
 * 初始化 MVP 数据表与索引。
 */
export const applySchema = (db: Database.Database): void => {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      entry_date TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      source_input_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      source_input_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS input_items (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_todos_entry_date ON todos(entry_date);
    CREATE INDEX IF NOT EXISTS idx_notes_entry_date ON notes(entry_date);
    CREATE INDEX IF NOT EXISTS idx_journals_entry_date ON journals(entry_date);
    CREATE INDEX IF NOT EXISTS idx_inputs_entry_date ON input_items(entry_date);
  `)
}
```

- [ ] **Step 4: Implement database connection**

Create `src/main/db/connection.ts`:

```ts
import { app } from 'electron'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { applySchema } from './schema'

// 主进程 SQLite 单例。
let database: Database.Database | undefined

/**
 * 获取应用数据库文件路径。
 */
export const getDatabasePath = (): string => {
  const dataDir = join(app.getPath('userData'), 'data')
  mkdirSync(dataDir, { recursive: true })
  return join(dataDir, 'memory-curator.sqlite')
}

/**
 * 获取已初始化的 SQLite 连接。
 */
export const getDatabase = (): Database.Database => {
  if (!database) {
    database = new Database(getDatabasePath())
    applySchema(database)
  }

  return database
}
```

- [ ] **Step 5: Implement repository**

Create `src/main/services/memoryRepository.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  createInputPayloadSchema,
  createJournalPayloadSchema,
  createNotePayloadSchema,
  createTodoPayloadSchema,
  dailyRecordSchema,
  llmSettingsSchema,
  type CreateInputPayload,
  type CreateJournalPayload,
  type CreateNotePayload,
  type CreateTodoPayload,
  type DailyRecord,
  type InputItem,
  type Journal,
  type LlmSettings,
  type Note,
  type Todo
} from '../../shared/memoryTypes'

// SQLite 行结构。
type RecordRow = Record<string, unknown>

/**
 * 生成 ISO 时间字符串。
 */
const now = (): string => new Date().toISOString()

/**
 * 把 SQLite 布尔整数转成实体布尔值。
 */
const rowToTodo = (row: RecordRow): Todo => ({
  id: String(row.id),
  title: String(row.title),
  note: String(row.note),
  entryDate: String(row.entry_date),
  completed: Number(row.completed) === 1,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
})

/**
 * 把 SQLite 行转成 Note 实体。
 */
const rowToNote = (row: RecordRow): Note => ({
  id: String(row.id),
  title: String(row.title),
  content: String(row.content),
  entryDate: String(row.entry_date),
  sourceInputId: row.source_input_id === null ? null : String(row.source_input_id),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
})

/**
 * 把 SQLite 行转成 Journal 实体。
 */
const rowToJournal = (row: RecordRow): Journal => ({
  id: String(row.id),
  title: String(row.title),
  content: String(row.content),
  entryDate: String(row.entry_date),
  sourceInputId: row.source_input_id === null ? null : String(row.source_input_id),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
})

/**
 * 把 SQLite 行转成 InputItem 实体。
 */
const rowToInputItem = (row: RecordRow): InputItem => ({
  id: String(row.id),
  content: String(row.content),
  source: row.source === 'chat' ? 'chat' : row.source === 'screenshot_text' ? 'screenshot_text' : 'manual',
  entryDate: String(row.entry_date),
  createdAt: String(row.created_at)
})

/**
 * 创建记忆仓储。
 */
export const createMemoryRepository = (db: Database.Database) => ({
  createTodo(payload: CreateTodoPayload): Todo {
    const input = createTodoPayloadSchema.parse(payload)
    const createdAt = now()
    const todo: Todo = {
      id: randomUUID(),
      title: input.title,
      note: input.note,
      entryDate: input.entryDate,
      completed: false,
      createdAt,
      updatedAt: createdAt
    }

    db.prepare(`
      INSERT INTO todos (id, title, note, entry_date, completed, created_at, updated_at)
      VALUES (@id, @title, @note, @entryDate, @completed, @createdAt, @updatedAt)
    `).run({ ...todo, completed: 0 })

    return todo
  },

  setTodoCompleted(id: string, completed: boolean): Todo {
    const updatedAt = now()
    db.prepare('UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?').run(completed ? 1 : 0, updatedAt, id)
    const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as RecordRow | undefined

    if (!row) {
      throw new Error(`Todo not found: ${id}`)
    }

    return rowToTodo(row)
  },

  createNote(payload: CreateNotePayload): Note {
    const input = createNotePayloadSchema.parse(payload)
    const createdAt = now()
    const note: Note = {
      id: randomUUID(),
      title: input.title,
      content: input.content,
      entryDate: input.entryDate,
      sourceInputId: input.sourceInputId ? input.sourceInputId : null,
      createdAt,
      updatedAt: createdAt
    }

    db.prepare(`
      INSERT INTO notes (id, title, content, entry_date, source_input_id, created_at, updated_at)
      VALUES (@id, @title, @content, @entryDate, @sourceInputId, @createdAt, @updatedAt)
    `).run(note)

    return note
  },

  createJournal(payload: CreateJournalPayload): Journal {
    const input = createJournalPayloadSchema.parse(payload)
    const createdAt = now()
    const journal: Journal = {
      id: randomUUID(),
      title: input.title,
      content: input.content,
      entryDate: input.entryDate,
      sourceInputId: input.sourceInputId ? input.sourceInputId : null,
      createdAt,
      updatedAt: createdAt
    }

    db.prepare(`
      INSERT INTO journals (id, title, content, entry_date, source_input_id, created_at, updated_at)
      VALUES (@id, @title, @content, @entryDate, @sourceInputId, @createdAt, @updatedAt)
    `).run(journal)

    return journal
  },

  createInput(payload: CreateInputPayload): InputItem {
    const input = createInputPayloadSchema.parse(payload)
    const item: InputItem = {
      id: randomUUID(),
      content: input.content,
      source: input.source,
      entryDate: input.entryDate,
      createdAt: now()
    }

    db.prepare(`
      INSERT INTO input_items (id, content, source, entry_date, created_at)
      VALUES (@id, @content, @source, @entryDate, @createdAt)
    `).run(item)

    return item
  },

  getDailyRecord(entryDate: string): DailyRecord {
    const todos = db.prepare('SELECT * FROM todos WHERE entry_date = ? ORDER BY created_at ASC').all(entryDate).map((row) => rowToTodo(row as RecordRow))
    const notes = db.prepare('SELECT * FROM notes WHERE entry_date = ? ORDER BY created_at DESC').all(entryDate).map((row) => rowToNote(row as RecordRow))
    const journals = db.prepare('SELECT * FROM journals WHERE entry_date = ? ORDER BY created_at DESC').all(entryDate).map((row) => rowToJournal(row as RecordRow))
    const inputs = db.prepare('SELECT * FROM input_items WHERE entry_date = ? ORDER BY created_at DESC').all(entryDate).map((row) => rowToInputItem(row as RecordRow))

    return dailyRecordSchema.parse({ entryDate, todos, notes, journals, inputs })
  },

  listNotes(): Note[] {
    return db.prepare('SELECT * FROM notes ORDER BY entry_date DESC, created_at DESC').all().map((row) => rowToNote(row as RecordRow))
  },

  listJournals(): Journal[] {
    return db.prepare('SELECT * FROM journals ORDER BY entry_date DESC, created_at DESC').all().map((row) => rowToJournal(row as RecordRow))
  },

  saveLlmSettings(settings: LlmSettings): LlmSettings {
    const parsed = llmSettingsSchema.parse(settings)
    db.prepare(`
      INSERT INTO app_settings (key, value)
      VALUES ('llm', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(JSON.stringify(parsed))

    return parsed
  },

  getLlmSettings(): LlmSettings {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'llm'").get() as { value: string } | undefined

    if (!row) {
      return { enabled: false, baseUrl: '', apiKey: '', model: '' }
    }

    return llmSettingsSchema.parse(JSON.parse(row.value))
  }
})

export type MemoryRepository = ReturnType<typeof createMemoryRepository>
```

- [ ] **Step 6: Run repository tests**

Run:

```bash
pnpm vitest run src/main/services/memoryRepository.test.ts
```

Expected result:

```txt
PASS src/main/services/memoryRepository.test.ts
```

- [ ] **Step 7: Checkpoint**

Run:

```bash
pnpm typecheck
git status --short
```

Expected result includes:

```txt
untracked src/main/db/schema.ts
untracked src/main/db/connection.ts
untracked src/main/services/memoryRepository.ts
untracked src/main/services/memoryRepository.test.ts
```

---

## Task 3: LLM Classification Service

**Files:**

- Create: `src/main/llm/classifier.ts`
- Create: `src/main/llm/classifier.test.ts`

- [ ] **Step 1: Write failing classifier tests**

Create `src/main/llm/classifier.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { classifyInput, parseClassificationResponse } from './classifier'

describe('classifier', () => {
  it('parses JSON classification from OpenAI-compatible response', () => {
    const result = parseClassificationResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              suggestedType: 'todo',
              confidence: 0.91,
              reason: '包含明确行动动词和待完成事项。',
              structured: { title: '整理数据库 schema', content: '整理数据库 schema' }
            })
          }
        }
      ]
    })

    expect(result.suggestedType).toBe('todo')
  })

  it('falls back to unknown when provider is disabled', async () => {
    const fetcher = vi.fn()
    const result = await classifyInput(
      { content: '随手记录一段不确定内容', source: 'manual', entryDate: '2026-05-22' },
      { enabled: false, baseUrl: '', apiKey: '', model: '' },
      fetcher
    )

    expect(fetcher).not.toHaveBeenCalled()
    expect(result.suggestedType).toBe('unknown')
    expect(result.confidence).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/main/llm/classifier.test.ts
```

Expected result:

```txt
FAIL src/main/llm/classifier.test.ts
Error: Failed to resolve import './classifier'
```

- [ ] **Step 3: Implement classifier**

Create `src/main/llm/classifier.ts`:

```ts
import {
  classificationResultSchema,
  createInputPayloadSchema,
  llmSettingsSchema,
  type ClassificationResult,
  type CreateInputPayload,
  type LlmSettings
} from '../../shared/memoryTypes'

// 可注入的 fetch 类型，方便测试。
type Fetcher = typeof fetch

/**
 * 构造低侵入的输入归类提示词。
 */
const buildPrompt = (input: CreateInputPayload): string => `
你是个人记忆策展工具的输入归类器。只输出 JSON，不输出 markdown。

可选 suggestedType: todo, note, journal, memory_clue, theme_clue, unknown。

判断规则：
- todo: 明确行动、计划或待完成事项。
- note: 事实记录、素材、临时想法。
- journal: 主观感受、反思、困惑、自我观察。
- memory_clue: 值得未来回看的事件、选择、转折或感受节点。
- theme_clue: 可能进入长期追踪的重复议题或关注方向。
- unknown: 证据不足。

输入来源: ${input.source}
输入日期: ${input.entryDate}
输入内容:
${input.content}

输出 JSON 格式：
{"suggestedType":"note","confidence":0.8,"reason":"一句简短中文理由","structured":{"title":"不超过 24 字标题","content":"保留用户原意的内容"}}
`

/**
 * 禁用或失败时使用的安全兜底结果。
 */
const fallbackClassification = (content: string): ClassificationResult => ({
  suggestedType: 'unknown',
  confidence: 0,
  reason: 'LLM 未启用或归类失败，保留原始输入等待手动归类。',
  structured: { title: content.slice(0, 24), content }
})

/**
 * 从 OpenAI-compatible 响应解析结构化归类结果。
 */
export const parseClassificationResponse = (response: unknown): ClassificationResult => {
  const content = (response as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content

  if (!content) {
    throw new Error('LLM response missing message content')
  }

  return classificationResultSchema.parse(JSON.parse(content))
}

/**
 * 调用 OpenAI-compatible provider 进行输入归类。
 */
export const classifyInput = async (
  payload: CreateInputPayload,
  settings: LlmSettings,
  fetcher: Fetcher = fetch
): Promise<ClassificationResult> => {
  const input = createInputPayloadSchema.parse(payload)
  const llm = llmSettingsSchema.parse(settings)

  if (!llm.enabled || !llm.baseUrl || !llm.apiKey || !llm.model) {
    return fallbackClassification(input.content)
  }

  try {
    const response = await fetcher(`${llm.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [{ role: 'user', content: buildPrompt(input) }],
        temperature: 0.1
      })
    })

    if (!response.ok) {
      return fallbackClassification(input.content)
    }

    return parseClassificationResponse(await response.json())
  } catch {
    return fallbackClassification(input.content)
  }
}
```

- [ ] **Step 4: Run classifier tests**

Run:

```bash
pnpm vitest run src/main/llm/classifier.test.ts
```

Expected result:

```txt
PASS src/main/llm/classifier.test.ts
```

- [ ] **Step 5: Checkpoint**

Run:

```bash
pnpm typecheck
git status --short
```

Expected result includes:

```txt
untracked src/main/llm/classifier.ts
untracked src/main/llm/classifier.test.ts
```

---

## Task 4: Typed IPC And Preload API

**Files:**

- Create: `src/main/ipc/memoryHandlers.ts`
- Create: `src/preload/memoryApi.ts`
- Create: `src/preload/types.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`

- [ ] **Step 1: Implement main-process IPC handlers**

Create `src/main/ipc/memoryHandlers.ts`:

```ts
import { ipcMain } from 'electron'
import { getDatabase } from '../db/connection'
import { classifyInput } from '../llm/classifier'
import { createMemoryRepository } from '../services/memoryRepository'
import {
  createInputPayloadSchema,
  createJournalPayloadSchema,
  createNotePayloadSchema,
  createTodoPayloadSchema,
  isoDateSchema,
  llmSettingsSchema
} from '../../shared/memoryTypes'

/**
 * 注册记忆工作台 IPC 处理器。
 */
export const registerMemoryHandlers = (): void => {
  const repo = createMemoryRepository(getDatabase())

  ipcMain.handle('memory:getDailyRecord', (_event, entryDate: unknown) => repo.getDailyRecord(isoDateSchema.parse(entryDate)))
  ipcMain.handle('memory:createTodo', (_event, payload: unknown) => repo.createTodo(createTodoPayloadSchema.parse(payload)))
  ipcMain.handle('memory:setTodoCompleted', (_event, id: unknown, completed: unknown) => repo.setTodoCompleted(String(id), Boolean(completed)))
  ipcMain.handle('memory:createNote', (_event, payload: unknown) => repo.createNote(createNotePayloadSchema.parse(payload)))
  ipcMain.handle('memory:createJournal', (_event, payload: unknown) => repo.createJournal(createJournalPayloadSchema.parse(payload)))
  ipcMain.handle('memory:createInput', (_event, payload: unknown) => repo.createInput(createInputPayloadSchema.parse(payload)))
  ipcMain.handle('memory:listNotes', () => repo.listNotes())
  ipcMain.handle('memory:listJournals', () => repo.listJournals())
  ipcMain.handle('memory:getLlmSettings', () => repo.getLlmSettings())
  ipcMain.handle('memory:saveLlmSettings', (_event, settings: unknown) => repo.saveLlmSettings(llmSettingsSchema.parse(settings)))
  ipcMain.handle('memory:classifyInput', (_event, payload: unknown) => classifyInput(createInputPayloadSchema.parse(payload), repo.getLlmSettings()))
}
```

- [ ] **Step 2: Register handlers in main entry**

Modify `src/main/index.ts` imports:

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { getDatabase } from './db/connection'
import { registerMemoryHandlers } from './ipc/memoryHandlers'
```

Modify `app.whenReady().then(() => { ... })` before `createWindow()`:

```ts
  getDatabase()
  registerMemoryHandlers()

  createWindow()
```

- [ ] **Step 3: Implement preload API**

Create `src/preload/memoryApi.ts`:

```ts
import { ipcRenderer } from 'electron'
import type {
  ClassificationResult,
  CreateInputPayload,
  CreateJournalPayload,
  CreateNotePayload,
  CreateTodoPayload,
  DailyRecord,
  Journal,
  LlmSettings,
  Note,
  Todo
} from '../shared/memoryTypes'

// 渲染层可访问的受限记忆 API。
export const memoryApi = {
  getDailyRecord: (entryDate: string): Promise<DailyRecord> => ipcRenderer.invoke('memory:getDailyRecord', entryDate),
  createTodo: (payload: CreateTodoPayload): Promise<Todo> => ipcRenderer.invoke('memory:createTodo', payload),
  setTodoCompleted: (id: string, completed: boolean): Promise<Todo> => ipcRenderer.invoke('memory:setTodoCompleted', id, completed),
  createNote: (payload: CreateNotePayload): Promise<Note> => ipcRenderer.invoke('memory:createNote', payload),
  createJournal: (payload: CreateJournalPayload): Promise<Journal> => ipcRenderer.invoke('memory:createJournal', payload),
  createInput: (payload: CreateInputPayload) => ipcRenderer.invoke('memory:createInput', payload),
  listNotes: (): Promise<Note[]> => ipcRenderer.invoke('memory:listNotes'),
  listJournals: (): Promise<Journal[]> => ipcRenderer.invoke('memory:listJournals'),
  getLlmSettings: (): Promise<LlmSettings> => ipcRenderer.invoke('memory:getLlmSettings'),
  saveLlmSettings: (settings: LlmSettings): Promise<LlmSettings> => ipcRenderer.invoke('memory:saveLlmSettings', settings),
  classifyInput: (payload: CreateInputPayload): Promise<ClassificationResult> => ipcRenderer.invoke('memory:classifyInput', payload)
}

export type MemoryApi = typeof memoryApi
```

Create `src/preload/types.ts`:

```ts
import type { MemoryApi } from './memoryApi'

declare global {
  interface Window {
    memoryApi: MemoryApi
  }
}
```

Modify `src/preload/index.ts`:

```ts
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { memoryApi } from './memoryApi'

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('memoryApi', memoryApi)
} else {
  // 非隔离上下文仅用于兼容特殊运行环境。
  ;(window as unknown as Window & { electron: typeof electronAPI }).electron = electronAPI
  ;(window as unknown as Window & { memoryApi: typeof memoryApi }).memoryApi = memoryApi
}
```

Modify `src/renderer/src/env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference path="../../preload/types.ts" />
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected result:

```txt
No TypeScript errors.
```

- [ ] **Step 5: Checkpoint**

Run:

```bash
git status --short
```

Expected result includes:

```txt
untracked src/main/ipc/memoryHandlers.ts
untracked src/preload/memoryApi.ts
untracked src/preload/types.ts
 M src/main/index.ts
 M src/preload/index.ts
 M src/renderer/src/env.d.ts
```

---

## Task 5: Renderer API And Navigation Shell

**Files:**

- Create: `src/renderer/src/lib/memoryApi.ts`
- Create: `src/renderer/src/lib/date.ts`
- Create: `src/renderer/src/stores/navigationStore.ts`
- Modify: `src/renderer/src/components/Sidebar.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Add renderer API wrapper and date helper**

Create `src/renderer/src/lib/memoryApi.ts`:

```ts
import type { MemoryApi } from '../../../preload/memoryApi'

/**
 * 获取 preload 暴露的记忆 API。
 */
export const getMemoryApi = (): MemoryApi => {
  if (!window.memoryApi) {
    throw new Error('memoryApi is not available')
  }

  return window.memoryApi
}
```

Create `src/renderer/src/lib/date.ts`:

```ts
/**
 * 返回本地日期字符串，格式为 YYYY-MM-DD。
 */
export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

Create `src/renderer/src/stores/navigationStore.ts`:

```ts
import { create } from 'zustand'
import { toLocalDateKey } from '../lib/date'

// MVP 主视图。
export type AppView = 'today' | 'notes' | 'journal' | 'settings'

// 导航状态。
interface NavigationState {
  // 当前视图。
  activeView: AppView
  // 当前选中日期。
  selectedDate: string
  // 切换当前视图。
  setActiveView: (view: AppView) => void
  // 切换当前日期。
  setSelectedDate: (date: string) => void
}

/**
 * 管理工作台导航与日期选择。
 */
export const useNavigationStore = create<NavigationState>((set) => ({
  activeView: 'today',
  selectedDate: toLocalDateKey(new Date()),
  setActiveView: (view) => set({ activeView: view }),
  setSelectedDate: (date) => set({ selectedDate: date })
}))
```

- [ ] **Step 2: Simplify Sidebar navigation**

Modify `src/renderer/src/components/Sidebar.tsx` to use MVP navigation ids:

```ts
import type React from 'react'
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, NotebookText, Settings } from 'lucide-react'
import type { AppView } from '../stores/navigationStore'

interface NavItem {
  // 唯一标识。
  id: AppView
  // 导航项名称。
  label: string
  // 图标组件。
  icon: React.ComponentType<{ className?: string }>
}

export interface SidebarProps {
  // 当前选中的核心导航项 ID。
  activeTab: AppView
  // 主导航项切换回调。
  onTabChange: (tabId: AppView) => void
  // 侧边栏是否折叠。
  isSidebarCollapsed: boolean
  // 侧边栏折叠/展开状态改变回调。
  onSidebarCollapseChange: (collapsed: boolean) => void
}

const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'today', label: 'Today 当日视图', icon: CalendarDays },
  { id: 'notes', label: '自由笔记', icon: NotebookText },
  { id: 'journal', label: '日记条目', icon: BookOpen },
  { id: 'settings', label: '模型与隐私', icon: Settings }
]
```

Keep the existing collapsed layout. Remove `activeCategory`, `onCategoryChange`, `CURATION_CATEGORIES`, and category rendering because MVP has no theme classification page yet.

- [ ] **Step 3: Replace App shell routing**

Modify `src/renderer/src/App.tsx`:

```tsx
import type React from 'react'
import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { TodayView } from './components/TodayView'
import { NotesView } from './components/NotesView'
import { JournalView } from './components/JournalView'
import { SettingsView } from './components/SettingsView'
import { useNavigationStore } from './stores/navigationStore'

/**
 * 记忆策展 Agent 的 MVP 主应用页面布局组件。
 */
export const App = (): React.JSX.Element => {
  // 控制左侧边栏是否折叠。
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false)
  const { activeView, setActiveView } = useNavigationStore()

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#000000] p-3 gap-3 text-white antialiased">
      <Sidebar
        activeTab={activeView}
        onTabChange={setActiveView}
        isSidebarCollapsed={isSidebarCollapsed}
        onSidebarCollapseChange={setIsSidebarCollapsed}
      />

      <section className="flex flex-1 overflow-hidden rounded-[6px] border border-white/5 bg-[#212121]">
        {activeView === 'today' && <TodayView />}
        {activeView === 'notes' && <NotesView />}
        {activeView === 'journal' && <JournalView />}
        {activeView === 'settings' && <SettingsView />}
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Add minimal view shells for typecheck**

Create each component with this minimal shape, then expand them in later tasks:

```tsx
import type React from 'react'

/**
 * MVP 页面壳层，后续任务扩展为完整实现。
 */
export const TodayView = (): React.JSX.Element => <div className="p-6 text-white">Today</div>
```

Use matching component names for `NotesView`, `JournalView`, and `SettingsView`.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected result:

```txt
No TypeScript errors.
```

- [ ] **Step 6: Checkpoint**

Run:

```bash
git status --short
```

Expected result includes modified `App.tsx` and `Sidebar.tsx`, plus new renderer files.

---

## Task 6: Today View And Unified Input

**Files:**

- Modify: `src/renderer/src/components/TodayView.tsx`

- [ ] **Step 1: Implement Today view data loading and creation workflow**

Replace `src/renderer/src/components/TodayView.tsx`:

```tsx
import type React from 'react'
import { useEffect, useState } from 'react'
import { Check, Loader2, Plus, Send } from 'lucide-react'
import type { ClassificationResult, DailyRecord, InputSource } from '../../../shared/memoryTypes'
import { getMemoryApi } from '../lib/memoryApi'
import { useNavigationStore } from '../stores/navigationStore'

/**
 * Today 当日记录主入口。
 */
export const TodayView = (): React.JSX.Element => {
  const { selectedDate, setSelectedDate } = useNavigationStore()
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null)
  const [inputContent, setInputContent] = useState<string>('')
  const [inputSource, setInputSource] = useState<InputSource>('manual')
  const [classification, setClassification] = useState<ClassificationResult | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const api = getMemoryApi()

  /**
   * 重新加载当天聚合记录。
   */
  const reload = async (): Promise<void> => {
    setDailyRecord(await api.getDailyRecord(selectedDate))
  }

  useEffect(() => {
    void reload()
  }, [selectedDate])

  /**
   * 保存原始输入并请求 Agent 归类。
   */
  const handleSubmitInput = async (): Promise<void> => {
    const content = inputContent.trim()

    if (!content) {
      return
    }

    setIsLoading(true)
    try {
      await api.createInput({ content, source: inputSource, entryDate: selectedDate })
      setClassification(await api.classifyInput({ content, source: inputSource, entryDate: selectedDate }))
      setInputContent('')
      await reload()
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 接受 Agent 建议并写入对应记录类型。
   */
  const acceptClassification = async (): Promise<void> => {
    if (!classification) {
      return
    }

    const title = classification.structured.title || classification.structured.content.slice(0, 24) || '未命名记录'
    const content = classification.structured.content || title

    if (classification.suggestedType === 'todo') {
      await api.createTodo({ title, note: content === title ? '' : content, entryDate: selectedDate })
    }

    if (classification.suggestedType === 'note' || classification.suggestedType === 'memory_clue' || classification.suggestedType === 'theme_clue') {
      await api.createNote({ title, content, entryDate: selectedDate })
    }

    if (classification.suggestedType === 'journal') {
      await api.createJournal({ title, content, entryDate: selectedDate })
    }

    setClassification(null)
    await reload()
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-wide text-white">Today 当日视图</h1>
            <p className="text-xs text-white/40">计划、素材和主观记录集中到同一天。</p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-[6px] border border-white/10 bg-[#000000] px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        <section className="rounded-[6px] border border-white/5 bg-[#000000]/35 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">统一输入</h2>
            <select
              value={inputSource}
              onChange={(event) => setInputSource(event.target.value as InputSource)}
              className="rounded-[6px] border border-white/10 bg-[#000000] px-2 py-1 text-xs text-white outline-none"
            >
              <option value="manual">手动文本</option>
              <option value="chat">聊天粘贴</option>
              <option value="screenshot_text">截图文字</option>
            </select>
          </div>
          <textarea
            value={inputContent}
            onChange={(event) => setInputContent(event.target.value)}
            placeholder="输入 todo、笔记、日记或聊天片段..."
            className="min-h-28 w-full resize-none rounded-[6px] border border-white/10 bg-[#000000] p-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/30"
          />
          <button
            onClick={() => void handleSubmitInput()}
            disabled={isLoading}
            className="mt-3 flex items-center gap-2 rounded-[6px] bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            保存并归类
          </button>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-[6px] border border-white/5 bg-[#000000]/35 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Todo</h2>
            <div className="flex flex-col gap-2">
              {dailyRecord?.todos.map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => void api.setTodoCompleted(todo.id, !todo.completed).then(reload)}
                  className="flex items-start gap-2 rounded-[6px] border border-white/5 bg-[#212121] p-3 text-left text-sm text-white/75"
                >
                  <Check className={`mt-0.5 h-4 w-4 ${todo.completed ? 'text-emerald-400' : 'text-white/20'}`} />
                  <span className={todo.completed ? 'line-through text-white/35' : ''}>{todo.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[6px] border border-white/5 bg-[#000000]/35 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">笔记</h2>
            <div className="flex flex-col gap-2">
              {dailyRecord?.notes.map((note) => (
                <article key={note.id} className="rounded-[6px] border border-white/5 bg-[#212121] p-3">
                  <h3 className="text-sm font-medium text-white">{note.title}</h3>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-white/50">{note.content}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[6px] border border-white/5 bg-[#000000]/35 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">日记</h2>
            <div className="flex flex-col gap-2">
              {dailyRecord?.journals.map((journal) => (
                <article key={journal.id} className="rounded-[6px] border border-white/5 bg-[#212121] p-3">
                  <h3 className="text-sm font-medium text-white">{journal.title}</h3>
                  <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-white/50">{journal.content}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      <aside className="w-80 border-l border-white/5 bg-[#000000]/30 p-4">
        <h2 className="text-sm font-semibold text-white">Agent 归类建议</h2>
        {classification ? (
          <div className="mt-3 rounded-[6px] border border-white/10 bg-[#212121] p-3">
            <p className="text-xs text-white/40">建议类型：{classification.suggestedType}</p>
            <p className="mt-2 text-sm text-white">{classification.structured.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-white/50">{classification.reason}</p>
            <button onClick={() => void acceptClassification()} className="mt-3 flex items-center gap-2 rounded-[6px] bg-white px-3 py-2 text-xs font-semibold text-black">
              <Plus className="h-3.5 w-3.5" />
              接受并写入
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-white/35">提交输入后，这里会显示 Agent 的类型判断。LLM 不可用时会保留原文等待手动整理。</p>
        )}
      </aside>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected result:

```txt
No TypeScript errors.
```

- [ ] **Step 3: Checkpoint**

Run:

```bash
git status --short
```

Expected result includes:

```txt
 M src/renderer/src/components/TodayView.tsx
```

---

## Task 7: Notes And Journal History Pages

**Files:**

- Modify: `src/renderer/src/components/NotesView.tsx`
- Modify: `src/renderer/src/components/JournalView.tsx`

- [ ] **Step 1: Implement Notes page**

Replace `src/renderer/src/components/NotesView.tsx`:

```tsx
import type React from 'react'
import { useEffect, useState } from 'react'
import type { Note } from '../../../shared/memoryTypes'
import { getMemoryApi } from '../lib/memoryApi'

/**
 * 自由笔记历史列表。
 */
export const NotesView = (): React.JSX.Element => {
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    void getMemoryApi().listNotes().then(setNotes)
  }, [])

  return (
    <div className="custom-scrollbar h-full w-full overflow-y-auto p-5">
      <h1 className="text-lg font-semibold tracking-wide text-white">自由笔记</h1>
      <p className="mt-1 text-xs text-white/40">按时间倒序回看素材、事实记录和临时想法。</p>
      <div className="mt-5 grid gap-3">
        {notes.map((note) => (
          <article key={note.id} className="rounded-[6px] border border-white/5 bg-[#000000]/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">{note.title}</h2>
              <span className="font-mono text-xs text-white/30">{note.entryDate}</span>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/60">{note.content}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement Journal page**

Replace `src/renderer/src/components/JournalView.tsx`:

```tsx
import type React from 'react'
import { useEffect, useState } from 'react'
import type { Journal } from '../../../shared/memoryTypes'
import { getMemoryApi } from '../lib/memoryApi'

/**
 * 日记历史列表，保留完整主观表达。
 */
export const JournalView = (): React.JSX.Element => {
  const [journals, setJournals] = useState<Journal[]>([])

  useEffect(() => {
    void getMemoryApi().listJournals().then(setJournals)
  }, [])

  return (
    <div className="custom-scrollbar h-full w-full overflow-y-auto p-5">
      <h1 className="text-lg font-semibold tracking-wide text-white">日记条目</h1>
      <p className="mt-1 text-xs text-white/40">按时间倒序回看感受、反思和自我观察。</p>
      <div className="mt-5 grid gap-3">
        {journals.map((journal) => (
          <article key={journal.id} className="rounded-[6px] border border-white/5 bg-[#000000]/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">{journal.title}</h2>
              <span className="font-mono text-xs text-white/30">{journal.entryDate}</span>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/60">{journal.content}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected result:

```txt
No TypeScript errors.
```

- [ ] **Step 4: Checkpoint**

Run:

```bash
git status --short
```

Expected result includes modified Notes and Journal components.

---

## Task 8: Settings Page And Privacy Boundary

**Files:**

- Modify: `src/renderer/src/components/SettingsView.tsx`

- [ ] **Step 1: Implement Settings page**

Replace `src/renderer/src/components/SettingsView.tsx`:

```tsx
import type React from 'react'
import { useEffect, useState } from 'react'
import type { LlmSettings } from '../../../shared/memoryTypes'
import { getMemoryApi } from '../lib/memoryApi'

/**
 * 模型配置与隐私边界页面。
 */
export const SettingsView = (): React.JSX.Element => {
  const [settings, setSettings] = useState<LlmSettings>({ enabled: false, baseUrl: '', apiKey: '', model: '' })
  const [savedAt, setSavedAt] = useState<string>('')

  useEffect(() => {
    void getMemoryApi().getLlmSettings().then(setSettings)
  }, [])

  /**
   * 保存 LLM provider 配置。
   */
  const save = async (): Promise<void> => {
    setSettings(await getMemoryApi().saveLlmSettings(settings))
    setSavedAt(new Date().toLocaleTimeString())
  }

  return (
    <div className="custom-scrollbar h-full w-full overflow-y-auto p-5">
      <h1 className="text-lg font-semibold tracking-wide text-white">模型与隐私</h1>
      <p className="mt-1 text-xs text-white/40">API key 保存在本地 SQLite，渲染层只通过受限 preload API 保存配置。</p>

      <section className="mt-5 max-w-2xl rounded-[6px] border border-white/5 bg-[#000000]/35 p-4">
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
          />
          启用 LLM 输入归类
        </label>

        <div className="mt-4 grid gap-3">
          <input
            value={settings.baseUrl}
            onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })}
            placeholder="https://api.openai.com/v1"
            className="rounded-[6px] border border-white/10 bg-[#000000] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
          />
          <input
            value={settings.apiKey}
            onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
            placeholder="API key"
            type="password"
            className="rounded-[6px] border border-white/10 bg-[#000000] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
          />
          <input
            value={settings.model}
            onChange={(event) => setSettings({ ...settings, model: event.target.value })}
            placeholder="模型名称，例如 gpt-4o-mini"
            className="rounded-[6px] border border-white/10 bg-[#000000] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
          />
        </div>

        <button onClick={() => void save()} className="mt-4 rounded-[6px] bg-white px-3 py-2 text-sm font-semibold text-black">
          保存设置
        </button>
        {savedAt && <span className="ml-3 text-xs text-white/35">已保存 {savedAt}</span>}
      </section>

      <section className="mt-4 max-w-2xl rounded-[6px] border border-white/5 bg-[#000000]/35 p-4">
        <h2 className="text-sm font-semibold text-white">发送给模型的内容范围</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          MVP 只在用户点击“保存并归类”后发送当前输入框内的文本、输入来源和日期。系统不会自动上传完整数据库、历史日记、历史笔记或 API key。
        </p>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected result:

```txt
No TypeScript errors.
```

- [ ] **Step 3: Checkpoint**

Run:

```bash
git status --short
```

Expected result includes modified Settings component.

---

## Task 9: Final Verification

**Files:**

- Verify all changed files.

- [ ] **Step 1: Run unit tests**

Run:

```bash
pnpm test:unit
```

Expected result:

```txt
PASS src/shared/memoryTypes.test.ts
PASS src/main/services/memoryRepository.test.ts
PASS src/main/llm/classifier.test.ts
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected result:

```txt
No TypeScript errors.
```

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

Expected result:

```txt
electron-vite build completes successfully.
```

- [ ] **Step 4: Inspect working tree**

Run:

```bash
git status --short
```

Expected result includes only files from this plan and the approved requirements spec.

- [ ] **Step 5: Manual smoke test**

Run:

```bash
pnpm dev
```

Expected behavior:

1. App opens to Today view.
2. Sidebar switches between Today, Notes, Journal, and Settings.
3. Today date picker changes the displayed date.
4. Submitting text creates an input item and shows an Agent suggestion.
5. With LLM disabled, suggestion type is `unknown` and original input remains visible.
6. Accepting a `todo`, `note`, or `journal` classification writes the record into the matching section.
7. Notes and Journal pages show saved records after app restart.
8. Settings saves and reloads LLM provider fields.

Stop the dev server after smoke testing.

---

## Self-Review

Spec coverage:

1. Local SQLite storage is covered by Task 2.
2. Text input and chat paste are covered by Task 6 through `InputSource` and unified input.
3. Daily todo creation, view, and completion are covered by Tasks 2 and 6.
4. Free note creation and history are covered by Tasks 2, 6, and 7.
5. Journal creation and history are covered by Tasks 2, 6, and 7.
6. Today view is covered by Task 6.
7. Basic LLM classification is covered by Task 3 and Task 6.
8. Local privacy boundary and settings are covered by Task 8.
9. Typecheck, tests, build, and smoke verification are covered by Task 9.

Intentional gaps:

1. Weekly review is deferred to phase 2.
2. Long-term themes are deferred to phase 2.
3. Memory fragments are deferred to phase 2.
4. Screenshot understanding is deferred to phase 3.
5. Pattern, conflict, and change comparison are deferred to phase 3.

Type consistency:

1. Shared payload and entity names are defined in `src/shared/memoryTypes.ts` and reused across repository, IPC, preload, and renderer.
2. `entryDate` is the only date field for record grouping.
3. `selectedDate` is renderer navigation state and maps directly to `entryDate` in API calls.
4. Classification values use `memory_clue` and `theme_clue` in code to avoid spaces in enum values.

No git commits are included because project-level instructions prohibit commit commands without explicit user authorization.
