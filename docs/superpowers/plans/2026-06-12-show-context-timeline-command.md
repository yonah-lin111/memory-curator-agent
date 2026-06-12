# /showContextTimeline Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new slash command `/showContextTimeline` in the AI Chat Input command panel that toggles the visibility of the context timeline panel (`AiChatContextTimeline.tsx`).

**Architecture:** Extend the chat input command list inside `constants.ts` and `types.ts`, and intercept the command execution in `App.tsx` to toggle the `isContextTimelineOpen` React state, clearing and focusing the input after toggle.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons.

---

### Task 1: Update Types & Constants

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`

- [ ] **Step 1: Update `AiChatInputCommandId` in types.ts**

In `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`, add `"showContextTimeline"` to the `AiChatInputCommandId` type union.

```typescript
export type AiChatInputCommandId = "clear" | "undo" | "model" | "showContextTimeline";
```

- [ ] **Step 2: Add `/showContextTimeline` command definition in constants.ts**

In `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`, add the new command object to `AI_CHAT_INPUT_COMMANDS`.

```typescript
  {
    id: "showContextTimeline",
    name: "/showContextTimeline",
    aliases: [],
    description: "显示或隐藏上下文时间线",
    addToContext: false,
  },
```

---

### Task 2: Implement Command Action in App.tsx

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Intercept `showContextTimeline` in App.tsx**

Update the `<AiChatWorkspace>` call on `App.tsx` to handle the command by toggling the timeline's visibility state.

Define `handleCommandExecute`:
```typescript
  const handleCommandExecute = (command: AiChatInputCommandId) => {
    if (command === "showContextTimeline") {
      setIsContextTimelineOpen((prev) => !prev);
      return;
    }
    return handleAiChatCommand(command);
  };
```

Pass it as `onCommandExecute`:
```typescript
            <AiChatWorkspace
              ...
              isContextTimelineOpen={isContextTimelineOpen}
              onCommandExecute={handleCommandExecute}
              ...
            />
```

---

### Task 3: Add Unit Tests

**Files:**
- Modify: `test/renderer/features/ai-chat/AiChatInput.test.tsx`

- [ ] **Step 1: Add a test checking the `/showContextTimeline` command**

Add a test block in `test/renderer/features/ai-chat/AiChatInput.test.tsx` to verify the new command executes `onCommandExecute` with `"showContextTimeline"`.

```typescript
  it("should trigger showContextTimeline command when typed and submitted", async () => {
    const onCommandExecute = vi.fn().mockResolvedValue("");
    renderAiChatInput(onCommandExecute);

    const textarea = screen.getByPlaceholderText("输入您的问题...");
    await userEvent.type(textarea, "/showContextTimeline");
    await userEvent.keyboard("{Enter}");

    expect(onCommandExecute).toHaveBeenCalledWith("showContextTimeline");
  });
```

- [ ] **Step 2: Run verification tests**

Run: `npm run test test/renderer/features/ai-chat/AiChatInput.test.tsx` or `npx vitest run test/renderer/features/ai-chat/AiChatInput.test.tsx`
Expected: PASS

---

### Task 4: Compilation & Standards Verification

- [ ] **Step 1: Type check the codebase**

Run: `npm run typecheck`
Expected: PASS with no compilation/type errors.

- [ ] **Step 2: Lint the codebase**

Run: `npm run lint`
Expected: PASS with no linting errors.
