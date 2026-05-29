# AI Chat Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project AGENTS.md forbids `git commit/merge`; do not include commit steps.

**Goal:** Build a global AI chat context store, derive message-list context for `AiChatWorkspace`, and use model `limit.context` from `/Users/yonah/.mc/config.json` through safe IPC model options.

**Architecture:** Renderer context lives in a focused Zustand store plus pure builder functions. `AiChatWorkspace` syncs session messages into the store and renders a compact `AiChatContextBar`. Main-process IPC safely exposes model `limit` and `modalities` while continuing to hide provider credentials.

**Tech Stack:** React 19, Zustand, Electron IPC, TypeScript, Vitest, Testing Library.

---

## File Structure

- Create `src/renderer/src/features/ai-chat/aiChatContextBuilder.ts` for context item types, stable keys, message derivation, token estimates, model lookup, and budget stats.
- Create `src/renderer/src/features/ai-chat/aiChatContextStore.ts` for the global per-session context store.
- Create `src/renderer/src/features/ai-chat/components/AiChatContextBar.tsx` for the compact expandable context UI.
- Modify `src/renderer/src/features/ai-chat/components/AiChatWorkspace.tsx` to sync message context and render the bar.
- Modify `src/renderer/src/features/ai-chat/aiChatMock.ts`, `src/renderer/src/env.d.ts`, and `src/preload/index.ts` to include model `limit` and `modalities` types.
- Modify `src/main/ipc/aiHandlers.ts` to return model `limit` and `modalities`, not provider `options`.
- Add tests:
  - `test/renderer/features/ai-chat/aiChatContextBuilder.test.ts`
  - `test/renderer/features/ai-chat/aiChatContextStore.test.ts`
  - `test/renderer/features/ai-chat/AiChatWorkspace.test.tsx`
  - Extend `test/main/ipc/aiHandlers.test.ts`

## Task 1: Builder Red-Green

- [ ] **Step 1: Write failing builder tests**

Create `test/renderer/features/ai-chat/aiChatContextBuilder.test.ts` with tests for:

```ts
import { describe, expect, it } from 'vitest'
import type { AiChatMessage, AiModelProviderOption, AiModelSelection } from '@renderer/features/ai-chat/aiChatMock'
import {
  buildMessageContextItems,
  estimateAiChatContextTokens,
  getAiChatContextBudget,
  resolveAiChatSelectedModelOption
} from '@renderer/features/ai-chat/aiChatContextBuilder'

describe('aiChatContextBuilder', () => {
  it('从用户与助手消息派生稳定上下文条目', () => {
    const messages: AiChatMessage[] = [
      { id: 'u1', role: 'user', content: '帮我整理今天的记录', time: '10:00' },
      { id: 'a1', role: 'assistant', content: '正在处理', answer: '今天的核心线索是测试优先。', time: '10:01' }
    ]

    const items = buildMessageContextItems('s1', messages)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      key: 'message:u1',
      sessionId: 's1',
      kind: 'message',
      sourceId: 'u1',
      title: '用户消息',
      content: '帮我整理今天的记录',
      meta: { role: 'user' }
    })
    expect(items[1]).toMatchObject({
      key: 'message:a1',
      title: '助手回答',
      content: '今天的核心线索是测试优先。',
      meta: { role: 'assistant' }
    })
  })

  it('过滤空内容并使用 answer 优先于 assistant content', () => {
    const messages: AiChatMessage[] = [
      { id: 'empty', role: 'user', content: '   ', time: '10:00' },
      { id: 'a1', role: 'assistant', content: '处理中', answer: '最终回答', time: '10:01' }
    ]

    const items = buildMessageContextItems('s1', messages)

    expect(items).toHaveLength(1)
    expect(items[0].content).toBe('最终回答')
  })

  it('估算 tokens 并根据当前模型 limit 计算预算', () => {
    expect(estimateAiChatContextTokens('12345678')).toBe(2)

    const modelOptions: AiModelProviderOption[] = [
      {
        id: 'bailian',
        name: 'Bailian',
        models: [
          {
            id: 'MiniMax-M2.5',
            name: 'MiniMax-M2.5',
            limit: { context: 204800, output: 131072 },
            modalities: { input: ['text'], output: ['text'] }
          }
        ]
      }
    ]
    const selected: AiModelSelection = { provider: 'bailian', model: 'MiniMax-M2.5' }

    expect(resolveAiChatSelectedModelOption(modelOptions, selected)?.limit?.context).toBe(204800)
    expect(
      getAiChatContextBudget({
        items: [{ key: 'x', sessionId: 's1', kind: 'message', sourceId: 'x', title: 'T', summary: 'S', content: '12345678', tokens: 2, createdAt: 0, meta: {} }],
        modelOptions,
        selectedModel: selected
      })
    ).toMatchObject({ totalTokens: 2, contextLimit: 204800, usagePercent: 0 })
  })
})
```

