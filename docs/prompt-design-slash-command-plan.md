# PromptAiChatInput `/` 斜杠命令支持方案

## 1. 目标

为 `PromptAiChatInput` 添加与 `AiChatInput` 同等的 `/` 斜杠命令功能，支持 `/clear`、`/undo`、`/model`、`/session` 四个命令。

---

## 2. 参考架构 (AiChatInput 命令系统)

```
AiChatInput.tsx
├── useAiChatInput()                    ← 总编排 Hook
│   ├── getMatchedCommands(inputText)    ← / 开头的模糊匹配
│   ├── isCommandInput(value)            ← 检测是否为 / 命令
│   ├── useAiChatModels()               ← /model 子面板
│   └── useAiChatSessions()             ← /session 子面板
├── MentionCommandPanels                 ← 统一的命令/模型/会话面板渲染
│   └── CommandPanel × N                ← 通用面板组件
└── AI_CHAT_INPUT_COMMANDS[]             ← 命令常量定义
```

关键文件：
- `src/renderer/src/features/ai-chat/components/AiChatInput/types.ts` — `AiChatInputCommandId`、`AiChatInputCommand`
- `src/renderer/src/features/ai-chat/components/AiChatInput/constants.ts` — `AI_CHAT_INPUT_COMMANDS`、`TEXTAREA_MIN_ROWS` 等
- `src/renderer/src/features/ai-chat/components/AiChatInput/utils.ts` — `getMatchedCommands`、`isCommandInput`
- `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatModels.ts`
- `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatSessions.ts`
- `src/renderer/src/features/ai-chat/components/AiChatInput/components/MentionCommandPanels.tsx`
- `src/renderer/src/features/ai-chat/components/CommandPanel.tsx` — 通用面板 UI

---

## 3. 当前 PromptAiChatInput 状态

```tsx
export const PromptAiChatInput = ({
  onSend,
  disabled,
}: {
  onSend?: (text: string, selectedModel?: string) => void;
  disabled?: boolean;
}) => { ... }
```

- 已有 `@file` mention 支持（通过 `useFileMention` hook + `CommandPanel` 组件）
- 已有模型 Select 下拉（`useActiveAiModels`）
- 键盘事件处理：`handleFileMentionKeyDown` → Enter 发送
- **无 `/` 命令支持**

---

## 4. 改造方案

### 4.1 后端新增 `/undo` 能力

#### 4.1.1 `PromptAiPersistenceService` 新增 `undoLastTurn`

在 `src/main/services/promptAiPersistenceService.ts` 中添加：

```typescript
public undoLastTurn(sessionId: string): PromptAiChatSessionItem | null {
  // 删除该会话最后一条 user + assistant 消息对
  // 参考 aiChatPersistenceService 的实现模式
  // 需要从 prompt_ai_chat_messages 表中倒序查找并删除
  // 同时清理 prompt_ai_agent_runs 表中关联的 run 记录
}
```

#### 4.1.2 IPC Handler

在 `src/main/ipc/promptAiHandlers.ts` 注册：

```typescript
ipcMain.handle("prompt-ai:session:undo", (_, sessionId: string) => {
  return getPersistence().undoLastTurn(sessionId);
});
```

#### 4.1.3 Preload 桥接

`src/preload/index.ts` 的 `promptAi` 对象中新增：

```typescript
undoLastTurn: (sessionId: string): Promise<any | null> =>
  ipcRenderer.invoke('prompt-ai:session:undo', sessionId),
```

#### 4.1.4 类型声明

`src/renderer/src/env.d.ts` 的 `promptAi` 接口中新增：

```typescript
undoLastTurn: (sessionId: string) => Promise<any | null>
```

### 4.2 Controller 新增 `handleUndo`

在 `src/renderer/src/features/prompt-design/components/usePromptAiChatController.ts` 中新增：

```typescript
const handleUndo = useCallback(async () => {
  if (isGenerating) return;
  const updated = await window.api.promptAi!.undoLastTurn(sessionId);
  if (updated) {
    await loadSession(sessionId); // 重新加载当前会话消息
  }
}, [isGenerating, sessionId, loadSession]);
```

并在返回值中导出 `handleUndo`。

### 4.3 PromptAiChatInput Props 扩展

```typescript
export const PromptAiChatInput = ({
  onSend,
  disabled,
  onNewChat,          // /clear
  onUndo,             // /undo
  onSessionChange,    // /session 选择后会调用
  chatSessions,       // /session 面板使用的会话列表
}: {
  onSend?: (text: string, selectedModel?: string) => void;
  disabled?: boolean;
  onNewChat?: () => void;
  onUndo?: () => void;
  onSessionChange?: (sessionId: string) => void;
  chatSessions?: AiChatSession[];
})
```

其中 `AiChatSession` 使用已有的 `prompt-design` 类型（来自 `usePromptAiChatController` 的 `sessions` 字段）。

### 4.4 轻量级 Slash Command Hook

在 `PromptAiChatInput` 内部新建 `useSlashCommands` 微 Hook（或内联实现），核心职责：

