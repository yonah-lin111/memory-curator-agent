# 项目级开发规范

## 样式布局

### 主题颜色

- 黑色主题
- 主 #000000、 次 #212121
- 禁止使用渐变色

### 样式

- 圆角：6px

### 字体

- 默认字体大小为 13px（在 `styles.css` 中重载为 Tailwind 的 `text-sm` / `text-base`）
- tag、描述等字体默认为 12px（在 `styles.css` 中重载为 Tailwind 的 `text-xs`）

### 交互与布局

- 前端交互需要优雅，动效、反馈与状态切换应自然克制，避免生硬跳变。
- 前端布局需要新颖，在保证信息清晰与可用性的前提下体现层次感与设计感。
- 优先通过留白、层级、卡片结构、节奏变化与微交互提升体验，禁止依赖渐变制造视觉效果。

## TS

### 函数

- 函数统一使用箭头函数编写。

### type 与 interface 使用时机

- 描述对象形状且需要被类实现、声明合并或对外扩展时，使用 `interface`。
- 描述联合类型、交叉类型、工具类型、函数类型、元组或需要类型运算时，使用 `type`。
- 同一类场景内保持一致，避免在等价表达中混用 `type` 与 `interface`。

## 注释要求

- 使用简体中文。
- 禁止输出或写入替换字符（Unicode U+FFFD，对应显示为 ）。
- 变量、type、interface、enum 等需要使用单行注释说明。
- 方法、函数使用多行注释说明。
- 方法、函数内部关键部位应按需添加简短注释，说明关键逻辑、边界条件或非直观决策。

## 目录结构与导入规范

### 目录层级规范

- **`src/renderer/src/pages/`**：存放粗粒度的路由/页面级组件（如 `JournalPage.tsx`, `TodayPage.tsx`）。
- **`src/renderer/src/pages/components/`**：存放特定页面独占、强业务属性的非通用子组件（如 `TodayPageEntryModal.tsx`）。
- **`src/renderer/src/components/ui/`**：存放高复用、无业务逻辑的基础原子 UI 组件（如 `IconButton.tsx`, `Toast.tsx`）。
- **`src/renderer/src/components/layout/`**：存放通用的页面框架/布局级组件（如 `Sidebar.tsx`）。

### 绝对路径导入

- 渲染层内一律使用以 `@renderer/` 为前缀的绝对路径别名导入，**禁止使用任何 `../` 或 `../../` 等较深的相对路径**。
