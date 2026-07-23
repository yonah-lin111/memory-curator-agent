import { CalendarDays, ChevronDown } from "lucide-react"
import type React from "react"
import { formatEntryDateLabel, formatEntryMonthLabel, formatWeekLabel } from "@/lib/dailyShared"

/**
 * DatePickerButton 组件属性接口
 */
export interface DatePickerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // 当前选中日期，格式 YYYY-MM-DD 或 YYYY-MM
  value?: string
  // 选择模式：按日、按周、按月
  mode?: "date" | "week" | "month"
  // 占位文本
  placeholder?: string
}

/**
 * DatePickerButton - 统一的日期选择器触发按钮
 * 完美还原 Naive UI/Tailwind 风格，提供高质感微交互。
 */
export const DatePickerButton = ({
  value,
  mode = "date",
  placeholder = "选择日期",
  className = "",
  ...props
}: DatePickerButtonProps): React.JSX.Element => {
  const getDisplayValue = (): string => {
    if (!value) return placeholder
    if (mode === "month") {
      return formatEntryMonthLabel(value)
    }
    if (mode === "week") {
      return formatWeekLabel(value)
    }
    return formatEntryDateLabel(value)
  }

  return (
    <button
      type="button"
      className={`group relative flex h-7 items-center gap-1.5 rounded-[6px] border border-white/10 bg-[#212121] px-2.5 text-left text-xs font-semibold text-white/80 transition-colors duration-150 hover:border-white/20 focus:outline-none focus:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      <CalendarDays className="h-3 w-3 flex-shrink-0 text-white/40" />
      <span className="font-mono flex-1">{getDisplayValue()}</span>
      <ChevronDown className="h-3 w-3 flex-shrink-0 text-white/30 transition-transform duration-150 group-data-[open=true]:rotate-180 group-aria-expanded:rotate-180" />
    </button>
  )
}
