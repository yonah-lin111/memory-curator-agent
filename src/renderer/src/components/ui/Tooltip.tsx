import React from "react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/IconButton";

// Tooltip 弹出位置
export type TooltipPlacement = "top" | "bottom" | "left" | "right";
// Tooltip 触发方式
export type TooltipTrigger = "hover" | "click" | "both";
// 确认按钮样式变体类型
export type TooltipVariant = "danger" | "primary";

// Tooltip 组件属性接口
export interface TooltipProps {
  // 触发 Tooltip 的子元素
  children: React.ReactNode;
  // 普通 Tooltip 显示的文本或节点内容（如果是确认气泡，则优先使用 title）
  content?: React.ReactNode;
  // 行为确认的标题 / 或作为文字提示标题
  title?: string;
  // 行为确认的详细描述/副作用警告（可选）
  description?: string;
  // 确认回调函数（若提供此回调，则自动启用行为确认气泡模式）
  onConfirm?: () => void;
  // 取旧的回调函数（可选）
  onCancel?: () => void;
  // 弹出气泡的位置，默认为 "top"
  placement?: TooltipPlacement;
  // 触发方式，支持 "hover" | "click" | "both"，默认为 "hover"（如果是行为确认，则强制为 "click"）
  trigger?: TooltipTrigger;
  // 确认按钮样式类型，默认为 "primary"
  variant?: TooltipVariant;
  // 延迟显示时间（毫秒），普通提示默认为 150ms，行为确认气泡默认为 0ms
  delay?: number;
  // 额外的弹出内容容器样式名
  contentClassName?: string;
  // 额外的包装容器样式名
  className?: string;
}

/**
 * Tooltip - 统一的二次确认与文字提示通用气泡组件
 * 采用 React Portal 挂载到 document.body，彻底消除 overflow 裁剪与遮挡问题。
 * 支持自适应双向/四向翻转、边界防越界纠偏、高精准位置计算。
 * 气泡小凸起完美还原 Naive UI 的高精度圆滑三角形 (采用自定义 SVG 曲线及无缝描边设计)。
 */
