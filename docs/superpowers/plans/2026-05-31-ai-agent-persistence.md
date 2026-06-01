# AI Agent Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist AI Agent sessions, messages, runs, tool calls, and context snapshots in local SQLite so chat history can be restored and audited after restart.

**Architecture:** Keep persistence in the main process. Add normalized SQLite tables, a focused `aiChatPersistenceService`, IPC read APIs, and persistence hooks inside `ai:chat:start` event handling. Renderer stays optimistic for interaction speed, then hydrates persisted sessions through preload APIs.

**Tech Stack:** Electron, TypeScript, better-sqlite3, Vitest, React, Zustand.

**Project Rule:** Do not run `git commit` or `git merge`. Use diffs and verification commands only.

---

## File Structure

- Modify: `src/main/db/schema.ts`
  - Add shared AI chat persistence types and row types.
- Modify: `src/main/db/index.ts`
  - Add `createAiChatPersistenceTables()` and call it from `initDatabase()`.
- Create: `src/main/services/aiChatPersistenceService.ts`
  - Own all SQL and mapping for sessions, messages, runs, tool calls, and context snapshots.
- Modify: `src/main/ipc/aiHandlers.ts`
  - Register history read handlers and persist `ai:chat:start` lifecycle.
- Modify: `src/preload/index.ts`
  - Expose `ai.listSessions()` and `ai.getSession(sessionId)`.
- Modify: `src/renderer/src/env.d.ts`
  - Add matching window API types.
- Modify: `src/renderer/src/features/ai-chat/aiChatMock.ts`
  - Reuse exported types for persisted history; add optional `createdAt/updatedAt` only if needed by UI.
- Modify: `src/renderer/src/App.tsx`
  - Hydrate persisted sessions on startup and fetch details on session switch.
- Create: `test/main/services/aiChatPersistenceService.test.ts`
  - Cover service behavior with a real in-memory SQLite database.
- Modify: `test/main/db/index.test.ts`
  - Cover AI table creation in the in-memory SQL harness.
- Modify: `test/main/ipc/aiHandlers.test.ts`
  - Cover history handlers and persistence wiring with mocks.
- Modify: `test/renderer/App.test.tsx`
  - Cover hydration and existing optimistic event flow.

---

### Task 1: Database Schema

**Files:**
- Modify: `src/main/db/schema.ts`
- Modify: `src/main/db/index.ts`
- Modify: `test/main/db/index.test.ts`

- [ ] **Step 1: Add schema row and domain types**

Add these types near the AI-adjacent shared types in `src/main/db/schema.ts`:

```ts
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
```

- [ ] **Step 2: Run typecheck to expose type mistakes**

Run:

```bash
pnpm typecheck
```

Expected: fail only if imports are not wired yet, or pass if no consumers exist.

- [ ] **Step 3: Add AI table creation**

Add to `src/main/db/index.ts`:

```ts
/**
 * 创建 AI Agent 持久化表与索引。
 */
export const createAiChatPersistenceTables = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_message_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_last_message_at
    ON ai_chat_sessions(last_message_at DESC);

    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      answer TEXT,
      parts_json TEXT NOT NULL,
      tool_steps_json TEXT NOT NULL,
      time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_created_at
    ON ai_chat_messages(session_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS ai_agent_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      assistant_message_id TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      status TEXT NOT NULL,
      error TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_session_started_at
    ON ai_agent_runs(session_id, started_at DESC);

    CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_assistant_message_id
    ON ai_agent_runs(assistant_message_id);

    CREATE TABLE IF NOT EXISTS ai_agent_tool_calls (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      observation TEXT NOT NULL,
      data_json TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(run_id, tool_call_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_agent_tool_calls_run_created_at
    ON ai_agent_tool_calls(run_id, created_at ASC);

    CREATE INDEX IF NOT EXISTS idx_ai_agent_tool_calls_message_id
    ON ai_agent_tool_calls(message_id);

    CREATE TABLE IF NOT EXISTS ai_agent_context_snapshots (
      id INTEGER PRIMARY KEY,
      run_id TEXT NOT NULL,
      context_key TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      source_id TEXT,
      content TEXT NOT NULL,
      tokens INTEGER,
      created_order INTEGER NOT NULL,
      meta_json TEXT NOT NULL,
      UNIQUE(run_id, context_key)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_agent_context_snapshots_run_order
    ON ai_agent_context_snapshots(run_id, created_order ASC);
  `)
}
```

Then call it inside `initDatabase()` after existing table creation:

```ts
  createAssociatedPeopleTable(sqlite)
  createAiChatPersistenceTables(sqlite)
