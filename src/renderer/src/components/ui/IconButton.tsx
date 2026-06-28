import React, { forwardRef } from "react";
import { Plus, X, Save, Check, Trash2, Edit3, Settings } from "lucide-react";

// 预设类型
export type IconButtonPreset = "add" | "close" | "save" | "confirm" | "delete" | "edit" | "default";

// 按钮尺寸类型
export type IconButtonSize = "small" | "medium" | "large";

// 尺寸对应的容器类名映射
const SIZE_CONTAINER_CLASSES: Record<IconButtonSize, string> = {
  small: "h-5 w-5",
  medium: "h-6 w-6",
  large: "h-7 w-7",
};

// 尺寸对应的纯图标类名映射
const SIZE_ICON_CLASSES: Record<IconButtonSize, string> = {
  small: "h-3 w-3",
  medium: "h-4 w-4",
  large: "h-[18px] w-[18px]",
};

// 尺寸对应的伴随文字图标类名映射
const SIZE_CHIP_ICON_CLASSES: Record<IconButtonSize, string> = {
  small: "h-2.5 w-2.5",
  medium: "h-3.5 w-3.5",
  large: "h-4 w-4",
};

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
  delete: "hover:bg-rose-400/10",
  edit: "hover:bg-amber-400/10",
  default: "hover:bg-white/5",
};

// 预设悬停文本颜色样式映射
const PRESET_TEXT_CLASSES: Record<IconButtonPreset, string> = {
  add: "hover:text-white",
  close: "hover:text-white",
  save: "hover:text-emerald-400",
  confirm: "hover:text-emerald-400",
  delete: "hover:text-rose-300",
  edit: "hover:text-amber-300",
  default: "hover:text-white",
};

// 预设默认文本与图标颜色样式映射
const PRESET_DEFAULT_TEXT_CLASSES: Record<IconButtonPreset, string> = {
  add: "text-white/45",
  close: "text-white/45",
  save: "text-emerald-500/70",
  confirm: "text-emerald-500/70",
  delete: "text-rose-400/80",
  edit: "text-amber-400/80",
  default: "text-white/45",
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
  // 预设属性
  preset?: IconButtonPreset;
  // 按钮尺寸，可选 small | medium | large，默认为 medium
  size?: IconButtonSize;
}

/**
 * IconButton - 统一的公共按钮与图标组件
 * 采用极简黑色主题，悬停时仅过渡背景色与前景图标色，取消位移动效与旋转动效
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({
  children,
  className = "",
  type = "button",
  highlighted = false,
  hoverBgClass,
  hoverTextClass,
  iconOnly = true,
  preset,
  size = "medium",
  disabled,
  ...props
}, ref): React.JSX.Element => {
  // 基础样式
  const baseStyles = "flex items-center justify-center rounded-[6px] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 disabled:opacity-35 disabled:cursor-not-allowed";

  // 尺寸样式
  const sizeStyles = iconOnly ? `${SIZE_CONTAINER_CLASSES[size]} flex-shrink-0` : "";

  // 悬停样式（若存在预设则以预设样式为默认值，同时也完美支持用户通过属性显式覆盖）
  const finalHoverBg = hoverBgClass ?? (preset ? PRESET_BG_CLASSES[preset] : "hover:bg-white/5");
  const finalHoverText = hoverTextClass ?? (preset ? PRESET_TEXT_CLASSES[preset] : "hover:text-white");
  const defaultTextClass = preset ? PRESET_DEFAULT_TEXT_CLASSES[preset] : "text-white/45";

  // 状态样式
  const stateStyles = disabled
    ? (highlighted ? "bg-white text-black" : `${defaultTextClass}`)
    : (highlighted
        ? (preset === "close"
            ? "bg-white/85 text-black hover:bg-white"
            : "bg-white text-black hover:bg-white/90")
        : `${defaultTextClass} ${finalHoverBg} ${finalHoverText}`);

  // 确定最终需要渲染的图标或子元素
  let renderContent = children;
  const PresetIcon = preset ? PRESET_ICONS[preset] : null;

  if (PresetIcon && !iconOnly && children) {
    // 当非纯图标且有 children 时，智能在最前方自动拼接预设图标，大小随 size 参数自动缩放
    renderContent = (
      <>
        <PresetIcon className={`${SIZE_CHIP_ICON_CLASSES[size]} flex-shrink-0`} />
        {children}
      </>
    );
  } else if (!renderContent && preset) {
    renderContent = PresetIcon ? <PresetIcon className={SIZE_ICON_CLASSES[size]} /> : null;
  } else if (!renderContent) {
    const DefaultIcon = PRESET_ICONS.default;
    renderContent = <DefaultIcon className={SIZE_ICON_CLASSES[size]} />;
  }

  return (
    <button
      ref={ref}
      type={type}
      className={`${baseStyles} ${sizeStyles} ${stateStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {renderContent}
    </button>
  );
});
