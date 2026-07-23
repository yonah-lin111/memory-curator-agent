import type { LucideIcon } from "lucide-react"
import { CheckCircle2, Circle, CircleDotDashed } from "lucide-react"

// 提示词设计的生命周期状态。
export type PromptDesignStatus = "todo" | "in_progress" | "completed"

// 提示词状态变更后刷新侧栏列表的事件。
export const PROMPT_DESIGN_STATUS_UPDATED_EVENT = "prompt-design:status-updated"

// 状态对应的展示元数据。
export const PROMPT_DESIGN_STATUS_OPTIONS: Array<{
  value: PromptDesignStatus
  label: string
  icon: LucideIcon
  className: string
}> = [
  { value: "todo", label: "未完成", icon: Circle, className: "text-white/40" },
  { value: "in_progress", label: "进行中", icon: CircleDotDashed, className: "text-amber-400" },
  { value: "completed", label: "已完成", icon: CheckCircle2, className: "text-emerald-400" },
]

/**
 * 获取状态的展示元数据。
 */
export const getPromptDesignStatusOption = (status: PromptDesignStatus) =>
  PROMPT_DESIGN_STATUS_OPTIONS.find((option) => option.value === status) ??
  PROMPT_DESIGN_STATUS_OPTIONS[0]
