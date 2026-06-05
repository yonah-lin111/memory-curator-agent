# 全页面预设 IconButton 替换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全页面（通过 `Sidebar.tsx` 主导航控制的各大页面）中包含 Add (添加), Close (关闭), Save (保存), Confirm (确认), Delete (删除), Edit (编辑) 功能的图标按钮（`IconButton`）统一重构为使用新增的 `preset` 系统。

**Architecture:** 
- 清理各文件中手动导入的、且已被 `preset` 内置的多余 `lucide-react` 图标。
- 使用 `preset="add" | "close" | "save" | "confirm" | "delete" | "edit"` 参数精简 `IconButton` 的组件属性，替换其子元素。

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React

---

### Task 1: 升级侧边栏聊天历史（AiChatHistoryList.tsx）

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatHistoryList.tsx`

- [ ] **Step 1: 重构“批量选择”与“新建对话”两个按钮**
  - “退出批量删除”时使用 `preset="close"`。
  - “新建对话”时使用 `preset="add"`。
  - 清理不再用到的 `Plus` 和 `X` 导入。

---

### Task 2: 升级人物档案档案库（PeoplePage.tsx & PeopleProfileForm.tsx）

**Files:**
- Modify: `src/renderer/src/pages/people/PeoplePage.tsx`
- Modify: `src/renderer/src/pages/people/components/PeopleProfileForm.tsx`

- [ ] **Step 1: 重构 PeoplePage.tsx 顶栏“录入新人物”与详情“编辑/删除”按钮**
  - 顶栏录入按钮使用 `preset="add"`。
  - 详情编辑按钮使用 `preset="edit"` 并删除 `<Edit2 className="h-3 w-3" />` 子元素。
  - 详情删除按钮使用 `preset="delete"` 并删除 `<Trash2 className="h-3 w-3" />` 子元素。
- [ ] **Step 2: 重构 PeopleProfileForm.tsx 顶栏的“保存”与“取消编辑”按钮**
  - 保存档案按钮使用 `preset="save"` 并删除子元素。
  - 取消编辑按钮使用 `preset="close"` 并删除子元素。

---

### Task 3: 升级便签闪念（SnippetsPage.tsx & TodaySnippetsPanel.tsx & TodayNoteEntryModal.tsx）

**Files:**
- Modify: `src/renderer/src/pages/snippets/SnippetsPage.tsx`
- Modify: `src/renderer/src/pages/today/components/TodaySnippetsPanel.tsx`
- Modify: `src/renderer/src/pages/today/components/TodayNoteEntryModal.tsx`

- [ ] **Step 1: 重构 SnippetsPage.tsx 与 TodaySnippetsPanel.tsx 中的“添加片段”按钮**
  - 均将 `Plus` 子组件替换为 `preset="add"` 参数，清理 `Plus` 导入。
- [ ] **Step 2: 重构 TodayNoteEntryModal.tsx 中的“关闭弹窗”与“保存卡片”按钮**
  - “关闭弹窗”按钮改用 `preset="close"` 并清除 `<X ... />`。
  - “保存随记卡片”按钮添加 `preset="save"` 参数，保留原有 children 文字。

---

### Task 4: 升级待办清单（TodoPage.tsx & TodayTodoPanel.tsx）

**Files:**
- Modify: `src/renderer/src/pages/todo/TodoPage.tsx`
- Modify: `src/renderer/src/pages/today/components/TodayTodoPanel.tsx`

- [ ] **Step 1: 重构两处待办输入框末尾的“添加待办”按钮**
  - 均使用 `preset="add"` 参数替换 `Plus` 子组件。

---

### Task 5: 升级素材库（NotesPage.tsx & NoteMarkdownModal.tsx）

**Files:**
- Modify: `src/renderer/src/pages/notes/NotesPage.tsx`
- Modify: `src/renderer/src/pages/notes/components/NoteMarkdownModal.tsx`

- [ ] **Step 1: 重构 NotesPage.tsx 中的“新建素材”、“编辑”、“删除”按钮**
  - 新建素材按钮使用 `preset="add"`。
  - 单个卡片编辑按钮使用 `preset="edit"` 移除子元素。
  - 单个卡片删除按钮使用 `preset="delete"` 移除子元素，并移除手写的 hoverBgClass/hoverTextClass 属性以使用系统语义主题样式。
- [ ] **Step 2: 重构 NoteMarkdownModal.tsx 的“关闭弹窗”和底部“保存素材”按钮**
  - 关闭弹窗按钮使用 `preset="close"` 移除 `<X ... />`。
  - 底部“保存/更新 Markdown 笔记”按钮使用 `preset={initialDraft ? "confirm" : "add"}`，保留原有 children 文本。

---

### Task 6: 静态编译及回归测试验证

- [ ] **Step 1: 运行类型系统校验**
  - 运行 `pnpm typecheck`。
- [ ] **Step 2: 运行单元测试集**
  - 运行 `pnpm test`。
