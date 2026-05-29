# AI 对话工作区设计规格

## 背景

当前应用是 `App -> Sidebar + Header + page` 的桌面布局。`Header` 右侧已有聊天按钮，但没有状态和交互。目标是在不接入 API 的前提下，设计一个 Telegram 风格的 AI 对话页面：点击 Header 聊天按钮后，左侧 `Sidebar` 内容切换为对话历史列表，Header 下方的主体区域切换为 AI 对话容器，并覆盖原本页面内容。

本规格采用 visual companion 中选定的 A 方案：整体模式切换。

## 范围

- 新增全局 `chat mode` 状态，由 `App.tsx` 控制。
- `Header` 聊天按钮支持打开/关闭 AI 对话模式，并显示高亮状态。
- `Sidebar` 在 AI 对话模式下替换为对话历史列表，而不是主导航。
- Header 下方主体区域展示 AI 对话工作区，覆盖原页面内容。
- 使用 mock 数据展示对话历史、消息、输入框和工具调用过程。
- 展示 ReAct 风格的 Agent 执行摘要：`Plan -> Tool -> Observation -> Answer`。

## 非目标

- 不接入真实 LLM、IPC、数据库或网络请求。
- 不实现真实发送消息、流式响应、工具执行或持久化。
- 不新增路由；AI 对话是当前布局的覆盖模式，不改变当前 page pathname。
- 不展示原始私有推理链，只展示适合用户阅读的执行摘要。

## 推荐方案

采用全局模式切换：

- `App.tsx` 持有 `isChatOpen` 和 `activeChatId`。
- `Header` 接收 `isChatOpen`、`onChatToggle`，按钮在打开时高亮，`aria-label` 在“打开聊天/关闭聊天”之间切换。
- `Sidebar` 增加 `mode`，在 `navigation` 和 `chat` 内容之间切换。
- 主内容区域保留原 page layer，同时叠加 chat layer。打开聊天时 chat layer 变为可见并接管交互，原 page layer 淡出但不卸载，关闭时平滑恢复。

这个方案符合 Telegram 的主心智模型：左侧是会话列表，右侧是当前会话消息流；同时满足“从 Header 按钮触发覆盖原 page”的产品要求。

## 布局与交互

### 桌面端

- 外层仍使用现有 `main` 的黑色背景、`12px` 间距和左右布局。
- AI 对话模式下，左侧栏视觉宽度保持展开状态，展示：
  - 顶部品牌区与“AI DIALOGS”标题。
  - 新建对话按钮。
  - 对话历史列表：标题、最后一条摘要、时间、状态。
  - 底部状态区：mock 的 Agent 模式说明。
- 右侧区域仍先渲染 `Header`。
- Header 下方的 AI 主体容器占满剩余高度，结构为：
  - 会话顶部信息条：标题、Agent 状态、工具数量。
  - 消息列表：用户气泡靠右，AI 气泡靠左或与 Telegram 桌面风格保持左侧主体流。
  - AI 工具调用气泡：在 AI 回复中嵌入 ReAct 执行块。
  - 输入框：多行 textarea、附件/工具模式按钮、发送按钮。

### 移动端

- 保持现有 `lg:flex-row` 之前的纵向布局。
- AI 对话模式下，Sidebar 的历史列表显示在顶部，可横向滚动或压缩为紧凑列表。
- 聊天主体在 Header 下方占满剩余可用空间，输入框固定在容器底部。

## 动效

- Header 按钮使用现有 `IconButton` 的颜色过渡，高亮时白底黑字。
- Sidebar 内容切换使用 `opacity + translateY` 的克制过渡，避免大幅位移。
- 主内容区域使用两个绝对层：
  - page layer：打开聊天时 `opacity-0 scale-[0.995] pointer-events-none`。
  - chat layer：打开聊天时 `opacity-100 translate-y-0 pointer-events-auto`。
- 动效时长控制在 `200-300ms`，使用 `ease-out` 或 Tailwind 默认缓动，保持自然但不拖沓。

## 组件结构

### `src/renderer/src/components/layout/Header.tsx`

