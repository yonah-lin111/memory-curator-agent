# Design Spec: `/showFullScreen` Command to Toggle Full Screen in AI Chat

This design introduces a new slash command `/showFullScreen` to allow users to collapse both the application sidebar and the AI context timeline, enabling an immersive full-screen chat experience.

## Requirements

- **Command Registration**: Add `/showFullScreen` as a registered slash command.
- **Fuzzy Match Support**: Typing `/showFullScreen` (or matching with fuzzy match rules like `/sfs`) in the chat input and pressing Enter.
- **Execution Effect**: Collapses BOTH the Sidebar panel and the Context Timeline panel.
- **Resetting state**: The command itself is not added to the chat history/context, and the input field is cleared and refocused after execution.

## Proposed Code Changes

### 1. Register command ID in `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`

Extend `AiChatInputCommandId` to include `"showFullScreen"`:

```typescript
export type AiChatInputCommandId = "clear" | "undo" | "model" | "showContextTimeline" | "session" | "showFullScreen";
```

### 2. Define the Command in `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`

Add `/showFullScreen` in `AI_CHAT_INPUT_COMMANDS`:

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

### 3. Handle execution in `src/renderer/src/App.tsx`

Intercept the `"showFullScreen"` command within `handleCommandExecute`:

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

## Testing & Verification

1. Add a unit test to verify suggestion matching and triggering for `/showFullScreen` inside `test/renderer/features/ai-chat/AiChatInput.test.tsx`.
2. Update existing key-navigation tests that assume 5 commands to account for 6 commands in the list.
