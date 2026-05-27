# Today Journal Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist `TodayJournalPanel` content into SQLite by `entry_date`, aggregate it through the existing workspace pipeline, and auto-save/delete it from `TodayWorkspace`.

**Architecture:** Extend the existing flat workspace persistence model with a dedicated `journals` table keyed by `entry_date`, keep all main-process access inside `workspaceService`, and return `journal` from the existing `workspace:list-day` aggregation. In the renderer, keep `TodayWorkspace.tsx` as the single state owner and implement debounced journal save plus blur/unmount flush without adding a second data flow.

**Tech Stack:** Electron, better-sqlite3, TypeScript, React, Vitest

---

### Task 1: Extend Database Types And Service Coverage

**Files:**
- Modify: `src/main/db/schema.ts`
- Modify: `src/main/db/index.ts`
- Modify: `src/main/services/workspaceService.ts`
- Modify: `src/main/services/workspaceService.test.ts`

- [ ] **Step 1: Add journal schema and payload types**

```ts
export type WorkspaceJournalSaveInput = {
  entryDate: string
  content: string
}

export type WorkspaceJournalItem = {
  entryDate: string
  content: string
  createdAt: string
  updatedAt: string
}

export type WorkspaceJournalRow = {
  entry_date: string
  content: string
  created_at: string
  updated_at: string
}

export type WorkspaceDayData = {
  todos: WorkspaceTodoItem[]
  snippets: WorkspaceSnippetItem[]
  journal: WorkspaceJournalItem | null
}

export const journals = sqliteTable('journals', {
  entryDate: text('entry_date').primaryKey(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})
```

- [ ] **Step 2: Create the `journals` table at DB init**

```ts
export const createJournalsTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS journals (
      entry_date TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}
```

- [ ] **Step 3: Extend workspace service with journal read/save/delete**

```ts
type WorkspaceService = {
  listDay: (entryDate: string) => WorkspaceDayData
  saveJournal: (input: WorkspaceJournalSaveInput) => WorkspaceJournalItem
  deleteJournal: (entryDate: string) => void
  // existing todo/snippet methods...
}

const mapJournalRow = (row: WorkspaceJournalRow): WorkspaceJournalItem => ({
  entryDate: row.entry_date,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})
```

`saveJournal` implementation rules:

```ts
if (!trimmedContent) {
  database.prepare('DELETE FROM journals WHERE entry_date = ?').run(input.entryDate)
  throw new Error('日记内容不能为空')
}
```

For normal saves:

```ts
const existing = database
  .prepare('SELECT entry_date, content, created_at, updated_at FROM journals WHERE entry_date = ?')
  .get(input.entryDate) as WorkspaceJournalRow | undefined

if (!existing) {
  database
    .prepare('INSERT INTO journals (entry_date, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(input.entryDate, trimmedContent, timestamp, timestamp)
} else {
  database
    .prepare('UPDATE journals SET content = ?, updated_at = ? WHERE entry_date = ?')
    .run(trimmedContent, timestamp, input.entryDate)
}
```

- [ ] **Step 4: Add service tests for journal behavior**

Add tests covering:

```ts
it('返回指定日期的 journal 记录', () => {
  service.saveJournal({ entryDate: '2026-05-27', content: '今天的日记' })
  service.saveJournal({ entryDate: '2026-05-26', content: '昨天的日记' })

  const workspace = service.listDay('2026-05-27')

  expect(workspace.journal?.entryDate).toBe('2026-05-27')
  expect(workspace.journal?.content).toBe('今天的日记')
})

it('更新同一天 journal 时保留 createdAt 并刷新 updatedAt', () => {
  const created = service.saveJournal({ entryDate: '2026-05-27', content: '初稿' })
  const updated = service.saveJournal({ entryDate: '2026-05-27', content: '终稿' })

  expect(updated.entryDate).toBe('2026-05-27')
  expect(updated.content).toBe('终稿')
  expect(updated.createdAt).toBe(created.createdAt)
})

it('删除 journal 后 listDay 返回 null', () => {
  service.saveJournal({ entryDate: '2026-05-27', content: '今天的日记' })
  service.deleteJournal('2026-05-27')

  expect(service.listDay('2026-05-27').journal).toBeNull()
})
```

- [ ] **Step 5: Run service verification**

Run: `pnpm test -- workspaceService`  
Expected: `workspaceService` tests pass with 0 failures, including new journal cases.

### Task 2: Extend IPC And Preload Workspace Bridge

**Files:**
- Modify: `src/main/ipc/workspaceHandlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`

- [ ] **Step 1: Register journal IPC handlers**

```ts
ipcMain.handle('workspace:journal:save', (_, input: WorkspaceJournalSaveInput) =>
  workspaceService.saveJournal(input)
)
ipcMain.handle('workspace:journal:delete', (_, entryDate: string) => {
  workspaceService.deleteJournal(entryDate)
})
```

- [ ] **Step 2: Expose preload bridge methods**

