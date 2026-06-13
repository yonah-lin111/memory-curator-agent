# Weekly Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a stunning, high-performance Weekly Review page featuring interactive ECharts and an innovative asymmetrical Origami layout that integrates with the global header's date selection.

**Architecture:** We use React 19, Zustand for global header state sharing, and vanilla ECharts for high-performance visualization. The page calculates week boundaries based on selected baseline date and parallelly queries 7 days of SQLite data.

**Tech Stack:** React, Tailwind CSS, Lucide Icons, ECharts (vanilla), Zustand.

---

## File Structure Map
- `src/renderer/src/components/layout/Header.tsx` (Modified) - Extend whitelist to allow dateNavigator on `"weekly"` page.
- `src/renderer/src/components/ui/PageWeekNavigator.tsx` (Created) - Custom weekly range navigator component.
- `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx` (Modified) - Full page view implementing the dual Origami Layout and ECharts.

---

### Task 1: Environment Setup & Whitelist Modification

**Files:**
- Modify: `package.json`
- Modify: `src/renderer/src/components/layout/Header.tsx`

- [ ] **Step 1: Install `echarts` library**
Run `pnpm install echarts` in the root folder.

- [ ] **Step 2: Update Header.tsx activePage whitelist**
Open `src/renderer/src/components/layout/Header.tsx` and add `"weekly"` to line 46:
```tsx
        {["today", "todo", "snippets", "journal", "weekly"].includes(activePage) && !isChatOpen && dateNavigator && (
          <span className="flex items-center ml-2">{dateNavigator}</span>
        )}
```

- [ ] **Step 3: Commit task**
```bash
git add package.json src/renderer/src/components/layout/Header.tsx
git commit -m "build(weekly): install echarts and whitelist weekly page in header"
```

---

### Task 2: Create custom Weekly Navigator

**Files:**
- Create: `src/renderer/src/components/ui/PageWeekNavigator.tsx`

- [ ] **Step 1: Write `PageWeekNavigator.tsx` component**
Create a new file at `src/renderer/src/components/ui/PageWeekNavigator.tsx` with complete weekly selection mechanics:
```tsx
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

interface PageWeekNavigatorProps {
  entryDate: string; // Base date inside the week
  onChange: (nextDate: string) => void;
}

// Get Monday of the week containing the given date
export const getMonday = (entryDate: string): string => {
  const d = new Date(`${entryDate}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return formatDateAsEntryDate(monday);
};

// Get Sunday of the week containing the given date
export const getSunday = (entryDate: string): string => {
  const mondayStr = getMonday(entryDate);
  const monday = new Date(`${mondayStr}T00:00:00`);
  monday.setDate(monday.getDate() + 6);
  return formatDateAsEntryDate(monday);
};

// Check if a date lies inside the week containing the baseline date
export const isDateInSameWeek = (dateA: string, dateB: string): boolean => {
  return getMonday(dateA) === getMonday(dateB);
};

