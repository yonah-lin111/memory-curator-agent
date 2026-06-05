# IconButton 预设按钮系统设计规范

设计一套易用、优雅且向下兼容的预设（Preset）系统，使得 `IconButton` 组件可以通过简单的 `preset` 属性直接渲染常用功能按钮，并在 `ShowcasePage` 中进行直观展示。

## 1. 目标与范围 (Goal & Scope)

- **支持预设功能**：支持 `add` (添加), `close` (关闭), `save` (保存), `confirm` (确认), `delete` (删除), `edit` (编辑), `default` (默认) 共有 7 种预设按钮。
- **向下完全兼容**：若用户不传 `preset`，保持现有功能与渲染表现。若用户同时传了 `preset` 和 `children`，以 `children` 优先渲染，但依然继承预设对应的 hover 样式与默认交互表现。
- **美学与体验 (Linus & Musk / UI-UX)**：
  - 极简暗色风格，圆角 6px，动画仅使用颜色渐变（`transition-colors duration-150`），禁止出现任何位移或旋转等繁冗动效。
  - 对于删除等操作引入极淡的符合语义色彩的 hover 状态（如删除微红、确认/保存微绿），其余维持高雅的白灰过渡态。

---

## 2. 详细设计 (Detailed Design)

### 2.1 IconButton 接口变更

在 `IconButtonProps` 接口中，增加 `preset` 属性：

```typescript
export type IconButtonPreset = "add" | "close" | "save" | "confirm" | "delete" | "edit" | "default";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode; // 调整为可选
  className?: string;
  highlighted?: boolean;
  hoverBgClass?: string;
  hoverTextClass?: string;
  iconOnly?: boolean;
  preset?: IconButtonPreset; // 新增：预设属性
}
```

### 2.2 预设映射关系 (Presets Mapping)

当 `children` 未提供且提供了 `preset` 时，使用对应的内置图标。

```typescript
import { Plus, X, Save, Check, Trash2, Edit3, Settings } from "lucide-react";

// 内置预设图标
const PRESET_ICONS: Record<IconButtonPreset, React.ComponentType<{ className?: string }>> = {
  add: Plus,
  close: X,
  save: Save,
  confirm: Check,
  delete: Trash2,
  edit: Edit3,
  default: Settings,
};

// 内置预设悬停背景色样式
const PRESET_BG_CLASSES: Record<IconButtonPreset, string> = {
  add: "hover:bg-white/5",
  close: "hover:bg-white/5",
  save: "hover:bg-emerald-500/10",
  confirm: "hover:bg-emerald-500/10",
  delete: "hover:bg-rose-500/10",
  edit: "hover:bg-white/5",
  default: "hover:bg-white/5",
};

// 内置预设悬停前景色样式
const PRESET_TEXT_CLASSES: Record<IconButtonPreset, string> = {
  add: "hover:text-white",
  close: "hover:text-white",
  save: "hover:text-emerald-400",
  confirm: "hover:text-emerald-400",
  delete: "hover:text-rose-400",
  edit: "hover:text-white",
  default: "hover:text-white",
};
```

### 2.3 核心实现逻辑

在 `IconButton` 渲染时：
1. 确定最终的图标或子元素：优先使用传入的 `children`。如果 `children` 为空但定义了 `preset`，则渲染 `PRESET_ICONS[preset]` (默认为 `PRESET_ICONS["default"]` = `Settings` 按钮)。
2. 确定悬停样式：
   - 背景色 `finalHoverBg` 默认值为 `PRESET_BG_CLASSES[preset]` 或 "hover:bg-white/5"。若用户显式传入 `hoverBgClass`，则以传入的为准。
   - 文本前景色 `finalHoverText` 默认值为 `PRESET_TEXT_CLASSES[preset]` 或 "hover:text-white"。若用户显式传入 `hoverTextClass`，则以传入的为准。
3. 渲染底层的 `<button>` 标签。为了保持统一尺寸，当 `iconOnly` 为 `true` 并且自动渲染预设图标时，传入的图标 className 设置为 `"h-4 w-4"`。

---

## 3. 展示面板变更 (Showcase ShowcasePage)

在 `src/renderer/src/pages/showcase/ShowcasePage.tsx` 的 **IconButton** 部分：
- **第一层（现状）**：保留 Standard、Highlighted、Disabled 三个基础形态演示。
- **第二层（全新 Presets 体验区）**：新增一排预设 IconButton。
  - Add / Plus 图标
  - Close / X 图标
  - Save / 磁盘图标
  - Confirm / 勾选图标
  - Delete / 垃圾桶图标（红悬停）
  - Edit / 画笔图标
  - Default / 齿轮图标
- **联动通知**：点击各个预设按钮均触发对应的全局 `useToast` 以完美验证状态交互：
  - 点击 Add -> `toast.success("已触发：添加 (Add) 操作")`
  - 点击 Delete -> `toast.error("已触发：删除 (Delete) 确认")`
  - 其他类似。

---

## 4. 自我复核 (Self-Review)

- **占位符校验**：无 "TBD" 或 "TODO"。
- **向下兼容性**：不带 `preset` 的普通用法依然 100% 表现一致。
- **打包稳定性**：`lucide-react` 中已包含 `Plus, X, Save, Check, Trash2, Edit3, Settings` 并能正确渲染。
- **类型安全性**：已完备定义 TS `type` 和 `interface` 并加上必要的单行/多行注释。
