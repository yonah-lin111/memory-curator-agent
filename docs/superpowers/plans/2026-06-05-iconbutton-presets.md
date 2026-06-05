# IconButton 预设系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `IconButton` 组件中引入添加、关闭、保存、确认、删除、编辑、默认等预设按钮，并完美集成到 UI 展示中心。

**Architecture:** 增加可选的 `preset` 属性，通过映射自动渲染 `lucide-react` 图标与特定语义的悬停样式。同时优先采用传入的 `children` 保证原功能兼容性。

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React

---

### Task 1: 升级 IconButton 组件，引入预设映射与接口

**Files:**
- Modify: `src/renderer/src/components/ui/IconButton.tsx`

- [ ] **Step 1: 读取 IconButton.tsx 的现有状态，编写新版的组件代码**

更新 `src/renderer/src/components/ui/IconButton.tsx`。

```tsx
import type React from "react";
import { Plus, X, Save, Check, Trash2, Edit3, Settings } from "lucide-react";

// 预设类型
export type IconButtonPreset = "add" | "close" | "save" | "confirm" | "delete" | "edit" | "default";

// 预设图标组件映射
const PRESET_ICONS: Record<IconButtonPreset, React.ComponentType<{ className?: string }>> = {
  add: Plus,
  close: X,
  save: Save,
  confirm: Check,
  delete: Trash2,
  edit: Edit3,
  default: Settings,
};

// 预设悬停背景样式映射
const PRESET_BG_CLASSES: Record<IconButtonPreset, string> = {
  add: "hover:bg-white/5",
  close: "hover:bg-white/5",
  save: "hover:bg-emerald-500/10",
  confirm: "hover:bg-emerald-500/10",
  delete: "hover:bg-rose-500/10",
  edit: "hover:bg-white/5",
  default: "hover:bg-white/5",
};

// 预设悬停文本颜色样式映射
const PRESET_TEXT_CLASSES: Record<IconButtonPreset, string> = {
  add: "hover:text-white",
  close: "hover:text-white",
  save: "hover:text-emerald-400",
  confirm: "hover:text-emerald-400",
  delete: "hover:text-rose-400",
  edit: "hover:text-white",
  default: "hover:text-white",
};

// 图标按钮组件属性接口
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // 按钮内部图标或内容（若传了 preset，则为可选）
  children?: React.ReactNode;
  // 额外的样式类名
  className?: string;
  // 是否处于高亮状态
  highlighted?: boolean;
  // 自定义 hover 背景类名
  hoverBgClass?: string;
  // 自定义 hover 文本颜色类名
  hoverTextClass?: string;
  // 是否仅显示图标（默认为 true，若为 false 则不强制 w-6 h-6）
  iconOnly?: boolean;
  // 新增：预设属性
  preset?: IconButtonPreset;
}

/**
 * IconButton - 统一的公共按钮与图标组件
 * 采用极简黑色主题，悬停时仅过渡背景色与前景图标色，取消位移动效与旋转动效
 */
export const IconButton = ({
  children,
  className = "",
  type = "button",
  highlighted = false,
  hoverBgClass,
  hoverTextClass,
  iconOnly = true,
  preset,
  ...props
}: IconButtonProps): React.JSX.Element => {
  // 基础样式
  const baseStyles = "flex items-center justify-center rounded-[6px] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 disabled:opacity-35 disabled:cursor-not-allowed";

  // 尺寸样式
  const sizeStyles = iconOnly ? "h-6 w-6 flex-shrink-0" : "";

  // 悬停样式（若存在预设则以预设样式为默认值，同时也完美支持用户通过属性显式覆盖）
  const finalHoverBg = hoverBgClass ?? (preset ? PRESET_BG_CLASSES[preset] : "hover:bg-white/5");
  const finalHoverText = hoverTextClass ?? (preset ? PRESET_TEXT_CLASSES[preset] : "hover:text-white");

  // 状态样式
  const stateStyles = highlighted
    ? "bg-white text-black hover:bg-white/90"
    : `text-white/45 ${finalHoverBg} ${finalHoverText}`;

  // 确定最终需要渲染的图标或子元素
  let renderContent = children;
  if (!renderContent && preset) {
    const PresetIcon = PRESET_ICONS[preset];
    renderContent = <PresetIcon className="h-4 w-4" />;
  } else if (!renderContent) {
    // 默认回退（当既没有 children 也没有 preset 时，或者 preset 为 default）
    const DefaultIcon = PRESET_ICONS.default;
    renderContent = <DefaultIcon className="h-4 w-4" />;
  }

  return (
    <button
      type={type}
      className={`${baseStyles} ${sizeStyles} ${stateStyles} ${className}`}
      {...props}
    >
      {renderContent}
    </button>
  );
};
```

- [ ] **Step 2: 验证组件在不传入属性时退回默认 (Settings) 图标，类型正确**

---

### Task 2: 升级 Showcase 展示页面，新增全新 Presets 展示层

**Files:**
- Modify: `src/renderer/src/pages/showcase/ShowcasePage.tsx`

- [ ] **Step 1: 在 ShowcasePage.tsx 中引入新增的预设按钮演示**

将 ShowcasePage.tsx 底部 `IconButton` 部分升级。

```tsx
        {/* Section: IconButton */}
        {isVisible("button") && (
          <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Star className="h-4 w-4 text-white/60" />
                IconButton 图标按钮
              </h3>
              <span className="text-xs font-mono text-white/30">IconButton.tsx</span>
            </div>
            <p className="text-xs text-white/50 font-medium">微动画悬停效果，支持高亮、禁用属性，以及丰富的开箱即用预设：</p>
            
            <div className="flex flex-col gap-4 mt-2">
              {/* 基础交互状态 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/45">Basic States:</span>
                <div className="flex items-center gap-4 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">Default</span>
                    <IconButton onClick={() => toast.info("点击了默认 IconButton")}>
                      <Settings className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">Highlighted</span>
                    <IconButton highlighted onClick={() => toast.info("点击了高亮 IconButton")}>
                      <Settings className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">Disabled</span>
                    <IconButton disabled onClick={() => {}}>
                      <Settings className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              </div>

              {/* 开箱即用预设（Presets） */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/45">Presets (开箱即用 + 智能语义 Hover):</span>
                <div className="flex flex-wrap items-center gap-6 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">add</span>
                    <IconButton preset="add" onClick={() => toast.success("已触发：添加 (Add) 操作")} />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">close</span>
                    <IconButton preset="close" onClick={() => toast.info("已触发：关闭 (Close) 操作")} />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">save</span>
                    <IconButton preset="save" onClick={() => toast.success("已保存配置！")} />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">confirm</span>
                    <IconButton preset="confirm" onClick={() => toast.success("操作已确认")} />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">delete</span>
                    <IconButton preset="delete" onClick={() => toast.error("数据已删除！")} />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">edit</span>
                    <IconButton preset="edit" onClick={() => toast.info("开始编辑内容")} />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">default</span>
                    <IconButton preset="default" onClick={() => toast.info("触发默认设置")} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
```

---

### Task 3: 运行 typecheck & 整体质量验证

- [ ] **Step 1: 运行类型校验，确保编译通过**

运行: `pnpm typecheck`
预期结果: TypeScript 编译通过，无任何错误和 Warning。
