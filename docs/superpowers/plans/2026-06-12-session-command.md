# AI Chat Session Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `/session` (alias `/resume`) slash commands in the AI Chat Input component, allowing interactive historical session search, selection, and switching.

**Architecture:** Create an isolated Micro Hook `useAiChatSessions.ts` to manage session search query, fuzzy title matching, active list navigation, and selection callbacks. Integrate it inside `useAiChatInput.ts`, intercept relevant keyboard navigation, and render a dedicated `<CommandPanel>` in `MentionCommandPanels.tsx`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest (jsdom testing).

---

### Task 1: Extend Configuration and Types

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`

- [ ] **Step 1: Update `AiChatInputCommandId` and `AiChatInputProps` in `types.ts`**
  Add `"session"` to `AiChatInputCommandId` and update `AiChatInputProps` to accept `chatSessions` and `onActiveSessionChange`.

  ```typescript
  // src/renderer/src/features/ai-chat/components/AiChatInput/types.ts
  import type { AiChatSession } from "@/features/ai-chat/types"; // Import if not already done

  export type AiChatInputCommandId = "clear" | "undo" | "model" | "showContextTimeline" | "session";

  export interface AiChatInputProps {
    // ... other props ...
    chatSessions: AiChatSession[];
    onActiveSessionChange: (sessionId: string) => void;
  }
  ```

- [ ] **Step 2: Add `/session` Command to `AI_CHAT_INPUT_COMMANDS` in `constants.ts`**
  Add command with `id: "session"`, `name: "/session"`, aliases `["/resume"]`, description `"快速搜索历史对话并进行切换"`, and `addToContext: false`.

  ```typescript
  // src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts
  export const AI_CHAT_INPUT_COMMANDS: AiChatInputCommand[] = [
    // ... existing ...
    {
      id: "session",
      name: "/session",
      aliases: ["/resume"],
      description: "快速搜索历史对话并进行切换",
      addToContext: false,
    },
    // ... existing ...
  ];
  ```

- [ ] **Step 3: Verify Compilation**
  Run: `npm run typecheck` or similar to verify type additions compiles successfully (or verify there are no syntax errors).

---

### Task 2: Implement `useAiChatSessions` Micro Hook

**Files:**
- Create: `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatSessions.ts`

- [ ] **Step 1: Write `useAiChatSessions.ts`**
  Implement the session matching and selection Micro Hook:

  ```typescript
  import type React from "react";
  import { useCallback, useEffect, useMemo, useState } from "react";
  import type { AiChatSession } from "@/features/ai-chat/types";

  export const useAiChatSessions = (
    inputText: string,
    setInputText: (value: string) => void,
    chatSessions: AiChatSession[],
    textareaRef: React.RefObject<HTMLTextAreaElement | null>,
    resetHistoryCursor: () => void,
    onActiveSessionChange: (sessionId: string) => void,
  ) => {
    const [activeSessionIndex, setActiveSessionIndex] = useState(0);

    const isSessionMode = useMemo(() => {
      const lower = inputText.toLowerCase();
      return (
        lower === "/session" ||
        lower.startsWith("/session ") ||
        lower === "/resume" ||
        lower.startsWith("/resume ")
      );
    }, [inputText]);

    const sessionQuery = useMemo(() => {
      if (!isSessionMode) return "";
      if (inputText.toLowerCase().startsWith("/session ")) {
        return inputText.slice(9).trim();
      }
      if (inputText.toLowerCase().startsWith("/resume ")) {
        return inputText.slice(8).trim();
      }
      return "";
    }, [isSessionMode, inputText]);

    const matchedSessions = useMemo(() => {
      if (!isSessionMode) return [];
      if (!sessionQuery) return chatSessions;
      const query = sessionQuery.toLowerCase();
      return chatSessions.filter((session) => {
        const title = session.title || "新建对话";
        return title.toLowerCase().includes(query);
      });
    }, [chatSessions, isSessionMode, sessionQuery]);

    useEffect(() => {
      setActiveSessionIndex(0);
    }, [matchedSessions.length]);

    const selectSession = useCallback((session: AiChatSession): void => {
      onActiveSessionChange(session.id);
      setInputText("");
      resetHistoryCursor();
      requestAnimationFrame(() => textareaRef.current?.focus());
    }, [onActiveSessionChange, setInputText, resetHistoryCursor, textareaRef]);

    const moveActiveSession = useCallback((direction: 1 | -1): void => {
      setActiveSessionIndex((currentIndex) => {
        if (matchedSessions.length === 0) return 0;
        return (currentIndex + direction + matchedSessions.length) % matchedSessions.length;
      });
    }, [matchedSessions.length]);

    return {
      activeSessionIndex,
      matchedSessions,
      isSessionMode,
      sessionQuery,
      setActiveSessionIndex,
      selectSession,
      moveActiveSession,
    };
  };
  ```

---

### Task 3: Integrate with `useAiChatInput.ts`

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatInput.ts`

