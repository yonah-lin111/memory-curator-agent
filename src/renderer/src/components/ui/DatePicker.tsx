import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import {
  CALENDAR_WEEKDAY_LABELS,
  createMonthCalendarDays,
  createTodayEntryDate,
  formatEntryDateLabel,
  formatEntryMonthLabel,
  getEntryMonth,
  shiftEntryMonth,
} from "@/lib/dailyShared";

// 统一的日期选择器属性。
export interface DatePickerProps {
  // 当前选中日期，格式 YYYY-MM-DD。
  value: string;
  // 日期变化回调。
  onChange: (nextDate: string) => void;
  // 占位文本。
  placeholder?: string;
  // 额外容器样式名。
  className?: string;
  // 默认按钮触发器样式。
  triggerClassName?: string;
  // 弹出日历的对齐方式，默认 "left"。
  align?: "left" | "right";
  // 按日期聚合的记录数量映射（可选，主要为 PageDateNavigator 复用支持）。
  entryCountMap?: Record<string, number>;
  // 月份数据是否正在加载（可选，主要为 PageDateNavigator 复用支持）。
  isMonthOverviewLoading?: boolean;
  // 可见月份变化回调（可选，主要为 PageDateNavigator 复用支持）。
  onVisibleMonthChange?: (nextMonth: string) => void;
  // 自定义触发子元素。
  children?: React.ReactNode;
}

// 角标数字上限。
const BADGE_MAX_COUNT = 99;

/**
 * DatePicker - 统一的弹出式月历日期选择器。
 * 支持作为普通 Form 表单项，也完美兼容 PageDateNavigator 日历导航器。
 */
export const DatePicker = ({
  value,
  onChange,
  placeholder = "选择日期",
  className = "",
  triggerClassName = "",
  align = "left",
  entryCountMap = {},
  isMonthOverviewLoading = false,
  onVisibleMonthChange,
  children,
}: DatePickerProps): React.JSX.Element => {
  // 控制弹层显示状态。
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // 当前在弹层中可见的月份 (格式 YYYY-MM)。
  const [visibleMonth, setVisibleMonth] = useState<string>(() =>
    value ? getEntryMonth(value) : getEntryMonth(createTodayEntryDate())
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const todayEntryDate = createTodayEntryDate();

  // 根据当前可见月份生成 42 天网格。
  const calendarDays = useMemo(
    () => createMonthCalendarDays(visibleMonth),
    [visibleMonth]
  );

  // 当 value 改变时，同步更新可见月份。
  useEffect(() => {
    if (value) {
      setVisibleMonth(getEntryMonth(value));
    }
  }, [value]);

  // 触发可见月份回调。
  useEffect(() => {
    if (isOpen && onVisibleMonthChange) {
      onVisibleMonthChange(visibleMonth);
    }
  }, [visibleMonth, isOpen, onVisibleMonthChange]);

  // 点击外部及 Esc 键关闭。
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  /**
   * 把记录数量压缩为角标文本，避免过长撑破单元格。
   */
  const formatBadgeCount = (count: number): string =>
    count > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}+` : String(count);

  // 决定触发器元素
  let triggerElement = children;
  if (React.isValidElement(children)) {
    const child = children as React.ReactElement<any>;
    const childProps: Record<string, any> = {
      onClick: (e: React.MouseEvent) => {
        setIsOpen((prev) => !prev);
        if (typeof child.props.onClick === "function") {
          child.props.onClick(e);
        }
      },
    };

    triggerElement = React.cloneElement(child, {
      ...childProps,
      "data-open": isOpen ? "true" : "false",
      "aria-expanded": isOpen,
    });
  } else if (!children) {
    triggerElement = (
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex w-full h-[28px] items-center gap-1.5 rounded-[6px] border border-white/10 bg-[#212121] px-2.5 text-left text-xs text-white outline-none transition-colors duration-150 hover:border-white/20 focus:border-white/25 ${triggerClassName}`}
      >
        <CalendarDays className="h-3 w-3 flex-shrink-0 text-white/40" />
        <span className="font-mono flex-1">
          {value ? formatEntryDateLabel(value) : placeholder}
        </span>
        <ChevronDown
          className={`h-3 w-3 flex-shrink-0 text-white/30 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
    );
  }

  // 弹出框对齐位置样式名
  const alignClass = align === "right" ? "right-0" : "left-0";

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {triggerElement}

      {isOpen && (
        <div
          aria-label="Date picker"
          className={`absolute ${alignClass} top-[calc(100%+8px)] z-[9999] w-[296px] rounded-[6px] border border-white/10 bg-[#303030] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.62)]`}
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
                aria-label={`View previous month ${shiftEntryMonth(visibleMonth, -1)}`}
                className="bg-white/[0.03] text-white/56 hover:bg-white/[0.08] hover:text-white"
                onClick={() =>
                  setVisibleMonth(shiftEntryMonth(visibleMonth, -1))
                }
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                aria-label={`View next month ${shiftEntryMonth(visibleMonth, 1)}`}
                onClick={() =>
                  setVisibleMonth(shiftEntryMonth(visibleMonth, 1))
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
              const isSelected = dayItem.entryDate === value;
              // 当前单元格是否为今天。
              const isToday = dayItem.entryDate === todayEntryDate;

              return (
                <button
                  key={dayItem.entryDate}
                  aria-label={`Select date ${dayItem.entryDate}, ${entryCount > 0 ? "has entries" : "no entries"}`}
                  className={`relative flex aspect-square w-full items-center justify-center rounded-[6px] border transition-colors duration-150 ${
                    isSelected
                      ? "border-white/28 bg-white/[0.09] text-white"
                      : dayItem.isCurrentMonth
                        ? "border-white/8 bg-black/35 text-white/78 hover:border-white/18 hover:bg-white/[0.05]"
                        : "border-white/6 bg-black/15 text-white/24 hover:border-white/12 hover:text-white/46"
                  }`}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setVisibleMonth(getEntryMonth(dayItem.entryDate));
                    onChange(dayItem.entryDate);
                  }}
                >
                  <span className="text-xs font-medium">
                    {dayItem.dayNumber}
                  </span>
                  {isToday ? (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white opacity-80" />
                  ) : null}
                  {entryCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-white p-0 text-[8px] font-bold text-black leading-none">
                      {formatBadgeCount(entryCount)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {isMonthOverviewLoading && (
            <div className="mt-3 border-t border-white/6 pt-2 text-center text-[11px] text-white/36">
              正在读取月历标记...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