1. **命令匹配**：复用 `getMatchedCommands(inputText)` 和 `isCommandInput(value)` 来自 `utils.ts`
2. **面板开关**：`isCommandPanelOpen`、`isModelMode`、`isSessionMode`
3. **命令执行**：`executeCommand(commandId)` → 根据 id 分发：
   - `"clear"` → `onNewChat?.()`, 清空输入
   - `"undo"` → `onUndo?.()`, 清空输入
   - `"model"` → `setInputText("/model ")`, 进入模型子面板
   - `"session"` → `setInputText("/session ")`, 进入会话子面板
4. **模型子面板**：复用 `useAiChatModels` 的数据构建逻辑（扁平化 `modelOptions`），或直接在此 Hook 内实现
5. **会话子面板**：基于 `chatSessions` props 进行过滤匹配
6. **键盘导航**：上/下箭头循环选中、Enter 确认、Escape 退出或清空

### 4.5 面板优先级与共存

输入框 `onChange` 时的调度逻辑（参考 `useAiChatInput.handleInputChange`）：

```
输入变化
├── 以 "/model" 或 "/model " 开头？
│   ├── 是 → 关闭其他面板，进入模型子面板模式
│   └── 否 → 
│       ├── 以 "/session" 或 "/session " 或 "/resume" 或 "/resume " 开头？
│       │   ├── 是 → 关闭其他面板，进入会话子面板模式
│       │   └── 否 → 
│       │       ├── 以 "/" 开头 且 matchedCommands.length > 0？
│       │       │   ├── 是 → 打开命令选择面板
│       │       │   └── 否 → 同步 @file mention 面板
```

### 4.6 键盘事件处理整合

输入框 `onKeyDown` 优先级：

```
按键事件
├── /session 模式 → ArrowUp/Down/Escape/Enter 处理
├── /model 模式 → ArrowUp/Down/Escape/Enter 处理
├── 命令面板打开 → ArrowUp/Down/Escape 处理
├── @file 面板打开 → 现有逻辑（handleFileMentionKeyDown）
├── Enter (非 Shift) → 发送消息
```

### 4.7 面板渲染

复用 `MentionCommandPanels` 或直接使用多个 `CommandPanel` 实例：

- **命令面板**：`idPrefix="prompt-cmd"`, 渲染 `command.name` + `command.description`
- **模型面板**：`idPrefix="prompt-model"`, 渲染模型名称 + provider 名称
- **会话面板**：`idPrefix="prompt-session"`, 渲染会话标题 + 时间

### 4.8 PromptAiChatWorkspace 适配

在 `PromptAiChatWorkspace.tsx` 中传入新 props：

```tsx
<PromptAiChatInput
  onSend={handleSend}
  disabled={isGenerating}
  onNewChat={controller.handleNewChat}
  onUndo={controller.handleUndo}
  onSessionChange={controller.handleSessionChange}
  chatSessions={controller.sessions}
/>
```

---

## 5. 不予支持的命令

| 命令 | 原因 |
|------|------|
| `/showContextTimeline` | Prompt Design 无上下文时间线功能 |
| `/showFullScreen` | Prompt Design 不适用全屏折叠逻辑 |

---

## 6. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/main/services/promptAiPersistenceService.ts` | 修改 | 新增 `undoLastTurn` 方法 |
| `src/main/ipc/promptAiHandlers.ts` | 修改 | 新增 `prompt-ai:session:undo` handler |
| `src/preload/index.ts` | 修改 | 新增 `undoLastTurn` 桥接 |
| `src/renderer/src/env.d.ts` | 修改 | 新增类型声明 |
| `src/renderer/src/features/prompt-design/components/usePromptAiChatController.ts` | 修改 | 新增 `handleUndo` |
| `src/renderer/src/features/prompt-design/components/PromptAiChatInput.tsx` | 修改 | 核心改造：props 扩展、slash 命令 Hook、面板渲染、键盘事件 |
| `src/renderer/src/features/prompt-design/components/PromptAiChatWorkspace.tsx` | 修改 | 传入新 props |

---

## 7. 实施顺序（依赖关系）

```
1. promptAiPersistenceService.undoLastTurn     ← 无依赖
2. promptAiHandlers / preload / env.d.ts        ← 依赖 1
3. usePromptAiChatController.handleUndo        ← 依赖 2
4. PromptAiChatInput (slash command + 面板)     ← 依赖 3
5. PromptAiChatWorkspace                        ← 依赖 4
```

---

## 8. 关键要点

- **复用现有工具**：`getMatchedCommands`、`isCommandInput`、`AI_CHAT_INPUT_COMMANDS`、`CommandPanel` 均直接导入复用，不重复造轮子
- **模型数据源**：`/model` 子面板的数据取自 `useActiveAiModels()` 的 `modelOptions`，与底部 Select 共享数据源但独立渲染
- **会话数据源**：`/session` 子面板的数据来自 props 的 `chatSessions`（由 workspace 传入 controller.sessions）
- **命令常量筛选**：在 `PromptAiChatInput` 层面只开放 `clear`、`undo`、`model`、`session` 四个命令，过滤掉 `showContextTimeline`、`showFullScreen`
- **`/undo` 后端逻辑**：从 `prompt_ai_chat_messages` 倒序找到最后一条 user 消息和紧随其后的一条 assistant 消息，一并删除；同时清理 `prompt_ai_agent_runs` 中关联的 run 记录