```ts
type WorkspaceJournalSavePayload = {
  entryDate: string
  content: string
}

saveJournal: (draft: WorkspaceJournalSavePayload) => ipcRenderer.invoke('workspace:journal:save', draft),
deleteJournal: (entryDate: string) => ipcRenderer.invoke('workspace:journal:delete', entryDate)
```

- [ ] **Step 3: Extend renderer ambient types**

```ts
type WorkspaceJournalItem = {
  entryDate: string
  content: string
  createdAt: string
  updatedAt: string
}

type WorkspaceDayData = {
  todos: WorkspaceTodoItem[]
  snippets: WorkspaceSnippetItem[]
  journal: WorkspaceJournalItem | null
}
```

- [ ] **Step 4: Run type-level verification**

Run: `pnpm typecheck`  
Expected: no TypeScript errors after bridge and payload type updates.

### Task 3: Wire Journal Auto-Save Into Today Workspace

**Files:**
- Modify: `src/renderer/src/pages/TodayWorkspace.tsx`
- Modify: `src/renderer/src/pages/components/TodayJournalPanel.tsx`

- [ ] **Step 1: Convert TodayJournalPanel into a pure presentation component**

```tsx
interface TodayJournalPanelProps {
  journalContent: string
  isSaving: boolean
  errorMessage: string | null
  lastSavedAt: string | null
  onJournalContentChange: (value: string) => void
  onJournalBlur: () => void
}
```

Header display target:

```tsx
<span>最近保存: {lastSavedAt ?? '未保存'}</span>
<span>•</span>
<span className="text-emerald-400">情绪感知: {predictedMood}</span>
```

- [ ] **Step 2: Load journal from `workspace:list-day` and add save state in `TodayWorkspace.tsx`**

Add state similar to:

```ts
const [journalContent, setJournalContent] = useState('')
const [savedJournalContent, setSavedJournalContent] = useState('')
const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
const [isJournalSaving, setIsJournalSaving] = useState(false)
const [journalError, setJournalError] = useState<string | null>(null)
```

On load:

```ts
setJournalContent(workspace.journal?.content ?? '')
setSavedJournalContent(workspace.journal?.content ?? '')
setLastSavedAt(workspace.journal?.updatedAt ?? null)
```

- [ ] **Step 3: Implement debounced save, delete-on-empty, and flush**

Core save routine:

```ts
const persistJournal = async (rawContent: string): Promise<void> => {
  const normalizedContent = rawContent.trim()

  if (normalizedContent === savedJournalContent.trim()) {
    return
  }

  setIsJournalSaving(true)
  setJournalError(null)

  try {
    if (!hasWorkspaceApi) {
      setSavedJournalContent(rawContent)
      setLastSavedAt(normalizedContent ? `${entryDate} 00:00` : null)
      return
    }

    if (!normalizedContent) {
      await window.api.workspace.deleteJournal(entryDate)
      setSavedJournalContent('')
      setLastSavedAt(null)
      return
    }

    const saved = await window.api.workspace.saveJournal({ entryDate, content: rawContent })
    setSavedJournalContent(saved.content)
    setLastSavedAt(saved.updatedAt)
  } catch {
    setJournalError('保存日记失败，请稍后重试')
    toast.error('保存日记失败，请稍后重试')
  } finally {
    setIsJournalSaving(false)
  }
}
```

Debounce and flush:

```ts
useEffect(() => {
  const timer = window.setTimeout(() => {
    void persistJournal(journalContent)
  }, 1000)

  return () => window.clearTimeout(timer)
}, [journalContent, persistJournal])

const handleJournalBlur = (): void => {
  void persistJournal(journalContent)
}
```

- [ ] **Step 4: Flush pending journal content on unmount and surface panel state**

Use cleanup like:

```ts
useEffect(() => {
  return () => {
    if (journalContent.trim() !== savedJournalContent.trim()) {
      void persistJournal(journalContent)
    }
  }
}, [journalContent, savedJournalContent, persistJournal])
```

Panel usage:

```tsx
<TodayJournalPanel
  errorMessage={journalError}
  isSaving={isJournalSaving}
  journalContent={journalContent}
  lastSavedAt={lastSavedAt}
  onJournalBlur={handleJournalBlur}
  onJournalContentChange={setJournalContent}
/>
```

- [ ] **Step 5: Run full verification**

Run: `pnpm test -- workspaceService`  
Expected: journal service coverage still passes.

Run: `pnpm typecheck`  
Expected: renderer and bridge changes compile cleanly.

Run: `pnpm lint`  
Expected: project lint/typecheck command exits 0.

### Self-Review

- [ ] `journals` is the only new table name; no `today_` prefix appears.
- [ ] `WorkspaceDayData` returns `journal` everywhere that consumes `listDay`.
- [ ] Empty journal content deletes the row instead of persisting empty strings.
- [ ] `TodayJournalPanel.tsx` no longer depends on hard-coded `JOURNAL_DATA`.
- [ ] No `git commit` step is executed because repository instructions forbid automatic commits here.
