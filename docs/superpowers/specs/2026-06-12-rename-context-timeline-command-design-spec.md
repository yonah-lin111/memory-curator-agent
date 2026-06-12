# Design Spec: Rename `/showContextTimeline` to `/contextTimeline`

## 1. Background
To improve clarity and keyboard efficiency, the command `/showContextTimeline` is renamed to `/contextTimeline`. Along with it, its internal command ID and TypeScript types are refactored for codebase consistency.

## 2. Proposed Changes

### 2.1 Types Modification
File: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/features/ai-chat/components/AiChatInput/types.ts`
- Change `showContextTimeline` member of `AiChatInputCommandId` union to `contextTimeline`.

```typescript
export type AiChatInputCommandId = "clear" | "undo" | "model" | "contextTimeline";
```

### 2.2 Constant Definitions Modification
File: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts`
- Update the command object with `id: "contextTimeline"` and `name: "/contextTimeline"`.

```typescript
  {
    id: "contextTimeline",
    name: "/contextTimeline",
    aliases: [],
    description: "显示或隐藏上下文时间线",
    addToContext: false,
  },
```

### 2.3 Controller Interception Modification
File: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/App.tsx`
- Intercept `"contextTimeline"` command instead of `"showContextTimeline"`.

```typescript
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

### 2.4 Tests Modification
File: `/Users/yonah/projects/agent/memory-curator-agent/test/renderer/features/ai-chat/AiChatInput.test.tsx`
- Rename test suite `'支持 /showContextTimeline 命令匹配与触发'` to `'支持 /contextTimeline 命令匹配与触发'`.
- Modify typed pattern `/show` to `/context`.
- Expect `onCommandExecute` to be called with `'contextTimeline'`.
- Update the `'命令面板上下键循环选择'` test to expect options matching `/\/contextTimeline/`.

## 3. Self-Review
1. No placeholders or TBD items.
2. Changes are internally consistent and completely refactor both the ID and name.
3. This is scoped perfectly for a single refactoring cycle.
