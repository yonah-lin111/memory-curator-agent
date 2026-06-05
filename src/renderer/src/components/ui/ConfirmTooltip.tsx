import React from "react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/IconButton";

// 确认按钮样式变体类型
export type ConfirmTooltipVariant = "danger" | "primary";

// 行为确认 Tooltip 组件属性接口
export interface ConfirmTooltipProps {
  // 触发确认气泡的子元素（必须能接收并触发 onClick）
  children: React.ReactElement<{
    onClick?: React.MouseEventHandler;
    [key: string]: any;
  }>;
  // 行为确认的标题
  title: string;
  // 行为确认的详细描述/副作用警告（可选）
  description?: string;
  // 确认回调函数
  onConfirm: () => void;
  // 取消回调函数（可选）
  onCancel?: () => void;
  // 确认按钮样式类型，默认为 "primary"
  variant?: ConfirmTooltipVariant;
  // 额外的弹出内容容器样式名
  contentClassName?: string;
  // 额外的包装容器样式名
  className?: string;
}

/**
 * ConfirmTooltip - 二次行为确认通用气泡组件
 * 采用 React Portal 挂载到 document.body 彻底解决遮挡与溢出裁剪问题。
 * 复用了 Naive UI Popconfirm 的自适应定位、防越界、自动翻转的先进显示逻辑，同时恢复了原先高内聚的设计样式与原本的 IconButton 布局。
 */
export const ConfirmTooltip = ({
  children,
  title,
  description,
  onConfirm,
  onCancel,
  variant = "primary",
  contentClassName = "",
  className = "",
}: ConfirmTooltipProps): React.JSX.Element => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 动态计算气泡的绝对定位坐标
  const updatePosition = (): void => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const triggerRect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      const tooltipHeight = tooltipRect.height || 110;
      const tooltipWidth = tooltipRect.width || 224; // w-56 为 224px

      // 视口边界（留出 8px 安全间距）
      const limitLeft = 8;
      const limitRight = window.innerWidth - 8;
      const limitTop = 8;
      const limitBottom = window.innerHeight - 8;

      const spaceAbove = triggerRect.top - limitTop;
      const spaceBelow = limitBottom - triggerRect.bottom;

      // 决定是否翻转定位 (如果上方空间不够且下方空间更大，则翻转至下方展示)
      let activeFlipped = false;
      if (spaceAbove < tooltipHeight + 12 && spaceBelow > spaceAbove) {
        activeFlipped = true;
      }

      // 计算目标 Absolute Top（加上 window 的 scrollY 滚动位移）
      let targetTop = 0;
      if (activeFlipped) {
        targetTop = window.scrollY + triggerRect.bottom + 8;
      } else {
        targetTop = window.scrollY + triggerRect.top - tooltipHeight - 8;
      }

      // 计算目标 Absolute Left（使气泡中心对齐触发器中心）
      const triggerCenter = triggerRect.left + triggerRect.width / 2;
      let targetLeft = triggerCenter - tooltipWidth / 2;

      // 左右边界防越界修正
      if (targetLeft < limitLeft) {
        targetLeft = limitLeft;
      } else if (targetLeft + tooltipWidth > limitRight) {
        targetLeft = limitRight - tooltipWidth;
      }

      // 加上 window 的 scrollX 滚动位移
      targetLeft += window.scrollX;

      setCoords({ top: targetTop, left: targetLeft });
    }
  };

  // 监听显示状态，动态绑定滚动与尺寸变化事件，实时重算位置
  useEffect(() => {
    if (isVisible) {
      // 延时执行位置计算，确保元素已经在 DOM 中渲染完毕，能够获取其真实宽高
      const timer = setTimeout(() => {
        updatePosition();
      }, 0);

      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
    return undefined;
  }, [isVisible]);

  // 劫持并触发切换
  const handleTriggerClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setIsVisible((prev) => !prev);
  };

  // 点击外部区域安全关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
        onCancel?.();
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible, onCancel]);

  // 键盘 Esc 键安全关闭支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsVisible(false);
        onCancel?.();
      }
    };

    if (isVisible) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, onCancel]);

  // 子级元素代理 onClick 事件劫持与合并
  const triggerElement = React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      handleTriggerClick(e);
      if (typeof children.props.onClick === "function") {
        children.props.onClick(e);
      }
    },
  });

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {triggerElement}

      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`absolute z-[999999] w-56 text-white p-3 rounded-[6px] border border-white/8 bg-[#212121]/95 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.55)] select-none transition-opacity duration-150 ${contentClassName}`}
            style={{
              position: "absolute",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              opacity: coords.top === 0 ? 0 : 1, // 初次定位前保持透明度为0，避免闪烁
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold text-white/90 leading-snug">
                {title}
              </span>
              {description && (
                <span className="text-[12px] text-white/40 leading-relaxed font-medium">
                  {description}
                </span>
              )}
              <div className="flex items-center justify-end gap-1.5 mt-1 border-t border-white/5 pt-2">
                <IconButton
                  preset="close"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVisible(false);
                    onCancel?.();
                  }}
                  title="取消"
                />
                <IconButton
                  className="h-6 w-6"
                  preset={variant === "danger" ? "delete" : "confirm"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVisible(false);
                    onConfirm();
                  }}
                  title="确认"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
