---
name: snippets-agent-tools-design
description: Design specification for snippets related agent tools and service extension
metadata:
  type: project
---

# Snippets Agent Tools 设计规格说明书 (2026-06-10)

本设计文档旨在为 AI Agent（curator）添加针对本地 `snippets` 表的增删改查以及批量操作工具，使其能够管理代码片段及笔记片段。

## 1. 架构设计与数据分层

为了保证项目结构的一致性、健壮性与可测试性，本项目采用 Service -> AgentTool 架构进行分层：

1. **Service 层 (`src/main/services/snippetsService.ts`)**：
   - 增加受控 SQL 查询接口 `querySql`。
   - 保留现有的 `create`, `update`, `delete` 等核心业务能力，进行参数校验和业务规则落库。
2. **Agent Tool 域 (`src/main/agent/tools/snippetTool.ts`)**：
   - 提供给 LLM 使用的 7 个独立工具。
   - 内置防 SQL 注入拦截器。
   - 包含面向用户的 UI 确认对话框设计（`ToolConfirmationConfig`）。
3. **注册与注入 (`src/main/agent/tools/toolRegistry.ts` 与 `src/main/ipc/aiHandlers.ts`)**：
   - 在上下文（Context）中提供 `snippetsService`。
   - 把 `snippets` 工具集动态加载到 Agent 内存中。

---

## 2. 接口契约设计

### 2.1 SnippetsService 接口扩展
```typescript
export type SnippetsService = {
  // 读取指定日期的全部片段
  listByDate: (entryDate: string) => SnippetItem[]
  // 创建片段
  create: (input: SnippetCreateInput) => SnippetItem
  // 更新片段
  update: (id: number, input: SnippetUpdateInput) => SnippetItem
  // 删除片段
  delete: (id: number) => void
  // 执行只读片段 SQL 查询并返回原始行
  querySql: (sql: string) => unknown[]
}
```

### 2.2 Agent Tools 详细设计

我们设计以下 7 个工具，遵循与 `todoTool.ts` 相同的开发风格：

| 工具名称 | 工具描述 | 是否需要用户确认 |
| :--- | :--- | :--- |
| `snippets_tool_query` | 条件/SQL 只读查询片段 | 否 |
| `snippets_tool_add` | 新增片段 | 是 (PEOPLE_ADD_CONFIRMATION / TODO_ADD_CONFIRMATION 风格) |
| `snippets_tool_update` | 更新片段 (根据 id) | 是 |
| `snippets_tool_delete` | 删除片段 (根据 id) | 是 |
| `snippets_tool_batch_add` | 批量新增片段 | 是 |
| `snippets_tool_batch_update` | 批量修改片段 | 是 |
| `snippets_tool_batch_delete` | 批量删除片段 | 是 |

---

## 3. 安全与质量保障 (防注入与参数检验)

1. **SQL 单一表限制**：
   - 所有在 `snippets_tool_query` 中执行的自定义 SQL 语句，其 `FROM` 子句中必须且仅允许查询 `snippets` 表。
   - 禁止在 SQL 中使用 `JOIN`, `UNION` 等多表连接操作。
2. **高风险 SQL 关键字过滤**：
   - 使用正则表达式阻断 `insert`, `update`, `delete`, `drop`, `alter`, `create`, `replace` 等一切写/修改数据库操作。
   - 禁止含有多条 SQL 语句拼接（如 `;`）及注释（`--`, `/*`, `*/`）。
3. **参数强类型校验**：
   - 所有的输入参数需通过 Agent 的 JSON Schema 校验。
   - 单次读取设置 `limit` 参数安全阈值（默认 20，最高 50）。

---

## 4. UI 确认配置

所有的写操作（Add, Update, Delete, 以及它们的 Batch 版本）均配置 `ToolConfirmationConfig`：
- **`renderTarget`**: 获取编辑、新增、删除的目标名称或摘要（例如 `"1 项片段"` 或 `"#13 片段"`）。
- **`renderSummary`**: 必须由 LLM 提供中文 Markdown 格式的 `confirmationSummary`。如无提供，提供默认格式化的回滚概要。
- **`completion`**: 写入成功后展示完成气泡/提示语（如 `"已创建片段：[标题]。"`）。
