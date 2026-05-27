# Today Journal Persistence Design

## Goal

为 `TodayJournalPanel.tsx` 设计并落地本地 SQLite 持久化方案，使 Today 工作台的 journal 与 todo/snippet 一样进入统一的按日数据域。页面默认只读取当天数据，但数据库按 `entry_date` 保留历史。

## Scope

- 包含 Today Journal 的 SQLite 表、主进程服务层、IPC handler、preload 桥接、渲染层自动保存与删除链路。
- 包含对现有 `workspace:list-day` 返回结构的扩展。
- 包含最小测试覆盖，优先覆盖主进程服务层。
- 不包含情绪字段持久化。
- 不包含 journal 历史版本、撤销栈、显式保存按钮、云同步。
- 不引入 `workspace_days` 父表或其他新的日期容器模型。

## Architecture

延续已经落地的 `workspace` 持久化链路：SQLite 仅在 Electron 主进程访问，渲染层通过 preload 暴露的 `window.api.workspace` 调用 IPC。`TodayWorkspace.tsx` 继续作为 Today 页面唯一的数据拥有者，统一维护 todo、snippet、journal 三类状态。

Journal 使用独立平铺表 `journals`，不复用 `notes`，也不和 `todos` / `snippets` 合并到父表。`workspace:list-day` 继续作为当天工作台聚合读取入口，新增的 journal 写接口仍然挂在 `workspace:*` 命名空间下，避免 Today 页面出现第二套并行数据通道。

## Data Model

### `journals`

- `entry_date TEXT PRIMARY KEY`
- `content TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

设计决策：

- 一天最多一条 journal，`entry_date` 作为主键，不再额外生成 `id`。
- `content` 只存当天当前版本的正文，不保存修改历史。
- `created_at` 表示该日记首次落库时间，`updated_at` 表示最近一次成功保存时间。
- 当 `content.trim()` 为空时，直接删除该日期对应记录，不保留空记录。
- 时间格式继续使用 `YYYY-MM-DD HH:mm`，和现有 workspace 数据格式保持一致。

## IPC API

保留现有 `window.api.workspace` 命名空间，新增 journal 读写能力：

- `window.api.workspace.listDay(entryDate)`
- `window.api.workspace.saveJournal(input)`
- `window.api.workspace.deleteJournal(entryDate)`

返回结构：

- `listDay` 返回 `{ todos, snippets, journal }`
- `saveJournal` 返回最新 journal 记录
- `deleteJournal` 返回 `void`

IPC channel：

- `workspace:list-day`
- `workspace:journal:save`
- `workspace:journal:delete`

`journal` 返回值语义：

- 有记录时：`{ entryDate, content, createdAt, updatedAt }`
- 无记录时：`null`

## Renderer Behavior

`TodayJournalPanel.tsx` 不直接访问 preload API，也不保存真实数据，只作为纯展示组件接收：

- `journalContent`
- `isSaving`
- `errorMessage`
- `lastSavedAt`
- `onJournalContentChange`
- `onBlur`

`TodayWorkspace.tsx` 负责 journal 的真实状态与保存调度：

- 组件加载时通过 `workspace:list-day(entryDate)` 读取当日 journal。
- 输入时立即更新本地 `journalContent`，不阻塞编辑器输入。
- 对 `journalContent` 执行 `1000ms` 防抖保存；只有当当前内容与最近一次成功落库内容不同，才触发写入。
- 编辑器失焦、组件卸载前执行一次强制 flush，提交尚未被防抖处理的修改。
- 当内容清空后，调用 `workspace:journal:delete(entryDate)` 删除记录，并把本地“最近已保存内容”重置为空。
- 当保存失败时，保留当前输入内容，不回滚 UI，仅展示错误状态，并允许后续输入或失焦再次重试。

展示规则：

- `TodayJournalPanel` 原有硬编码 `JOURNAL_DATA` 不再作为真实数据源。
- 顶部时间展示改为最近成功保存时间；没有已保存记录时显示 `未保存`。
- 情绪文案继续纯前端派生，不写入数据库。

## Main Process Behavior

`workspaceService` 继续作为 Today 工作台的唯一主进程服务：

- `listDay(entryDate)` 在读取 todos/snippets 的同时读取 `journals` 单条记录。
- `saveJournal({ entryDate, content })` 执行最小校验后进行 upsert。
- 若指定日期无现存记录，则插入新行并同时设置 `created_at` / `updated_at`。
- 若指定日期已有记录，则只更新 `content` / `updated_at`，保留原始 `created_at`。
- `deleteJournal(entryDate)` 直接删除该日期记录；当记录不存在时保持幂等。

输入校验：

- `entryDate` 必须是 `YYYY-MM-DD`。
- `saveJournal` 接收的 `content` 允许为空字符串，但渲染层在空字符串场景应优先走删除接口。
- 服务层仍需对空字符串保持一致语义，避免不同调用方导致脏数据进入表中。

## Error Handling

- 数据库异常直接抛到 IPC，由渲染层转换为页面错误文案。
- 自动保存失败不清空输入、不回滚编辑器状态。
- 删除失败时也不强制恢复旧内容，仅提示错误，并在下一次保存/删除时重试。
- `workspace:list-day` 任一子查询失败时保持整次请求失败，由页面显示统一工作台错误状态，避免 Today 页面出现部分数据新、部分数据旧的分叉态。

## Files

- Modify `src/main/db/schema.ts`：新增 journal 类型与 `journals` 表定义，扩展 `WorkspaceDayData`。
- Modify `src/main/db/index.ts`：创建 `journals` 表。
- Modify `src/main/services/workspaceService.ts`：扩展 `listDay`，新增 `saveJournal` / `deleteJournal`。
- Modify `src/main/services/workspaceService.test.ts`：补齐 journal 的新增、更新、删除、读取测试。
- Modify `src/main/ipc/workspaceHandlers.ts`：注册 journal IPC handler。
- Modify `src/preload/index.ts`：暴露 `window.api.workspace.saveJournal` / `deleteJournal`。
- Modify `src/renderer/src/env.d.ts`：声明 renderer 侧 journal 类型与 API。
- Modify `src/renderer/src/pages/TodayWorkspace.tsx`：接入 journal 读取、自动保存、强制 flush 与错误展示。
- Modify `src/renderer/src/pages/components/TodayJournalPanel.tsx`：移除硬编码真实数据来源，改为纯展示组件。

## Verification

- `pnpm test -- workspaceService`
- `pnpm typecheck`
- `pnpm lint`

## Constraints

- 表名固定为 `journals`。
- 不使用 `today_` 前缀。
- 不执行 `git commit`，因为当前指令未授权且项目规范明确禁止自动提交。
- 不引入新的状态管理库、迁移框架或版本化存储模型。