// Calculate week number in year
export const getWeekNumber = (entryDate: string): number => {
  const d = new Date(`${entryDate}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  // Set to nearest Thursday: current date + 4 - current day number
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

export const PageWeekNavigator = ({
  entryDate,
  onChange,
}: PageWeekNavigatorProps): React.JSX.Element => {
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [visibleMonth, setVisibleMonth] = useState<string>(getEntryMonth(entryDate));
  const navigatorRef = useRef<HTMLDivElement | null>(null);

  const monday = getMonday(entryDate);
  const sunday = getSunday(entryDate);
  const weekNum = getWeekNumber(entryDate);

  const previousWeekDate = shiftEntryDate(entryDate, -7);
  const nextWeekDate = shiftEntryDate(entryDate, 7);
  const todayEntryDate = createTodayEntryDate();

  const calendarDays = useMemo(() => createMonthCalendarDays(visibleMonth), [visibleMonth]);

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

  useEffect(() => {
    if (isCalendarOpen) {
      setVisibleMonth(getEntryMonth(entryDate));
    }
  }, [entryDate, isCalendarOpen]);

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
                const isSelected = isDateInSameWeek(dayItem.entryDate, entryDate);
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
```

- [ ] **Step 2: Commit custom Week Navigator**
```bash
git add src/renderer/src/components/ui/PageWeekNavigator.tsx
git commit -m "feat(weekly): implement custom PageWeekNavigator component with full-week highlights"
```

---

### Task 3: Implement Core WeeklyReviewPage logic & Parallel Data Fetching

**Files:**
- Modify: `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx`

- [ ] **Step 1: Code the full WeeklyReviewPage.tsx logic**
We'll populate `WeeklyReviewPage.tsx` with:
- State for current `entryDate` (defaults to today's date).
- Parallel fetching of 7 days of sqlite data.
- Global header synchronization.
- Layout division (40% left analytics panel, 60% right scrollable Time River).
- Responsive ECharts container using standard Canvas elements.

Here's the full boilerplate and structure for `WeeklyReviewPage.tsx`:
```tsx
import type React from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import * as echarts from "echarts";
import { useHeaderStore } from "@/lib/headerStore";
import { useToast } from "@/components/ui/Toast";
import { PageWeekNavigator, getMonday, getSunday } from "@/components/ui/PageWeekNavigator";
import { createTodayEntryDate, shiftEntryDate } from "@/lib/dailyShared";
import { CheckCircle2, Circle, FileText, Bookmark, Calendar, ArrowRight, Star, TrendingUp, Sparkles } from "lucide-react";

// Day aggregation interface
interface DayDataAggregated {
  entryDate: string;
  weekdayName: string;
  todos: any[];
  snippets: any[];
  journal: any | null;
}

const WEEKDAYS_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export const WeeklyReviewPage = (): React.JSX.Element => {
  const toast = useToast();
  const setDateNavigator = useHeaderStore((state) => state.setDateNavigator);

  // Use state to track selected date
  const [entryDate, setEntryDate] = useState<string>(() => createTodayEntryDate());
  const [weeklyData, setWeeklyData] = useState<DayDataAggregated[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // DOM refs for ECharts
  const radarChartRef = useRef<HTMLDivElement | null>(null);
  const heatChartRef = useRef<HTMLDivElement | null>(null);

  // Instanced chart refs to destroy/resize cleanly
  const radarInstance = useRef<echarts.ECharts | null>(null);
  const heatInstance = useRef<echarts.ECharts | null>(null);

  // Sync date selection to Header
  useEffect(() => {
    setDateNavigator(
      <PageWeekNavigator
        entryDate={entryDate}
        onChange={(nextDate) => {
          setEntryDate(nextDate);
        }}
      />
    );
    return () => {
      setDateNavigator(null);
    };
  }, [entryDate, setDateNavigator]);

  // Parallel fetch 7 days of data
  useEffect(() => {
    const fetchWeekData = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const mondayStr = getMonday(entryDate);
        const datesArray = Array.from({ length: 7 }, (_, i) => shiftEntryDate(mondayStr, i));

        const results = await Promise.all(
          datesArray.map(async (d, index) => {
            let data = { todos: [], snippets: [], journal: null };
            if (window.api?.daily) {
              data = await window.api.daily.listDay(d);
            }
            return {
              entryDate: d,
              weekdayName: WEEKDAYS_ZH[index],
              todos: data.todos || [],
              snippets: data.snippets || [],
              journal: data.journal || null,
            };
          })
        );
        setWeeklyData(results);
      } catch (err) {
        toast.error("加载周度数据失败");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchWeekData();
  }, [entryDate, toast]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalTodos = 0;
    let completedTodos = 0;
    let highPriorityCount = 0;
    let totalSnippets = 0;
    let journalsCount = 0;
    const tagsMap: Record<string, number> = {};

    weeklyData.forEach((day) => {
      totalTodos += day.todos.length;
      completedTodos += day.todos.filter((t) => t.completed).length;
      highPriorityCount += day.todos.filter((t) => t.priority === "high" || t.priority === 3).length;
      totalSnippets += day.snippets.length;
      if (day.journal) journalsCount++;

      day.snippets.forEach((snip) => {
        if (snip.tags) {
          snip.tags.forEach((t: string) => {
            tagsMap[t] = (tagsMap[t] || 0) + 1;
          });
        }
      });
    });

    const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    const topTags = Object.entries(tagsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      totalTodos,
      completedTodos,
      completionRate,
      highPriorityCount,
      totalSnippets,
      journalsCount,
      topTags,
    };
  }, [weeklyData]);

  // ECharts Rendering
  useEffect(() => {
    if (isLoading || weeklyData.length === 0) return;

    // 1. Radar Star Chart
    if (radarChartRef.current) {
      if (!radarInstance.current) {
        radarInstance.current = echarts.init(radarChartRef.current);
      }

      const todoComp = stats.completionRate;
      const snipRate = Math.min(100, (stats.totalSnippets / 10) * 100);
      const journalRate = Math.round((stats.journalsCount / 7) * 100);
      const density = Math.min(100, ((stats.totalTodos + stats.totalSnippets) / 25) * 100);
      const hiPriComp = stats.totalTodos > 0 ? Math.round((stats.completedTodos / stats.totalTodos) * 100) : 0;

      radarInstance.current.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          backgroundColor: "#212121",
          borderColor: "rgba(255,255,255,0.1)",
          textStyle: { color: "#ffffff", fontSize: 11 },
        },
        radar: {
          indicator: [
            { name: "待办完成率", max: 100 },
            { name: "知识沉淀度", max: 100 },
            { name: "日记连续性", max: 100 },
            { name: "重点攻坚力", max: 100 },
            { name: "信息策展度", max: 100 },
          ],
          shape: "polygon",
          splitNumber: 4,
          axisName: {
            color: "rgba(255, 255, 255, 0.45)",
            fontSize: 10,
            fontFamily: "monospace",
          },
          splitLine: {
            lineStyle: {
              color: "rgba(255, 255, 255, 0.05)",
            },
          },
          splitArea: {
            show: false,
          },
          axisLine: {
            lineStyle: {
              color: "rgba(255, 255, 255, 0.05)",
            },
          },
        },
        series: [
          {
            name: "Weekly Review Store",
            type: "radar",
            symbol: "circle",
            symbolSize: 4,
            data: [
              {
                value: [todoComp, snipRate, journalRate, hiPriComp, density],
                name: "策展度量",
                itemStyle: {
                  color: "#ffffff",
                },
                lineStyle: {
                  color: "#ffffff",
                  width: 1.5,
                },
                areaStyle: {
                  color: "rgba(255, 255, 255, 0.06)",
                },
              },
            ],
          },
        ],
      });
    }

    // 2. Micro scatter density charts (Activity Heatmap)
    if (heatChartRef.current) {
      if (!heatInstance.current) {
        heatInstance.current = echarts.init(heatChartRef.current);
      }

      // X: Days of week (Mon-Sun)
      // Y: Categories (Todos, Snippets, Journals)
      const data: any[] = [];
      const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
      const categories = ["待办", "片段", "日记"];

      weeklyData.forEach((day, dayIdx) => {
        // Todo count
        data.push([dayIdx, 0, day.todos.length]);
        // Snippets count
        data.push([dayIdx, 1, day.snippets.length]);
        // Journal presence
        data.push([dayIdx, 2, day.journal ? 2 : 0]);
      });

      heatInstance.current.setOption({
        backgroundColor: "transparent",
        grid: {
          top: 10,
          bottom: 25,
          left: 45,
          right: 15,
        },
        xAxis: {
          type: "category",
          data: days,
          boundaryGap: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(255,255,255,0.4)",
            fontSize: 10,
          },
        },
        yAxis: {
          type: "category",
          data: categories,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(255,255,255,0.4)",
            fontSize: 10,
          },
          splitLine: {
            show: true,
            lineStyle: { color: "rgba(255,255,255,0.03)" },
          },
        },
        series: [
          {
            name: "活跃密度",
            type: "scatter",
            symbolSize: (val: any) => {
              return Math.min(20, Math.max(0, val[2] * 4));
            },
            data: data.map((item) => ({
              value: item,
              itemStyle: {
                color: item[2] > 0 ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.08)",
              },
            })),
            animationDelay: (idx: number) => idx * 10,
          },
        ],
      });
    }

    // Auto resize
    const handleResize = (): void => {
      radarInstance.current?.resize();
      heatInstance.current?.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isLoading, weeklyData, stats]);

  // Clean destroy
  useEffect(() => {
    return () => {
      radarInstance.current?.dispose();
      heatInstance.current?.dispose();
      radarInstance.current = null;
      heatInstance.current = null;
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-[#000000] gap-4 overflow-hidden text-sm">
      {/* 1. Left Panel (40% width) */}
      <div className="w-full lg:w-[40%] flex flex-col gap-3 h-full overflow-y-auto pr-1">
        {/* Weekly Stats Header */}
        <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute right-4 top-4 text-white/5 font-mono text-5xl font-extrabold select-none">
            STATS
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white/60" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">周策展指数</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-black/40 p-2.5 rounded-[6px] border border-white/5 flex flex-col">
              <span className="text-[10px] text-white/30 font-mono">待办完成率</span>
              <span className="text-xl font-bold mt-1 text-white/90">{stats.completionRate}%</span>
              <span className="text-[9px] text-white/20 mt-1 font-mono">{stats.completedTodos} / {stats.totalTodos}</span>
            </div>
            <div className="bg-black/40 p-2.5 rounded-[6px] border border-white/5 flex flex-col">
              <span className="text-[10px] text-white/30 font-mono">知识沉淀</span>
              <span className="text-xl font-bold mt-1 text-white/90">{stats.totalSnippets}</span>
              <span className="text-[9px] text-white/20 mt-1 font-mono">个片段捕获</span>
            </div>
            <div className="bg-black/40 p-2.5 rounded-[6px] border border-white/5 flex flex-col">
              <span className="text-[10px] text-white/30 font-mono">日记连续性</span>
              <span className="text-xl font-bold mt-1 text-white/90">{stats.journalsCount}/7</span>
              <span className="text-[9px] text-white/20 mt-1 font-mono">天写作记录</span>
            </div>
          </div>
        </div>

        {/* ECharts Radar Star Chart */}
        <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col h-[280px]">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-4 w-4 text-white/60" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">五维策展星盘</span>
          </div>
          <div ref={radarChartRef} className="flex-1 w-full h-full" />
        </div>

        {/* ECharts Scatter Heatmap */}
        <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col h-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-white/60" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">周中律动密度</span>
          </div>
          <div ref={heatChartRef} className="flex-1 w-full h-full" />
        </div>

        {/* Tag Cloud Card */}
        <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Bookmark className="h-4 w-4 text-white/60" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">核心周标签云</span>
          </div>
          {stats.topTags.length === 0 ? (
            <div className="text-xs text-white/30 font-mono text-center py-4 bg-black/20 rounded-[6px]">
              暂无标签沉淀
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {stats.topTags.map(([tag, count]) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded-[6px] bg-black/50 border border-white/5 hover:border-white/20 text-xs text-white/80 transition-all font-mono duration-150 cursor-default flex items-center gap-1.5"
                >
                  #{tag}
                  <span className="text-[9px] text-white/30 font-semibold bg-white/5 px-1 rounded-full">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Right Panel - Asymmetrical Origami Time River (60% width) */}
      <div className="w-full lg:w-[60%] flex flex-col h-full bg-[#000000] overflow-hidden">
        <div className="flex-shrink-0 mb-2 flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-white/60" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">时间溪流 (Time Stream)</h3>
          </div>
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">{getMonday(entryDate).replace(/-/g, "/")} - {getSunday(entryDate).replace(/-/g, "/")}</span>
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center font-mono text-white/40 text-xs">
            正在追溯时光碎片...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 pb-4">
            {weeklyData.map((day, idx) => {
              // Asymmetric style shifting: alternative card layout rules
              const isEven = idx % 2 === 0;

              return (
                <div
                  key={day.entryDate}
                  className={`group bg-[#212121] rounded-[6px] border border-white/5 hover:border-white/15 p-4 flex flex-col gap-3 transition-all duration-300 hover:scale-[1.005] cursor-default`}
                >
                  <div className="flex items-center justify-between border-b border-white/[0.03] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-white/80 group-hover:text-white transition-colors">
                        {day.weekdayName}
                      </span>
                      <span className="text-[10px] font-mono text-white/30 bg-black/40 px-1.5 py-0.5 rounded-[6px] border border-white/5">
                        {day.entryDate}
                      </span>
                    </div>

                    <ArrowRight className="h-3 w-3 text-white/0 group-hover:text-white/40 transition-all transform group-hover:translate-x-1" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Column A: Journal & Content Highlighting */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-white/40" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">时光高光 / Journal</span>
                      </div>
                      {day.journal ? (
                        <p className="text-xs text-white/70 leading-relaxed font-normal bg-black/30 p-2.5 rounded-[6px] border border-white/[0.03] break-all select-text line-clamp-4">
                          {day.journal.content}
                        </p>
                      ) : (
                        <div className="text-xs text-white/20 font-mono py-2 bg-black/10 rounded-[6px] text-center border border-dashed border-white/5">
                          此日未执笔写日记
                        </div>
                      )}
                    </div>

                    {/* Column B: Todos & Snippets */}
                    <div className="flex flex-col gap-3">
                      {/* Todos brief list */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-white/40" />
                          <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">每日行动 / Todo ({day.todos.filter((t: any) => t.completed).length}/{day.todos.length})</span>
                        </div>
                        {day.todos.length === 0 ? (
                          <div className="text-xs text-white/20 font-mono py-1.5 bg-black/10 rounded-[6px] text-center">
                            无行动待办
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 max-h-[85px] overflow-y-auto">
                            {day.todos.slice(0, 3).map((todo: any) => (
                              <div key={todo.id} className="flex items-center gap-2 text-xs text-white/65">
                                {todo.completed ? (
                                  <CheckCircle2 className="h-3 w-3 text-white/40 flex-shrink-0" />
                                ) : (
                                  <Circle className="h-3 w-3 text-white/20 flex-shrink-0" />
                                )}
                                <span className={`truncate ${todo.completed ? "line-through text-white/30" : ""}`}>{todo.text}</span>
                              </div>
                            ))}
                            {day.todos.length > 3 && (
                              <div className="text-[10px] text-white/30 font-mono pl-5">
                                等其它 {day.todos.length - 3} 项行动...
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Snippets brief list */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Bookmark className="h-3.5 w-3.5 text-white/40" />
                          <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">记忆碎片 / Snippets ({day.snippets.length})</span>
                        </div>
                        {day.snippets.length === 0 ? (
                          <div className="text-xs text-white/20 font-mono py-1.5 bg-black/10 rounded-[6px] text-center">
                            无捕获片段
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 max-h-[85px] overflow-y-auto">
                            {day.snippets.slice(0, 2).map((snip: any) => (
                              <div key={snip.id} className="text-xs text-white/65 flex items-center gap-1.5 truncate">
                                <span className="text-[9px] font-mono text-white/30 select-none">[{snip.time || "碎片"}]</span>
                                <span className="truncate font-semibold">{snip.title || snip.content}</span>
                              </div>
                            ))}
                            {day.snippets.length > 2 && (
                              <div className="text-[10px] text-white/30 font-mono">
                                等其它 {day.snippets.length - 2} 个片段捕获...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit the full code changes**
```bash
git add src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx
git commit -m "feat(weekly): implement complete WeeklyReviewPage.tsx view with asymmetrical Origami Layout & multi-chart ECharts"
```

---

### Task 4: Complete build, type-checks & verification

- [ ] **Step 1: Check typescript compile errors**
Run: `npm run typecheck`
Ensure there are no ts errors.

- [ ] **Step 2: Verify lint checks**
Run: `npm run lint`
Ensure code structure is clean and formatted.
