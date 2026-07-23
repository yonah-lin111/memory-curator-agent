import { Check, Globe2, LoaderCircle, X } from "lucide-react"
import React from "react"
import type { CuratorToolStep } from "@/features/curator/types"

// 联网搜索调用组件属性类型。
type CuratorWebSearchCallBlockProps = {
  // 连续执行的联网搜索步骤。
  steps: CuratorToolStep[]
  // 后方是否紧邻另一个执行片段。
  connectsToNextExecution?: boolean
}

/**
 * 返回联网搜索步骤的状态展示配置。
 */
const getSearchStatusPresentation = (
  status: CuratorToolStep["status"],
): {
  Icon: React.ComponentType<{ className?: string }>
  className: string
} => {
  if (status === "running") return { Icon: LoaderCircle, className: "animate-spin text-amber-400" }
  if (status === "failed") return { Icon: X, className: "text-red-400" }
  if (status === "cancelled") return { Icon: X, className: "text-white/35" }
  return { Icon: Check, className: "text-emerald-400" }
}

/**
 * 获取联网搜索的查询文本。
 */
const getSearchQuery = (step: CuratorToolStep): string => {
  const input = step.input as { query?: unknown } | undefined
  return typeof input?.query === "string" && input.query.trim() ? input.query.trim() : "Web search"
}

/**
 * CuratorWebSearchCallBlock - 独立渲染联网搜索调用，避免与普通工具调用混排。
 */
export const CuratorWebSearchCallBlock = ({
  steps,
  connectsToNextExecution = false,
}: CuratorWebSearchCallBlockProps): React.JSX.Element | null => {
  if (steps.length === 0) return null

  return (
    <div className="relative my-1.5 flex w-full gap-2.5 pl-1">
      <div className="relative flex w-6 shrink-0 flex-col items-center self-stretch">
        <div className="relative z-10 flex h-5 w-5 items-center justify-center">
          <Globe2 className="h-3.5 w-3.5 text-sky-300" />
        </div>
        {connectsToNextExecution ? (
          <div aria-hidden="true" className="absolute bottom-[-24px] top-5 w-[2px] bg-white/5" />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="font-mono text-xs font-bold text-sky-300">Web search</div>
        <div className="flex flex-col gap-1.5">
          {steps.map((step) => {
            const presentation = getSearchStatusPresentation(step.status)
            return (
              <div key={step.id} className="flex min-w-0 items-start gap-1.5">
                <svg
                  className="mt-0.5 h-3 w-3 shrink-0 stroke-current text-white/45"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 1v5h7"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="min-w-0 break-all font-mono text-xs text-white/80">
                  {getSearchQuery(step)}
                </span>
                <presentation.Icon
                  className={`mt-0.5 h-3 w-3 shrink-0 ${presentation.className}`}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
