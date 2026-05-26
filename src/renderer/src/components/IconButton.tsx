import type React from "react";

// 图标按钮组件属性接口
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // 按钮内部图标或内容
  children: React.ReactNode;
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
  hoverBgClass = "hover:bg-white/5",
  hoverTextClass = "hover:text-white",
  iconOnly = true,
  ...props
}: IconButtonProps): React.JSX.Element => {
  // 基础样式
  const baseStyles = "flex items-center justify-center rounded-[6px] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 disabled:opacity-35 disabled:cursor-not-allowed";

  // 尺寸样式
  const sizeStyles = iconOnly ? "h-6 w-6 flex-shrink-0" : "";

  // 状态样式
  const stateStyles = highlighted
    ? "bg-white text-black hover:bg-white/90"
    : `text-white/45 ${hoverBgClass} ${hoverTextClass}`;

  return (
    <button
      type={type}
      className={`${baseStyles} ${sizeStyles} ${stateStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
