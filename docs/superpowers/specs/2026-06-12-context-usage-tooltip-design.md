# 2026-06-12 Context Usage Tooltip Design Spec

## Background & Objective
In the AI Chat component (`src/renderer/src/features/ai-chat/components/AiChatInput/`), there is a token usage circle component (`ContextUsageCircle`) that displays the context usage status. Currently, it has a custom nested `div` that mimics a tooltip with CSS hover controls. This is inconsistent with our global design, lacks animation, and does not leverage our robust global `Tooltip` component (`src/renderer/src/components/ui/Tooltip.tsx`).

The objective is to replace the local custom hover layout with the uniform `Tooltip` component.

## Design Details

### 1. File Modification
* **File to modify:** `src/renderer/src/features/ai-chat/components/AiChatInput/components/ContextUsageCircle.tsx`

### 2. Import Changes
* Add import for `Tooltip` from `@/components/ui/Tooltip`:
  ```tsx
  import { Tooltip } from "@/components/ui/Tooltip";
  ```

### 3. Component Hierarchy Update
Currently, the render tree in `ContextUsageCircle` is:
```tsx
return (
  <div
    aria-label={contextTooltipLabel}
    className="group relative flex h-6 w-6 shrink-0 items-center justify-center text-white/50"
  >
    <svg ...>
       ...
    </svg>
    <div className="pointer-events-none absolute bottom-8 left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] border border-white/10 bg-black px-2 py-1 text-[12px] text-white/70 shadow-lg group-hover:block">
      {contextTooltipLabel}
    </div>
  </div>
);
```

We will refactor it to:
```tsx
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
```

This ensures:
1. Complete removal of the group hover nested div.
2. Direct integration of the high-fidelity `Tooltip` component with standard micro-interactions.
3. Smooth portal-based rendering above other content.
