import type React from "react";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { DatePicker } from "@/components/ui/DatePicker";
import { DatePickerButton } from "@/components/ui/DatePickerButton";
import { shiftEntryDate } from "@/lib/dailyShared";

// 页面顶部日期切换器属性。
interface PageDateNavigatorProps {
  // 当前页面日期。
  entryDate: string;
  // 当前可见月份。
  visibleMonth: string;
  // 按日期聚合的记录数量映射。
  entryCountMap: Record<string, number>;
  // 月份数据是否正在加载。
  isMonthOverviewLoading?: boolean;
  // 日期变化回调。
  onChange: (nextDate: string) => void;
  // 可见月份变化回调。
  onVisibleMonthChange: (nextMonth: string) => void;
}

/**
 * PageDateNavigator - 极简的左上角日期选择器与弹出式月历。
 * 基于统一的 DatePicker 组件重构，消除冗余的弹窗及位置计算代码。
 */
export const PageDateNavigator = ({
  entryDate,
  entryCountMap,
  isMonthOverviewLoading = false,
  onChange,
  onVisibleMonthChange,
}: PageDateNavigatorProps): React.JSX.Element => {
  // 当前页前一天日期。
  const previousDate = shiftEntryDate(entryDate, -1);
  // 当前页后一天日期。
  const nextDate = shiftEntryDate(entryDate, 1);

  return (
    <div className="flex items-center gap-1">
      <IconButton
        aria-label={`View previous day ${previousDate}`}
        onClick={() => onChange(previousDate)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </IconButton>

      <DatePicker
        value={entryDate}
        onChange={onChange}
        entryCountMap={entryCountMap}
        isMonthOverviewLoading={isMonthOverviewLoading}
        onVisibleMonthChange={onVisibleMonthChange}
      >
        <DatePickerButton
          aria-label={`Open date picker, current date ${entryDate}`}
          value={entryDate}
        />
      </DatePicker>

      <IconButton
        aria-label={`View next day ${nextDate}`}
        onClick={() => onChange(nextDate)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
};
