# 提示词设计功能设计规格

## 概述

在现有应用中新增「提示词设计」页面，通过 Header 的 Book 按钮打开。支持卡片画布自由排布提示词，右侧 AI 面板辅助改稿，AI 可使用文件工具读取项目上下文。与聊天 agent 共用会话存储但工具集隔离。

## 架构决策

**方案 B：通用 Workspace 架层**。将 App.tsx 中的 overlay 切换逻辑抽象为 `OverlayWorkspace` 通用容器，chat 和 prompt-design 均为其子组件。Sidebar mode 从 `"navigation" | "chat"` 扩展为 `"navigation" | "chat" | "prompts"`。

---

## 依赖

| 包              | 用途                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| `@xyflow/react` | 画布节点编辑器：无限画布、拖拽/缩放/框选、贝塞尔连线、吸附网格、Minimap |
| `dagre`         | 有向图自动布局（`/layout` 命令实现卡片自动排列）                        |

---

## 文件结构

### 新增文件

```
src/renderer/src/
├── components/layout/
│   └── OverlayWorkspace.tsx          # 通用 overlay 容器

├── features/prompt-design/
│   ├── types.ts                       # Project, PromptDesign, CanvasBlock 等
│   ├── usePromptDesignController.ts   # 项目管理 + IPC + AI 桥接
│   ├── promptDesignStore.ts           # Zustand store
│   ├── components/
│   │   ├── PromptDesignWorkspace.tsx  # 顶层 overlay 组件 (3 栏布局)
│   │   ├── PromptSidebar.tsx          # 左侧项目/提示词树列表
│   │   ├── PromptCanvas.tsx           # 中间无限画布
│   │   ├── PromptCard.tsx             # 单个提示词卡片
│   │   ├── PromptCanvasToolbar.tsx    # 底部画布工具栏
│   │   ├── PromptDesignAIPanel.tsx    # 右侧 AI 对话面板
│   │   ├── PromptDesignInput.tsx      # 输入框
│   │   ├── PromptCommandPanel.tsx     # / 命令面板
│   │   └── PromptProjectManager.tsx   # 项目管理弹窗
│   └── hooks/
│       ├── useCanvasInteraction.ts    # 拖拽/缩放/选择/框选
│       └── usePromptDesignAgent.ts    # AI 对话 hook

├── components/layout/Sidebar/
│   └── components/
│       └── PromptProjectList.tsx      # Sidebar prompts mode 内容

src/main/agent/tools/
├── fileReadTool.ts
├── fileWriteTool.ts
├── fileEditTool.ts
├── fileGlobTool.ts
├── fileGrepTool.ts
└── todoWriteTool.ts
```

### 修改文件

| 文件                 | 变更                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`            | 引入 `OverlayWorkspace`，新增 `activeOverlay` 状态替代 `isChatOpen` 布尔值，新增 `isPromptsOpen`/`onPromptsToggle` 透传给 Header |
| `Sidebar.tsx`        | mode 类型扩展 `"prompts"`，新增 `PromptProjectList` 渲染分支                                                                     |
| `toolRegistry.ts`    | 新增 `fileToolFactories`，工具注册表构造函数支持按 agent 类型选择工厂                                                            |
| `AiChatSession` 类型 | 新增 `type: 'chat' \| 'prompt'` 和 `promptDesignId?: string` 字段                                                                |
| `reactAgent.ts`      | 根据 session.type 选择工具集                                                                                                     |
| 数据库 migration     | 新增 `prompt_projects`、`prompt_designs` 表；`chat_sessions` 表新增 `type` 列                                                    |

---

## 数据模型

```typescript
type Project = {
  id: string;
  name: string;
  type: "filesystem" | "virtual";
  path?: string; // filesystem 类型的工作目录
  createdAt: number;
  updatedAt: number;
};

