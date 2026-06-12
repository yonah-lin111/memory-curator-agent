# Context Usage Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom, primitive local group-hover token tooltip in `ContextUsageCircle` with the high-fidelity `@/components/ui/Tooltip` component.

**Architecture:** Use `@/components/ui/Tooltip` as a wrapper around the token progress circle trigger, specifying `content={contextTooltipLabel}` and `placement="top"`.

**Tech Stack:** React, Tailwind CSS, TypeScript

---

### Task 1: Refactor ContextUsageCircle Component

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/components/ContextUsageCircle.tsx`

- [ ] **Step 1: Check existing ContextUsageCircle implementation**

Verify imports and structure of `src/renderer/src/features/ai-chat/components/AiChatInput/components/ContextUsageCircle.tsx`.

- [ ] **Step 2: Apply Tooltip wrapper and remove custom div**

Refactor the component to import and wrap the element inside `<Tooltip>`.

```tsx
import type React from "react";
import { Tooltip } from "@/components/ui/Tooltip";

// 上下文圆环使用状态属性类型。
export interface ContextUsageCircleProps {
  // 当前模型上下文使用百分比。
  contextUsagePercent: number | null;
  // 当前上下文 token 估算。
  contextTokens: number;
  // 当前模型上下文窗口上限。
  contextLimit?: number;
}

/**
 * ContextUsageCircle - 展示当前模型上下文 token 消耗的环形进度条组件。
 */
export const ContextUsageCircle = ({
  contextUsagePercent,
  contextTokens,
  contextLimit,
}: ContextUsageCircleProps): React.JSX.Element => {
  const contextUsageValue =
    contextUsagePercent === null
      ? null
      : Math.min(Math.max(contextUsagePercent, 0), 100);

  const contextUsageLabel =
    contextUsageValue === null
      ? "Unknown context usage"
      : `Context usage ${contextUsageValue}%`;

  const contextTokenLabel =
    contextLimit === undefined
      ? `~${contextTokens.toLocaleString("zh-CN")} tokens / Unknown limit`
      : `~${contextTokens.toLocaleString("zh-CN")} tokens / ${contextLimit.toLocaleString("zh-CN")}`;

  const contextTooltipLabel = `${contextUsageLabel} · ${contextTokenLabel}`;
  const circleRadius = 8;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleDashOffset =
    contextUsageValue === null
      ? circleCircumference
      : circleCircumference * (1 - contextUsageValue / 100);

  return (
    <Tooltip content={contextTooltipLabel} placement="top">
      <div
        aria-label={contextTooltipLabel}
        className="flex h-6 w-6 shrink-0 items-center justify-center text-white/50 cursor-help"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="-rotate-90 h-5 w-5"
        >
          <circle
            cx="12"
            cy="12"
            r={circleRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-white/10"
          />
          <circle
            cx="12"
            cy="12"
            r={circleRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circleCircumference}
            strokeDashoffset={circleDashOffset}
            className="text-white/80 transition-[stroke-dashoffset] duration-200"
          />
        </svg>
      </div>
    </Tooltip>
  );
};
```

- [ ] **Step 3: Run typescript check to verify no syntax or module import errors**

Run: `pnpm typecheck`
Expected: PASS with no compilation errors.
