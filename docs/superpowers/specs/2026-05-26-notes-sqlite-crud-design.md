# Notes SQLite CRUD Design

## Goal

将 `NotesPage.tsx` 的自由笔记从前端静态数组与内存态迁移到本地 SQLite，支持创建、读取、更新、删除。首次建库不写入演示数据，笔记池为空。

## Scope

- 包含 Notes 本地持久化、主进程 SQLite 初始化、IPC CRUD、preload 安全桥接、渲染层加载和写入流程。
- 不包含 Agent、LLM、剪贴板监听、云同步、迁移系统、全文搜索。
- 不保留 `INITIAL_NOTES` 作为运行时数据源。

## Architecture

SQLite 只在 Electron 主进程中访问。渲染进程通过 preload 暴露的 `window.api.notes` 调用 IPC，避免直接接触 Node、SQLite 或文件路径。

数据库文件放在 `app.getPath("userData")/curator.db`，启动时执行 `CREATE TABLE IF NOT EXISTS notes`。服务层负责把数据库行转换成页面使用的 `NoteMaterialItem` 形状。

## Data Model

`notes` 表字段：

- `id TEXT PRIMARY KEY`
- `title TEXT NOT NULL`
- `content TEXT NOT NULL`
- `source TEXT NOT NULL`
- `tags TEXT NOT NULL`，存储 JSON 字符串数组
- `time TEXT NOT NULL`，沿用页面显示格式 `YYYY-MM-DD HH:mm`
- `is_curated INTEGER NOT NULL DEFAULT 0`
- `clue TEXT`

新增笔记时主进程生成 `id`、`time`、`isCurated=false`、`clue="可能关联主题「Markdown 新素材」"`。更新笔记只修改 `title`、`content`、`source`、`tags`，不改创建时间和策展状态。

## IPC API

preload 暴露：

- `window.api.notes.list(): Promise<NoteMaterialItem[]>`
- `window.api.notes.create(draft): Promise<NoteMaterialItem>`
- `window.api.notes.update(id, draft): Promise<NoteMaterialItem>`
- `window.api.notes.delete(id): Promise<void>`

IPC channel 使用 `notes:list`、`notes:create`、`notes:update`、`notes:delete`。

## Renderer Behavior

`NotesPage.tsx` 初始 `notes` 为空数组，挂载后调用 `window.api.notes.list()`。加载时显示克制的本地数据库读取状态。加载失败时显示错误态和重试按钮。

创建、更新、删除都先等待 SQLite 写入成功，再更新本地 React 状态。失败时保留原状态并显示错误提示。

## Files

- Create `src/main/db/schema.ts`：共享主进程 Note 类型和 SQLite 表结构常量。
- Create `src/main/db/index.ts`：打开 SQLite，初始化表，导出数据库句柄。
- Create `src/main/services/notesService.ts`：封装 Notes CRUD。
- Create `src/main/ipc/notesHandlers.ts`：注册 Notes IPC handler。
- Modify `src/main/index.ts`：应用启动时初始化数据库并注册 handler。
- Modify `src/preload/index.ts`：暴露 `window.api.notes`。
- Modify `src/renderer/src/env.d.ts`：声明 preload API 类型。
- Modify `src/renderer/src/components/pages/NotesPage.tsx`：移除静态数据依赖，接入异步 CRUD。

## Error Handling

服务层对输入做最小校验：标题和正文必须非空，标签必须是字符串数组。数据库异常向 IPC 抛出，由渲染层转换为页面错误文案。

## Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- 如原生依赖正常，再跑 `pnpm build`

## Constraints

- 不提交 git commit，除非用户显式要求。
- 不添加 Agent。
- 不新增 Drizzle migration 或 React Query，避免超出当前 CRUD 目标。