/** 提示词链连线：source 的输出作为 target 的输入，按 DAG 拓扑顺序执行 */
type CardConnection = {
  id: string;
  projectId: string;
  sourceId: string; // 连线起点卡片 ID（上游，输出提供者）
  targetId: string; // 连线终点卡片 ID（下游，接收上游所有入边的输出作为输入）
  condition?: string; // 条件标签，如 "是/否"、"通过/驳回"。同一 source 出边按 condition 路由分支
};

/** 提示词链执行时上下文拼接规则 */
type ChainContext = {
  /** 目标卡片执行前，将所有入边来源卡片的输出按连线顺序拼入上下文 */
  upstreamOutputs: Map<string, string>; // sourceId → 该 source 上一次执行输出
};

/**
 * 拼接格式：外部 XML 标签包裹，结构清晰、防止内容注入混淆。
 * 类似 Claude subagent MD 文件的区域分隔模式。
 */
type PromptAssembler = (
  card: PromptDesign,
  upstreamOutputs: Map<string, string>,
) => string;

/** 拼接产物示例：
 * <prompt_card id="b" project="proj-1">
 *   修复以下 SQL 注入漏洞。确保使用参数化查询。
 * </prompt_card>
 *
 * <upstream id="a">
 *   是。userId 直接拼接进 SQL，存在注入风险。
 * </upstream>
 *
 * <upstream id="c">
 *   ...c 的输出...
 * </upstream>
 */

type PromptDesign = {
  id: string;
  projectId: string;
  chatSessionId: string; // 反向引用 AiChatSession，多张卡片可共享同一会话
  title: string;
  content: string; // Markdown
  canvasX: number;
  canvasY: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};
```

### 会话类型扩展

```typescript
// AiChatSession 新增字段
{
  type: "chat" | "prompt"; // 区分对话类型
}
```

会话与卡片为 **1:N 关系**：卡片通过 `chatSessionId` 反向引用会话，同一会话下可挂载多张卡片，共享 AI 对话上下文。

## 状态管理

### Zustand Store (`promptDesignStore`)

```
state:
  projects: Project[]
  activeProjectId: string | null
  activePromptDesignId: string | null
  promptDesigns: Map<projectId, PromptDesign[]>
  canvasViewport: { x, y, scale }
  selectedCardIds: Set<string>
  isAIPanelOpen: boolean

actions:
  createProject / deleteProject / renameProject
  createPromptDesign / deletePromptDesign
  updatePromptContent / updatePromptTitle
  updateCardPosition / updateCardSize
  setCanvasViewport
  toggleAIPanel
  setActiveProject / setActivePromptDesign
```

### AI 对话状态

复用 `useAiChatController`。通过 `session.metadata.type === 'prompt'` 过滤提示词专属会话。选中卡片时通过 `card.chatSessionId` 定位对应会话，同一会话下多张卡片共享对话上下文。

## 数据流

```
Sidebar (mode="prompts")
  │ 点击项目 → store.setActiveProject(id)
  │ 点击提示词 → store.setActivePromptDesign(id)
  ▼
PromptCanvas
  │ 渲染 activeProjectId 下所有 PromptDesign 卡片
  │ 拖拽 → store.updateCardPosition
  │ 点击卡片 → 选中 + 打开右侧 AI 面板
  ▼
PromptDesignAIPanel
  │ 选中卡片 → 通过 card.chatSessionId 定位会话
  │ 当前会话下所有卡片共享同一 AI 对话上下文
  │ 发送消息 → useAiChatController → IPC → main process
  ▼
PromptDesignInput
  │ / 命令面板 (new-card, delete-card, export, read-file...)
