import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  getMonday,
  formatWeekLabel,
} from "@/lib/dailyShared";

// 统一的日期选择器属性。
export interface DatePickerProps {
  // 当前选中值，格式 YYYY-MM-DD 或 YYYY-MM。
  value: string;
  // 变化回调。
  onChange: (nextValue: string) => void;
  // 选择模式：按日、按周、按月，默认按日。
  mode?: "date" | "week" | "month";
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
  // 是否禁用。
  disabled?: boolean;
}

// 角标数字上限。
const BADGE_MAX_COUNT = 99;

// 月度名称数组
const MONTHS = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
];

/**
 * DatePicker - 统一的弹出式月历日期选择器。
 * 支持作为普通 Form 表单项，也完美兼容 PageDateNavigator 日历导航器。
 */
export const DatePicker = ({
  value,
  onChange,
  mode = "date",
  placeholder = "选择日期",
  className = "",
  triggerClassName = "",
  align = "left",
  entryCountMap = {},
  isMonthOverviewLoading = false,
  onVisibleMonthChange,
  children,
  disabled = false,
}: DatePickerProps): React.JSX.Element => {
  // 控制弹层显示状态。
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // 当前在弹层中可见的月份 (格式 YYYY-MM)。
  const [visibleMonth, setVisibleMonth] = useState<string>(() =>
    value && mode !== "month"
      ? getEntryMonth(value)
      : getEntryMonth(createTodayEntryDate()),
  );
  // 控制月度选择器中的年份。
  const [visibleYear, setVisibleYear] = useState<number>(() => {
    if (value) {
      const year = parseInt(value.slice(0, 4), 10);
      if (!isNaN(year)) return year;
    }
    return new Date().getFullYear();
  });
  // 记录鼠标当前 hover 悬停的日期，用于周选择模式的高亮反馈。
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  // 气泡绝对定位坐标
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  // 气泡 DOM 引用
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const todayEntryDate = createTodayEntryDate();

  // 根据当前可见月份生成 42 天网格。
  const calendarDays = useMemo(
    () => createMonthCalendarDays(visibleMonth),
    [visibleMonth],
  );

  /**
   * 动态更新气泡容器的绝对定位坐标。
   */
  const updatePosition = (): void => {
    if (isOpen && tooltipRef.current && containerRef.current) {
      const triggerRect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // 获取当前气泡主体的高度和宽度
      const tooltipHeight =
        tooltipRef.current.offsetHeight || tooltipRect.height || 320;
      const tooltipWidth =
        tooltipRef.current.offsetWidth || tooltipRect.width || 296;

      // 视口安全可见边界 (留出 8px 安全间距)
      const limitLeft = 8;
      const limitRight = window.innerWidth - 8;
      const limitTop = 8;
      const limitBottom = window.innerHeight - 8;

      // 安全间距
      const gap = 8;
      const spaceBelow = limitBottom - triggerRect.bottom;
      const spaceAbove = triggerRect.top - limitTop;

      // 决定垂直方向：默认在下方，若下方空间不足且上方空间更大，则翻转到上方
      let targetTop = triggerRect.bottom + gap;
      if (spaceBelow < tooltipHeight && spaceAbove > spaceBelow) {
        targetTop = triggerRect.top - tooltipHeight - gap;
      }

      // 决定水平方向：支持 "left" 或 "right" 对齐
      let targetLeft = triggerRect.left;
      if (align === "right") {
        targetLeft = triggerRect.right - tooltipWidth;
      }

      // 融入当前视窗滚动位移
      let finalTop = window.scrollY + targetTop;
      let finalLeft = window.scrollX + targetLeft;

      // 进行水平边界越界修正
      const viewLeft = limitLeft + window.scrollX;
      const viewRight = limitRight + window.scrollX;
      if (finalLeft < viewLeft) {
        finalLeft = viewLeft;
      } else if (finalLeft + tooltipWidth > viewRight) {
        finalLeft = viewRight - tooltipWidth;
      }

      // 进行垂直边界越界修正
      const viewTop = limitTop + window.scrollY;
      const viewBottom = limitBottom + window.scrollY;
      if (finalTop < viewTop) {
        finalTop = viewTop;
      } else if (finalTop + tooltipHeight > viewBottom) {
        finalTop = viewBottom - tooltipHeight;
      }

      setCoords({ top: finalTop, left: finalLeft });
    }
  };

  // 监听显示状态及窗口滚动/缩放，实时重算位置
  useEffect(() => {
    if (isOpen) {
      // 首次渲染后立即计算位置
      const timer = setTimeout(() => {
        updatePosition();
      }, 0);

      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    } else {
      setCoords(null);
    }
    return undefined;
  }, [isOpen, visibleMonth, visibleYear, mode]);

  // 当 value 改变时，同步更新可见月份与年份。
  useEffect(() => {
    if (value) {
      if (mode === "month") {
        const year = parseInt(value.slice(0, 4), 10);
        if (!isNaN(year)) {
          setVisibleYear(year);
        }
      } else {
        setVisibleMonth(getEntryMonth(value));
      }
    }
  }, [value, mode]);

  // 当禁用状态开启时，确保关闭弹窗。
  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  // 触发可见月份回调。
  useEffect(() => {
    if (isOpen && onVisibleMonthChange && mode !== "month") {
      onVisibleMonthChange(visibleMonth);
    }
  }, [visibleMonth, isOpen, onVisibleMonthChange, mode]);

  // 点击外部及 Esc 键关闭。
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
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
        if (disabled) return;
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
      mode: child.props.mode || mode,
      disabled: child.props.disabled !== undefined ? child.props.disabled : disabled,
    });
  } else if (!children) {
    const getDisplayValue = (): string => {
      if (!value) return placeholder;
      if (mode === "month") {
        return formatEntryMonthLabel(value);
      }
      if (mode === "week") {
        return formatWeekLabel(value);
      }
      return formatEntryDateLabel(value);
    };

    triggerElement = (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
        }}
        className={`relative flex w-full h-[28px] items-center gap-1.5 rounded-[6px] border border-white/10 bg-[#212121] px-2.5 text-left text-xs text-white outline-none transition-colors duration-150 hover:border-white/20 focus:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed ${triggerClassName}`}
      >
        <CalendarDays className="h-3 w-3 flex-shrink-0 text-white/40" />
        <span className="font-mono flex-1">{getDisplayValue()}</span>
        <ChevronDown
          className={`h-3 w-3 flex-shrink-0 text-white/30 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
    );
  }

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {triggerElement}

      {isOpen &&
        createPortal(
          <div
            ref={tooltipRef}
            aria-label="Date picker"
            className="absolute z-[999999] w-[296px] rounded-[6px] border border-white/10 bg-[#212121] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.62)] animate-card-modal-in"
            style={{
              position: "absolute",
              top: `${coords?.top ?? 0}px`,
              left: `${coords?.left ?? 0}px`,
              opacity: coords ? undefined : 0, // 避免闪烁
            }}
            role="dialog"
          >
            {mode === "month" ? (
              /* 月份选择器视图 */
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/26">
                      Select Month
                    </p>
                    <p className="text-sm font-semibold text-white/86">
                      {visibleYear}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      aria-label={`View previous year ${visibleYear - 1}`}
                      className="bg-white/[0.03] text-white/56 hover:bg-white/[0.08] hover:text-white"
                      onClick={() => setVisibleYear((prev) => prev - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      aria-label={`View next year ${visibleYear + 1}`}
                      onClick={() => setVisibleYear((prev) => prev + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {MONTHS.map((monthName, index) => {
                    const monthIndexStr = String(index + 1).padStart(2, "0");
                    const monthValue = `${visibleYear}-${monthIndexStr}`;
                    const isSelected = value === monthValue;

                    return (
                      <button
                        key={monthName}
                        aria-label={`Select month ${monthValue}`}
                        className={`flex h-9 items-center justify-center rounded-[6px] border text-xs font-medium transition-colors duration-150 ${
                          isSelected
                            ? "border-white/28 bg-white/[0.09] text-white"
                            : "border-white/8 bg-black/35 text-white/78 hover:border-white/18 hover:bg-white/[0.05]"
                        }`}
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onChange(monthValue);
                        }}
                      >
                        {monthName}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* 日期/周选择器视图 */
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/26">
                      {mode === "week" ? "Select Week" : "Select Date"}
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
                    // 当前单元格是否为选中日期/周。
                    const isSelected =
                      mode === "week"
                        ? value &&
                          getMonday(dayItem.entryDate) === getMonday(value)
                        : dayItem.entryDate === value;
                    // 判断当前日期是否属于鼠标 hover 悬停的那一周。
                    const isHovered =
                      mode === "week" &&
                      hoveredDate &&
                      getMonday(dayItem.entryDate) === getMonday(hoveredDate);
                    // 当前单元格是否为今天。
                    const isToday = dayItem.entryDate === todayEntryDate;

                    return (
                      <button
                        key={dayItem.entryDate}
                        aria-label={`Select date ${dayItem.entryDate}, ${entryCount > 0 ? "has entries" : "no entries"}`}
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
                        onMouseEnter={() => {
                          if (mode === "week") {
                            setHoveredDate(dayItem.entryDate);
                          }
                        }}
                        onMouseLeave={() => {
                          if (mode === "week") {
                            setHoveredDate(null);
                          }
                        }}
                        onClick={() => {
                          setIsOpen(false);
                          setVisibleMonth(getEntryMonth(dayItem.entryDate));
                          onChange(
                            mode === "week"
                              ? getMonday(dayItem.entryDate)
                              : dayItem.entryDate,
                          );
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
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
