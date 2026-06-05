import type React from "react";
import { useState, useRef, useEffect } from "react";

// Tooltip 弹出位置
export type TooltipPlacement = "top" | "bottom" | "left" | "right";
// Tooltip 触发方式
export type TooltipTrigger = "hover" | "click" | "both";

// Tooltip 组件属性接口
export interface TooltipProps {
  // 触发 Tooltip 的子元素
  children: React.ReactNode;
  // Tooltip 显示的文本或节点内容
  content: React.ReactNode;
  // 弹出位置，支持 "top" | "bottom" | "left" | "right"，默认为 "top"
  placement?: TooltipPlacement;
  // 触发方式，支持 "hover" | "click" | "both"，默认为 "hover"
  trigger?: TooltipTrigger;
  // 额外的弹出内容容器样式名
  contentClassName?: string;
  // 额外的包装容器样式名
  className?: string;
  // 延迟显示时间（毫秒），默认 150ms
  delay?: number;
}

/**
 * Tooltip - 统一的公共文字提示组件
 * 采用极简暗色主题，支持悬停与点击触发，并且自带精细淡入淡出动画。
 */
export const Tooltip = ({
  children,
  content,
  placement = "top",
  trigger = "hover",
  contentClassName = "",
  className = "",
  delay = 150,
}: TooltipProps): React.JSX.Element => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 定位类名映射
  const placementClasses: Record<TooltipPlacement, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  // 小三角类名映射 (利用旋转的 45 度小正方形)
  const arrowClasses: Record<TooltipPlacement, string> = {
    top: "bottom-[-4px] left-1/2 -translate-x-1/2 rotate-45 border-r border-b",
    bottom: "top-[-4px] left-1/2 -translate-x-1/2 rotate-45 border-l border-t",
    left: "right-[-4px] top-1/2 -translate-y-1/2 rotate-45 border-r border-t",
    right: "left-[-4px] top-1/2 -translate-y-1/2 rotate-45 border-l border-b",
  };

  const showTooltip = (): void => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    } else {
      setIsVisible(true);
    }
  };

  const hideTooltip = (): void => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const handleMouseEnter = (): void => {
    if (trigger === "hover" || trigger === "both") {
      showTooltip();
    }
  };

  const handleMouseLeave = (): void => {
    if (trigger === "hover" || trigger === "both") {
      hideTooltip();
    }
  };

  const handleClick = (e: React.MouseEvent): void => {
    if (trigger === "click" || trigger === "both") {
      e.stopPropagation();
      setIsVisible((prev) => !prev);
    }
  };

  // 点击外部关闭 Tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    if (trigger === "click" || trigger === "both") {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [trigger]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* 触发子元素 */}
      {children}

      {/* 弹出气泡 */}
      <div
        className={`absolute z-50 pointer-events-none transition-all duration-150 ${
          placementClasses[placement]
        } ${
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        role="tooltip"
        aria-hidden={!isVisible}
      >
        <div
          className={`relative bg-[#212121] text-white border border-white/5 px-2.5 py-1.5 rounded-[6px] text-xs font-semibold shadow-lg whitespace-nowrap select-none ${contentClassName}`}
        >
          {content}
          {/* 精美箭头 */}
          <div
            className={`absolute h-2 w-2 bg-[#212121] border-white/5 ${arrowClasses[placement]}`}
          />
        </div>
      </div>
    </div>
  );
};
