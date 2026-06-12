import type React from "react";

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
    <div
      aria-label={contextTooltipLabel}
      className="group relative flex h-6 w-6 shrink-0 items-center justify-center text-white/50"
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
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] border border-white/10 bg-black px-2 py-1 text-[12px] text-white/70 shadow-lg group-hover:block">
        {contextTooltipLabel}
      </div>
    </div>
  );
};
