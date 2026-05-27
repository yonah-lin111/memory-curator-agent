# Today Workspace Persistence Design

## Goal

为 `TodayTodoPanel.tsx` 与 `TodaySnippetsPanel.tsx` 设计并落地本地 SQLite 持久化方案，支持创建、读取、更新、删除，并为按日期查看历史保留扩展能力。`TodayWorkspace` 默认只读取当天数据，但数据库保留完整历史。

## Scope

- 包含 `TodayWorkspace` 的待办与随记数据落库。
- 包含主进程 SQLite 表、服务层、IPC handler、preload 桥接、渲染层异步加载与写入。
- 包含最小测试覆盖，优先覆盖主进程服务层。
- 不包含云同步、跨设备合并、事件溯源、全文搜索、日记正文持久化。
- 不复用现有 `notes` 表，避免 `TodayWorkspace` 与 `NotesPage` 语义耦合。

## Architecture

延续现有 `notes` 链路模式：SQLite 仅在 Electron 主进程访问，渲染层通过 preload 暴露的 `window.api.workspace` 调用 IPC。`TodayWorkspace` 负责维护当天视图状态，但真实数据源来自本地数据库。

数据库新增两张独立表：

- `todos`
- `snippets`

两张表都使用 `entry_date` 字段保存所属日期，格式为 `YYYY-MM-DD`。Today 页面默认按本地当天日期查询；后续若增加日期切换，只需要把日期参数透传到现有读取接口。

## Data Model

### `todos`

- `id TEXT PRIMARY KEY`
- `entry_date TEXT NOT NULL`
- `text TEXT NOT NULL`
- `priority TEXT NOT NULL`
- `completed INTEGER NOT NULL DEFAULT 0`
- `sort_order INTEGER NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

索引：

- `idx_todos_entry_date`
- `idx_todos_entry_date_completed_sort_order`

设计决策：

- `sort_order` 持久化用户顺序，避免每次按推导排序覆盖手动调整结果。
- `priority` 继续限制为 `P0` 到 `P3`，和现有 UI 保持一致。
- `created_at` / `updated_at` 使用 `YYYY-MM-DD HH:mm`，便于现有列表时间格式复用。

### `snippets`

- `id TEXT PRIMARY KEY`
- `entry_date TEXT NOT NULL`
- `title TEXT NOT NULL`
- `content TEXT NOT NULL`
- `tags TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

索引：

- `idx_snippets_entry_date`

设计决策：

- `tags` 存 JSON 字符串数组，复用现有 `notes` 表模式。
- 片段卡片显示的 `time` 由 `created_at` 派生出 `HH:mm`，不再单独存一份冗余字段。

## IPC API

preload 暴露：

- `window.api.workspace.listToday(date?: string)`
- `window.api.workspace.createTodo(input)`
- `window.api.workspace.updateTodo(id, input)`
- `window.api.workspace.deleteTodo(id)`
- `window.api.workspace.sortTodos(items)`
- `window.api.workspace.createSnippet(input)`
- `window.api.workspace.updateSnippet(id, input)`
- `window.api.workspace.deleteSnippet(id)`

返回结构：

- `listToday` 返回 `{ todos, snippets }`
- 其他写接口返回单条最新记录或 `void`

IPC channel：

- `workspace:list-day`
- `workspace:todo:create`
- `workspace:todo:update`
- `workspace:todo:delete`
- `workspace:todo:sort`
- `workspace:snippet:create`
- `workspace:snippet:update`
- `workspace:snippet:delete`

## Renderer Behavior

`TodayWorkspace.tsx` 初始不再依赖 `TODO_ITEMS` / `NOTE_ITEMS` 静态数组。组件挂载后读取当天工作台数据：

- 加载中：保留页面结构，仅面板内展示克制的本地读取状态。
- 加载失败：显示错误文案，不写入伪造数据。
- 创建 / 更新 / 删除：等待 SQLite 写入成功后再更新本地状态。

待办行为：

- 新增待办时由主进程生成 `id`、`entry_date`、`sort_order`、时间字段。
- 切换完成状态、切换优先级、编辑文本都走 `updateTodo`。
- 点击“一键排序”后，渲染层先基于现有算法产出新顺序，再将 `id` 顺序提交给主进程持久化 `sort_order`。

随记行为：

- 继续使用 `TodayNoteEntryModal`。
- 保存新建 / 编辑统一走 `createSnippet` / `updateSnippet`。
- 面板展示时间时使用 `created_at` 派生的 `HH:mm`。

## Error Handling

- 服务层对输入做最小校验：待办文本非空、优先级合法、`sort_order` 为非负整数；片段标题和内容允许二选一非空、标签必须是字符串数组。
- 数据库异常直接抛到 IPC，由渲染层转换为页面错误文案。
- 渲染层写操作失败时保留原状态，避免 UI 和数据库分叉。

## Files

- Modify `src/main/db/schema.ts`：新增 Workspace 类型与表定义。
- Modify `src/main/db/index.ts`：创建新表与索引。
- Create `src/main/services/workspaceService.ts`：封装 todos/snippets CRUD 与当日查询。
- Create `src/main/services/workspaceService.test.ts`：覆盖服务层核心逻辑。
- Create `src/main/ipc/workspaceHandlers.ts`：注册 Workspace IPC handler。
- Modify `src/main/index.ts`：启动时注册 Workspace handler。
- Modify `src/preload/index.ts`：暴露 `window.api.workspace`。
- Modify `src/renderer/src/env.d.ts`：声明 Workspace API 与类型。
- Modify `src/renderer/src/pages/TodayWorkspace.tsx`：移除静态 mock，接入异步持久化。
- Modify `src/renderer/src/pages/components/TodayTodoPanel.tsx`：从直接 `setTodos` 改为调用页面层异步回调。
- Modify `src/renderer/src/pages/components/TodaySnippetsPanel.tsx`：无需改结构，只消费真实数据。
- Modify `src/renderer/src/pages/components/TodayNoteEntryModal.tsx`：扩展片段类型，统一保存载荷。

## Verification

- `pnpm test -- workspaceService`
- `pnpm typecheck`
- `pnpm lint`

## Constraints

- 不执行 `git commit`，因为项目与本次任务都没有授权。
- 不引入 React Query、migration 框架或额外状态管理层。