```

- [ ] **Step 4: Add db test coverage**

Update `test/main/db/index.test.ts` imports:

```ts
  createAiChatPersistenceTables,
```

Call `createAiChatPersistenceTables(database as never)` in the migration test, then assert:

```ts
    const aiSessionIdType = database
      .prepare("SELECT type FROM pragma_table_info('ai_chat_sessions') WHERE name = 'id'")
      .get('id') as { type: string }
    const aiMessageSessionIdType = database
      .prepare("SELECT type FROM pragma_table_info('ai_chat_messages') WHERE name = 'session_id'")
      .get('session_id') as { type: string }

    expect(aiSessionIdType.type).toBe('TEXT')
    expect(aiMessageSessionIdType.type).toBe('TEXT')
```

If the in-memory harness cannot parse `UNIQUE(...)`, update its `createTable` reducer to skip table constraints:

```ts
        if (/^(UNIQUE|PRIMARY|FOREIGN|CHECK)\b/i.test(columnDefinition)) {
          return currentColumns
        }
```

- [ ] **Step 5: Verify Task 1**

Run:

```bash
pnpm test test/main/db/index.test.ts
pnpm typecheck
```

Expected: db test passes; typecheck passes or only fails on later unimplemented API references if done out of order.

---

### Task 2: Persistence Service

**Files:**
- Create: `src/main/services/aiChatPersistenceService.ts`
- Create: `test/main/services/aiChatPersistenceService.test.ts`

- [ ] **Step 1: Write service tests first**

Create `test/main/services/aiChatPersistenceService.test.ts` with real in-memory SQLite:

```ts
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { createAiChatPersistenceTables } from '../../../src/main/db'
import { createAiChatPersistenceService } from '../../../src/main/services/aiChatPersistenceService'

const createService = () => {
  const database = new Database(':memory:')
  createAiChatPersistenceTables(database)
  return createAiChatPersistenceService(database)
}

