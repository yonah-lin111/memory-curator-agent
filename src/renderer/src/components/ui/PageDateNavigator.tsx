import { ChevronLeft, ChevronRight } from "lucide-react"
import type React from "react"
import { DatePicker } from "@/components/ui/DatePicker"
import { DatePickerButton } from "@/components/ui/DatePickerButton"
import { IconButton } from "@/components/ui/IconButton"
import { shiftEntryDate } from "@/lib/dailyShared"

// 页面顶部日期与周导航器属性。
interface PageDateNavigatorProps {
  // 当前页面日期（格式 YYYY-MM-DD）。
  entryDate: string
  // 导航与选择模式：按日或按周，默认为 "date"。
  mode?: "date" | "week"
  // 当前可见月份（格式 YYYY-MM）。
  visibleMonth?: string
  // 按日期聚合的记录数量映射。
  entryCountMap?: Record<string, number>
  // 月份数据是否正在加载。
  isMonthOverviewLoading?: boolean
  // 日期或基准周一变化回调。
  onChange: (nextDate: string) => void
  // 可见月份变化回调。
  onVisibleMonthChange?: (nextMonth: string) => void
}

/**
 * PageDateNavigator - 极简的左上角日期与周度导航器。
 * 基于统一的 DatePicker 组件重构，消除冗余的弹窗及位置计算代码。
 */
export const PageDateNavigator = ({
  entryDate,
  mode = "date",
  entryCountMap = {},
  isMonthOverviewLoading = false,
  onChange,
  onVisibleMonthChange,
}: PageDateNavigatorProps): React.JSX.Element => {
  // 步长：周模式为 7，日模式为 1。
  const step = mode === "week" ? 7 : 1
  const previousDate = shiftEntryDate(entryDate, -step)
  const nextDate = shiftEntryDate(entryDate, step)

  const prevLabel = mode === "week" ? "Previous Week" : `View previous day ${previousDate}`
  const nextLabel = mode === "week" ? "Next Week" : `View next day ${nextDate}`

  return (
    <div className="flex items-center gap-1">
      <IconButton aria-label={prevLabel} onClick={() => onChange(previousDate)}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </IconButton>

      <DatePicker
        mode={mode}
        value={entryDate}
        onChange={onChange}
        entryCountMap={entryCountMap}
        isMonthOverviewLoading={isMonthOverviewLoading}
        onVisibleMonthChange={onVisibleMonthChange}
      >
        <DatePickerButton
          aria-label={`Open date picker, current ${mode === "week" ? "week" : "date"} ${entryDate}`}
          mode={mode}
          value={entryDate}
        />
      </DatePicker>

      <IconButton aria-label={nextLabel} onClick={() => onChange(nextDate)}>
        <ChevronRight className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  )
}
