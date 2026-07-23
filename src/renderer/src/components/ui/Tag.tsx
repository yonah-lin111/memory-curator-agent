import { X } from "lucide-react"
import type React from "react"

// Tag 组件尺寸类型
export type TagSize = "small" | "default" | "large"

// Tag 组件颜色类型
export type TagColor =
  | "default"
  | "pink"
  | "amber"
  | "blue"
  | "teal"
  | "emerald"
  | "rose"
  | "gray"
  | "purple"
  | "indigo"
  | "sky"
  | "orange"

// Tag 组件属性接口
export interface TagProps {
  // 标签文本内容
  children: React.ReactNode
  // 标签尺寸，可选 small | default | large
  size?: TagSize
  // 标签前缀，支持字符（如 '#', '-'）或 React 节点（如图标）
  prefix?: React.ReactNode
  // 是否处于高亮/激活状态
  highlighted?: boolean
  // 点击标签回调（可选，使标签可点击）
  onClick?: (event: React.MouseEvent<HTMLSpanElement>) => void
  // 点击关闭按钮回调（可选，存在时展示关闭按钮）
  onClose?: (event: React.MouseEvent<HTMLSpanElement>) => void
  // 标签颜色预设
  color?: TagColor
  // 基础背景与边框颜色样式（未高亮时）
  bgClass?: string
  // 高亮背景与边框颜色样式
  highlightBgClass?: string
  // 悬浮（Hover）时的样式
  hoverClass?: string
  // 额外的样式类名
  className?: string
}

// 颜色样式映射。
const COLOR_STYLES: Record<TagColor, { bg: string; highlightBg: string; hover: string }> = {
  default: {
    bg: "border-white/5 bg-white/[0.03] text-white/45",
    highlightBg: "border-white/15 bg-white/10 text-white/90",
    hover: "hover:border-white/20 hover:text-white/80",
  },
  pink: {
    bg: "border-pink-500/10 bg-pink-500/[0.03] text-pink-400/80",
    highlightBg: "border-pink-500/20 bg-pink-500/10 text-pink-400",
    hover: "hover:border-pink-500/30 hover:text-pink-300",
  },
  amber: {
    bg: "border-amber-500/10 bg-amber-500/[0.03] text-amber-400/80",
    highlightBg: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    hover: "hover:border-amber-500/30 hover:text-amber-300",
  },
  blue: {
    bg: "border-blue-500/10 bg-blue-500/[0.03] text-blue-400/80",
    highlightBg: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    hover: "hover:border-blue-500/30 hover:text-blue-300",
  },
  teal: {
    bg: "border-teal-500/10 bg-teal-500/[0.03] text-teal-400/80",
    highlightBg: "border-teal-500/20 bg-teal-500/10 text-teal-400",
    hover: "hover:border-teal-500/30 hover:text-teal-300",
  },
  emerald: {
    bg: "border-emerald-500/10 bg-emerald-500/[0.03] text-emerald-400/80",
    highlightBg: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    hover: "hover:border-emerald-500/30 hover:text-emerald-300",
  },
  rose: {
    bg: "border-rose-500/10 bg-rose-500/[0.03] text-rose-400/80",
    highlightBg: "border-rose-500/20 bg-rose-500/10 text-rose-400",
    hover: "hover:border-rose-500/30 hover:text-rose-300",
  },
  gray: {
    bg: "border-neutral-500/10 bg-neutral-500/[0.03] text-neutral-400/80",
    highlightBg: "border-neutral-500/20 bg-neutral-500/10 text-neutral-400",
    hover: "hover:border-neutral-500/30 hover:text-neutral-300",
  },
  purple: {
    bg: "border-purple-500/10 bg-purple-500/[0.03] text-purple-400/80",
    highlightBg: "border-purple-500/20 bg-purple-500/10 text-purple-400",
    hover: "hover:border-purple-500/30 hover:text-purple-300",
  },
  indigo: {
    bg: "border-indigo-500/10 bg-indigo-500/[0.03] text-indigo-400/80",
    highlightBg: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
    hover: "hover:border-indigo-500/30 hover:text-indigo-300",
  },
  sky: {
    bg: "border-sky-500/10 bg-sky-500/[0.03] text-sky-400/80",
    highlightBg: "border-sky-500/20 bg-sky-500/10 text-sky-400",
    hover: "hover:border-sky-500/30 hover:text-sky-300",
  },
  orange: {
    bg: "border-orange-500/10 bg-orange-500/[0.03] text-orange-400/80",
    highlightBg: "border-orange-500/20 bg-orange-500/10 text-orange-400",
    hover: "hover:border-orange-500/30 hover:text-orange-300",
  },
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
}

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
  color,
  bgClass,
  highlightBgClass,
  hoverClass,
  className = "",
}: TagProps): React.JSX.Element => {
  const currentStyles = SIZE_STYLES[size]
  const isClickable = typeof onClick === "function"
  const isInteractive = isClickable || typeof onClose === "function"

  // 获取预设颜色样式，如果显式传递了 bgClass 等，则进行覆盖
  const resolvedColor = color || "default"
  const defaultBg = bgClass ?? COLOR_STYLES[resolvedColor].bg
  const defaultHighlightBg = highlightBgClass ?? COLOR_STYLES[resolvedColor].highlightBg
  const defaultHover = hoverClass ?? COLOR_STYLES[resolvedColor].hover

  return (
    <span
      role={isClickable ? "button" : undefined}
      aria-label={
        isClickable && typeof children === "string" ? `Add snippet tag ${children}` : undefined
      }
      className={`inline-flex items-center justify-center border font-semibold select-none transition-all duration-150 ${
        currentStyles.container
      } ${
        highlighted ? defaultHighlightBg : `${defaultBg} ${isInteractive ? defaultHover : ""}`
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
          aria-label="Delete tag"
          className="opacity-60 hover:opacity-100 cursor-pointer text-current hover:text-rose-400 transition-all flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            onClose(e)
          }}
        >
          <X className={currentStyles.closeIconSize} />
        </span>
      )}
    </span>
  )
}
