# ReAct Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude Code style ReAct loop with provider configuration, People table read tools, streaming output, tool-step output, and buffered typewriter rendering.

**Architecture:** The main process owns provider calls, tool execution, and the agent loop. The renderer sends chat runs over IPC and receives typed stream events. Provider code normalizes OpenAI compatible, OpenAI, Anthropic, and Google configuration while defaulting to Bailian MiniMax.

**Tech Stack:** Electron IPC, TypeScript, native `fetch`, Vitest, React.

---

## File Structure

- Create `src/main/agent/types.ts` for shared main-process agent/provider/tool types.
- Create `src/main/agent/providerConfig.ts` for `/Users/yonah/.mc/config.json` reading and normalization.
- Create `src/main/agent/openaiCompatibleProvider.ts` for OpenAI compatible streaming and SSE parsing.
- Create `src/main/agent/providerFactory.ts` for provider construction across configured formats.
- Create `src/main/agent/peopleTool.ts` for the read-only People tool.
- Create `src/main/agent/reactAgent.ts` for the ReAct loop.
- Create `src/main/ipc/aiHandlers.ts` for chat start and event streaming.
- Modify `src/main/index.ts` to register AI IPC.
- Modify `src/preload/index.ts` and `src/renderer/src/env.d.ts` to expose AI chat APIs.
- Modify `src/renderer/src/components/layout/aiChatMock.ts`, `AiChatWorkspace.tsx`, `AiChatMessageBubble.tsx`, and `App.tsx` to use real streamed events.
- Add tests under `test/main/agent/` and update renderer tests for chat streaming.
- Write `/Users/yonah/.mc/config.json` with default Bailian/MiniMax config.

## Tasks

### Task 1: Config And Provider Tests

- [ ] Write failing tests for config normalization and provider selection.
- [ ] Implement config reader and provider factory.
- [ ] Write `/Users/yonah/.mc/config.json`.
- [ ] Run `pnpm test test/main/agent/providerConfig.test.ts test/main/agent/providerFactory.test.ts`.

### Task 2: OpenAI Compatible Stream Parser

- [ ] Write failing tests for SSE text deltas and streamed tool-call argument assembly.
- [ ] Implement OpenAI compatible request/stream parser.
- [ ] Run `pnpm test test/main/agent/openaiCompatibleProvider.test.ts`.

### Task 3: People Tool

- [ ] Write failing tests for `people_list` query, relationship filtering, limit, and observation truncation.
- [ ] Implement read-only People tool.
- [ ] Run `pnpm test test/main/agent/peopleTool.test.ts`.

### Task 4: ReAct Loop

- [ ] Write failing tests proving a tool call is executed, observed, and followed by a final model turn.
- [ ] Implement bounded ReAct loop and event emission.
- [ ] Run `pnpm test test/main/agent/reactAgent.test.ts`.

### Task 5: IPC Bridge

- [ ] Add AI IPC handler and preload API.
- [ ] Ensure unsubscribe cleans listeners.
- [ ] Run `pnpm typecheck`.

### Task 6: Renderer Streaming UI

- [ ] Write failing renderer test for streamed text and tool-step updates.
- [ ] Replace mock delayed answer with real IPC stream handling.
- [ ] Add buffered typewriter flushing.
- [ ] Run `pnpm test test/renderer/App.test.tsx`.

### Task 7: Full Verification

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Review `git diff --check` and `git diff --stat`.
