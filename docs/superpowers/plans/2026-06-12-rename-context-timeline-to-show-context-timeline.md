# Rename `/contextTimeline` back to `/showContextTimeline` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the slash command `/contextTimeline` back to `/showContextTimeline` and update its TypeScript type definition, constant mappings, test files, and app routing integration to use `"showContextTimeline"` as the unique ID and `"/showContextTimeline"` as the command.

**Architecture:** Refactor the codebase where `"contextTimeline"` is currently used as an AiChatInput command to `"showContextTimeline"`.
- Update `types.ts` command ID union.
- Update `constants.ts` command definition.
- Update `App.tsx` handling mapping.
- Update tests to assert matching `/showContextTimeline` and command execution with `'showContextTimeline'`.

**Tech Stack:** React, TypeScript, Vitest, Tailwind CSS.

---

### Task 1: Type Definitions and Constants Refactoring

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts:5-5`
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts:27-32`

- [ ] **Step 1: Update type definition `AiChatInputCommandId` in types.ts**

Open `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts` and change `"contextTimeline"` to `"showContextTimeline"`.

```typescript
export type AiChatInputCommandId = "clear" | "undo" | "model" | "showContextTimeline";
```

- [ ] **Step 2: Update constant configuration `AI_CHAT_INPUT_COMMANDS` in constants.ts**

Open `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts` and update the command ID and name:

```typescript
  {
    id: "showContextTimeline",
    name: "/showContextTimeline",
    aliases: [],
    description: "显示或隐藏上下文时间线",
    addToContext: false,
  },
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `pnpm typecheck`
Expected: Passes without errors related to these files.

- [ ] **Step 4: Commit types and constants updates**

```bash
git add src/renderer/src/features/ai-chat/components/AiChatInput/types.ts src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts
git commit -m "refactor(ai-chat): rename contextTimeline to showContextTimeline in types and constants"
```

---

### Task 2: Application Command Handling

**Files:**
- Modify: `src/renderer/src/App.tsx:160-163`

- [ ] **Step 1: Update command interceptor logic in App.tsx**

Open `src/renderer/src/App.tsx` and change `"contextTimeline"` intercept to `"showContextTimeline"`:

```typescript
    if (command === "showContextTimeline") {
      setIsContextTimelineOpen((prev) => !prev);
      return;
    }
```

- [ ] **Step 2: Verify type-checking**

Run: `pnpm typecheck`
Expected: Passes with no errors in App.tsx.

- [ ] **Step 3: Commit application controller changes**

```bash
git add src/renderer/src/App.tsx
git commit -m "refactor(ai-chat): update command execution callback to intercept showContextTimeline"
```

---

### Task 3: Unit Tests Updating

**Files:**
- Modify: `test/renderer/features/ai-chat/AiChatInput.test.tsx:184-201`
- Modify: `test/renderer/features/ai-chat/AiChatInput.test.tsx:223-227`

- [ ] **Step 1: Update the specific test for timeline toggle command in AiChatInput.test.tsx**

Open `test/renderer/features/ai-chat/AiChatInput.test.tsx` and update the test block:

```typescript
  it('支持 /showContextTimeline 命令匹配与触发', async () => {
    const onCommandExecute = vi.fn()
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI Chat Input Area')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/show'
      }
    })

    await waitFor(() => expect(screen.getByRole('option', { name: /\/showContextTimeline/ })).toBeInTheDocument())
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })
    expect(onCommandExecute).toHaveBeenCalledWith('showContextTimeline')
  })
```

- [ ] **Step 2: Update command list navigation cycling test in AiChatInput.test.tsx**

Open `test/renderer/features/ai-chat/AiChatInput.test.tsx` and update lines 223-227 to expect `/showContextTimeline` instead of `/contextTimeline`:

```typescript
    // 上键循环，选中末项 /showContextTimeline
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/showContextTimeline/ })).toHaveAttribute('aria-selected', 'true')
    })
```

- [ ] **Step 3: Run targeted test suite**

Run: `npx vitest run test/renderer/features/ai-chat/AiChatInput.test.tsx`
Expected: The tests `/showContextTimeline 命令匹配与触发` and `命令面板上下键循环选择` pass successfully.

- [ ] **Step 4: Commit test updates**

```bash
git add test/renderer/features/ai-chat/AiChatInput.test.tsx
git commit -m "test(ai-chat): update tests to expect showContextTimeline"
```
