# MC Database Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store the SQLite database at the current user's home `.mc/db/curator.db` path on macOS, Linux, and Windows.

**Architecture:** Add a small main-process path module that owns the `.mc` application data root and the database directory path. Keep `initDatabase()` responsible for creating the database directory and opening SQLite.

**Tech Stack:** Electron 39, TypeScript, Node `os.homedir`, Node `path.join`, better-sqlite3, Vitest.

---

### Task 1: Centralize `.mc` Paths

**Files:**
- Create: `src/main/paths.ts`
- Test: `src/main/paths.test.ts`

- [ ] Write a failing Vitest test that asserts `getAppDataRoot()` returns `<home>/.mc`, `getDatabaseDir()` returns `<home>/.mc/db`, and `getDatabasePath()` returns `<home>/.mc/db/curator.db`.
- [ ] Run `pnpm test src/main/paths.test.ts` and verify it fails because the module does not exist.
- [ ] Implement the three path functions using `homedir()` and `join()`.
- [ ] Re-run `pnpm test src/main/paths.test.ts` and verify it passes.

### Task 2: Use `.mc/db` For SQLite

**Files:**
- Modify: `src/main/db/index.ts`

- [ ] Replace the `app.getPath('userData')` database location with `getDatabaseDir()` and `getDatabasePath()`.
- [ ] Keep `mkdirSync(databaseDir, { recursive: true })` before opening SQLite.
- [ ] Run `pnpm typecheck` and `pnpm test`.

### Self-Review

- Spec coverage: database path is under user home `.mc/db`; directory is created recursively; Windows compatibility comes from Node `homedir()` and `join()`.
- Placeholder scan: no placeholders.
- Type consistency: all path functions return strings and are consumed by `initDatabase()`.
