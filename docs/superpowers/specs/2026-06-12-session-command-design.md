# Design Spec: `/session` & `/resume` Commands for Interactive Session Switching

This document specifies the design for adding the `/session` (alias `/resume`) slash commands inside the AI Chat Input component. It enables users to search through their historical chat sessions interactively and switch the active session directly from the input prompt, using a matching interaction pattern to the existing `/model` command.

## 1. Requirements

- Add command `/session` (and alias `/resume`) with description "快速搜索历史对话并进行切换".
- Trigger a command selection panel showing a filtered list of sessions matching the input query.
- Use arrow keys (`ArrowUp`/`ArrowDown`) to navigate, `Enter` to select and switch to the session, and `Escape` to clear.
- Render details of matching sessions: Title and number of message turns (e.g. "3 轮对话").
- Support case-insensitive matches against session titles. Empty or unnamed sessions should display a fallback title like "新建对话" or "无标题会话".
- Seamlessly transition inputs, cursors, and focus states on selection.

## 2. Architecture & Components

We follow the codebase's existing pattern of isolated Micro Hooks to coordinate states within `AiChatInput`.

### 2.1 Type Additions (`types.ts`)
Add `"session"` to the `AiChatInputCommandId` union. Update `AiChatInputProps` to accept:
- `chatSessions: AiChatSession[]`
- `onActiveSessionChange: (sessionId: string) => void`

### 2.2 Constant Configuration (`constants.ts`)
Append the `/session` configuration to `AI_CHAT_INPUT_COMMANDS`.

### 2.3 Micro Hook (`useAiChatSessions.ts`)
Create a new file `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatSessions.ts` implementing session selection and matching logic:
- `isSessionMode`: matches if input value is `/session` or starting with `/session `, or `/resume` or starting with `/resume `.
- `sessionQuery`: slices input value after `/session ` or `/resume `.
- `matchedSessions`: filtered list of sessions containing the query (case-insensitive).
- `selectSession`: triggers `onActiveSessionChange`, clears the input, resets cursors, and focuses the textarea.

### 2.4 Control Integration (`useAiChatInput.ts`)
- Invoke `useAiChatSessions` and integrate returned variables.
- Handle state transitions in `handleInputChange`.
- Intercept keys (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`) in `handleKeyDown` when `isSessionMode` is active.
- Handle `executeCommand` to insert `/session ` text when command is triggered via the main slash command overlay.

### 2.5 UI Panel Integration (`MentionCommandPanels.tsx` & `AiChatInput.tsx`)
- Incorporate `CommandPanel` with session configuration in `MentionCommandPanels.tsx`.
- Pass new properties into `<MentionCommandPanels />` inside `AiChatInput.tsx`.

### 2.6 Prop Drilling (`AiChatWorkspace.tsx` & `App.tsx`)
- Retrieve and pass `chatSessions` and `onActiveSessionChange` (bound to `setActiveChatId`) from `App.tsx` down through `AiChatWorkspace.tsx` to `AiChatInput.tsx`.
