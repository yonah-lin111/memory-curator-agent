import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import {
  CALENDAR_WEEKDAY_LABELS,
  createMonthCalendarDays,
  createTodayEntryDate,
  formatDateAsEntryDate,
  getEntryMonth,
  shiftEntryDate,
  shiftEntryMonth,
} from "@/lib/dailyShared";

// 页面周导航器属性接口
interface PageWeekNavigatorProps {
  // 当前基准日期
  entryDate: string;
  // 日期变化回调函数
  onChange: (nextDate: string) => void;
}

/**
 * 获取指定日期所在周的周一日期 (格式：YYYY-MM-DD)
 * @param entryDate 基准日期
 * @returns 当周周一的日期字符串
 */
export const getMonday = (entryDate: string): string => {
  const d = new Date(`${entryDate}T00:00:00`);
  const day = d.getDay();
  // 周日 getDay() 为 0，需要向前平移 6 天；其余天数平移 1 - day
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return formatDateAsEntryDate(monday);
};

/**
 * 获取指定日期所在周的周日日期 (格式：YYYY-MM-DD)
 * @param entryDate 基准日期
 * @returns 当周周日的日期字符串
 */
export const getSunday = (entryDate: string): string => {
  const mondayStr = getMonday(entryDate);
  const monday = new Date(`${mondayStr}T00:00:00`);
  monday.setDate(monday.getDate() + 6);
  return formatDateAsEntryDate(monday);
};

/**
 * 判断两个日期是否属于同一周（周一至周日）
 * @param dateA 日期A
 * @param dateB 日期B
 * @returns 是否在同一周
 */
export const isDateInSameWeek = (dateA: string, dateB: string): boolean => {
  return getMonday(dateA) === getMonday(dateB);
};

/**
 * 计算指定日期在当年属于第几周
 * @param entryDate 基准日期
 * @returns 周数
 */
export const getWeekNumber = (entryDate: string): number => {
  const d = new Date(`${entryDate}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  // 设置为最近的周四：当前日期 + 4 - 当前星期数（0 转换为 7）
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

/**
 * PageWeekNavigator - 自定义的全局周度策展导航器组件。
 * 支持跨周平滑切换，并在月历弹窗中整体高亮悬停所在的整周。
 */
export const PageWeekNavigator = ({
  entryDate,
  onChange,
}: PageWeekNavigatorProps): React.JSX.Element => {
  // 控制月历弹层打开状态
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  // 当前在弹层中可见的月份
  const [visibleMonth, setVisibleMonth] = useState<string>(getEntryMonth(entryDate));
  // 导航器容器 DOM 引用，用于点击外部关闭弹层
  const navigatorRef = useRef<HTMLDivElement | null>(null);

  // 计算当前周的时间跨度与周数
  const monday = getMonday(entryDate);
  const sunday = getSunday(entryDate);
  const weekNum = getWeekNumber(entryDate);

  // 上一周与下一周的切换基准日期
  const previousWeekDate = shiftEntryDate(entryDate, -7);
  const nextWeekDate = shiftEntryDate(entryDate, 7);
  // 今天的日期
  const todayEntryDate = createTodayEntryDate();

  // 根据当前可见月份生成日历网格数据
  const calendarDays = useMemo(() => createMonthCalendarDays(visibleMonth), [visibleMonth]);

  // 处理点击外部与 Escape 键关闭弹窗
  useEffect(() => {
    if (!isCalendarOpen) return;
    const handleClickOutside = (e: MouseEvent): void => {
      if (navigatorRef.current && !navigatorRef.current.contains(e.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setIsCalendarOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCalendarOpen]);

  // 当弹窗打开时，自动将可见月份同步为选中日期所在月份
  useEffect(() => {
    if (isCalendarOpen) {
      setVisibleMonth(getEntryMonth(entryDate));
    }
  }, [entryDate, isCalendarOpen]);

  // 记录鼠标当前 hover 悬停的日期，以便在月历中对该整周进行高亮反馈
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  return (
    <div ref={navigatorRef} className="flex items-center gap-1">
      <IconButton
        aria-label="Previous Week"
        onClick={() => onChange(previousWeekDate)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </IconButton>

      <div className="relative">
        <button
          aria-expanded={isCalendarOpen}
          aria-haspopup="dialog"
          className="relative flex h-7 items-center gap-1.5 rounded-[6px] border border-white/5 bg-[#303030] px-2.5 text-left text-xs font-semibold text-white/80 transition-colors duration-150 hover:border-white/15 hover:bg-white/[0.04]"
          type="button"
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        >
          <CalendarDays className="h-3 w-3 flex-shrink-0 text-white/40" />
          <span className="font-mono text-xs">{`${monday.replace(/-/g, ".")} - ${sunday.replace(/-/g, ".")} [W${weekNum}]`}</span>
          <ChevronDown className={`h-3 w-3 flex-shrink-0 text-white/30 transition-transform duration-150 ${isCalendarOpen ? "rotate-180" : ""}`} />
        </button>

        {isCalendarOpen && (
          <div
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[296px] rounded-[6px] border border-white/10 bg-[#303030] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.62)]"
            role="dialog"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/26">Select Week</p>
                <p className="text-sm font-semibold text-white/86">{visibleMonth.replace("-", ".")}</p>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  aria-label="Prev Month"
                  onClick={() => setVisibleMonth(shiftEntryMonth(visibleMonth, -1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  aria-label="Next Month"
                  onClick={() => setVisibleMonth(shiftEntryMonth(visibleMonth, 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {CALENDAR_WEEKDAY_LABELS.map((label) => (
                <span key={label} className="text-[10px] font-mono text-white/28">{label}</span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {calendarDays.map((dayItem) => {
                // 判断当前日期是否属于被选中的那一周
                const isSelected = isDateInSameWeek(dayItem.entryDate, entryDate);
                // 判断当前日期是否属于鼠标 hover 悬停的那一周
                const isHovered = hoveredDate && isDateInSameWeek(dayItem.entryDate, hoveredDate);
                const isToday = dayItem.entryDate === todayEntryDate;

                return (
                  <button
                    key={dayItem.entryDate}
                    className={`relative flex aspect-square w-full items-center justify-center rounded-[6px] border transition-colors duration-150 ${
                      isSelected
                        ? "border-white/40 bg-white/[0.15] text-white"
                        : isHovered
                          ? "border-white/20 bg-white/[0.06] text-white"
                          : dayItem.isCurrentMonth
                            ? "border-white/8 bg-black/35 text-white/78 hover:border-white/18 hover:bg-white/[0.05]"
                            : "border-white/6 bg-black/15 text-white/24 hover:border-white/12 hover:text-white/46"
                    }`}
                    type="button"
                    onMouseEnter={() => setHoveredDate(dayItem.entryDate)}
                    onMouseLeave={() => setHoveredDate(null)}
                    onClick={() => {
                      setIsCalendarOpen(false);
                      onChange(getMonday(dayItem.entryDate));
                    }}
                  >
                    <span className="text-xs font-medium">{dayItem.dayNumber}</span>
                    {isToday && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white opacity-80" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <IconButton
        aria-label="Next Week"
        onClick={() => onChange(nextWeekDate)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
};
