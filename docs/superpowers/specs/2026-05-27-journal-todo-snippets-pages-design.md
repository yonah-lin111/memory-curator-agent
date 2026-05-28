# Journal / Todo / Snippets 页面设计说明

## 目标

在现有 Electron + React + SQLite 架构上，完成 `JournalPage.tsx`、`TodoPage.tsx`、`SnippetsPage.tsx` 三个正式页面的布局、样式和数据库 CRUD 接入。三页共用同一套底层数据模型与 IPC 通道，但页面结构、视觉节奏和交互重心必须明确分化：

- `JournalPage`：偏沉浸写作与回看。
- `TodoPage`：偏执行效率与状态切换。
- `SnippetsPage`：偏探索整理与卡片归档。

数据范围固定为“按日期切换管理任意一天”，不做全库历史检索页。

## 约束

- 继续沿用项目黑色主题：主背景 `#000000`，卡片背景 `#212121`。
- 禁止使用渐变色。
- 圆角统一 `6px`。
- 优先复用 `src/renderer/src/components/ui/` 中已有公共组件。
- 渲染层导入统一使用 `@renderer/` 绝对路径别名。
- 不新增数据库表，不修改现有 workspace schema。
- 不把页面做成同一个壳子换文案，布局和视觉重心必须区分。

## 设计方向

整体采用 `Swiss Modernism 2.0 + Editorial Grid` 的混合思路：严格的信息层级、克制的高对比、少量微动效、明显留白。交互反馈保留轻量 hover / focus / 淡入淡出，不做花哨 HUD、霓虹或强视觉噪音。

## 架构

三页共用一层页面级数据接入模式，但不共用页面布局：

- 页面层负责：
  - `entryDate` 状态。
  - `isLoading`、`errorMessage`、toast 反馈。
  - `window.api.workspace` 的 CRUD 调用。
  - 无 preload bridge 时的回退数据或本地临时态。
- 页面专属子组件负责：
  - 展示。
  - 交互输入。
  - 调用页面传入的回调。

这样可以避免把 IPC / 数据访问散落进多个展示组件，同时保证三页布局自由度。

## 页面设计

### JournalPage

#### 页面定位

单日长文本写作与回看界面。Journal 不是列表管理，而是“某一天只有一篇正文”的记录页。

#### 布局

- 左侧：`日期脊柱`
  - 日期切换器。
  - 当日状态摘要：字数、最近保存时间、内容状态、情绪线索。
  - 页面动作：清空、聚焦编辑器。
- 右侧：`沉浸书写面`
  - 基于现有 `MDEditor` 的长文编辑区。
  - 顶部工具条保留预览模式切换。
  - 底部显示保存状态、错误状态、字数。

#### CRUD 设计

- 读取：通过 `window.api.workspace.listDay(entryDate)` 取回 `journal`。
- 保存：调用 `window.api.workspace.saveJournal({ entryDate, content })`。
- 删除：当内容清空后调用 `window.api.workspace.deleteJournal(entryDate)`。

#### 交互

- 内容变更后自动保存。
- 编辑器失焦时补一次保存。
- 保存失败时保留当前脏内容，不回滚。

### TodoPage

#### 页面定位

单日任务执行界面。强调快速录入、行内修改、优先级切换和完成反馈。

#### 布局

- 左侧主区：`任务跑道`
  - 顶部快速录入条。
  - 未完成任务列表。
  - 已完成任务折叠区或次级展示区。
- 右侧侧栏：`控制塔`
  - 当日任务统计。
  - 优先级分布。
  - 排序按钮。
  - 当前日期说明与操作提示。

#### CRUD 设计

- 读取：`window.api.workspace.listDay(entryDate)` 取回 `todos`。
- 新建：`window.api.workspace.createTodo(...)`。
- 更新：`window.api.workspace.updateTodo(id, ...)`。
- 删除：`window.api.workspace.deleteTodo(id)`。
- 排序：`window.api.workspace.sortTodos(...)`。

#### 交互

- 复用 `todoShared.ts` 的优先级轮转逻辑。
- 任务文本支持行内编辑。
- 完成状态一键切换。
- 删除时保留轻微收缩淡出动画。
- 排序不做复杂拖拽，先保留现有“手动排序 / 重排”模式。

### SnippetsPage

#### 页面定位

单日片段档案页。重点不是“写长文”，而是把零散片段按标签和内容状态重新整理。

#### 布局

- 左侧：`标签地图`
  - 当前日期切换器。
  - 标签计数。
  - 全部 / 某标签筛选。
