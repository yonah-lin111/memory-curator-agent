# Design Spec: `/showContextTimeline` Command to Toggle Context Timeline in AI Chat

## 1. Background & Purpose
Currently, users can toggle the AI Chat Context Timeline (which displays detailed tokens budget and timeline/Q&A rounds metrics) using the toggle button on the UI header or inside the workspace.
This design introduces a new slash command `/showContextTimeline` to allow users to toggle the visibility of this context timeline directly from the keyboard using the chat input command panel.

## 2. Requirements & User Experience (UX)
- **Command Registration**: Add `/showContextTimeline` as a registered slash command.
- **Trigger Condition**:
  - Typing `/showContextTimeline` (or matching with fuzzy match rules like `/sct`) in the chat input and pressing Enter.
- **Command Action**:
  - Toggles the `isContextTimelineOpen` boolean state, which opens/closes the `AiChatContextTimeline` component.
  - Clears the chat input and refocusses the textarea after execution.
- **No Persistence in Context**:
  - The command execution is purely UI state toggling and does not add any text to the message list or persist any message in context.

## 3. Technical Design

### Type System Changes
- Update `AiChatInputCommandId` in `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`:
  ```typescript
  export type AiChatInputCommandId = "clear" | "undo" | "model" | "showContextTimeline";
  ```

### Constants Modification
- Add `/showContextTimeline` in `AI_CHAT_INPUT_COMMANDS` in `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`:
  ```typescript
  {
    id: "showContextTimeline",
    name: "/showContextTimeline",
    aliases: [],
    description: "显示或隐藏上下文时间线",
    addToContext: false,
  }
  ```

### Event Handling & State Propagation
- In `src/renderer/src/App.tsx`, intercept `"showContextTimeline"` command inside the command execution callback:
  ```typescript
  const handleCommandExecute = (command: AiChatInputCommandId) => {
    if (command === "showContextTimeline") {
      setIsContextTimelineOpen((prev) => !prev);
      return;
    }
    return handleAiChatCommand(command);
  };
  ```
  Pass `handleCommandExecute` to `<AiChatWorkspace onCommandExecute={handleCommandExecute} />`.

## 4. Verification Plan
- Type `/` and verify `/showContextTimeline` shows up in the command panel suggestion list.
- Type `/showContextTimeline` (or `/sho`) and press Enter to toggle the visibility of the timeline panel.
- Verify the input area clears and refocusses after executing `/showContextTimeline`.
- Run typescript compilation and standard tests (`npm run typecheck` or similar verification commands if any) to make sure everything works perfectly.
