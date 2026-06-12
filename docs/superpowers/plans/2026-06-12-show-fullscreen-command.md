# /showFullScreen Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new slash command `/showFullScreen` in the AI Chat Input that collapses both the application Sidebar and the AI Context Timeline.

**Architecture:** Extend the existing `onCommandExecute` slash command propagation mechanism in the workspace, intercepting `"showFullScreen"` in `App.tsx` and updating React states `isSidebarCollapsed` and `isContextTimelineOpen`.

**Tech Stack:** React, TypeScript, Vitest, Testing Library

---

### Task 1: Type Definitions and Constants Registration

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`

- [ ] **Step 1: Add command ID to `AiChatInputCommandId` union type**

In `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`:
```typescript
export type AiChatInputCommandId = "clear" | "undo" | "model" | "showContextTimeline" | "session" | "showFullScreen";
```

- [ ] **Step 2: Register command details in `AI_CHAT_INPUT_COMMANDS` array**

In `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`:
```typescript
export const AI_CHAT_INPUT_COMMANDS: AiChatInputCommand[] = [
  ...
  {
    id: "showFullScreen",
    name: "/showFullScreen",
    aliases: [],
    description: "折叠侧边栏和上下文时间线",
    addToContext: false,
  },
];
```

- [ ] **Step 3: Run project compilation check to ensure no TS errors**

Run: `npm run typecheck` (or corresponding command)

---

### Task 2: Command Execution in App.tsx

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Handle command `"showFullScreen"` inside `handleCommandExecute`**

In `src/renderer/src/App.tsx`:
```typescript
  // 执行 AI 对话斜杠命令。
  const handleCommandExecute = (
    command: AiChatInputCommandId,
  ): string | void | Promise<string | void> => {
    if (command === "showContextTimeline") {
      setIsContextTimelineOpen((prev) => !prev);
      return;
    }
    if (command === "showFullScreen") {
      setIsSidebarCollapsed(true);
      setIsContextTimelineOpen(false);
      return;
    }
    return handleAiChatCommand(command);
  };
```

---

### Task 3: Test Updates and Verification

**Files:**
- Modify: `test/renderer/features/ai-chat/AiChatInput.test.tsx`

- [ ] **Step 1: Add test case for matching and triggering `/showFullScreen`**

In `test/renderer/features/ai-chat/AiChatInput.test.tsx` (after `/showContextTimeline` test):
```typescript
  it('支持 /showFullScreen 命令匹配与触发', async () => {
    const onCommandExecute = vi.fn()
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI Chat Input Area')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/showFullScreen'
      }
    })

    await waitFor(() => expect(screen.getByRole('option', { name: /\/showFullScreen/ })).toBeInTheDocument())
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })
    expect(onCommandExecute).toHaveBeenCalledWith('showFullScreen')
  })
```

- [ ] **Step 2: Update the loop selection test case to expect `/showFullScreen` as the last command**

In `test/renderer/features/ai-chat/AiChatInput.test.tsx` (inside `命令面板上下键循环选择` test case):
```typescript
    // 上键循环，选中末项 /showFullScreen
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/showFullScreen/ })).toHaveAttribute('aria-selected', 'true')
    })
```

- [ ] **Step 3: Run the test suite and verify everything passes**

Run: `npm run test` (or `npx vitest run test/renderer/features/ai-chat/AiChatInput.test.tsx`)
Expected: All tests pass.
