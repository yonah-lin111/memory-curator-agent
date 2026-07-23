import { Check, LoaderCircle, Server, X } from "lucide-react"
import React, { useState } from "react"
import type { CuratorToolStep } from "@/features/curator/types"

type PromptAiMcpCallBlockProps = {
  // 同一 MCP 服务连续执行的步骤。
  steps: CuratorToolStep[]
  // 后方是否紧邻另一个执行片段。
  connectsToNextExecution?: boolean
}

/**
 * 返回 MCP 调用状态的图标与样式。
 */
const getMcpStatusPresentation = (
  status: CuratorToolStep["status"],
): {
  Icon: React.ComponentType<{ className?: string }>
  className: string
} => {
  if (status === "running") {
    return { Icon: LoaderCircle, className: "animate-spin text-amber-400" }
  }
  if (status === "failed") return { Icon: X, className: "text-red-400" }
  if (status === "cancelled") return { Icon: X, className: "text-white/35" }
  return { Icon: Check, className: "text-emerald-400" }
}

/**
 * PromptAiMcpCallBlock - 渲染提示词设计 Agent 的 MCP 调用，不参与普通工具执行分组。
 */
export const PromptAiMcpCallBlock = ({
  steps,
  connectsToNextExecution = false,
}: PromptAiMcpCallBlockProps): React.JSX.Element | null => {
  const [isCallListExpanded, setIsCallListExpanded] = useState(false)
  const serverName = steps[0]?.mcp?.serverName

  if (!serverName) {
    return null
  }

  const collapseThreshold = 2
  const hasMoreSteps = steps.length > collapseThreshold
  const visibleSteps =
    hasMoreSteps && !isCallListExpanded ? steps.slice(0, collapseThreshold) : steps
  const hiddenStepCount = steps.length - collapseThreshold

  return (
    <div className="relative flex w-full gap-2.5 pl-1 my-1.5">
      <div className="relative flex w-6 flex-col items-center self-stretch shrink-0">
        <div className="relative z-10 flex h-5 w-5 items-center justify-center">
          <Server className="h-3.5 w-3.5 text-cyan-300" />
        </div>
        {connectsToNextExecution ? (
          <div aria-hidden="true" className="absolute top-5 bottom-[-24px] w-[2px] bg-white/5" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <div className="text-xs font-mono font-bold text-cyan-100">MCP · {serverName}</div>
        <div className="flex flex-col gap-1.5">
          {visibleSteps.map((step) => {
            const toolName = step.mcp?.toolName ?? step.tool
            const presentation = getMcpStatusPresentation(step.status)

            return (
              <div
                key={step.id}
                className="flex min-w-0 items-start gap-1 text-xs leading-relaxed text-white/45"
              >
                <span className="inline-flex h-[1.625em] w-3 shrink-0 items-center justify-center select-none">
                  <svg className="h-3 w-3 stroke-current" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M3 1v5h7"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="min-w-0 break-all font-mono text-xs text-white/45">
                  {toolName}
                </span>
                <presentation.Icon
                  className={`mt-0.5 h-3 w-3 shrink-0 ${presentation.className}`}
                />
                {step.status === "failed" && step.observation ? (
                  <span className="min-w-0 break-all text-xs text-red-300/80">
                    {step.observation}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
        {hasMoreSteps ? (
          <button
            type="button"
            className="w-fit text-xs [transform:skewX(-8deg)] font-medium text-cyan-100/50 transition-colors hover:text-cyan-100/80"
            onClick={() => setIsCallListExpanded((previous) => !previous)}
          >
            {isCallListExpanded
              ? `Hide ${hiddenStepCount} more`
              : `Show ${hiddenStepCount} more...`}
          </button>
        ) : null}
      </div>
    </div>
  )
}
