# Tooltip Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a reusable, fully custom `Tooltip` component matching the dark theme of the project, support hover/click triggers, and showcase it interactively on the UI Workshop/Showcase page.

**Architecture:** Create a self-contained React component utilizing absolute positioning, local hover/click listeners, click-outside global hook inside a relative wrapper, and beautiful micro-interactions.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React (for trigger examples).

---

### Task 1: Create the Tooltip Component

**Files:**
- Create: `src/renderer/src/components/ui/Tooltip.tsx`

- [ ] **Step 1: Write the Tooltip component file**

Implement the custom Tooltip with positioning mapping, arrow indicators, delay helpers, hover/click actions, and clicking outside handlers.

```tsx
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
```

- [ ] **Step 2: Run type check to make sure it compiles cleanly**

Run: `pnpm typecheck`
Expected: Done without any errors or warnings.


### Task 2: Integrate Tooltip into ShowcasePage

**Files:**
- Modify: `src/renderer/src/pages/showcase/ShowcasePage.tsx`

- [ ] **Step 1: Read ShowcasePage.tsx and inject Tooltip showcases**

Add a navigation item "Tooltip" into `sections` array and a corresponding demo card under the scrollable playground area.

```tsx
// 1. Add "tooltip" to ActiveSection type
type ActiveSection = "all" | "toast" | "tag" | "date" | "select" | "editor" | "button" | "tooltip";

// 2. Import Tooltip component using absolute path
import { Tooltip } from "@renderer/components/ui/Tooltip";

// 3. Add to sections array
{ id: "tooltip", label: "Tooltip 提示", desc: "文字气泡提示组件" }
```

Render the Tooltip section card using matching black-card style:

```tsx
        {/* Section: Tooltip */}
        {isVisible("tooltip") && (
          <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-white/60" />
                Tooltip 文字提示
              </h3>
              <span className="text-xs font-mono text-white/30">Tooltip.tsx</span>
            </div>
            <p className="text-xs text-white/50 font-medium">支持四个方位（top, bottom, left, right）、不同的触发模式（Hover, Click, Both）：</p>

            <div className="flex flex-col gap-5 mt-2">
              {/* Placement options */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/45">Placements (Hover to Trigger):</span>
                <div className="flex flex-wrap items-center gap-6 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <Tooltip placement="top" content="Prompt text on top" trigger="hover">
                    <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                      Top Tooltip
                    </button>
                  </Tooltip>

                  <Tooltip placement="bottom" content="Prompt text on bottom" trigger="hover">
                    <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                      Bottom Tooltip
                    </button>
                  </Tooltip>

                  <Tooltip placement="left" content="Prompt text on left" trigger="hover">
                    <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                      Left Tooltip
                    </button>
                  </Tooltip>

                  <Tooltip placement="right" content="Prompt text on right" trigger="hover">
                    <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                      Right Tooltip
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Trigger options */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/45">Triggers (Modes):</span>
                <div className="flex flex-wrap items-center gap-6 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-mono text-white/30">trigger="hover"</span>
                    <Tooltip trigger="hover" content="Triggers purely on hover">
                      <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                        Hover Trigger
                      </button>
                    </Tooltip>
                  </div>

                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-mono text-white/30">trigger="click"</span>
                    <Tooltip trigger="click" content="Triggers purely on click (Click outside to close)">
                      <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                        Click Trigger
                      </button>
                    </Tooltip>
                  </div>

                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-mono text-white/30">trigger="both"</span>
                    <Tooltip trigger="both" content="Supports both Hover and Click triggers">
                      <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                        Both Trigger
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
```


### Task 3: Lint and Type Check Verification

**Files:**
- Run lint & typescript verification commands to guarantee 0 issues.

- [ ] **Step 1: Run type checking**

Run: `pnpm typecheck`
Expected: OK (no TypeScript compilation issues in renderer or node processes)

- [ ] **Step 2: Run linter/formatting checks if applicable**

Run: `pnpm lint`
Expected: OK