describe('aiChatPersistenceService', () => {
  it('creates a session, appends messages, and reads the session detail', () => {
    const service = createService()

    service.ensureSession({
      id: 's1',
      title: '新会话',
      summary: '第一条消息',
      status: '运行中',
      timestamp: '2026-05-31 10:00'
    })
    service.appendMessage({
      id: 'm-user',
      sessionId: 's1',
      role: 'user',
      content: '你好',
      time: '10:00',
      timestamp: '2026-05-31 10:00'
    })
    service.appendMessage({
      id: 'm-ai',
      sessionId: 's1',
      role: 'assistant',
      content: '正在处理',
      answer: '',
      parts: [],
      toolSteps: [],
      time: '10:00',
      timestamp: '2026-05-31 10:00'
    })

    expect(service.listSessions()).toHaveLength(1)
    expect(service.getSession('s1')).toMatchObject({
      id: 's1',
      title: '新会话',
      messages: [
        { id: 'm-user', role: 'user', content: '你好' },
        { id: 'm-ai', role: 'assistant', content: '正在处理', answer: '' }
      ]
    })
  })

  it('updates assistant message text and tool snapshots', () => {
    const service = createService()

    service.ensureSession({
      id: 's1',
      title: '新会话',
      summary: '摘要',
      status: '运行中',
      timestamp: '2026-05-31 10:00'
    })
    service.appendMessage({
      id: 'm-ai',
      sessionId: 's1',
      role: 'assistant',
      content: '正在处理',
      answer: '',
      parts: [],
      toolSteps: [],
      time: '10:00',
      timestamp: '2026-05-31 10:00'
    })
    service.updateAssistantMessage({
      messageId: 'm-ai',
      content: '正在处理',
      answer: '完成',
      parts: [{ id: 'p1', kind: 'text', content: '完成' }],
      toolSteps: [
        {
          id: 'call-1',
          title: '工具结果：people_query',
          status: 'done',
          tool: 'people_query',
          input: { query: '阿明' },
          observation: '找到 1 位关联人物',
          data: [{ name: '阿明' }]
        }
      ],
      timestamp: '2026-05-31 10:01'
    })

    expect(service.getSession('s1')?.messages[0]).toMatchObject({
      answer: '完成',
      parts: [{ id: 'p1', kind: 'text', content: '完成' }],
      toolSteps: [{ id: 'call-1', status: 'done', tool: 'people_query' }]
    })
  })

  it('persists run, tool call, and context snapshots', () => {
    const service = createService()

    service.startRun({
      id: 'run-1',
      sessionId: 's1',
      assistantMessageId: 'm-ai',
      provider: 'bailian',
      model: 'MiniMax-M2.5',
      context: [
        {
          key: 'message:m1',
          kind: 'message',
          title: '用户消息',
          sourceId: 'm1',
          content: '历史消息',
          tokens: 3,
          createdAt: 10,
          meta: { role: 'user' }
        }
      ],
      timestamp: '2026-05-31 10:00'
    })
    service.upsertToolCall({
      id: 'tool-row-1',
      runId: 'run-1',
      messageId: 'm-ai',
      toolCallId: 'call-1',
      name: 'people_query',
      status: 'running',
      input: { query: '阿明' },
      observation: '',
      data: null,
      timestamp: '2026-05-31 10:00'
    })
    service.upsertToolCall({
      id: 'tool-row-1',
      runId: 'run-1',
      messageId: 'm-ai',
      toolCallId: 'call-1',
      name: 'people_query',
      status: 'done',
      input: { query: '阿明' },
      observation: '找到 1 位关联人物',
      data: [{ name: '阿明' }],
      timestamp: '2026-05-31 10:01'
    })
    service.finishRun({
      id: 'run-1',
      status: 'completed',
      timestamp: '2026-05-31 10:02'
    })

    expect(service.getRun('run-1')).toMatchObject({
      id: 'run-1',
      status: 'completed'
    })
    expect(service.listToolCalls('run-1')).toMatchObject([
      {
        toolCallId: 'call-1',
        status: 'done',
        observation: '找到 1 位关联人物'
      }
    ])
    expect(service.listContextSnapshots('run-1')).toMatchObject([
      {
        contextKey: 'message:m1',
        kind: 'message',
        content: '历史消息'
      }
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test test/main/services/aiChatPersistenceService.test.ts
```

Expected: fail because `aiChatPersistenceService.ts` does not exist.

- [ ] **Step 3: Implement service**

Create `src/main/services/aiChatPersistenceService.ts` with these responsibilities:

```ts
import type {
  AiAgentRunStatus,
  AiAgentToolCallStatus,
  AiChatMessageItem,
  AiChatMessagePart,
  AiChatMessageRole,
  AiChatMessageRow,
  AiChatSessionItem,
  AiChatSessionRow,
  AiToolStep
} from '../db/schema'
import type { AgentContextPayloadItem } from '../agent/contextMessages'

export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => unknown
}

export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
}

export type AiChatPersistenceService = {
  // 读取最近 AI 会话。
  listSessions: () => AiChatSessionItem[]
  // 读取单个 AI 会话详情。
  getSession: (sessionId: string) => AiChatSessionItem | null
  // 创建或更新 AI 会话。
  ensureSession: (input: EnsureSessionInput) => void
  // 写入 AI 消息。
  appendMessage: (input: AppendMessageInput) => void
  // 更新助手消息展示快照。
  updateAssistantMessage: (input: UpdateAssistantMessageInput) => void
  // 创建 Agent run。
  startRun: (input: StartRunInput) => void
  // 结束 Agent run。
  finishRun: (input: FinishRunInput) => void
  // 读取 Agent run，供测试和审计使用。
  getRun: (runId: string) => PersistedRun | null
  // 写入或更新工具调用。
  upsertToolCall: (input: UpsertToolCallInput) => void
  // 读取 run 的工具调用。
  listToolCalls: (runId: string) => PersistedToolCall[]
  // 读取 run 的上下文快照。
  listContextSnapshots: (runId: string) => PersistedContextSnapshot[]
}

// Define input and persisted output types in the same file with Chinese comments.
```

Use helper functions:

```ts
const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    return JSON.stringify({ error: '数据无法序列化' })
  }
}

const parseArray = <T>(value: string): T[] => {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

const mapMessageRow = (row: AiChatMessageRow): AiChatMessageItem => ({
  id: row.id,
  role: row.role,
  content: row.content,
  time: row.time,
  answer: row.answer ?? undefined,
  parts: parseArray<AiChatMessagePart>(row.parts_json),
  toolSteps: parseArray<AiToolStep>(row.tool_steps_json)
})

const mapSessionRow = (row: AiChatSessionRow, messages: AiChatMessageItem[] = []): AiChatSessionItem => ({
  id: row.id,
  title: row.title,
  summary: row.summary,
  status: row.status,
  time: row.last_message_at.slice(11, 16) || row.last_message_at,
  messages
})
```

The SQL for `ensureSession` must use upsert:

```sql
INSERT INTO ai_chat_sessions (id, title, summary, status, created_at, updated_at, last_message_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  summary = excluded.summary,
  status = excluded.status,
  updated_at = excluded.updated_at,
  last_message_at = excluded.last_message_at
```

The SQL for `upsertToolCall` must use `ON CONFLICT(run_id, tool_call_id) DO UPDATE`.

- [ ] **Step 4: Verify Task 2**

Run:

```bash
pnpm test test/main/services/aiChatPersistenceService.test.ts
pnpm typecheck
```

Expected: service test passes and typecheck passes.

---

### Task 3: Main IPC Persistence Wiring

**Files:**
- Modify: `src/main/ipc/aiHandlers.ts`
- Modify: `test/main/ipc/aiHandlers.test.ts`

- [ ] **Step 1: Extend IPC tests**

Add imports and mocks in `test/main/ipc/aiHandlers.test.ts`:

```ts
import { ipcMain } from 'electron'
import { registerAiHandlers } from '../../../src/main/ipc/aiHandlers'
import { createAiChatPersistenceService } from '../../../src/main/services/aiChatPersistenceService'

vi.mock('../../../src/main/services/aiChatPersistenceService', () => ({
  createAiChatPersistenceService: vi.fn()
}))
```

Add a test that captures handlers:

```ts
it('registers AI history handlers through persistence service', async () => {
  const service = {
    listSessions: vi.fn(() => [{ id: 's1', title: '历史', summary: '摘要', time: '10:00', status: '运行完成', messages: [] }]),
    getSession: vi.fn(() => ({ id: 's1', title: '历史', summary: '摘要', time: '10:00', status: '运行完成', messages: [] }))
  }
  vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)

  registerAiHandlers()

  const calls = vi.mocked(ipcMain.handle).mock.calls
  const listHandler = calls.find(([channel]) => channel === 'ai:sessions:list')?.[1]
  const getHandler = calls.find(([channel]) => channel === 'ai:session:get')?.[1]

  expect(await listHandler?.({} as never)).toEqual(service.listSessions())
  expect(await getHandler?.({} as never, 's1')).toEqual(service.getSession('s1'))
})
```

Add a lifecycle test with a fake provider if feasible in this file; otherwise cover it in service and renderer tests, and keep IPC test scoped to handler registration plus model options.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test test/main/ipc/aiHandlers.test.ts
```

Expected: fail because handlers are not registered yet.

- [ ] **Step 3: Wire persistence into `aiHandlers.ts`**

Modify imports:

```ts
import { createAiChatPersistenceService, type DatabaseConnection as AiChatDatabaseConnection } from '../services/aiChatPersistenceService'
```

Inside `registerAiHandlers()`:

```ts
  const aiChatService = createAiChatPersistenceService(database as unknown as AiChatDatabaseConnection)

  ipcMain.handle('ai:sessions:list', async () => aiChatService.listSessions())
  ipcMain.handle('ai:session:get', async (_, sessionId: string) => aiChatService.getSession(sessionId))
```

In `ai:chat:start`, before starting the async run:

```ts
    const timestamp = createTimestamp()
    const userTime = createDisplayTime(timestamp)
    const userMessageId = `${runId}-user`
    const assistantMessageId = `${runId}-assistant`

    aiChatService.ensureSession({
      id: payload.sessionId,
      title: payload.message.slice(0, 15) + (payload.message.length > 15 ? '...' : ''),
      summary: payload.message,
      status: '运行中',
      timestamp
    })
    aiChatService.appendMessage({
      id: userMessageId,
      sessionId: payload.sessionId,
      role: 'user',
      content: payload.message,
      time: userTime,
      timestamp
    })
    aiChatService.appendMessage({
      id: assistantMessageId,
      sessionId: payload.sessionId,
      role: 'assistant',
      content: `正在处理：“${payload.message}”`,
      answer: '',
      parts: [],
      toolSteps: [],
      time: userTime,
      timestamp
    })
    aiChatService.startRun({
      id: runId,
      sessionId: payload.sessionId,
      assistantMessageId,
      provider: providerId,
      model: modelId,
      context: payload.context ?? [],
      timestamp
    })
```

During event handling, persist tool and text changes. Keep local mutable snapshots inside the async closure:

```ts
    const assistantParts: AiChatMessagePart[] = []
    const assistantToolSteps: AiToolStep[] = []
    let assistantAnswer = ''
```

On `text_delta`, append text to `assistantAnswer` and update message. On `tool_started`, upsert running tool and add a tool part. On `tool_finished` or `tool_failed`, update tool call and tool step. On `done`, call `finishRun({ status: 'completed' })`; on catch, call `finishRun({ status: 'failed', error })`.

- [ ] **Step 4: Verify Task 3**

Run:

```bash
pnpm test test/main/ipc/aiHandlers.test.ts
pnpm typecheck
```

Expected: IPC tests and typecheck pass.

---

### Task 4: Preload and Renderer API Types

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Modify: `src/renderer/src/features/ai-chat/aiChatMock.ts`

- [ ] **Step 1: Add preload methods**

In `src/preload/index.ts`, extend `api.ai`:

```ts
    listSessions: (): Promise<AiChatSession[]> =>
      ipcRenderer.invoke('ai:sessions:list'),
    getSession: (sessionId: string): Promise<AiChatSession | null> =>
      ipcRenderer.invoke('ai:session:get', sessionId),
```

Define local preload types mirroring existing renderer types:

```ts
type AiChatSession = {
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
  messages: AiChatMessage[]
}
```

Add `AiChatMessage`, `AiChatMessagePart`, and `AiToolStep` only once; avoid duplicating incompatible names.

- [ ] **Step 2: Add `env.d.ts` methods**

Extend `Window['api']['ai']`:

```ts
      listSessions: () => Promise<AiChatSession[]>
      getSession: (sessionId: string) => Promise<AiChatSession | null>
```

- [ ] **Step 3: Verify Task 4**

Run:

```bash
pnpm typecheck
```

Expected: typecheck passes.

---

### Task 5: Renderer Hydration

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `test/renderer/App.test.tsx`

- [ ] **Step 1: Write renderer tests first**

In `test/renderer/App.test.tsx`, add or extend `window.api` mocks:

```ts
window.api = {
  ai: {
    listSessions: vi.fn(async () => [
      {
        id: 'persisted-s1',
        title: '持久化会话',
        summary: '从 SQLite 恢复',
        time: '10:00',
        status: '运行完成',
        messages: [
          {
            id: 'persisted-m1',
            role: 'user',
            content: '恢复一条历史',
            time: '10:00'
          }
        ]
      }
    ]),
    getSession: vi.fn(async (sessionId: string) => ({
      id: sessionId,
      title: '持久化会话',
      summary: '从 SQLite 恢复',
      time: '10:00',
      status: '运行完成',
      messages: [
        {
          id: 'persisted-m1',
          role: 'user',
          content: '恢复一条历史',
          time: '10:00'
        }
      ]
    })),
    getModelOptions: vi.fn(async () => ({
      defaultProvider: 'bailian',
      defaultModel: 'MiniMax-M2.5',
      providers: [],
      agent: { context: { toolOutputMaxChars: 4096, recentToolResultLimit: 3 } }
    })),
    startChat: vi.fn(),
    onChatEvent: vi.fn(() => () => undefined)
  }
} as never
```

Test:

```ts
it('启动时优先使用持久化 AI 会话', async () => {
  render(<App />)

  await waitFor(() => {
    expect(screen.getByText('持久化会话')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run renderer test to verify failure**

Run:

```bash
pnpm test test/renderer/App.test.tsx
```

Expected: new test fails because `App` does not call `listSessions` yet.

- [ ] **Step 3: Hydrate sessions in `App.tsx`**

Add startup effect:

```ts
  useEffect(() => {
    let isMounted = true

    void window.api?.ai?.listSessions?.()
      .then((sessions) => {
        if (!isMounted || sessions.length === 0) {
          return
        }

        setChatSessions(sessions)
        setActiveChatId(sessions[0].id)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }
      })

    return () => {
      isMounted = false
    }
  }, [])
```

Add session-switch detail loading:

```ts
  useEffect(() => {
    if (!window.api?.ai?.getSession) {
      return
    }

    let isMounted = true

    void window.api.ai.getSession(activeChatId).then((session) => {
      if (!isMounted || !session) {
        return
      }

      setChatSessions((prevSessions) =>
        prevSessions.map((item) => (item.id === session.id ? session : item))
      )
    })

    return () => {
      isMounted = false
    }
  }, [activeChatId])
```

Keep existing optimistic UI update in `handleSendMessage`.

- [ ] **Step 4: Verify Task 5**

Run:

```bash
pnpm test test/renderer/App.test.tsx
pnpm typecheck
```

Expected: renderer test and typecheck pass.

---

### Task 6: End-to-End Verification and Cleanup

**Files:**
- Review all touched files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm test test/main/db/index.test.ts test/main/services/aiChatPersistenceService.test.ts test/main/ipc/aiHandlers.test.ts test/renderer/App.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Run type/lint gate**

Run:

```bash
pnpm lint
```

Expected: TypeScript checks pass.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: Electron Vite build succeeds.

- [ ] **Step 5: Check diff hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Status shows only intended files.

- [ ] **Step 6: Manual review checklist**

Confirm:

- No API Key or provider `options` is persisted.
- No `git commit` or `git merge` was run.
- No unrelated UI restyling was introduced.
- No Unicode replacement character was introduced.
- Renderer imports still use `@renderer/` aliases.
- New TS functions use arrow functions except existing exported function declarations already present in local style.
