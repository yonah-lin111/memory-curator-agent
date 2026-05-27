import type React from "react";
import { X } from "lucide-react";

// Tag 组件尺寸类型
export type TagSize = "small" | "default" | "large";

// Tag 组件属性接口
export interface TagProps {
  // 标签文本内容
  children: React.ReactNode;
  // 标签尺寸，可选 small | default | large
  size?: TagSize;
  // 标签前缀，支持字符（如 '#', '-'）或 React 节点（如图标）
  prefix?: React.ReactNode;
  // 是否处于高亮/激活状态
  highlighted?: boolean;
  // 点击标签回调（可选，使标签可点击）
  onClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
  // 点击关闭按钮回调（可选，存在时展示关闭按钮）
  onClose?: (event: React.MouseEvent<HTMLSpanElement>) => void;
  // 基础背景与边框颜色样式（未高亮时）
  bgClass?: string;
  // 高亮背景与边框颜色样式
  highlightBgClass?: string;
  // 悬浮（Hover）时的样式
  hoverClass?: string;
  // 额外的样式类名
  className?: string;
}

// 尺寸映射配置。
const SIZE_STYLES: Record<TagSize, { container: string; closeIconSize: string }> = {
  small: {
    container: "text-[10px] px-1.5 py-0.5 rounded-[4px] gap-0.5",
    closeIconSize: "h-2 w-2 ml-0.5",
  },
  default: {
    container: "text-xs px-2 py-1 rounded-[6px] gap-1",
    closeIconSize: "h-2.5 w-2.5 ml-1",
  },
  large: {
    container: "text-sm px-2.5 py-1.5 rounded-[6px] gap-1.5",
    closeIconSize: "h-3 w-3 ml-1.5",
  },
};

/**
 * Tag - 公共高复用原子标签组件
 * 支持不同尺寸选择、丰富前缀配置、关闭动作以及灵活的色彩自定义
 */
export const Tag = ({
  children,
  size = "default",
  prefix,
  highlighted = false,
  onClick,
  onClose,
  bgClass = "border-white/5 bg-white/[0.03] text-white/45",
  highlightBgClass = "border-white/15 bg-white/10 text-white/90",
  hoverClass = "hover:border-white/20 hover:text-white/80",
  className = "",
}: TagProps): React.JSX.Element => {
  const currentStyles = SIZE_STYLES[size];
  const isClickable = typeof onClick === "function";
  const isInteractive = isClickable || typeof onClose === "function";

  return (
    <span
      role={isClickable ? "button" : undefined}
      aria-label={isClickable && typeof children === "string" ? `添加随记标签 ${children}` : undefined}
      className={`inline-flex items-center justify-center border font-semibold select-none transition-all duration-150 ${
        currentStyles.container
      } ${
        highlighted ? highlightBgClass : `${bgClass} ${isInteractive ? hoverClass : ""}`
      } ${isInteractive ? "cursor-pointer" : "cursor-default"} ${className}`}
      onClick={onClick}
    >
      {prefix && (
        <span className="flex items-center justify-center flex-shrink-0 text-current/60">
          {prefix}
        </span>
      )}
      <span className="truncate leading-none">{children}</span>
      {onClose && (
        <span
          role="button"
          aria-label="删除标签"
          className="opacity-60 hover:opacity-100 cursor-pointer text-current hover:text-rose-400 transition-all flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onClose(e);
          }}
        >
          <X className={currentStyles.closeIconSize} />
        </span>
      )}
    </span>
  );
};