- 中间：`片段卡片流`
  - 标题、摘要、更新时间、标签。
  - 支持选中某条片段。
- 右侧：`详情抽屉`
  - 新建或编辑当前片段。
  - 标题、内容、标签输入。

#### CRUD 设计

- 读取：`window.api.workspace.listDay(entryDate)` 取回 `snippets`。
- 新建：`window.api.workspace.createSnippet(...)`。
- 更新：`window.api.workspace.updateSnippet(id, ...)`。
- 删除：`window.api.workspace.deleteSnippet(id)`。

#### 交互

- 列表与详情分离，避免在卡片流里塞长表单。
- 删除失败时撤销本地删除动画状态。
- 标签筛选只在前端派生，不新增数据库查询接口。

## 组件拆分

页面专属组件放在 `src/renderer/src/pages/components/`：

- `JournalDateRail.tsx`
- `JournalEditorSurface.tsx`
- `TodoControlTower.tsx`
- `SnippetsTagMap.tsx`
- `SnippetDetailDrawer.tsx`

可选补充的公共原子组件仅在确认跨页复用后再抽，例如：

- `PageDateNavigator.tsx`
- `EmptyState.tsx`
- `SectionCard.tsx`

原则是只抽真通用原子，不抽伪复用页面壳。

## 状态流

### 页面共通状态

- `entryDate`
- `isLoading`
- `errorMessage`
- 实体状态：
  - `journalContent`
  - `todos`
  - `snippets`

### 页面专属状态

- `JournalPage`
  - `savedJournalContent`
  - `lastSavedAt`
  - `isJournalSaving`
- `TodoPage`
  - 快速输入草稿
  - 行内编辑项
  - 删除动画状态
- `SnippetsPage`
  - 当前选中片段
  - 新建 / 编辑模式
  - 当前标签筛选
  - 删除动画状态

## 错误处理

- 首次读取失败：
  - 页面顶部显示内联错误卡。
  - 同时触发 toast。
- 写操作失败：
  - toast 提示。
  - 不清空用户当前输入。
- Journal 自动保存失败：
  - 保留未保存正文。
  - 标记“未同步”或失败状态。
- Todo / Snippets 删除失败：
  - 恢复本地删除动画状态。

## 响应式

- 桌面端保持三页各自设计：
  - Journal：双栏。
  - Todo：主区 + 侧栏。
  - Snippets：三段式不对称布局。
- 窄屏下统一收敛为单列或上下堆叠：
  - 日期与控制信息移到正文 / 列表上方。
  - 详情抽屉改为全宽下方编辑区。

## 测试设计

渲染层补充页面行为测试，不重复主进程 service 的 SQLite CRUD 测试。

### JournalPage

- 加载指定日期的日记内容。
- 编辑内容后触发保存。
- 清空内容触发删除路径。
- 保存失败时展示失败状态。

### TodoPage

- 加载指定日期的待办列表。
- 新增待办。
- 行内编辑待办文本。
- 切换完成状态。
- 切换优先级。
- 删除待办。
- 切换日期后重新加载。

### SnippetsPage

- 加载指定日期的片段列表。
- 新增片段。
- 编辑片段。
- 删除片段。
- 标签筛选。
- 切换日期后重新加载。

### 路由级验证

- `App.test.tsx` 补充三个页面不再展示 `COMING SOON` 的基本覆盖。

## 实施原则

- 优先复用已有 `IconButton`、`Tag`、`Toast`、`todoShared.ts` 以及 `TodayWorkspace` 中已经验证过的 workspace API 使用模式。
- 页面样式可以共享基础 token，但不共享整页骨架。
- 先把 CRUD 跑通，再做必要的视觉微调，不做无意义炫技。

## 风险与边界

- 当前公共 UI 原子较少，若完全不补充轻量共用组件，页面文件容易变大。
- `TodayWorkspace` 现有逻辑可复用，但直接搬运会把工作台式布局气质带进独立页面，需要主动拆掉。
- `SnippetsPage` 如果把筛选、浏览、编辑全部塞进一个组件，复杂度会迅速失控，因此必须拆右侧详情抽屉。
- Journal 保存是单篇覆盖，不支持版本历史；本次范围内不扩展版本回溯。

## 结论

本次实现应当围绕“同一数据层、三种页面人格”展开：Journal 做沉浸书写，Todo 做执行控制，Snippets 做探索整理。数据库接口保持不变，前端通过页面级状态组织和专属布局完成差异化。
