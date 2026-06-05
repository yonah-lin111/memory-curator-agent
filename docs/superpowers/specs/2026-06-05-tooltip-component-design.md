# Tooltip 公共组件设计规范 (Tooltip Component Design Spec)

本文档定义了在 Memory Curator Agent 项目中新增公共 UI 组件 Tooltip 的设计方案与实现路径。

## 1. 业务背景与目的
Tooltip（文字提示）是后台/桌面应用中不可或缺的微交互组件。当用户悬停（hover）或点击（click）某个操作按钮/标签时，会浮现轻量级的辅助信息。为了让项目的组件库更完善，我们设计一个符合极简暗色主题、拥有流畅动效、且同时完美支持 Hover 与 Click 交互模式的 `Tooltip` 原子组件，并在 `ShowcasePage` 中进行展示。

## 2. 核心架构与功能设计

### 2.1 Tooltip 组件接口 (Tooltip Props)
Tooltip 组件将放置于 `src/renderer/src/components/ui/Tooltip.tsx`。
其接口定义如下：

```typescript
export type TooltipPlacement = "top" | "bottom" | "left" | "right";
export type TooltipTrigger = "hover" | "click" | "both";

export interface TooltipProps {
  // 触发 Tooltip 的子元素
  children: React.ReactNode;
  // Tooltip 显示的文本或节点内容
  content: React.ReactNode;
  // 弹出位置，支持 "top" | "bottom" | "left" | "right"，默认为 "top"
  placement?: TooltipPlacement;
  // 触发方式，支持 "hover" | "click" | "both"，默认为 "hover"
  trigger?: TooltipTrigger;
  // 额外的弹出容器样式
  contentClassName?: string;
  // 额外的包装容器样式
  className?: string;
  // 延迟显示时间（毫秒），默认 150ms
  delay?: number;
}
```

### 2.2 交互逻辑与实现细节
为了保持轻量无依赖，Tooltip 将基于纯 React 结合 Tailwind CSS 进行开发：
1. **状态管理**：
   - 本地维护 `isVisible` 表示 Tooltip 的可见状态。
   - 使用定时器处理 `delay` 延迟显示。
2. **事件监听**：
   - **Hover 模式**：通过绑定 `onMouseEnter`、`onMouseLeave` 事件控制。
   - **Click 模式**：通过绑定 `onClick` 切换显示状态。
   - **点击外部关闭（Click Outside）**：在 `trigger` 包含 `click` 时的生命周期内，在全局 `document` 监听点击，若点击了 Tooltip 及其触发元素之外的区域，则将其隐藏。
3. **定位机制**：
   - 采用绝对定位（`absolute`），配合父容器相对定位（`relative`）。
   - 根据 `placement` 属性计算出对应的 Tailwind CSS 位置类名，例如：
     - `top`: `bottom-full left-1/2 -translate-x-1/2 mb-2`
     - `bottom`: `top-full left-1/2 -translate-x-1/2 mt-2`
     - `left`: `right-full top-1/2 -translate-y-1/2 mr-2`
     - `right`: `left-full top-1/2 -translate-y-1/2 ml-2`
4. **小三角（Arrow）**：
   - 在 Tooltip 内部渲染一个精美的方向指示三角形，通过绝对定位自动对齐边缘。

## 3. 视觉与规范契合

| 设计维度 | 项目规范 | Tooltip 实现方案 |
| :--- | :--- | :--- |
| **主题颜色** | 黑色主题 (主 #000000, 次 #212121) | 背景采用 `#212121`（与次色一致），边框使用 `border-white/5` |
| **圆角大小** | 边框圆角 `6px` | 严格使用 `rounded-[6px]` |
| **字体大小** | 默认正文 13px，Tag/描述等 12px | 文字默认使用 `text-xs` (12px) 级别以突显辅助工具提示的层次感 |
| **动效反馈** | 自然、克制、优雅，避免生硬跳变 | 采用 `transition-all duration-150` 并支持 `opacity-0 scale-95` 到 `opacity-100 scale-100` 的淡入淡出动画 |
| **函数风格** | 统一使用箭头函数 | 使用箭头函数声明 Tooltip 组件 |
| **导入路径** | `@renderer/` 前缀绝对路径 | 在 ShowcasePage 引入时使用 `@renderer/components/ui/Tooltip` 绝对路径 |

## 4. 实施计划 (Implementation Plan)
1. **新建组件**：在 `src/renderer/src/components/ui/` 目录下创建 `Tooltip.tsx`。
2. **Showcase 集成**：在 `ShowcasePage.tsx` 中增加一个专属的 `Tooltip` 展示区块，展示不同的 `placement`、不同的 `trigger`（如 Hover、Click），并支持全方位的 Playground 交互。
3. **静态校验**：运行 `npm run lint` 与 `npm run typecheck` 确认代码无任何报错，并符合项目代码规范。
