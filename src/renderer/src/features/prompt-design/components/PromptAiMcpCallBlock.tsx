import React, { useState } from "react";
import { Check, ChevronDown, LoaderCircle, Server, X } from "lucide-react";
import type { CuratorToolStep } from "@/features/curator/types";

type PromptAiMcpCallBlockProps = {
  // 同一 MCP 服务连续执行的步骤。
  steps: CuratorToolStep[];
  // 后方是否紧邻另一个执行片段。
  connectsToNextExecution?: boolean;
};

/**
 * 安全序列化 MCP 调用详情。
 */
const stringifyValue = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to serialize MCP data.";
  }
};

/**
 * 截断 MCP 摘要，完整内容由详情面板承载。
 */
const getSummary = (observation: string): string => {
  const normalized = observation.trim();
  return normalized.length > 160 ? `${normalized.slice(0, 160)}...` : normalized || "No output.";
};

/**
 * 返回 MCP 步骤的状态图标与样式。
 */
const getStatusPresentation = (status: CuratorToolStep["status"]): {
  Icon: React.ComponentType<{ className?: string }>;
  className: string;
  label: string;
} => {
  if (status === "running") return { Icon: LoaderCircle, className: "animate-spin text-amber-400", label: "运行中" };
  if (status === "failed") return { Icon: X, className: "text-red-400", label: "失败" };
  if (status === "cancelled") return { Icon: X, className: "text-white/35", label: "已取消" };
  return { Icon: Check, className: "text-emerald-400", label: "完成" };
};

/**
 * PromptAiMcpCallBlock - 渲染提示词设计 Agent 的 MCP 调用，不参与普通工具执行分组。
 */
export const PromptAiMcpCallBlock = ({
  steps,
  connectsToNextExecution = false,
}: PromptAiMcpCallBlockProps): React.JSX.Element | null => {
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set());
  const [isCallListExpanded, setIsCallListExpanded] = useState(false);
  const serverName = steps[0]?.mcp?.serverName;

  if (!serverName) {
    return null;
  }

  const toggleDetails = (stepId: string): void => {
    setExpandedStepIds((previous) => {
      const next = new Set(previous);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };
  const collapseThreshold = 2;
  const hasMoreSteps = steps.length > collapseThreshold;
  const visibleSteps = hasMoreSteps && !isCallListExpanded ? steps.slice(0, collapseThreshold) : steps;
  const hiddenStepCount = steps.length - collapseThreshold;

  return (
    <div className="relative flex w-full gap-2.5 pl-1 my-1.5">
      <div className="relative flex w-6 flex-col items-center self-stretch shrink-0">
        <div className="relative z-10 flex h-5 w-5 items-center justify-center">
          <Server className="h-3.5 w-3.5 text-cyan-300" />
        </div>
        {connectsToNextExecution ? <div aria-hidden="true" className="absolute top-5 bottom-[-24px] w-[2px] bg-white/5" /> : null}
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <div className="text-xs font-mono font-bold text-cyan-100">MCP · {serverName}</div>
        <div className="flex flex-col gap-1.5">
          {visibleSteps.map((step) => {
            const presentation = getStatusPresentation(step.status);
            const isExpanded = expandedStepIds.has(step.id);
            const toolName = step.mcp?.toolName ?? step.tool;

            return (
              <div key={step.id} className="min-w-0 border-l border-cyan-200/15 pl-2.5">
                <button
                  type="button"
                  className="flex w-full items-start gap-1.5 text-left"
                  onClick={() => toggleDetails(step.id)}
                  aria-expanded={isExpanded}
                >
                  <presentation.Icon className={`mt-0.5 h-3 w-3 shrink-0 ${presentation.className}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-all font-mono text-xs text-white/80">{toolName}</span>
                    <span className="block break-words text-xs leading-relaxed text-white/45">{getSummary(step.observation)}</span>
                  </span>
                  <ChevronDown className={`mt-0.5 h-3 w-3 shrink-0 text-white/35 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                </button>
                {isExpanded ? (
                  <pre className="mt-1.5 max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-white/5 pt-1.5 text-xs leading-relaxed text-white/50 custom-scrollbar">{stringifyValue({ input: step.input ?? {}, output: step.data ?? null })}</pre>
                ) : null}
              </div>
            );
          })}
        </div>
        {hasMoreSteps ? (
          <button
            type="button"
            className="w-fit text-xs [transform:skewX(-8deg)] font-medium text-cyan-100/50 transition-colors hover:text-cyan-100/80"
            onClick={() => setIsCallListExpanded((previous) => !previous)}
          >
            {isCallListExpanded ? `Hide ${hiddenStepCount} more` : `Show ${hiddenStepCount} more...`}
          </button>
        ) : null}
      </div>
    </div>
  );
};
