# Note 分类功能 & 策展代码清理

## 目标

为 NotesPage 右侧容器添加分类管理功能（持久化 CRUD），清理左侧"策展/主题线索"相关废弃代码。

---

## 数据模型

### 新建 `note_categories` 表

```ts
note_categories = sqliteTable('note_categories', {
  id:        integer('id').primaryKey(),
  name:      text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0)
})
```

### 修改 `notes` 表

- **新增** `categoryId`: `integer('category_id')` 可空，外键关联 `note_categories.id`
- **删除** `isCurated`、`clue` 字段

---

## Service 层

### 新建 `src/main/services/noteCategoryService.ts`

| 方法 | 描述 |
|------|------|
| `list()` | 按 `sort_order ASC` 返回全部分类 |
| `create(name)` | 新建分类 |
| `update(id, name)` | 重命名分类 |
| `delete(id)` | 删除分类（关联笔记的 categoryId 置 NULL） |
| `reorder(ids[])` | 按传入顺序更新 sortOrder |

### 修改 `src/main/services/notesService.ts`

- `list(categoryId?)`: 支持按分类筛选；LEFT JOIN 获取 `categoryName`
- `create(input)`: 增加 `categoryId` 参数
- `update(id, input)`: 增加 `categoryId` 参数
- `querySql`: 支持跨表 JOIN（白名单增加 `note_categories`）

---

## IPC 通道

### 新建 `src/main/ipc/noteCategoryHandlers.ts`

| Channel | Service 方法 |
|---------|-------------|
| `note-categories:list` | `list()` |
| `note-categories:create` | `create(name)` |
| `note-categories:update` | `update(id, name)` |
| `note-categories:delete` | `delete(id)` |
| `note-categories:reorder` | `reorder(ids[])` |

### 修改 `src/main/ipc/notesHandlers.ts`

`notes:create` / `notes:update` 传递 `categoryId` 参数。

### 修改 `src/main/index.ts`

注册 `registerNoteCategoryHandlers()`。

---

## Preload API

### 新增

```ts
window.api.noteCategories: {
  list:   () => Promise<NoteCategory[]>
  create: (name: string) => Promise<NoteCategory>
  update: (id: number, name: string) => Promise<NoteCategory>
  delete: (id: number) => Promise<void>
  reorder: (ids: number[]) => Promise<void>
}
```

### 修改

`notes.create` / `notes.update` 增加可选 `categoryId?: number`。

---

## Agent Tools

### 新建 `src/main/agent/tools/noteCategoryTool.ts`

与 `noteTool.ts` 风格一致，提供：

- `note_categories_query`: 只读查询 + 受控 SQL（SELECT FROM note_categories）
- `note_categories_add`: 创建分类（含 confirmation）
- `note_categories_update`: 更新分类（含 confirmation）
- `note_categories_delete`: 删除分类（含 confirmation）

### 修改 `src/main/agent/tools/noteTool.ts`

- `notes_tool_query` 增加 `categoryId` 参数
- `buildStructuredWhere` 增加 `categoryId` 条件
- SQL 白名单允许 `note_categories` 表 JOIN
- Tools 注册入口同步更新

---

## 前端

### 新建 `NoteCategoryPanel.tsx`

右侧分类面板，**方案 A（内联编辑卡片）**：

- 卡片列表按 `sortOrder` 排列
- 点击分类名触发 inline 编辑（input 原地替换）
- 新增按钮在列表顶部插入空白卡片
- 点击分类卡片作为当前激活的筛选器（高亮 + 左侧素材列表过滤）
- 删除时弹出 Tooltip 确认
- 拖拽排序（可选，V2）

### 修改 `NotesPage.tsx`

**删除：**
- `isCurated`、`clue` 字段的 TS 类型定义
- `activeFilter` 状态与筛选逻辑（`pending`/`curated` 两个 tab）
- `NotesFilter` 类型
- `StatsSummaryItem` 类型与 `createStatsItems` 函数
- 统计指标 2x2 网格
- `NotesSidebar` 组件（替换为 `NoteCategoryPanel`）

**新增：**
- `activeCategoryId` 状态
- 分类筛选逻辑合并进 `filterNotes`

**类型更新：**
- `NoteMaterialItem` 新增 `categoryId?: number`、`categoryName?: string`
- 删除 `isCurated: boolean`、`clue?: string`

---

## 兼容性

- 旧 `isCurated`/`clue` 字段直接在 schema 中删除，不保留迁移
- 旧统计面板代码全部移除

---

## 改动文件清单

| 文件 | 操作 |
|------|------|
| `src/main/db/schema.ts` | 新增表 + 删除字段 |
| `src/main/services/noteCategoryService.ts` | **新建** |
| `src/main/services/notesService.ts` | 增加 categoryId 支持 |
| `src/main/ipc/noteCategoryHandlers.ts` | **新建** |
| `src/main/ipc/notesHandlers.ts` | 透传 categoryId |
| `src/main/index.ts` | 注册 handler |
| `src/main/agent/tools/noteCategoryTool.ts` | **新建** |
| `src/main/agent/tools/noteTool.ts` | 增加 categoryId 参数 |
| `src/main/agent/index.ts` | 注册新工具 |
| `src/preload/index.ts` | 新增 + 修改 API |
| `src/renderer/src/pages/notes/NotesPage.tsx` | 删除策展代码 + 集成分类 |
| `src/renderer/src/pages/notes/components/NoteCategoryPanel.tsx` | **新建** |
