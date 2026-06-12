# Design Spec: Rename `/contextTimeline` to `/showContextTimeline`

To align with the latest product requirements, the slash command `/contextTimeline` is being renamed back to `/showContextTimeline`. Its internal command ID and TS types will be refactored from `"contextTimeline"` to `"showContextTimeline"` for codebase consistency.

## Proposed Changes

### 1. Types (`src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`)
- Change the `contextTimeline` member of `AiChatInputCommandId` union type to `showContextTimeline`.

```typescript
export type AiChatInputCommandId = "clear" | "undo" | "model" | "showContextTimeline";
```

### 2. Constants (`src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`)
- Update the registered command's ID and name back to `/showContextTimeline`:

```typescript
  {
    id: "showContextTimeline",
    name: "/showContextTimeline",
    aliases: [],
    description: "显示或隐藏上下文时间线",
    addToContext: false,
  },
```

### 3. Application Execution Context (`src/renderer/src/App.tsx`)
- Intercept `"showContextTimeline"` command instead of `"contextTimeline"`.

```typescript
  const handleCommandExecute = (
    command: AiChatInputCommandId,
  ): string | void | Promise<string | void> => {
    if (command === "showContextTimeline") {
      setIsContextTimelineOpen((prev) => !prev);
      return;
    }
    return handleAiChatCommand(command);
  };
```

### 4. Unit Tests (`test/renderer/features/ai-chat/AiChatInput.test.tsx`)
- Rename the test case `'支持 /contextTimeline 命令匹配与触发'` to `'支持 /showContextTimeline 命令匹配与触发'`.
- Verify the suggestion matching and triggering for `/showContextTimeline` matches `showContextTimeline`.
- Update the `'命令面板上下键循环选择'` test case to expect `showContextTimeline` and match `/showContextTimeline` upon arrow up keypress.
