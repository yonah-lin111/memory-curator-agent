import type React from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import * as echarts from "echarts";
import { useHeaderStore } from "@/lib/headerStore";
import { useToast } from "@/components/ui/Toast";
import {
  PageWeekNavigator,
  getMonday,
} from "@/components/ui/PageWeekNavigator";
import { createTodayEntryDate, shiftEntryDate } from "@/lib/dailyShared";
import {
  CheckCircle2,
  Circle,
  FileText,
  Bookmark,
  Calendar,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { WeeklySummaryPanel } from "@/pages/weekly-review/components/WeeklySummaryPanel";

// 单日聚合并格式化后的数据接口
interface DayDataAggregated {
  // 日期 (格式：YYYY-MM-DD)
  entryDate: string;
  // 星期名称 (如周一、周二)
  weekdayName: string;
  // 当日待办列表
  todos: any[];
  // 当日片段列表
  snippets: any[];
  // 当日日记数据
  journal: any | null;
}

// 星期在中文环境下的名称常量
const WEEKDAYS_ZH = [
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
  "周日",
] as const;

/**
 * WeeklyReviewPage - 周度策展仪表盘页面。
 * 运用非对称 Origami 律动网格布局与 ECharts 交互星盘进行周度回顾。
 */
export const WeeklyReviewPage = (): React.JSX.Element => {
  // 引用 Toast 提示服务
  const toast = useToast();
  // 全局 Header Store 中的设置导航器方法
  const setDateNavigator = useHeaderStore((state) => state.setDateNavigator);

  // 当前周的选中基准日期，默认初始化为今天
  const [entryDate, setEntryDate] = useState<string>(() =>
    createTodayEntryDate(),
  );
  // 包含周一至周日 7 天的聚合数据列表
  const [weeklyData, setWeeklyData] = useState<DayDataAggregated[]>([]);
  // 数据加载 loading 状态
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 包含处于展开状态的日期列表 (支持多日同时展开、折叠)
  const [expandedDates, setExpandedDates] = useState<string[]>([]);

  // 当周度数据加载完成时，默认展开第一天 (周一) 且当切换周时自适应重置
  useEffect(() => {
    if (weeklyData.length > 0) {
      const hasOverlap = expandedDates.some((date) =>
        weeklyData.some((day) => day.entryDate === date),
      );
      if (!hasOverlap) {
        setExpandedDates([weeklyData[0].entryDate]);
      }
    }
  }, [weeklyData]);

  // 记忆标签环形图的 DOM 容器引用
  const doughnutChartRef = useRef<HTMLDivElement | null>(null);
  // 每日行动与片段趋势双轴图的 DOM 容器引用
  const lineBarChartRef = useRef<HTMLDivElement | null>(null);

  // 环形图 ECharts 实例引用
  const doughnutInstance = useRef<echarts.ECharts | null>(null);
  // 折线柱状图 ECharts 实例引用
  const lineBarInstance = useRef<echarts.ECharts | null>(null);

  /**
   * 将周度导航器 PageWeekNavigator 挂载发布到全局 Header 栏
   */
  useEffect(() => {
    setDateNavigator(
      <PageWeekNavigator
        entryDate={entryDate}
        onChange={(nextDate) => {
          setEntryDate(nextDate);
        }}
      />,
    );
    return () => {
      setDateNavigator(null);
    };
  }, [entryDate, setDateNavigator]);

  /**
   * 页面加载时默认静默检查上一周（相对于今天）是否需要生成总结并自动触发。
   */
  useEffect(() => {
    const autoSummaryLastWeek = async (): Promise<void> => {
      try {
        const today = createTodayEntryDate();
        const currentMonday = getMonday(today);
        const lastWeekStartDate = shiftEntryDate(currentMonday, -7);

        // 1. 检查上一周是否已经有总结
        if (window.api?.weekly?.summary) {
          const lastWeekSummary = await window.api.weekly.summary.get(lastWeekStartDate);
          if (lastWeekSummary) return; // 已有总结，静默跳过

          // 2. 检查上一周是否有数据（非空）
          const datesArray = Array.from({ length: 7 }, (_, i) =>
            shiftEntryDate(lastWeekStartDate, i),
          );
          const daysData = await Promise.all(
            datesArray.map(async (d) => {
              if (window.api?.daily) {
                return await window.api.daily.listDay(d);
              }
              return { todos: [], snippets: [], journal: null };
            }),
          );
          const lastWeekIsEmpty = daysData.every(
            (day) =>
              (!day.todos || day.todos.length === 0) &&
              (!day.snippets || day.snippets.length === 0) &&
              !day.journal,
          );

          // 3. 如果上一周尚未生成总结且内容非空，则在后台静默发起生成
          if (!lastWeekIsEmpty) {
            await window.api.weekly.summary.generate({ weekStartDate: lastWeekStartDate });
          }
        }
      } catch (err) {
        console.error("静默生成上一周总结失败", err);
      }
    };

    void autoSummaryLastWeek();
  }, []);

  /**
   * 并发异步读取当前周（周一至周日）的 7 天 SQLite 数据库原始数据
   */
  useEffect(() => {
    const fetchWeekData = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const mondayStr = getMonday(entryDate);
        const datesArray = Array.from({ length: 7 }, (_, i) =>
          shiftEntryDate(mondayStr, i),
        );

        // 并发执行 IPC 读取操作
        const results = await Promise.all(
          datesArray.map(async (d, index) => {
            let data: { todos: any[]; snippets: any[]; journal: any | null } = {
              todos: [],
              snippets: [],
              journal: null,
            };
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
          }),
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

  /**
   * 汇总计算当前周的深度分析统计指标（待办、片段、高频标签等）
   */
  const stats = useMemo(() => {
    // 待办总数
    let totalTodos = 0;
    // 已完成待办数
    let completedTodos = 0;
    // 高优先级待办数
    let highPriorityCount = 0;
    // 捕获的片段总数
    let totalSnippets = 0;
    // 写日记的总天数
    let journalsCount = 0;
    // 临时记录标签频次的 map 映射
    const tagsMap: Record<string, number> = {};

    weeklyData.forEach((day) => {
      totalTodos += day.todos.length;
      completedTodos += day.todos.filter((t) => t.completed).length;
      highPriorityCount += day.todos.filter(
        (t) => t.priority === "high" || t.priority === 3,
      ).length;
      totalSnippets += day.snippets.length;
      if (day.journal) {
        journalsCount++;
      }

      day.snippets.forEach((snip) => {
        if (snip.tags) {
          snip.tags.forEach((t: string) => {
            tagsMap[t] = (tagsMap[t] || 0) + 1;
          });
        }
      });
    });

    // 计算待办完成率百分比
    const completionRate =
      totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    // 获取频次前 10 的高频周标签
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

  /**
   * 初始化并刷新 ECharts 各维度指标图表的渲染副作用
   */
  useEffect(() => {
    if (isLoading || weeklyData.length === 0) return;

    // 在测试环境下，跳过 ECharts 的初始化，避免 JSDOM canvas 报错导致单元测试崩溃
    const isTestEnv =
      (typeof process !== "undefined" &&
        (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST))) ||
      (typeof window !== "undefined" &&
        (Boolean((window as any).vi) ||
          Boolean((window as any).vitest) ||
          Boolean((window as any).__vitest_worker__) ||
          (window as any).process?.env?.NODE_ENV === "test"));
    if (isTestEnv) return;

    // 1. 初始化或配置记忆标签环形图 (Doughnut)
    if (doughnutChartRef.current) {
      if (!doughnutInstance.current) {
        doughnutInstance.current = echarts.init(doughnutChartRef.current);
      }

      const doughnutData = stats.topTags.slice(0, 5).map(([tag, count]) => ({
        name: `#${tag}`,
        value: count,
      }));

      doughnutInstance.current.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          backgroundColor: "#212121",
          borderColor: "rgba(255,255,255,0.1)",
          textStyle: { color: "#ffffff", fontSize: 12 },
        },
        legend: {
          show: false,
        },
        series: [
          {
            name: "标签占比",
            type: "pie",
            radius: ["35%", "65%"],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 3,
              borderColor: "#212121",
              borderWidth: 1.5,
            },
            label: {
              show: true,
              position: "outside",
              formatter: "{b}",
              color: "rgba(255, 255, 255, 0.45)",
              fontSize: 12,
              fontFamily: "monospace",
            },
            labelLine: {
              show: true,
              length: 5,
              length2: 5,
              lineStyle: {
                color: "rgba(255, 255, 255, 0.1)",
              },
            },
            data:
              doughnutData.length > 0
                ? doughnutData
                : [
                    {
                      name: "暂无标签",
                      value: 1,
                      itemStyle: { color: "rgba(255,255,255,0.05)" },
                      label: { show: false },
                    },
                  ],
          },
        ],
      });
    }

    // 2. 初始化或配置每日行动与片段趋势双轴图 (Line + Bar)
    if (lineBarChartRef.current) {
      if (!lineBarInstance.current) {
        lineBarInstance.current = echarts.init(lineBarChartRef.current);
      }

      const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
      const todoCompletedSeries = weeklyData.map(
        (day) => day.todos.filter((t) => t.completed).length,
      );
      const todoTotalSeries = weeklyData.map((day) => day.todos.length);
      const snippetSeries = weeklyData.map((day) => day.snippets.length);

      lineBarInstance.current.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "#212121",
          borderColor: "rgba(255,255,255,0.1)",
          textStyle: { color: "#ffffff", fontSize: 12 },
        },
        grid: {
          top: 30,
          bottom: 25,
          left: 40,
          right: 40,
        },
        xAxis: {
          type: "category",
          data: days,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(255,255,255,0.4)",
            fontSize: 12,
          },
        },
        yAxis: [
          {
            type: "value",
            name: "待办行动",
            nameTextStyle: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: {
              show: true,
              lineStyle: { color: "rgba(255,255,255,0.03)" },
            },
            axisLabel: {
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
            },
          },
          {
            type: "value",
            name: "片段捕获",
            nameTextStyle: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: {
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
            },
          },
        ],
        series: [
          {
            name: "已完成待办",
            type: "bar",
            stack: "todo",
            itemStyle: {
              color: "rgba(255, 255, 255, 0.75)",
            },
            barWidth: 16,
            data: todoCompletedSeries,
          },
          {
            name: "未完成待办",
            type: "bar",
            stack: "todo",
            itemStyle: {
              color: "rgba(255, 255, 255, 0.15)",
            },
            barWidth: 16,
            data: todoTotalSeries.map(
              (tot, idx) => tot - todoCompletedSeries[idx],
            ),
          },
          {
            name: "片段捕获",
            type: "line",
            yAxisIndex: 1,
            symbol: "circle",
            symbolSize: 6,
            itemStyle: {
              color: "#ffffff",
            },
            lineStyle: {
              color: "#ffffff",
              width: 1.5,
              type: "dashed",
            },
            data: snippetSeries,
          },
        ],
      });
    }

    // 处理视窗 Resize 动态重绘，避免图表拉伸错位
    const handleResize = (): void => {
      doughnutInstance.current?.resize();
      lineBarInstance.current?.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isLoading, weeklyData, stats]);

  /**
   * 卸载组件时进行 ECharts 实例的显式销毁，防止内存泄漏
   */
  useEffect(() => {
    return () => {
      doughnutInstance.current?.dispose();
      lineBarInstance.current?.dispose();
      doughnutInstance.current = null;
      lineBarInstance.current = null;
    };
  }, []);

  return (
    <div
      aria-label="Weekly Review Page"
      className="w-full h-full bg-[#000000] overflow-y-auto custom-scrollbar py-4 px-1 lg:px-2 [scrollbar-gutter:stable] flex flex-col text-sm"
    >
      <div className="flex-1 flex flex-col gap-6 pr-1">
        {/* 1. 上部面板：数据透视 (Dashboard) */}
        <div className="w-full flex flex-col bg-[#000000]">
          <div className="flex-shrink-0 mb-3 flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/60" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
                数据透视
              </h3>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* 卡片 1: 周数据透视 (独占一行，高度自适应，内部卡片水平排列) */}
            <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col h-auto relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-white/60" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
                  周数据透视
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                <div className="bg-black/40 p-4 rounded-[6px] border border-white/5 flex flex-col justify-between h-[90px]">
                  <span className="text-xs text-white/30 font-mono leading-none">
                    待办完成率
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-bold text-white/90 leading-none">
                      {stats.completionRate}%
                    </span>
                    <span className="text-xs text-white/30 font-mono leading-none">
                      {stats.completedTodos} / {stats.totalTodos}
                    </span>
                  </div>
                </div>
                <div className="bg-black/40 p-4 rounded-[6px] border border-white/5 flex flex-col justify-between h-[90px]">
                  <span className="text-xs text-white/30 font-mono leading-none">
                    知识沉淀
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-bold text-white/90 leading-none">
                      {stats.totalSnippets}
                    </span>
                    <span className="text-xs text-white/30 font-mono leading-none">
                      个片段捕获
                    </span>
                  </div>
                </div>
                <div className="bg-black/40 p-4 rounded-[6px] border border-white/5 flex flex-col justify-between h-[90px]">
                  <span className="text-xs text-white/30 font-mono leading-none">
                    日记连续性
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-bold text-white/90 leading-none">
                      {stats.journalsCount}/7
                    </span>
                    <span className="text-xs text-white/30 font-mono leading-none">
                      天写作记录
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* echart 图表展示网格 (同一行) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-2">
              {/* 卡片 2: 记忆标签占比 */}
              <div className="bg-[#212121] rounded-[6px] border border-white/5 p-3 flex flex-col h-[400px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bookmark className="h-3.5 w-3.5 text-white/40" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
                    记忆标签占比
                  </span>
                </div>
                <div ref={doughnutChartRef} className="flex-1 w-full h-full" />
              </div>

              {/* 卡片 3: 每日行动与片段趋势 */}
              <div className="bg-[#212121] rounded-[6px] border border-white/5 p-3 flex flex-col h-[400px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-white/40" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
                    每日行动与片段趋势
                  </span>
                </div>
                <div ref={lineBarChartRef} className="flex-1 w-full h-full" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. 下部面板：时间溪流与周度总结各自独占一行 */}
        <div className="flex flex-col gap-6 w-full">
          {/* 左列：时间溪流 */}
          <div className="w-full flex flex-col bg-[#000000]">
            <div className="flex-shrink-0 mb-3 flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-white/60" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
                  时间溪流
                </h3>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {isLoading ? (
                <div className="flex items-center justify-center font-mono text-white/40 text-xs py-12">
                  正在追溯时光碎片...
                </div>
              ) : (
                weeklyData.map((day) => {
                  const isExpanded = expandedDates.includes(day.entryDate);
                  return (
                    <div
                      key={day.entryDate}
                      className={`group bg-[#212121] rounded-[6px] border transition-all duration-300 p-4 flex flex-col cursor-default ${
                        isExpanded
                          ? "border-white/15 bg-[#1a1a1a]"
                          : "border-white/5 hover:border-white/10"
                      }`}
                    >
                      <div
                        onClick={() => {
                          setExpandedDates((prev) =>
                            prev.includes(day.entryDate)
                              ? prev.filter((d) => d !== day.entryDate)
                              : [...prev, day.entryDate],
                          );
                        }}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold font-mono transition-colors ${
                              isExpanded
                                ? "text-white"
                                : "text-white/80 group-hover:text-white"
                            }`}
                          >
                            {day.weekdayName}
                          </span>
                          <span className="text-xs font-mono text-white/30 bg-black/40 px-1.5 py-0.5 rounded-[6px] border border-white/5">
                            {day.entryDate}
                          </span>
                          {/* 折叠时显示简单的徽章总结 */}
                          {!isExpanded && (
                            <div className="hidden sm:flex items-center gap-2 ml-3 text-xs text-white/40 font-mono">
                              <span>
                                {day.journal ? "📝 已写日记" : "📝 无日记"}
                              </span>
                              <span className="text-white/10">|</span>
                              <span>
                                ✅ 待办{" "}
                                {day.todos.filter((t) => t.completed).length}/
                                {day.todos.length}
                              </span>
                              <span className="text-white/10">|</span>
                              <span>🔖 片段 {day.snippets.length}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 animate-todo-item-enter pt-3 border-t border-white/[0.03]">
                          {/* A栏：日记正文策展高光 */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-white/40" />
                              <span className="text-xs font-mono uppercase tracking-wider text-white/30">
                                时光高光 / Journal
                              </span>
                            </div>
                            {day.journal ? (
                              <p className="text-xs text-white/70 leading-relaxed font-normal bg-black/30 p-2.5 rounded-[6px] border border-white/[0.03] break-all select-text max-h-[140px] overflow-y-auto custom-scrollbar">
                                {day.journal.content}
                              </p>
                            ) : (
                              <div className="text-xs text-white/20 font-mono py-4 bg-black/10 rounded-[6px] text-center border border-dashed border-white/5">
                                此日未执笔写日记
                              </div>
                            )}
                          </div>

                          {/* B栏：高内聚的待办列表与捕获的片段 */}
                          <div className="flex flex-col gap-3">
                            {/* 行动待办 */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-white/40" />
                                <span className="text-xs font-mono uppercase tracking-wider text-white/30">
                                  每日行动 / Todo (
                                  {
                                    day.todos.filter((t: any) => t.completed)
                                      .length
                                  }
                                  /{day.todos.length})
                                </span>
                              </div>
                              {day.todos.length === 0 ? (
                                <div className="text-xs text-white/20 font-mono py-1.5 bg-black/10 rounded-[6px] text-center">
                                  无行动待办
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 max-h-[85px] overflow-y-auto custom-scrollbar">
                                  {day.todos.map((todo: any) => (
                                    <div
                                      key={todo.id}
                                      className="flex items-center gap-2 text-xs text-white/65"
                                    >
                                      {todo.completed ? (
                                        <CheckCircle2 className="h-3 w-3 text-white/40 flex-shrink-0" />
                                      ) : (
                                        <Circle className="h-3 w-3 text-white/20 flex-shrink-0" />
                                      )}
                                      <span
                                        className={`truncate ${todo.completed ? "line-through text-white/30" : ""}`}
                                      >
                                        {todo.text}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* 记忆碎片 */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <Bookmark className="h-3.5 w-3.5 text-white/40" />
                                <span className="text-xs font-mono uppercase tracking-wider text-white/30">
                                  记忆碎片 / Snippets ({day.snippets.length})
                                </span>
                              </div>
                              {day.snippets.length === 0 ? (
                                <div className="text-xs text-white/20 font-mono py-1.5 bg-black/10 rounded-[6px] text-center">
                                  无捕获片段
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 max-h-[85px] overflow-y-auto custom-scrollbar">
                                  {day.snippets.map((snip: any) => (
                                    <div
                                      key={snip.id}
                                      className="text-xs text-white/65 flex items-center gap-1.5 truncate"
                                    >
                                      <span className="text-xs font-mono text-white/30 select-none">
                                        [{snip.time || "碎片"}]
                                      </span>
                                      <span className="truncate font-semibold">
                                        {snip.title || snip.content}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右列：周度总结 */}
          <div className="w-full flex flex-col bg-[#000000]">
            <WeeklySummaryPanel
              weekStartDate={getMonday(entryDate)}
              isEmpty={stats.totalTodos === 0 && stats.totalSnippets === 0 && stats.journalsCount === 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
