import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import {
  CALENDAR_WEEKDAY_LABELS,
  createMonthCalendarDays,
  createTodayEntryDate,
  formatEntryDateLabel,
  formatEntryMonthLabel,
  getEntryMonth,
  shiftEntryDate,
  shiftEntryMonth,
} from "@renderer/pages/components/dailyShared";

// 页面顶部日期切换器属性。
interface PageDateNavigatorProps {
  // 当前页面日期。
  entryDate: string;
  // 当前页面标签。
  label: string;
  // 当前可见月份。
  visibleMonth: string;
  // 按日期聚合的记录数量映射。
  entryCountMap: Record<string, number>;
  // 当前日期记录数量。
  currentEntryCount: number;
  // 月份数据是否正在加载。
  isMonthOverviewLoading?: boolean;
  // 日期变化回调。
  onChange: (nextDate: string) => void;
  // 可见月份变化回调。
  onVisibleMonthChange: (nextMonth: string) => void;
  // 格式化当前页面的记录提示。
  formatCountHint: (count: number) => string;
}

// 角标数字上限。
const BADGE_MAX_COUNT = 99;

/**
 * PageDateNavigator - 页面顶部日期切换器与弹出式月历。
 */
export const PageDateNavigator = ({
  entryDate,
  label,
  visibleMonth,
  entryCountMap,
  currentEntryCount,
  isMonthOverviewLoading = false,
  onChange,
  onVisibleMonthChange,
  formatCountHint,
}: PageDateNavigatorProps): React.JSX.Element => {
  // 日期弹层是否打开。
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  // 整个导航器容器引用，用于点击外部关闭。
  const navigatorRef = useRef<HTMLDivElement | null>(null);
  // 当前页前一天日期。
  const previousDate = shiftEntryDate(entryDate, -1);
  // 当前页后一天日期。
  const nextDate = shiftEntryDate(entryDate, 1);
  // 今日日期。
  const todayEntryDate = createTodayEntryDate();
  // 当前月历网格。
  const calendarDays = useMemo(
    () => createMonthCalendarDays(visibleMonth),
    [visibleMonth],
  );
  // 当前日期所在月份。
  const activeMonth = getEntryMonth(entryDate);

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }

    /**
     * 点击弹层外部时收起日期选择器。
     */
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;

      if (navigatorRef.current && !navigatorRef.current.contains(target)) {
        setIsCalendarOpen(false);
      }
    };

    /**
     * 处理 Escape 快捷关闭。
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCalendarOpen]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }

    onVisibleMonthChange(activeMonth);
  }, [activeMonth, isCalendarOpen, onVisibleMonthChange]);

  /**
   * 把记录数量压缩为角标文本，避免过长撑破单元格。
   */
  const formatBadgeCount = (count: number): string =>
    count > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}+` : String(count);

  return (
    <div
      ref={navigatorRef}
      className="flex items-center justify-start rounded-[6px] border border-white/10 bg-white/[0.02] px-3 py-2"
    >
      <div className="flex items-center gap-1.5">
        <IconButton
          aria-label={`查看前一天 ${previousDate}`}
          className="h-8 w-8 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white"
          onClick={() => onChange(previousDate)}
        >
          <ChevronLeft className="h-4 w-4" />
        </IconButton>

        <div className="relative">
          <button
            aria-expanded={isCalendarOpen}
            aria-haspopup="dialog"
            aria-label={`打开 ${label} 日期选择器，当前日期 ${entryDate}`}
            className="relative flex min-w-[176px] items-center gap-2 rounded-[6px] border border-white/10 bg-black/35 px-3 py-2 text-left transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.05]"
            type="button"
            onClick={() => setIsCalendarOpen((currentOpen) => !currentOpen)}
          >
            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-white/54" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white/88">
                {formatEntryDateLabel(entryDate)}
              </p>
              <p className="truncate text-[11px] text-white/38">
                {formatCountHint(currentEntryCount)}
              </p>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 flex-shrink-0 text-white/40 transition-transform duration-150 ${isCalendarOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isCalendarOpen ? (
            <div
              aria-label={`${label} 日期选择器`}
              className="absolute left-0 top-[calc(100%+8px)] z-50 w-[296px] rounded-[6px] border border-white/10 bg-[#111111] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.62)]"
              role="dialog"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/26">
                    Select Date
                  </p>
                  <p className="text-sm font-semibold text-white/86">
                    {formatEntryMonthLabel(visibleMonth)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton
                    aria-label={`查看上个月 ${shiftEntryMonth(visibleMonth, -1)}`}
                    className="h-7 w-7 bg-white/[0.03] text-white/56 hover:bg-white/[0.08] hover:text-white"
                    onClick={() =>
                      onVisibleMonthChange(shiftEntryMonth(visibleMonth, -1))
                    }
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    aria-label={`查看下个月 ${shiftEntryMonth(visibleMonth, 1)}`}
                    className="h-7 w-7 bg-white/[0.03] text-white/56 hover:bg-white/[0.08] hover:text-white"
                    onClick={() =>
                      onVisibleMonthChange(shiftEntryMonth(visibleMonth, 1))
                    }
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                {CALENDAR_WEEKDAY_LABELS.map((weekdayLabel) => (
                  <span
                    key={weekdayLabel}
                    className="text-[10px] font-mono text-white/28"
                  >
                    {weekdayLabel}
                  </span>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1">
                {calendarDays.map((dayItem) => {
                  // 当前单元格记录数量。
                  const entryCount = entryCountMap[dayItem.entryDate] ?? 0;
                  // 当前单元格是否为选中日期。
                  const isSelected = dayItem.entryDate === entryDate;
                  // 当前单元格是否为今天。
                  const isToday = dayItem.entryDate === todayEntryDate;

                  return (
                    <button
                      key={dayItem.entryDate}
                      aria-label={`选择日期 ${dayItem.entryDate}，${entryCount > 0 ? `${formatCountHint(entryCount)}` : "无记录"}`}
                      className={`relative flex aspect-square w-full items-center justify-center rounded-[6px] border transition-colors duration-150 ${
                        isSelected
                          ? "border-white/28 bg-white/[0.09] text-white"
                          : isToday
                            ? dayItem.isCurrentMonth
                              ? "border-white/20 bg-white/[0.05] text-white font-semibold hover:border-white/32 hover:bg-white/[0.08]"
                              : "border-white/12 bg-white/[0.02] text-white/50 hover:border-white/24 hover:bg-white/[0.05]"
                            : dayItem.isCurrentMonth
                              ? "border-white/8 bg-black/35 text-white/78 hover:border-white/18 hover:bg-white/[0.05]"
                              : "border-white/6 bg-black/15 text-white/24 hover:border-white/12 hover:text-white/46"
                      }`}
                      type="button"
                      onClick={() => {
                        setIsCalendarOpen(false);
                        onVisibleMonthChange(getEntryMonth(dayItem.entryDate));
                        onChange(dayItem.entryDate);
                      }}
                    >
                      <span className="text-xs font-medium">{dayItem.dayNumber}</span>
                      {isToday ? (
                        <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white opacity-80" />
                      ) : null}
                      {entryCount > 0 ? (
                        <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-white px-0.5 text-[8px] font-bold text-black">
                          {formatBadgeCount(entryCount)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/6 pt-2 text-[11px] text-white/36">
                <span>{formatCountHint(currentEntryCount)}</span>
                <span>{isMonthOverviewLoading ? "正在读取月历标记..." : "右上角数字表示当日记录数"}</span>
              </div>
            </div>
          ) : null}
        </div>

        <IconButton
          aria-label={`查看后一天 ${nextDate}`}
          className="h-8 w-8 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white"
          onClick={() => onChange(nextDate)}
        >
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
};
