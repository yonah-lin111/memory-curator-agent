# Today Workspace Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project rule: do not run `git commit` unless explicitly requested.

**Goal:** Persist `TodayWorkspace` todos and snippets to local SQLite with IPC-backed CRUD while defaulting the UI to the current day.

**Architecture:** Add `todos` and `snippets` tables in the main-process SQLite database, expose a narrow `window.api.workspace` bridge in preload, and keep `TodayWorkspace.tsx` as the owner of the current-day view state. Reuse the existing Notes persistence pattern, but keep data domains isolated from `notes`.

**Tech Stack:** Electron, TypeScript, React, better-sqlite3, IPC, Vitest, pnpm.

---

## File Structure

- Modify: `src/main/db/schema.ts` - define workspace todo/snippet row/input/view types and unions.
- Modify: `src/main/db/index.ts` - create tables and indexes on startup.
- Create: `src/main/services/workspaceService.ts` - validate payloads, map rows, implement list/create/update/delete/sort.
- Create: `src/main/services/workspaceService.test.ts` - verify date filtering, create/update/delete, and sort persistence.
- Create: `src/main/ipc/workspaceHandlers.ts` - register workspace IPC handlers.
- Modify: `src/main/index.ts` - register workspace handlers.
- Modify: `src/preload/index.ts` - expose `window.api.workspace`.
- Modify: `src/renderer/src/env.d.ts` - declare workspace API and renderer-side types.
- Modify: `src/renderer/src/pages/TodayWorkspace.tsx` - replace mock state with async load/save state.
- Modify: `src/renderer/src/pages/components/TodayTodoPanel.tsx` - replace direct state mutation with async page callbacks.
- Modify: `src/renderer/src/pages/components/TodayNoteEntryModal.tsx` - make snippet payload compatible with persisted shape.

## Task 1: Main-Process Schema And DB Setup

**Files:**
- Modify: `src/main/db/schema.ts`
- Modify: `src/main/db/index.ts`

- [ ] **Step 1: Add workspace table types and payload types**

Define `WorkspaceTodoPriority` / `WorkspaceTodoRow` / `WorkspaceSnippetRow` / create-update payloads / renderer-facing items in `src/main/db/schema.ts`.

- [ ] **Step 2: Add SQLite table definitions**

Add Drizzle table declarations for `todos` and `snippets`, matching the approved design fields.

- [ ] **Step 3: Add table creation and index creation**

Extend `src/main/db/index.ts` so startup runs `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for both workspace tables.

## Task 2: Workspace Service With Tests

**Files:**
- Create: `src/main/services/workspaceService.ts`
- Create: `src/main/services/workspaceService.test.ts`

- [ ] **Step 1: Write service tests first**

Cover:
- listing only a requested `entry_date`
- creating todo with generated timestamps and next `sort_order`
- updating todo fields
- sorting todos by persisted `sort_order`
- creating and updating snippets
- deleting todo and snippet

- [ ] **Step 2: Implement service helpers**

Add date/time formatting, tag parsing, payload validation, row-to-view mapping, and next-sort-order calculation.

- [ ] **Step 3: Implement CRUD and sort methods**

Expose one service with:
- `listDay(date)`
- `createTodo(input)`
- `updateTodo(id, input)`
- `deleteTodo(id)`
- `reorderTodos(date, ids)`
- `createSnippet(input)`
- `updateSnippet(id, input)`
- `deleteSnippet(id)`

- [ ] **Step 4: Run targeted tests**

Run: `pnpm test -- workspaceService`

Expected: workspace service test file passes with 0 failures.

## Task 3: IPC And Preload Bridge

**Files:**
- Create: `src/main/ipc/workspaceHandlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`

- [ ] **Step 1: Register workspace IPC handlers**

Add `ipcMain.handle` channels for day listing and todo/snippet CRUD/sort operations.

- [ ] **Step 2: Wire handlers into app startup**

Register workspace handlers from `src/main/index.ts` after DB init.

- [ ] **Step 3: Expose preload bridge**

Add `window.api.workspace` wrapper methods in `src/preload/index.ts`.

- [ ] **Step 4: Declare renderer types**

Extend `src/renderer/src/env.d.ts` so `TodayWorkspace` can consume typed workspace APIs.

## Task 4: Renderer Integration

**Files:**
- Modify: `src/renderer/src/pages/TodayWorkspace.tsx`
- Modify: `src/renderer/src/pages/components/TodayTodoPanel.tsx`
- Modify: `src/renderer/src/pages/components/TodaySnippetsPanel.tsx`
- Modify: `src/renderer/src/pages/components/TodayNoteEntryModal.tsx`

- [ ] **Step 1: Replace mock data with async load state**

Load current-day workspace data on mount, track loading/error state, and remove `TODO_ITEMS` / `NOTE_ITEMS` as runtime sources.

- [ ] **Step 2: Convert todo panel actions to async callbacks**

Move create/update/delete/sort persistence into `TodayWorkspace.tsx`, and pass explicit callback props down to `TodayTodoPanel.tsx`.

- [ ] **Step 3: Convert snippets modal flow to persisted CRUD**

Create and update snippets through the preload API, keep `TodaySnippetsPanel.tsx` display-only, and format snippet time from persisted timestamps.

- [ ] **Step 4: Keep existing stats and panel UX intact**

Ensure top stats still derive from live state and the panels continue using the existing visual structure.

## Task 5: Full Verification

**Files:**
- Modify: none

- [ ] **Step 1: Run targeted service tests**

Run: `pnpm test -- workspaceService`

Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS

- [ ] **Step 3: Run lint**

Run: `pnpm lint`

Expected: PASS
