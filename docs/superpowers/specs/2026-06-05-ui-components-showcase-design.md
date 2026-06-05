# UI 公共组件展示页设计规范 (UI Components Showcase Design)

本文档定义了在 Memory Curator Agent 项目中新增公共 UI 组件展示页（Playground）的设计方案。

## 1. 业务背景与目的
为了方便开发者和设计师直观、实时地预览和调试项目中的公共原子组件，保持整体 UI 视觉风格及交互的统一，决定在侧边栏新增一个专属的公共组件展示页（Page ID: `showcase`）。该页面不仅展示所有组件，且支持全方位交互（Playground 形式）。

## 2. 核心架构与功能设计

### 2.1 侧边栏集成 (Sidebar Integration)
- **页面标识**：`showcase`
- **新增分组**：在 `Sidebar.tsx` 中新增分组 `DEVELOPER`。
  ```typescript
  {
    id: "developer",
    label: "DEVELOPER",
    items: [
      {
        id: "showcase",
        label: "UI Showcase",
        description: "公共组件展示与交互",
        icon: LayoutGrid, // 使用 lucide-react 里的 LayoutGrid 或者 Eye 等图标
      }
    ]
  }
  ```
- **App 路由配置**：
  - 将 `showcase` 加入 `VALID_PAGES` 列表中。
  - `getPageCategory("showcase")` 返回 `"DEVELOPER"`。
  - `renderPageById` 中增加 `"showcase"` 对应的组件 `<ShowcasePage />` 的渲染。

### 2.2 展示页布局设计 (ShowcasePage Layout)
采用高内聚、新颖的**双栏交互 Playground 布局**：
1. **左侧组件迷你锚点导航轨 (Navigation Rail)**：
   - 包含：全览 (All)、消息提示 (Toast)、标签组件 (Tag)、日期切换 (DateNavigator)、下拉选择 (Select)、编辑器 (Markdown)、空状态 (EmptyState)、图标按钮 (IconButton)。
   - 采用精致的微悬浮效果与左侧卡片结构，极富节奏感。
2. **右侧滚动卡片 Playground 区域**：
   - 每一个组件使用高阶黑卡片 (`bg-[#212121]`，`border-white/5`，`rounded-[6px]`) 承载。
   - 每个卡片分为：组件标题 + 源文件路径、一句话描述、**实时互动 Demo 区域**、Props 与使用示例（折叠展示或代码说明）。

### 2.3 互动设计 (Interactive Demos)
- **Toast / Alert**：提供按钮触发 success、error、warning 和 info，可在本页面触发全局 Toast 消息并观察顶部入场动画。
- **Tag 标签**：展示不同尺寸（small, default, large）、带图标前缀、高亮状态以及可点击、可关闭的互动标签。
- **PageDateNavigator**：内置一个本地状态 `currentDate` 和 `countMap`，支持在 Showcase 页面内部流畅进行前一天、后一天切换以及弹窗月历选择。
- **Select**：展示单选及分组单选。用户在 Showcase 页面修改下拉项时，界面状态同步响应更新。
- **MarkdownEditor**：展示内置编辑器，可测试实时编辑及预览模式。
- **EmptyState**：展示多种预设的空状态，以及带操作动作（IconButton）的配置。
- **IconButton**：展示各种高亮、非高亮状态及 hover 过渡动效。

## 3. 视觉与规范契合

| 设计维度 | 项目规范 | 展示页实现方案 |
| :--- | :--- | :--- |
| 主题颜色 | 黑色主题 (主 #000000, 次 #212121) | 完全采用纯黑与深灰底色，禁止任何渐变色 |
| 边框圆角 | 边框 `border-white/5` 且圆角 `6px` | 所有 Playground 容器及卡片严格遵循 6px 圆角与极淡灰白边框 |
| 字体大小 | 正文 13px，Tag/描述 12px | 使用 Tailwind 的 `text-sm` (13px) 与 `text-xs` (12px) 样式重载 |
| 函数风格 | 统一使用箭头函数 | 页面及所有 Demo 子组件全部采用箭头函数编写 |
| 导入路径 | `@renderer/` 前缀绝对路径 | 所有引入组件一律使用绝对路径导入，拒绝 `../../` 相对路径 |
| 注释规范 | 单行注释说明 type/interface，多行注释说明函数 | 遵守简体中文注释规则，关键交互点添加详尽注释 |

## 4. 实施计划 (Implementation Plan)
1. **第一步**：创建 `src/renderer/src/pages/showcase/ShowcasePage.tsx`。
2. **第二步**：在 `Sidebar.tsx` 中注册 `showcase` 页面、图标与 `DEVELOPER` 导航组。
3. **第三步**：在 `App.tsx` 中配置页面路由及分类，无缝对接。
4. **第四步**：通过 `npm run typecheck` 与 `npm run lint` 验证无任何编译与风格错误。