- 增加 `isChatOpen?: boolean`。
- 增加 `onChatToggle?: () => void`。
- 聊天按钮根据打开状态设置 `highlighted` 和 `aria-label`。

### `src/renderer/src/components/layout/Sidebar.tsx`

- 增加 `mode: "navigation" | "chat"`。
- 增加聊天历史相关 props：
  - `chatSessions`
  - `activeChatId`
  - `onChatSessionChange`
  - `onNewChat`
- 导航模式保持现有行为。
- 聊天模式渲染 `AiChatHistoryList`。
- 打开 AI 对话时应强制展示展开宽度，关闭后恢复用户之前的折叠状态。

### `src/renderer/src/components/layout/AiChatHistoryList.tsx`

- 只负责左侧对话历史列表。
- 不直接持有业务状态。
- 接收 mock 会话数组、当前会话 id、切换回调和新建回调。

### `src/renderer/src/components/layout/AiChatWorkspace.tsx`

- 只负责 Header 下方的 AI 对话主体。
- 接收当前会话数据。
- 组合消息列表、工具调用块和输入框。

### `src/renderer/src/components/layout/AiChatMessageBubble.tsx`

- 渲染用户/AI 消息气泡。
- AI 消息支持内嵌工具调用块。

### `src/renderer/src/components/layout/AiToolCallBlock.tsx`

- 渲染 ReAct 风格的工具执行摘要。
- 状态包括 `done`、`running`、`queued`。
- 展示内容使用“计划、工具、观察、结果”，不展示私有原始推理链。

### `src/renderer/src/components/layout/aiChatMock.ts`

- 定义 mock 类型和数据。
- 类型包括会话、消息、工具步骤。
- 数据覆盖至少三个会话、用户气泡、普通 AI 气泡、工具调用 AI 气泡和运行中状态。

## 数据流

1. `App.tsx` 读取 mock 会话数据。
2. `App.tsx` 维护 `isChatOpen` 与 `activeChatId`。
3. 点击 Header 聊天按钮：
   - 打开时保存当前 Sidebar 折叠状态，并将左侧栏强制展开为历史列表。
   - 关闭时恢复原来的 Sidebar 折叠状态和页面内容。
4. 点击历史列表项只更新 `activeChatId`，不改路由。
5. 输入框仅展示静态 UI，不提交数据。

## 视觉约束

- 遵循项目黑色主题：主背景 `#000000`，次级容器 `#212121`。
- 禁止渐变。
- 圆角统一 `rounded-[6px]`。
- 字号遵循全局 13px，标签和描述使用 12px。
- 使用 `lucide-react` 图标，不手写 SVG。
- 渲染层导入使用 `@renderer/` 绝对路径。
- TypeScript 函数使用箭头函数。
- 新增类型、变量、函数按项目规范添加简体中文注释。

## 可访问性

- Header 聊天按钮使用准确 `aria-label`。
- Sidebar 聊天历史区域使用 `aria-label="对话历史列表"`。
- 当前对话项使用 `aria-current="true"`。
- 输入框使用明确 placeholder 和 `aria-label`。
- 工具调用步骤不只依赖颜色表达状态，应有文字状态。

## 测试关注

- 点击 Header 聊天按钮后：
  - 按钮 aria-label 变为“关闭聊天”。
  - Sidebar 渲染对话历史列表。
  - AI 对话主体出现。
  - 当前页面内容不再可交互。
- 再次点击 Header 聊天按钮后：
  - 主导航恢复。
  - 原 page 内容恢复。
- 点击历史列表项能切换当前会话标题和消息内容。
- AI 气泡能展示工具调用摘要。
- 不改变当前 URL pathname。
- `pnpm test` 与 `pnpm typecheck` 必须通过。

## 风险点

- 如果直接条件渲染 page/chat，会导致动效生硬；应使用叠层过渡。
- 如果 Sidebar 折叠状态不处理，折叠态下历史列表不可用；打开聊天时必须强制展开。
- 工具调用内容如果写成真实推理链，会违背安全边界；只展示用户可见执行摘要。
- `App.test.tsx` 已经较长，新测试应聚焦交互，不继续堆无关断言。