export const Tooltip = ({
  children,
  content,
  title,
  onConfirm,
  onCancel,
  placement = "top",
  trigger = "hover",
  variant = "primary",
  delay = 150,
  contentClassName = "",
  className = "",
}: TooltipProps): React.JSX.Element => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [shouldRender, setShouldRender] = useState<boolean>(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState<boolean>(false);
  const [activePlacement, setActivePlacement] = useState<TooltipPlacement>(placement);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [arrowOffset, setArrowOffset] = useState<{
    left?: number;
    top?: number;
  }>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let animTimeout: NodeJS.Timeout;
    if (isVisible) {
      setShouldRender(true);
      setIsAnimatingOut(false);
    } else {
      if (shouldRender) {
        setIsAnimatingOut(true);
        animTimeout = setTimeout(() => {
          setShouldRender(false);
          setIsAnimatingOut(false);
          setCoords(null); // 卸载时重置坐标，避免下次打开时闪烁旧位置或由于动画尺寸错误导致计算偏差
        }, 120);
      }
    }
    return () => {
      if (animTimeout) clearTimeout(animTimeout);
    };
  }, [isVisible, shouldRender]);

  const isConfirmMode = typeof onConfirm === "function";
  const activeTrigger = isConfirmMode ? "click" : trigger;
  const activeDelay = isConfirmMode ? 0 : delay;

  // 动态更新气泡与小三角箭头的绝对定位坐标
  const updatePosition = (): void => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const triggerRect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // 使用 offsetHeight/offsetWidth 作为主布局尺寸，能完美避开 CSS Transform（如缩放动画）对尺寸计算的几何干扰
      const tooltipHeight = tooltipRef.current.offsetHeight || tooltipRect.height || 40;
      const tooltipWidth = tooltipRef.current.offsetWidth || tooltipRect.width || 120;

      // 视口可见边界（留出 8px 安全间距）
      const limitLeft = 8;
      const limitRight = window.innerWidth - 8;
      const limitTop = 8;
      const limitBottom = window.innerHeight - 8;

      const spaceAbove = triggerRect.top - limitTop;
      const spaceBelow = limitBottom - triggerRect.bottom;
      const spaceLeft = triggerRect.left - limitLeft;
      const spaceRight = limitRight - triggerRect.right;

      // 1. 自动决定是否翻转 (自适应定位)
      let resolvedPlacement = placement;
      if (
        placement === "top" &&
        spaceAbove < tooltipHeight + 12 &&
        spaceBelow > spaceAbove
      ) {
        resolvedPlacement = "bottom";
      } else if (
        placement === "bottom" &&
        spaceBelow < tooltipHeight + 12 &&
        spaceAbove > spaceBelow
      ) {
        resolvedPlacement = "top";
      } else if (
        placement === "left" &&
        spaceLeft < tooltipWidth + 12 &&
        spaceRight > spaceLeft
      ) {
        resolvedPlacement = "right";
      } else if (
        placement === "right" &&
        spaceRight < tooltipWidth + 12 &&
        spaceLeft > spaceRight
      ) {
        resolvedPlacement = "left";
      }

      setActivePlacement(resolvedPlacement);

      // 2. 根据最终定位，计算未纠偏的目标位置 (含 window 滚动位移)
      let targetTop = 0;
      let targetLeft = 0;

      if (resolvedPlacement === "top") {
        targetTop = window.scrollY + triggerRect.top - tooltipHeight - 16;
        targetLeft =
          window.scrollX + triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
      } else if (resolvedPlacement === "bottom") {
        targetTop = window.scrollY + triggerRect.bottom + 16;
        targetLeft =
          window.scrollX + triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
      } else if (resolvedPlacement === "left") {
        targetTop =
          window.scrollY +
          triggerRect.top +
          triggerRect.height / 2 -
          tooltipHeight / 2;
        targetLeft = window.scrollX + triggerRect.left - tooltipWidth - 16;
      } else if (resolvedPlacement === "right") {
        targetTop =
          window.scrollY +
          triggerRect.top +
          triggerRect.height / 2 -
          tooltipHeight / 2;
        targetLeft = window.scrollX + triggerRect.right + 16;
      }

      // 3. 执行边界纠偏修正 (进行全向视口安全校围，确保在极小页面或大尺寸气泡下，主体内容100%处于可见视口内)
      let adjustedLeft = targetLeft;
      let adjustedTop = targetTop;

      const viewLeft = limitLeft + window.scrollX;
      const viewRight = limitRight + window.scrollX;
      const viewTop = limitTop + window.scrollY;
      const viewBottom = limitBottom + window.scrollY;

      // 修正水平越界
      if (adjustedLeft < viewLeft) {
        adjustedLeft = viewLeft;
      } else if (adjustedLeft + tooltipWidth > viewRight) {
        adjustedLeft = viewRight - tooltipWidth;
      }

      // 修正垂直越界
      if (adjustedTop < viewTop) {
        adjustedTop = viewTop;
      } else if (adjustedTop + tooltipHeight > viewBottom) {
        adjustedTop = viewBottom - tooltipHeight;
      }

      setCoords({ top: adjustedTop, left: adjustedLeft });

      // 4. 计算小三角箭头的精准定位
      if (resolvedPlacement === "top" || resolvedPlacement === "bottom") {
        const triggerCenter = triggerRect.left + triggerRect.width / 2;
        // 算出箭头相对气泡左边缘的偏移
        let arrowX = triggerCenter - (adjustedLeft - window.scrollX);
        // 限制箭头不越过圆角边界
        arrowX = Math.max(12, Math.min(tooltipWidth - 12, arrowX));
        setArrowOffset({ left: arrowX });
      } else {
        const triggerCenterY = triggerRect.top + triggerRect.height / 2;
        // 算出箭头相对气泡上边缘的偏移
        let arrowY = triggerCenterY - (adjustedTop - window.scrollY);
        // 限制箭头不越过圆角边界
        arrowY = Math.max(12, Math.min(tooltipHeight - 12, arrowY));
        setArrowOffset({ top: arrowY });
      }
    }
  };

  // 监听显示状态变化，实时重算位置
  useEffect(() => {
    if (isVisible) {
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
  }, [isVisible, shouldRender]);

  // 定时器辅助控制
  const showTooltip = (): void => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (activeDelay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, activeDelay);
    } else {
      setIsVisible(true);
    }
  };

  const hideTooltip = (): void => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    // 允许用户在 150ms 内将鼠标移动到 Tooltip 气泡内部，防止直接消失
    if (activeTrigger === "hover" || activeTrigger === "both") {
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 150);
    } else {
      setIsVisible(false);
    }
  };

  const handleMouseEnter = (): void => {
    if (activeTrigger === "hover" || activeTrigger === "both") {
      showTooltip();
    }
  };

  const handleMouseLeave = (): void => {
    if (activeTrigger === "hover" || activeTrigger === "both") {
      hideTooltip();
    }
  };

  const handleTooltipMouseEnter = (): void => {
    if (activeTrigger === "hover" || activeTrigger === "both") {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    }
  };

  const handleTooltipMouseLeave = (): void => {
    if (activeTrigger === "hover" || activeTrigger === "both") {
      hideTooltip();
    }
  };

  const handleTriggerClick = (e: React.MouseEvent): void => {
    if (activeTrigger === "click" || activeTrigger === "both") {
      e.stopPropagation();
      setIsVisible((prev) => !prev);
    }
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
        if (isConfirmMode) {
          onCancel?.();
        }
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible, isConfirmMode, onCancel]);

  // 键盘 Esc 键安全关闭支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsVisible(false);
        if (isConfirmMode) {
          onCancel?.();
        }
      }
    };

    if (isVisible) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, isConfirmMode, onCancel]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // 气泡卡片基础样式 (使用完全不透明的 bg-[#303030] 且无边框，与主次色区分)
  const cardClassName = isConfirmMode
    ? "w-48 p-2.5 text-white bg-[#303030]"
    : "px-2.5 py-1.5 text-xs font-semibold text-white bg-[#303030] whitespace-nowrap";

  // 子级元素代理 onClick 与事件处理
  let triggerElement: React.ReactNode = children;
  if (React.isValidElement(children)) {
    triggerElement = React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        handleTriggerClick(e);
        if (
          typeof (children as React.ReactElement<any>).props.onClick ===
          "function"
        ) {
          (children as React.ReactElement<any>).props.onClick(e);
        }
      },
    });
  }

  // 决定小三角箭头 SVG 容器的绝对定位样式
  const arrowStyle: React.CSSProperties = {
    position: "absolute",
    width: "20px",
    height: "20px",
    pointerEvents: "none",
  };

  if (activePlacement === "top") {
    arrowStyle.bottom = "-14px";
    arrowStyle.left =
      arrowOffset.left !== undefined ? `${arrowOffset.left}px` : "50%";
    arrowStyle.transform = "translateX(-50%) rotate(180deg)";
  } else if (activePlacement === "bottom") {
    arrowStyle.top = "-14px";
    arrowStyle.left =
      arrowOffset.left !== undefined ? `${arrowOffset.left}px` : "50%";
    arrowStyle.transform = "translateX(-50%)";
  } else if (activePlacement === "left") {
    arrowStyle.right = "-14px";
    arrowStyle.top =
      arrowOffset.top !== undefined ? `${arrowOffset.top}px` : "50%";
    arrowStyle.transform = "translateY(-50%) rotate(90deg)";
  } else if (activePlacement === "right") {
    arrowStyle.left = "-14px";
    arrowStyle.top =
      arrowOffset.top !== undefined ? `${arrowOffset.top}px` : "50%";
    arrowStyle.transform = "translateY(-50%) rotate(270deg)";
  }

  const isPositioned = coords !== null;
  const animationClass = isPositioned
    ? isAnimatingOut
      ? "animate-tooltip-out"
      : "animate-tooltip-in"
    : "";

  let transformOrigin = "center";
  if (activePlacement === "top") {
    transformOrigin =
      arrowOffset.left !== undefined ? `${arrowOffset.left}px 100%` : "bottom center";
  } else if (activePlacement === "bottom") {
    transformOrigin =
      arrowOffset.left !== undefined ? `${arrowOffset.left}px 0%` : "top center";
  } else if (activePlacement === "left") {
    transformOrigin =
      arrowOffset.top !== undefined ? `100% ${arrowOffset.top}px` : "right center";
  } else if (activePlacement === "right") {
    transformOrigin =
      arrowOffset.top !== undefined ? `0% ${arrowOffset.top}px` : "left center";
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {triggerElement}

      {shouldRender &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`absolute z-[999999] rounded-[6px] select-text drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${cardClassName} ${animationClass} ${contentClassName}`}
            style={{
              position: "absolute",
              top: `${coords?.top ?? 0}px`,
              left: `${coords?.left ?? 0}px`,
              opacity: isPositioned ? undefined : 0, // 初次定位前保持透明度为0，避免闪烁
              transformOrigin,
            }}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
            onClick={(e) => e.stopPropagation()}
            role="tooltip"
            aria-hidden={!isVisible}
          >
            {isConfirmMode ? (
              /* 二次确认气泡模式 */
              <div className="flex flex-col">
                <span className="text-sm leading-snug">{title || content}</span>
                <div className="flex items-center justify-end mt-0.5 gap-1">
                  <IconButton
                    preset="close"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsVisible(false);
                      onCancel?.();
                    }}
                    title="取消"
                  />
                  <IconButton
                    preset={variant === "danger" ? "delete" : "confirm"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsVisible(false);
                      onConfirm?.();
                    }}
                    title="确认"
                  />
                </div>
              </div>
            ) : (
              /* 普通文字提示模式 */
              content || title
            )}

            {/* 精美自适应圆滑三角形小凸起 (自定义 SVG 黄金曲线 + 无缝融边设计) */}
            <svg viewBox="0 0 20 20" style={arrowStyle}>
              {/* 填充路径：完全实心的全圆角三角形 */}
              <path
                d="M 5,14 L 15,14 Q 17,14 16,12 L 11.5,4 Q 10,1 8.5,4 L 4,12 Q 3,14 5,14 Z"
                fill="#303030"
                stroke="none"
              />
            </svg>
          </div>,
          document.body,
        )}
    </div>
  );
};