- [ ] **Step 1: Call `useAiChatSessions` and extract variables**
  Import and extract states from `useAiChatSessions`.

  ```typescript
  // src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatInput.ts
  import { useAiChatSessions } from "@/features/ai-chat/components/AiChatInput/hooks/useAiChatSessions";

  // Inside useAiChatInput hook:
  const {
    activeSessionIndex,
    matchedSessions,
    isSessionMode,
    setActiveSessionIndex,
    selectSession,
    moveActiveSession,
  } = useAiChatSessions(
    inputText,
    setInputText,
    props.chatSessions || [],
    textareaRef,
    resetHistoryCursor,
    props.onActiveSessionChange,
  );
  ```

- [ ] **Step 2: Update `handleInputChange`**
  Prevent default Slash menu & Agent menu when `/session` or `/resume` commands are input.

  ```typescript
  const isNextSessionMode =
    nextValue === "/session" ||
    nextValue.startsWith("/session ") ||
    nextValue === "/resume" ||
    nextValue.startsWith("/resume ");

  if (isNextModelMode || isNextSessionMode) {
    setIsCommandPanelOpen(false);
    closeAgentMentionPanel();
    return;
  }
  ```

- [ ] **Step 3: Update `executeCommand`**
  Add interception when `"session"` command is executed.

  ```typescript
  if (command.id === "session") {
    const text = "/session ";
    setInputText(text);
    resetHistoryCursor();
    requestAnimationFrame(() => textareaRef.current?.focus());
    return;
  }
  ```

- [ ] **Step 4: Update Keyboard Event Interception in `handleKeyDown`**
  Intercept key navigations when `isSessionMode` is active.

  ```typescript
  if (isSessionMode && matchedSessions.length > 0) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveSession(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveSession(-1);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setInputText("");
      resetHistoryCursor();
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      const activeSession = matchedSessions[activeSessionIndex] ?? matchedSessions[0];
      if (activeSession) {
        selectSession(activeSession);
      }
      return;
    }
  }
  ```

---

### Task 4: Implement UI Overlay Panels

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/components/MentionCommandPanels.tsx`
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/AiChatInput.tsx`

- [ ] **Step 1: Add Session Panel Props to `MentionCommandPanelsProps`**
  Update the types of `MentionCommandPanelsProps` and render a fourth `CommandPanel` for sessions.

  ```typescript
  // src/renderer/src/features/ai-chat/components/AiChatInput/components/MentionCommandPanels.tsx
  export interface MentionCommandPanelsProps {
    // ... existing ...
    isSessionMode: boolean;
    matchedSessions: any[]; // Or imported AiChatSession[]
    activeSessionIndex: number;
    onActiveSessionIndexChange: (idx: number) => void;
    onSessionSelect: (session: any) => void;
    onSessionPanelKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  }
  ```

- [ ] **Step 2: Render Session `CommandPanel` inside `MentionCommandPanels`**
  Render the fourth panel using `CommandPanel`. Use a formatted list display:

  ```typescript
  <CommandPanel
    isOpen={isSessionMode && matchedSessions.length > 0}
    ariaLabel="AI Session Selection Panel"
    items={matchedSessions}
    activeIndex={activeSessionIndex}
    onActiveIndexChange={onActiveSessionIndexChange}
    onItemSelect={onSessionSelect}
    onKeyDown={onSessionPanelKeyDown}
    idPrefix="ai-chat-session"
    renderItem={(session) => (
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-semibold text-white truncate max-w-[200px]">
          {session.title || "新建对话"}
        </span>
        <span className="text-xs text-white/30">-</span>
        <span className="truncate text-xs text-white/45">
          {session.messages.length} 轮对话
        </span>
      </span>
    )}
  />
  ```

- [ ] **Step 3: Connect Props in `AiChatInput.tsx`**
  Exposed and connected session states to the `<MentionCommandPanels />` call inside `AiChatInput.tsx`.

---

### Task 5: Prop-Drilling and Upper-Level Integration

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatWorkspace.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Update `AiChatWorkspaceProps` and pass down to `AiChatInput`**
  Pass down `chatSessions` and `onActiveSessionChange` through `AiChatWorkspace.tsx`.

- [ ] **Step 2: Connect states inside `App.tsx`**
  Add `chatSessions` and `onActiveSessionChange` (bound to `setActiveChatId`) into `<AiChatWorkspace />` render block.

---

### Task 3: Verification & Test Addition

**Files:**
- Modify: `test/renderer/features/ai-chat/AiChatInput.test.tsx`

- [ ] **Step 1: Add a regression/unit test for `/session` and `/resume` interaction**
  Create a test block in `AiChatInput.test.tsx` to verify typing `/session` opens the panel, lists the mock sessions, and selects a session.

- [ ] **Step 2: Execute Tests**
  Run `npx vitest test/renderer/features/ai-chat/AiChatInput.test.tsx` or `npm run test`.