```

## 交互设计

### 整体布局 (3 栏)

```
┌──────────────────────────────────────────────────────────────┐
│ Header  (category="AGENT" / activePage="prompt-design")       │
├──────────┬──────────────────────────────────┬─────────────────┤
│ Sidebar  │                                  │   AI Panel      │
│ (mode=   │          Canvas                  │  (360px, 可折叠) │
│ prompts) │    ┌────┐  ┌────┐  ┌────┐       │                 │
│          │    │ C1 │  │ C2 │  │ C3 │       │  对话消息列表    │
│ Project1 │    └────┘  └──┬─┘  └────┘       │                 │
│  ● Card1 │           ┌───┘                  │  工具调用块      │
│    Card2 │           │ C4                   │                 │
│ Project2 │           └────┘                 │  输入框          |
│  ● Card1 │                                  │                 │
├──────────┴──────────────────────────────────┴─────────────────┤
│ Canvas Toolbar: [✚] [🗗] [    100%   ] [布局] [导出]          │
└──────────────────────────────────────────────────────────────┘
```

### 项目管理

- 首次打开无项目时，自动创建默认项目「默认项目」(type='virtual')
- Sidebar 底部 `+` 按钮 → 弹出 `PromptProjectManager` 弹窗：
  - 虚拟项目：输入名称即可创建
  - 文件系统项目：输入名称 + 点击「选择目录」打开系统目录选择器
- 右键项目 → 重命名 / 删除（删除时级联删除所有提示词和连线）
- filesystem 项目的工具路径限定在 `project.path` 目录内，不可越界读写

### 卡片画布

- **主题**：黑色背景，带浅色网格点 (`text-white/5` 1px dot, 40px 间距)
- **卡片**：`bg-[#212121]`，`border border-white/5`，rounded 6px，默认宽 280px，高自适应
  - 顶部：标题（可编辑 inline）+ 标签（text-xs, 12px）
  - 中部：Markdown 内容预览（截断 3 行，`line-clamp-3`）
  - 底部：更新时间 (text-white/30, 12px) + 操作按钮
  - Hover：`scale-[1.02]` + 阴影 `shadow-[0_4px_20px_rgba(0,0,0,0.4)]`，200ms ease-out
- **拖拽**：选中后鼠标拖拽平移，吸附 20px 网格
- **平移画布**：鼠标中键拖拽 / 两指触控板
- **缩放**：`Ctrl/Meta + Wheel`，范围 0.25x ~ 3x，底部工具栏显示百分比
- **新建卡片**：画布空白处双击 → 弹出微浮动输入框（类 Figma），输入标题回车创建
- **多选**：`Shift + Click` 追加选择，画布空白处拖拽框选
- **连线**（提示词链）：两个卡片选中后右键 →「关联」→ 弹出条件输入框，填写条件标签（如"是/否"、"通过/驳回"），确认后创建灰色贝塞尔曲线（带箭头，标签附着于连线上）。连线具有执行语义——上游卡片的输出作为下游卡片的输入。一张卡片可有多条入边和出边，构成 DAG，禁止环路
- **删除**：选中后 `Delete`/`Backspace`，二次确认

### 右键菜单

- 复制内容 / 复制 Markdown
- 关联到其他卡片
- 导出为文本
- 删除（二次确认）

### AI 面板

- 宽度 360px，从右侧滑入 (300ms ease-out cubic-bezier)
- 顶部显示选中卡片标题，点击折叠为 48px 窄条
- 消息列表复用 `AiChatMessageBubble`
- **不显示** `AiChatContextTimeline` 统计面板
- 工具调用块：可折叠，默认展开，展示工具名 + 参数 + 结果
- 底部固定输入框

### 输入框 & 命令面板

- 复用 `AiChatInput` 核心骨架，去掉：
  - Agent mention (`@people_agent` 等)
  - Context budget/usage 显示
  - Session 切换面板
- 保留：附件拖拽、文本输入、发送/取消
- 命令面板 (`/` 或 `Cmd/Ctrl+K` 触发)：

| 命令           | 功能                                     |
| -------------- | ---------------------------------------- |
| `/new-card`    | 在画布中心新建提示词卡片                 |
| `/delete-card` | 删除当前选中卡片                         |
| `/rename`      | 重命名当前卡片标题                       |
| `/export`      | 导出当前卡片为 Markdown 文件             |
| `/read-file`   | 弹出项目文件选择器，供 AI 读取           |
| `/switch-proj` | 切换当前项目                             |
| `/layout`      | 按 DAG 拓扑层级自动排列卡片 (dagre 布局) |
| `/clear`       | 清空当前对话                             |

- 样式：`bg-[#212121]`，`border-white/10`，rounded 6px，hover: bg-white/8
- 模糊搜索、↑↓ 选择、Enter 执行、Esc 关闭

### 提示词链执行

连线构成的 DAG 支持链式执行。选中起始卡片后右键「执行链」，AI 按拓扑顺序依次处理每张卡片。

**上下文拼接规则**（XML 标签风格，防内容注入混淆）：

- 当前卡片内容用 `<prompt_card id="...">...</prompt_card>` 包裹
- 每条入边的上游输出用 `<upstream id="...">...</upstream>` 包裹，按拓扑序排列
- LLM 通过标签边界明确区分「自身任务」与「上游上下文」
- 无入边的卡片（根节点）以原始内容直接执行，无 upstream 块

**分叉处理**：

- 一张卡片有多条出边时，每个下游分支独立继承该卡片的输出
- 如 `a → b` 和 `a → c`，`b` 和 `c` 的执行上下文均包含 `a` 的输出
- 相邻层级的并发分支顺序不保证

**条件路由**（连线带 condition 标签时触发）：

- 卡片执行完成后，AI 根据其输出内容判断每条出边的 condition 是否满足
- 仅通过条件匹配的出边继续下游执行，不匹配的分支被剪枝
- 如卡片 a 有出边 `a -[是]→ b` 和 `a -[否]→ c`，AI 根据 a 的执行结果判定走 b 还是 c（或两者都走）
- 所有出边均无 condition 时视为无条件全分支执行
- condition 标签可在连线上点击编辑，双击快速修改

**环路检测**：

- 新建连线时即时检测拓扑环（DFS），存在环路时拒绝创建

### 链式提示词示例

以 DAG `a → [b, c]`（b → d）为例，各卡片内容与执行流程：

````
卡片 a（根节点）
─────────────────
内容：判断以下代码是否存在 SQL 注入风险：
```sql
SELECT * FROM users WHERE id = ${userId}
````

请回答「是」或「否」，并附简要说明。

卡片 b（condition: 是） 卡片 c（condition: 否）
───────────────── ─────────────────
内容：修复以下 SQL 注入漏洞。 内容：写一段 Code Review 通过
确保使用参数化查询。 评语，说明代码安全无风险。

卡片 d
─────────────────
内容：将修复后的代码整理成 Markdown
格式的安全整改报告。

```

**执行流程**（XML 拼接格式）：

```

Step 1 — 执行 a（无上游，无 <upstream> 块）
实际发送给 LLM 的 Prompt：
─────────────────────────────────────────────
<prompt_card id="a" project="proj-1">
判断以下代码是否存在 SQL 注入风险：

```sql
SELECT * FROM users WHERE id = ${userId}
```

请回答「是」或「否」，并附简要说明。
</prompt_card>
─────────────────────────────────────────────
输出 = "是。userId 直接拼接进 SQL，存在注入风险。"

Step 2 — 条件路由
AI 判断 a 的输出匹配 condition「是」→ 执行 b

Step 3 — 执行 b（上游 a 注入）
实际发送给 LLM 的 Prompt：
─────────────────────────────────────────────
<prompt_card id="b" project="proj-1">
修复以下 SQL 注入漏洞。确保使用参数化查询。
</prompt_card>

<upstream id="a">
是。userId 直接拼接进 SQL，存在注入风险。
</upstream>
─────────────────────────────────────────────
  输出 = "修复方案：改用参数化查询
  `SELECT * FROM users WHERE id = ?`"

Step 4 — 执行 d（上游 b 注入）
实际发送给 LLM 的 Prompt：
─────────────────────────────────────────────
<prompt_card id="d" project="proj-1">
将修复后的代码整理成 Markdown 格式的安全整改报告。
</prompt_card>

<upstream id="b">
修复方案：改用参数化查询
`SELECT * FROM users WHERE id = ?`
</upstream>
─────────────────────────────────────────────
```

汇聚节点（多入边）拼接示例，`a → c` 且 `b → c`：

```
<prompt_card id="c" project="proj-1">
...c 卡片内容...
</prompt_card>

<upstream id="a">
...a 的输出...
</upstream>

<upstream id="b">
...b 的输出...
</upstream>
```

每一步输出均可缓存，修改中间某张卡片后仅重跑下游受影响的子树。

---

## 工具系统

### 工具注册隔离

`toolRegistry.ts` 重构为按 agent 类型选择工厂：

```typescript
// 聊天 agent 工具
const chatToolFactories = [
  createAskTool,
  createNoteTools,
  createJournalTools,
  createPeopleTools,
  createTodoTools,
  createSnippetTools,
  createNoteCategoryTools,
  createThemeTools,
  createBillsTools,
  createTimeNowTool,
  createDateOffsetTool,
];

// 提示词 agent 工具
const promptToolFactories = [
  createFileReadTool,
  createFileWriteTool,
  createFileEditTool,
  createFileGlobTool,
  createFileGrepTool,
  createTodoWriteTool,
];
```

### 文件工具规格

| 工具         | 描述           | 关键参数                                            |
| ------------ | -------------- | --------------------------------------------------- |
| `file_read`  | 读取文件内容   | `filePath`, `offset?`, `limit?`                     |
| `file_write` | 写入/创建文件  | `filePath`, `content`                               |
| `file_edit`  | 精确字符串替换 | `filePath`, `oldString`, `newString`, `replaceAll?` |
| `file_glob`  | Glob 匹配文件  | `pattern`, `path?`                                  |
| `file_grep`  | 正则搜索内容   | `pattern`, `path?`, `include?`                      |
| `todo_write` | AI 管理待办    | `todos: { content, status, priority }[]`            |

### IPC 通道

文件工具通过 `window.api.ai` 现有通道发送，主进程新增对应 handler。与聊天 agent 同 IPC 但工具集互斥。

---

## 持久化

### 数据库表

```sql
CREATE TABLE IF NOT EXISTS prompt_projects (
    id INTEGER PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'virtual',  -- 'virtual' | 'filesystem'
    path TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
-- 索引: idx_prompt_projects_updated_at (updated_at DESC)

CREATE TABLE IF NOT EXISTS prompt_designs (
    id INTEGER PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    chat_session_id TEXT NOT NULL,
    canvas_x REAL NOT NULL DEFAULT 0,
    canvas_y REAL NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
-- 索引: idx_prompt_designs_project_updated (project_id, updated_at DESC)

CREATE TABLE IF NOT EXISTS prompt_connections (
    id INTEGER PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    condition TEXT,                            -- 条件标签，NULL 表示无条件全分支
    created_at TIMESTAMP NOT NULL,
    UNIQUE(source_id, target_id)
);
-- 索引: idx_prompt_connections_project (project_id)

-- ai_chat_sessions 新增列
ALTER TABLE ai_chat_sessions ADD COLUMN type TEXT NOT NULL DEFAULT 'chat';
```

### 缓存

- Canvas viewport 存 localStorage `prompt-design-canvas-viewport`
- AI 模型选择沿用现有 `LOCAL_STORAGE_AI_MODEL_KEY`

---

## 边界与约束

- 提示词设计页面打开时聊天页面必须关闭（互斥 overlay）
- 提示词 agent 的工具不能影响聊天 agent 的任何数据结构（隔离）
- `file_write`/`file_edit` 需用户确认（confirmation）后才执行，参照现有 `askTool` 机制
- 卡片画布最多同时渲染 50 张卡片（虚拟化按需，超出视口的卡片不渲染 DOM）
- 首次打开无项目时，自动创建默认项目「默认项目」