- [ ] **Step 2: Run builder tests and verify RED**

Run: `pnpm test test/renderer/features/ai-chat/aiChatContextBuilder.test.ts`

Expected: FAIL because `aiChatContextBuilder` does not exist.

- [ ] **Step 3: Implement builder**

Create `src/renderer/src/features/ai-chat/aiChatContextBuilder.ts` with exported types and functions required by the tests.

- [ ] **Step 4: Run builder tests and verify GREEN**

Run: `pnpm test test/renderer/features/ai-chat/aiChatContextBuilder.test.ts`

Expected: PASS.

## Task 2: Store Red-Green

- [ ] **Step 1: Write failing store tests**

Create `test/renderer/features/ai-chat/aiChatContextStore.test.ts` covering:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useAiChatContextStore } from '@renderer/features/ai-chat/aiChatContextStore'

const item = {
  key: 'message:m1',
  sessionId: 's1',
  kind: 'message' as const,
  sourceId: 'm1',
  title: '用户消息',
  summary: '摘要',
  content: '内容',
  tokens: 1,
  createdAt: 1,
  meta: { role: 'user' }
}

describe('aiChatContextStore', () => {
  beforeEach(() => useAiChatContextStore.getState().resetAll())

  it('按会话隔离并按 key 去重', () => {
    const store = useAiChatContextStore.getState()
    store.addItem(item)
    store.addItem(item)
    store.addItem({ ...item, key: 'message:m2', sourceId: 'm2', sessionId: 's2' })

    expect(useAiChatContextStore.getState().getSessionItems('s1')).toHaveLength(1)
    expect(useAiChatContextStore.getState().getSessionItems('s2')).toHaveLength(1)
  })

  it('同步消息上下文时保留非消息上下文', () => {
    const store = useAiChatContextStore.getState()
    store.addItem({ ...item, kind: 'memory', key: 'memory:m1' })
    store.syncMessageItems('s1', [{ ...item, key: 'message:m2', sourceId: 'm2' }])

    const items = useAiChatContextStore.getState().getSessionItems('s1')
    expect(items.map((value) => value.key)).toEqual(['memory:m1', 'message:m2'])
  })

  it('支持删除和清空会话', () => {
    const store = useAiChatContextStore.getState()
    store.addItem(item)
    store.removeItem('s1', 'message:m1')
    expect(useAiChatContextStore.getState().getSessionItems('s1')).toHaveLength(0)

    store.addItem(item)
    store.clearSession('s1')
    expect(useAiChatContextStore.getState().getSessionItems('s1')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run store tests and verify RED**

Run: `pnpm test test/renderer/features/ai-chat/aiChatContextStore.test.ts`

Expected: FAIL because `aiChatContextStore` does not exist.

- [ ] **Step 3: Implement store**

Create `src/renderer/src/features/ai-chat/aiChatContextStore.ts` using Zustand. Include `resetAll` only for tests and deterministic cleanup.

- [ ] **Step 4: Run store tests and verify GREEN**

Run: `pnpm test test/renderer/features/ai-chat/aiChatContextStore.test.ts`

Expected: PASS.

## Task 3: Model Options Red-Green

- [ ] **Step 1: Write failing IPC test**

Extend `test/main/ipc/aiHandlers.test.ts` to verify `createModelOptionsResponse` returns `limit/modalities` and omits `options`.

- [ ] **Step 2: Run IPC test and verify RED**

Run: `pnpm test test/main/ipc/aiHandlers.test.ts`

Expected: FAIL because `createModelOptionsResponse` is not exported or does not return limit/modalities.

- [ ] **Step 3: Implement safe model option passthrough**

Modify `src/main/ipc/aiHandlers.ts`, `src/preload/index.ts`, `src/renderer/src/env.d.ts`, and `src/renderer/src/features/ai-chat/aiChatMock.ts`.

- [ ] **Step 4: Run IPC test and verify GREEN**

Run: `pnpm test test/main/ipc/aiHandlers.test.ts`

Expected: PASS.

## Task 4: Workspace UI Red-Green

- [ ] **Step 1: Write failing workspace test**

Create `test/renderer/features/ai-chat/AiChatWorkspace.test.tsx` using Testing Library. Render `AiChatWorkspace` with one user and one assistant message plus model limit `204800`; assert the context bar displays `上下文`, `2 条`, and `204800`.

- [ ] **Step 2: Run workspace test and verify RED**

Run: `pnpm test test/renderer/features/ai-chat/AiChatWorkspace.test.tsx`

Expected: FAIL because `AiChatContextBar` is not rendered.

- [ ] **Step 3: Implement context bar and workspace sync**

Create `AiChatContextBar.tsx`; update `AiChatWorkspace.tsx` to build message items on session message changes, sync them to the global store, and render budget stats from selected model.

- [ ] **Step 4: Run workspace test and verify GREEN**

Run: `pnpm test test/renderer/features/ai-chat/AiChatWorkspace.test.tsx`

Expected: PASS.

## Task 5: Existing Renderer Compatibility

- [ ] **Step 1: Update existing model mocks**

Update `test/renderer/App.test.tsx` model mocks if TypeScript requires `limit/modalities`.

- [ ] **Step 2: Run App renderer tests**

Run: `pnpm test test/renderer/App.test.tsx`

Expected: PASS.

## Task 6: Full Verification

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm test test/renderer/features/ai-chat/aiChatContextBuilder.test.ts test/renderer/features/ai-chat/aiChatContextStore.test.ts test/renderer/features/ai-chat/AiChatWorkspace.test.tsx test/main/ipc/aiHandlers.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run project test suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Run lint/typecheck**

Run: `pnpm lint`

Expected: PASS.

- [ ] **Step 4: Run build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 5: Review diff hygiene**

Run: `git diff --check` and `git diff --stat`.

Expected: no whitespace errors; changed files limited to docs, AI chat context, model option types, IPC test, and renderer tests.

## Task 7: Payload Injection And Main-Process Budgeting

- [x] **Step 1: Write failing main-process context message tests**

Create `test/main/agent/contextMessages.test.ts` to prove historical message context becomes real `AgentMessage` entries and latest context survives budget pressure with deterministic compression.

- [x] **Step 2: Write failing renderer payload regression test**

Update `test/renderer/App.test.tsx` to send two AI turns and assert the second `startChat` payload contains the first user message and assistant answer.

- [x] **Step 3: Implement context payload and main-process message construction**

Create `src/main/agent/contextMessages.ts`; update `src/main/ipc/aiHandlers.ts`, `src/renderer/src/App.tsx`, `src/preload/index.ts`, `src/renderer/src/env.d.ts`, and `src/renderer/src/features/ai-chat/aiChatMock.ts`.

- [x] **Step 4: Verify targeted RED/GREEN tests**

Run:

```bash
pnpm vitest run test/main/agent/contextMessages.test.ts
pnpm vitest run test/renderer/App.test.tsx -t "AI 对话第二轮发送时携带上一轮消息上下文"
```

Expected: PASS after implementation.

## Task 8: OpenCode-Style Context Boundaries

- [x] **Step 1: Write failing grouped context budgeting test**

Update `test/main/agent/contextMessages.test.ts` with a tight-budget case where old and new user/assistant pairs exist. Expected behavior: keep the newest complete pair and current user message, and do not compress an old assistant response into the request by itself.

- [x] **Step 2: Implement grouped context selection**

Update `src/main/agent/contextMessages.ts` so `message` context items are grouped by turn. Select groups newest-first, compress only when the newest selected group itself exceeds budget, and preserve chronological order in final `AgentMessage[]`.

- [x] **Step 3: Write failing global context cache limit test**

Update `test/renderer/features/ai-chat/aiChatContextStore.test.ts` to add 21 sessions and assert the first session is pruned while 20 recent sessions remain.

- [x] **Step 4: Implement session cache pruning**

Update `src/renderer/src/features/ai-chat/aiChatContextStore.ts` with a 20-session cap. Every write moves that session to the recent end, then prunes the oldest entries.

- [x] **Step 5: Verify targeted tests**

Run:

```bash
pnpm vitest run test/main/agent/contextMessages.test.ts test/renderer/features/ai-chat/aiChatContextStore.test.ts
pnpm vitest run test/renderer/App.test.tsx -t "AI 对话第二轮发送时携带上一轮消息上下文"
```

Expected: PASS.
