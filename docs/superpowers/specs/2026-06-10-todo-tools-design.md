# Todos Agent 工具集成 — 设计规格

> 日期：2026-06-10 | 状态：待审核

## 1. 目标

为 Agent 系统集成 todo 相关工具，使 AI 能查询、创建、更新、删除本地待办。完全镜像 `peopleTool.ts` 的四工具（query/add/update/delete）+ 受控 SQL 模式。

## 2. 背景

- `src/main/db/schema.ts` 已定义 `todos` 表、`TodoItem`/`TodoRow`/`TodoCreateInput`/`TodoUpdateInput` 等完整类型。
- `src/main/services/todosService.ts` 已实现 `listByDate` / `create` / `update` / `delete` / `reorder`，缺少 `querySql`。
- `src/main/agent/tools/peopleTool.ts` 建立了工具设计模式：查询（结构化条件 + 受控 SQL）+ 三种写入工具（带确认），本次严格遵循。

## 3. 架构

### 3.1 文件规划

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/main/agent/tools/todoTool.ts` | 新增 | Todos 四工具定义 |
| `src/main/services/todosService.ts` | 修改 | 增加 `querySql` 方法 |
| `src/main/agent/tools/toolRegistry.ts` | 修改 | 注册 todo 工具工厂，扩展 `AgentToolRegistryContext` |
| `src/main/agent/types.ts` | 修改 | 新增 todo 相关类型 |

**不动**：`schema.ts`（类型完备）、IPC 层、Renderer 层。

### 3.2 与 peopleTool 的关键差异

| 维度 | peopleTool | todoTool |
|---|---|---|
| 主键类型 | `string` (external_id) | `number` (自增) |
| 日期维度 | 无 | `entryDate` 必填/默认今天 |
| 默认排序 | `updated_at DESC` | `completed ASC, sort_order ASC, created_at ASC` |
| details 字段 | 有（Markdown 长文本） | 无 |
| 写入输入 | 完整 profile 对象 | `text + priority + entryDate/completed` |
| SQL 查询列 | 基础/详情两档 | 始终全列（列数少） |

## 4. 工具设计

### 4.1 查询工具 `todos_tool_query`

双通道查询：结构化条件优先，SQL 回退。

**结构化入参**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `entryDate` | string? | 日期 `YYYY-MM-DD`，默认今天；传 `"all"` 跨日期 |
| `query` | string? | 文本关键词（LIKE `%text%`） |
| `priority` | TodoPriority? | 精确匹配 |
| `completed` | boolean? | 完成状态 |
| `limit` | number? | 默认 20，最大 50 |

**SQL 通道**：`sql` 参数，受控规则与 peopleTool 一致 — 仅允许 `SELECT FROM todos`，禁止 JOIN/UNION/注释/多语句/写关键字，自动补 LIMIT。

**内部排序**：`completed ASC, sort_order ASC, created_at ASC`。

**输出**：`AgentToolResult & { items: TodoItem[]; rows: unknown[] }`。

### 4.2 新增工具 `todos_tool_add`

| 入参 | 类型 | 必填 |
|---|---|---|
| `entryDate` | string | 是 |
| `text` | string | 是 |
| `priority` | TodoPriority | 是 |
| `confirmationSummary` | string | 是 |

确认文案：「将创建待办：{text}。（P{priority}）」
完成提示：「已添加待办：{text}。」

### 4.3 更新工具 `todos_tool_update`

| 入参 | 类型 | 必填 |
|---|---|---|
| `id` | number | 是 |
| `text` | string | 是 |
| `priority` | TodoPriority | 是 |
| `completed` | boolean | 是 |
| `confirmationSummary` | string | 是 |

确认文案：「将更新待办：{text}。」
完成提示：「已更新待办：{text}。」

### 4.4 删除工具 `todos_tool_delete`

| 入参 | 类型 | 必填 |
|---|---|---|
| `id` | number | 是 |
| `confirmationSummary` | string | 是 |

确认文案：「将删除待办：{text}。」
完成提示：「已删除待办：{id}。」

## 5. 服务层改动

`TodosService` 类型增加：

```ts
querySql: (sql: string) => unknown[]
```

实现为 `database.prepare(sql).all()` 的透传。

## 6. 注册上下文改动

```ts
// toolRegistry.ts
export type AgentToolRegistryContext = {
  peopleService: Pick<PeopleService, 'list' | 'querySql' | 'create' | 'update' | 'delete'>
  // 新增：
  todosService: Pick<TodosService, 'listByDate' | 'querySql' | 'create' | 'update' | 'delete'>
}
```

工厂列表中新增 `({ todosService }) => createTodoTools(todosService)`。

## 7. Prompt 与安全

### 7.1 意图关键词

中文：待办、任务、清单、要做、完成、优先级、P0、P1、P2、P3
英文：todo、task、done、completed

### 7.2 安全边界

- SQL 仅允许 `SELECT FROM todos`，复用 peopleTool 的安全校验常量（`FORBIDDEN_SQL_PATTERN`、`SQL_COMMENT_PATTERN`、`MAX_PEOPLE_SQL_LENGTH`），表名改为 `todos`
- 写入前必须通过内部确认
- AI 自填 `confirmationSummary` 字段（简洁中文 Markdown）
- 待办内容不得凭空捏造
- 不提供 `todos_tool_reorder`（排序属 UI 交互，不适合 AI 直接重排所有待办）

## 8. 非目标

- 不做 reorder 工具
- 不修改 IPC/Renderer 层
- 不新增数据库迁移
- 不修改 peopleTool
