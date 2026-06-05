# ConfirmTooltip 行为确认公共组件设计规范 (ConfirmTooltip Design Spec)

本文档定义了在 Memory Curator Agent 项目中新增公共 UI 组件 ConfirmTooltip 的设计方案与实现路径。

## 1. 业务背景与目的
ConfirmTooltip（行为确认 Tooltip）是桌面应用中针对高风险或关键操作进行二次确认的绝佳轻量化交互手段（如：删除、清空、重置、强力覆盖等）。
传统的 Modal 弹窗过于沉重，容易打断用户的心智流；而直接触发操作又极其容易引发用户误触。
为了实现优雅、新颖、轻量的交互，我们设计一个通用的 `ConfirmTooltip` 组件：
- 它包装任意 Trigger 元素，在点击 Trigger 时在就近位置弹出一个微型确认气泡卡片。
- 它支持自定义标题、详细描述和两个精美的行为控制按钮。
- 它将在 `PeoplePage` 人物档案删除处首发应用，并在后续为整个项目提供统一的二次行为确认规范。

## 2. 核心架构与功能设计

### 2.1 ConfirmTooltip 组件接口 (ConfirmTooltip Props)
ConfirmTooltip 组件将放置于 `src/renderer/src/components/ui/ConfirmTooltip.tsx`。
其接口定义如下：

```typescript
import type React from "react";

export interface ConfirmTooltipProps {
  // 触发行为确认的气泡子元素（无需在其上绑定 onClick，组件会自动接管并触发 Tooltip 开启）
  children: React.ReactNode;
  // 行为确认的标题文本（如："确定删除人物档案？"）
  title: string;
  // 行为确认的详细描述，补充说明后果（如："删除后，相关的个人背景、关系链及备注资料将永久丢失。"）
  description?: string;
  // 确认按钮回调函数
  onConfirm: () => void;
  // 取消按钮回调函数（可选）
  onCancel?: () => void;
  // 弹出气泡的位置，支持 "top" | "bottom" | "left" | "right"，默认为 "top"
  placement?: "top" | "bottom" | "left" | "right";
  // 确认类型样式："danger"（高亮玫瑰红，用于删除等危险操作） | "primary"（高亮翠绿，用于普通确认）
  variant?: "danger" | "primary";
  // 额外的弹出内容容器样式名
  contentClassName?: string;
  // 额外的包装容器样式名
  className?: string;
}
```

### 2.2 交互逻辑与实现细节
为了保持轻量无第三方库依赖，组件将基于 React 结合 Tailwind CSS 进行开发：
1. **状态管理**：
   - 本地维护 `isVisible` 表征二次确认气泡是否打开。
2. **事件与接管（Trigger Hijack）**：
   - 组件通过 `React.cloneElement` 或事件包装的形式，自动劫持子元素（Trigger）的 `onClick` 事件，触发 Tooltip 的展开与折叠。
3. **点击外部关闭（Click Outside）**：
   - 在组件挂载时，于全局 `document` 监听 `mousedown` 事件。如果用户点击了气泡和 Trigger 之外的区域，则安全关闭气泡。
4. **键盘快捷支持（Keyboard Accessibility）**：
   - 全局监听键盘事件。当气泡展示时，按下 `Escape` 键直接触发关闭/取消。
5. **定位机制**：
   - 采用绝对定位（`absolute z-50`），配合父容器相对定位（`relative inline-block`）。
   - 根据 `placement` 属性计算对应的偏移与对齐类名，并与 `Tooltip` 定位规则完全对齐。
6. **精美三角指针**：
   - 使用绝对定位及 45 度旋转的微型正方形，渲染一个完美贴合气泡边缘的方向三角指示符。

## 3. 视觉与项目规范契合

| 设计维度 | 项目规范要求 (AGENTS.md) | ConfirmTooltip 实现细节 |
| :--- | :--- | :--- |
| **主题颜色** | 黑色主题 (主 #000000, 次 #212121) | 气泡背景采用二次背景色 `bg-[#212121]/95` 并结合 `backdrop-blur-md`；卡片边框使用细白透 `border border-white/8`。 |
| **圆角大小** | 边框圆角严格使用 `6px` | 气泡卡片整体与操作按钮严格使用 `rounded-[6px]` 样式。 |
| **字体大小** | 默认 13px，Tag与描述等 12px | 标题使用 `text-[12px] font-bold text-white/90`，副文本使用 `text-[11px] text-white/40 font-medium`。 |
| **交互按钮** | 使用 `@/components/ui/IconButton` | 取消按钮：`preset="close"`，灰白悬停样式；<br>确认按钮：`preset="confirm"`，`danger` 变体下悬停使用玫瑰色 `hover:bg-rose-400/10 hover:text-rose-300 text-rose-400/80`，`primary` 变体下悬停使用翠绿色 `hover:bg-emerald-500/10 hover:text-emerald-400 text-emerald-500/70`。 |
| **函数风格** | 统一使用箭头函数 | 强制所有方法（包括组件声明、内部事件处理器等）使用箭头函数编写。 |
| **导入路径** | `@/` 前缀绝对路径 | 所有模块引用和组件集成均使用 `@/components/ui/ConfirmTooltip` 的路径，不出现任何相对路径。 |
| **注释要求** | 简体中文，拒绝 Unicode 替换字符 | 统一使用简明扼要的简体中文单行及多行注释，核心描述方法的用意，避免无谓解释。 |

## 4. 实施计划 (Implementation Plan)
1. **新建组件**：在 `src/renderer/src/components/ui/` 下创建并编写 `ConfirmTooltip.tsx`。
2. **集成删除功能**：在 `src/renderer/src/pages/people/PeoplePage.tsx` 中定位到删除按钮，将 `IconButton` 包装进 `ConfirmTooltip` 中，连接 `onConfirm` 到 `handleDeletePerson` 回调。
3. **集成展示测试**：在 UI 组件大观或相应测试页面（如 ShowcasePage 如果存在）进行组件展现，确保位置正常、遮挡处理和边界溢出完好。
4. **静态静态校验**：运行项目特定的类型校验与 Lint 命令（`pnpm typecheck`），实现零 Error/Warning 交付。
