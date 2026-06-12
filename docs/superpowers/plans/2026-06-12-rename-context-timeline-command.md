# Rename `/showContextTimeline` to `/contextTimeline` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `/showContextTimeline` command name to `/contextTimeline`, and rename its internal ID and TypeScript types from `"showContextTimeline"` to `"contextTimeline"`.

**Architecture:** Refactor the command types, command definitions in constants, controller interception logic, and the corresponding unit test suite to use the new command name and ID, ensuring type-safety and passing tests.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Type Refactoring

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`

- [ ] **Step 1: Modify types in types.ts**

Update `AiChatInputCommandId` union type:

```typescript
export type AiChatInputCommandId = "clear" | "undo" | "model" | "contextTimeline";
```

---

### Task 2: Constant Definition Refactoring

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`

- [ ] **Step 1: Modify constant definition in constants.ts**

Update the `/showContextTimeline` object to use the new `id` and `name`:

```typescript
  {
    id: "contextTimeline",
    name: "/contextTimeline",
    aliases: [],
    description: "显示或隐藏上下文时间线",
    addToContext: false,
  },
```

---

### Task 3: Controller Callback Refactoring

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Modify handler in App.tsx**

Update `handleCommandExecute` callback to intercept `"contextTimeline"`:

```typescript
  // 执行 AI 对话斜杠命令。
  const handleCommandExecute = (
    command: AiChatInputCommandId,
  ): string | void | Promise<string | void> => {
    if (command === "contextTimeline") {
      setIsContextTimelineOpen((prev) => !prev);
      return;
    }
    return handleAiChatCommand(command);
  };
```

---

### Task 4: Unit Test Suite Refactoring

**Files:**
- Modify: `test/renderer/features/ai-chat/AiChatInput.test.tsx`

- [ ] **Step 1: Modify command tests to use new ID and name**

Replace test title and expectations for `/showContextTimeline` with `/contextTimeline`:

```typescript
  it('支持 /contextTimeline 命令匹配与触发', async () => {
    const onCommandExecute = vi.fn()
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI Chat Input Area')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/context'
      }
    })

    await waitFor(() => expect(screen.getByRole('option', { name: /\/contextTimeline/ })).toBeInTheDocument())
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })
    expect(onCommandExecute).toHaveBeenCalledWith('contextTimeline')
  })
```

- [ ] **Step 2: Update navigation tests for ArrowUp select**

Update target selection check in `'命令面板上下键循环选择'` test to expect `/contextTimeline`:

```typescript
    // 上键循环，选中末项 /contextTimeline
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/contextTimeline/ })).toHaveAttribute('aria-selected', 'true')
    })
```

---

### Task 5: Verification and Build

- [ ] **Step 1: Run the updated test suite**

Run: `pnpm vitest run test/renderer/features/ai-chat/AiChatInput.test.tsx`
Expected: Tests for matching `/contextTimeline` pass.

- [ ] **Step 2: Run build / typecheck to ensure zero type errors**

Run: `pnpm typecheck`
Expected: Zero compilation and type errors.
