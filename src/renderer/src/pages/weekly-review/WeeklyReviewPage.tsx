import type React from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import * as echarts from "echarts";
import { useHeaderStore } from "@/lib/headerStore";
import { useToast } from "@/components/ui/Toast";
import { PageDateNavigator } from "@/components/ui/PageDateNavigator";
import {
  createTodayEntryDate,
  shiftEntryDate,
  getMonday,
} from "@/lib/dailyShared";
import {
  Bookmark,
  CheckCircle2,
  Circle,
  StickyNote,
  BookOpen,
  Calendar,
  TrendingUp,
  Sparkles,
  Receipt,
  CheckSquare,
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
  // 当日账单数据
  bills: any[];
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
  // 账单费用分类饼图的 DOM 容器引用
  const billPieChartRef = useRef<HTMLDivElement | null>(null);

  // 环形图 ECharts 实例引用
  const doughnutInstance = useRef<echarts.ECharts | null>(null);
  // 折线柱状图 ECharts 实例引用
  const lineBarInstance = useRef<echarts.ECharts | null>(null);
  // 账单饼图 ECharts 实例引用
  const billPieInstance = useRef<echarts.ECharts | null>(null);

  /**
   * 将周度导航器 PageDateNavigator 挂载发布到全局 Header 栏
   */
  useEffect(() => {
    setDateNavigator(
      <PageDateNavigator
        mode="week"
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
            let bills: any[] = [];
            if (window.api?.bill) {
              bills = await window.api.bill.list({ billDate: d });
            }
            return {
              entryDate: d,
              weekdayName: WEEKDAYS_ZH[index],
              todos: data.todos || [],
              snippets: data.snippets || [],
              journal: data.journal || null,
              bills,
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
    // 账单总数
    let totalBills = 0;
    // 临时记录标签频次的 map 映射
    const tagsMap: Record<string, number> = {};

    weeklyData.forEach((day) => {
      totalTodos += day.todos.length;
      completedTodos += day.todos.filter((t) => t.completed).length;
      highPriorityCount += day.todos.filter(
        (t) => t.priority === "high" || t.priority === 3,
      ).length;
      totalSnippets += day.snippets.length;
      totalBills += day.bills.length;
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

    // 计算本周总收入与支出，以及收支分类数据
    let totalExpense = 0;
    let totalIncome = 0;
    const expenseCategoryMap: Record<string, number> = {};
    const incomeCategoryMap: Record<string, number> = {};

    weeklyData.forEach((day) => {
      day.bills.forEach((bill) => {
        const cat = bill.category || "其他";
        if (bill.billType === "expense") {
          totalExpense += bill.amount;
          expenseCategoryMap[cat] =
            (expenseCategoryMap[cat] || 0) + bill.amount;
        } else if (bill.billType === "income") {
          totalIncome += bill.amount;
          incomeCategoryMap[cat] = (incomeCategoryMap[cat] || 0) + bill.amount;
        }
      });
    });

    const expenseCategoryData = Object.entries(expenseCategoryMap)
      .map(([name, value]) => ({
        name,
        value: Number((value / 100).toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value);

    const incomeCategoryData = Object.entries(incomeCategoryMap)
      .map(([name, value]) => ({
        name,
        value: Number((value / 100).toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalTodos,
      completedTodos,
      completionRate,
      highPriorityCount,
      totalSnippets,
      journalsCount,
      totalBills,
      topTags,
      totalExpense,
      totalIncome,
      expenseCategoryData,
      incomeCategoryData,
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

      const journalSeries = weeklyData.map((day) => (day.journal ? 1 : 0));
      const expenseSeries = weeklyData.map((day) =>
        Number(
          (
            day.bills
              .filter((b) => b.billType === "expense")
              .reduce((sum, b) => sum + b.amount, 0) / 100
          ).toFixed(2),
        ),
      );
      const incomeSeries = weeklyData.map((day) =>
        Number(
          (
            day.bills
              .filter((b) => b.billType === "income")
              .reduce((sum, b) => sum + b.amount, 0) / 100
          ).toFixed(2),
        ),
      );

      lineBarInstance.current.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(26, 26, 26, 0.9)",
          borderColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          textStyle: {
            color: "#ffffff",
            fontSize: 12,
            fontFamily: "monospace",
          },
          axisPointer: {
            type: "shadow",
            shadowStyle: { color: "rgba(255,255,255,0.05)" },
          },
          padding: [12, 16],
          extraCssText:
            "box-shadow: 0 8px 32px rgba(0,0,0,0.8); backdrop-filter: blur(8px); border-radius: 8px;",
        },
        legend: {
          data: ["已完成待办", "未完成待办", "片段", "日记", "支出", "收入"],
          textStyle: {
            color: "rgba(255,255,255,0.6)",
            fontSize: 11,
            fontFamily: "monospace",
          },
          top: 0,
          left: "center",
          icon: "circle",
          itemWidth: 8,
          itemHeight: 8,
          itemGap: 16,
        },
        grid: {
          top: 50,
          bottom: 25,
          left: 20,
          right: 20,
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: days,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(255,255,255,0.3)",
            fontSize: 11,
            fontFamily: "monospace",
            margin: 12,
          },
          boundaryGap: true,
        },
        yAxis: [
          {
            type: "value",
            name: "RECORD COUNT",
            nameTextStyle: {
              color: "rgba(255,255,255,0.2)",
              fontSize: 10,
              fontFamily: "monospace",
              padding: [0, 20, 0, 0],
            },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: {
              show: true,
              lineStyle: { color: "rgba(255,255,255,0.04)", type: "dashed" },
            },
            axisLabel: {
              color: "rgba(255,255,255,0.3)",
              fontSize: 10,
              fontFamily: "monospace",
            },
            minInterval: 1,
          },
          {
            type: "value",
            name: "AMOUNT (¥)",
            nameTextStyle: {
              color: "rgba(255,255,255,0.2)",
              fontSize: 10,
              fontFamily: "monospace",
              padding: [0, 0, 0, 20],
            },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: {
              color: "rgba(255,255,255,0.3)",
              fontSize: 10,
              fontFamily: "monospace",
            },
          },
        ],
        series: [
          {
            name: "已完成待办",
            type: "bar",
            stack: "todo",
            itemStyle: {
              color: "#ffffff",
              borderRadius: [3, 3, 0, 0],
            },
            barWidth: 16,
            data: todoCompletedSeries,
          },
          {
            name: "未完成待办",
            type: "bar",
            stack: "todo",
            itemStyle: {
              color: "rgba(255, 255, 255, 0.12)",
              borderRadius: [3, 3, 0, 0],
            },
            barWidth: 16,
            data: todoTotalSeries.map(
              (tot, idx) => tot - todoCompletedSeries[idx],
            ),
          },
          {
            name: "片段",
            type: "line",
            itemStyle: {
              color: "#60a5fa",
            },
            lineStyle: {
              color: "#60a5fa",
              width: 2,
            },
            data: snippetSeries,
          },
          {
            name: "日记",
            type: "line",
            itemStyle: {
              color: "#c084fc",
            },
            lineStyle: {
              color: "#c084fc",
              width: 2,
              type: "dashed",
            },
            data: journalSeries,
          },
          {
            name: "支出",
            type: "line",
            yAxisIndex: 1,
            itemStyle: {
              color: "#f87171",
            },
            lineStyle: {
              color: "#f87171",
              width: 2,
            },
            data: expenseSeries,
          },
          {
            name: "收入",
            type: "line",
            yAxisIndex: 1,
            itemStyle: {
              color: "#4ade80",
            },
            lineStyle: {
              color: "#4ade80",
              width: 2,
            },
            data: incomeSeries,
          },
        ],
      });
    }

    // 3. 初始化或配置账单双层嵌套环形图 (旭日图效果)
    if (billPieChartRef.current) {
      if (!billPieInstance.current) {
        billPieInstance.current = echarts.init(billPieChartRef.current);
      }

      const totalIncomeYuan = Number((stats.totalIncome / 100).toFixed(2));
      const totalExpenseYuan = Number((stats.totalExpense / 100).toFixed(2));

      // 内圈数据：总收支
      const innerData: Array<{
        name: string;
        value: number;
        itemStyle: { color: string };
      }> = [];
      if (totalIncomeYuan > 0) {
        innerData.push({
          name: "总收入",
          value: totalIncomeYuan,
          itemStyle: { color: "#4ade80" },
        });
      }
      if (totalExpenseYuan > 0) {
        innerData.push({
          name: "总支出",
          value: totalExpenseYuan,
          itemStyle: { color: "#f87171" },
        });
      }
      if (innerData.length === 0) {
        innerData.push({
          name: "无收支",
          value: 1,
          itemStyle: { color: "rgba(255,255,255,0.05)" },
        });
      }

      // 外圈数据：收支细分
      const outerData = [
        ...stats.incomeCategoryData.map((item) => ({
          ...item,
          itemStyle: { color: "rgba(74, 222, 128, 0.7)" },
        })),
        ...stats.expenseCategoryData.map((item) => ({
          ...item,
          itemStyle: { color: "rgba(248, 113, 113, 0.7)" },
        })),
      ];

      billPieInstance.current.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          backgroundColor: "#212121",
          borderColor: "rgba(255,255,255,0.1)",
          textStyle: { color: "#ffffff", fontSize: 12 },
          formatter: "{b}: ¥{c} ({d}%)",
        },
        legend: {
          show: false,
        },
        series: [
          {
            name: "收支大类",
            type: "pie",
            radius: ["20%", "40%"],
            label: {
              show: false,
              position: "inner",
            },
            labelLine: {
              show: false,
            },
            itemStyle: {
              borderColor: "#212121",
              borderWidth: 1.5,
            },
            data: innerData,
          },
          {
            name: "细分分类",
            type: "pie",
            radius: ["45%", "65%"],
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
              outerData.length > 0
                ? outerData
                : [
                    {
                      name: "",
                      value: 0,
                      label: { show: false },
                      labelLine: { show: false },
                    },
                  ],
          },
        ],
      });
    }

    // 处理视窗 Resize 动态重绘，避免图表拉伸错位
    const handleResize = (): void => {
      doughnutInstance.current?.resize();
      lineBarInstance.current?.resize();
      billPieInstance.current?.resize();
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
      billPieInstance.current?.dispose();
      doughnutInstance.current = null;
      lineBarInstance.current = null;
      billPieInstance.current = null;
    };
  }, []);

  return (
    <section
      aria-label="Weekly Review Page"
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto custom-scrollbar text-white text-sm"
    >
      <div className="flex-1 flex flex-col gap-4">
        {/* 1. 上部面板：数据透视 (Dashboard) */}
        <div className="flex flex-col gap-3 w-full">
          {/* 卡片 1: 周数据透视 (独占一行，高度自适应，内部卡片水平排列) */}
          <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col h-auto relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-white/60" />
                <span className="text-sm font-bold tracking-wide text-white/80">
                  周数据透视
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
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
              <div className="bg-black/40 p-4 rounded-[6px] border border-white/5 flex flex-col justify-between h-[90px]">
                <span className="text-xs text-white/30 font-mono leading-none">
                  收支总览
                </span>
                <div className="flex flex-col gap-1 mt-1 justify-end h-full">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-white/30 font-mono leading-none">
                      支
                    </span>
                    <span className="text-sm font-bold text-red-400/80 leading-none">
                      ¥{(stats.totalExpense / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-white/30 font-mono leading-none">
                      收
                    </span>
                    <span className="text-sm font-bold text-green-400/80 leading-none">
                      ¥{(stats.totalIncome / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* echart 图表展示网格 - 第一行：每日行动与片段趋势 (独占一行) */}
          <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col h-[60vh] mb-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-white/60" />
                <span className="text-sm font-bold tracking-wide text-white/80">
                  每日各项记录趋势
                </span>
              </div>
            </div>
            <div ref={lineBarChartRef} className="flex-1 w-full h-full" />
          </div>

          {/* echart 图表展示网格 - 第二行：账单分类与片段标签占比 (并排) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-2">
            {/* 卡片: 收支分类占比 */}
            <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col h-[400px]">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-white/60" />
                  <span className="text-sm font-bold tracking-wide text-white/80">
                    收支分类占比
                  </span>
                </div>
              </div>
              <div ref={billPieChartRef} className="flex-1 w-full h-full" />
            </div>

            {/* 卡片: 片段标签占比 */}
            <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col h-[400px]">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-white/60" />
                  <span className="text-sm font-bold tracking-wide text-white/80">
                    片段标签占比
                  </span>
                </div>
              </div>
              <div ref={doughnutChartRef} className="flex-1 w-full h-full" />
            </div>
          </div>
        </div>

        {/* 2. 下部面板：时间溪流与周度总结各自独占一行 */}
        <div className="flex flex-col gap-6 w-full">
          {/* 时间溪流 - Origami 律动风琴 */}
          <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-white/60" />
                <span className="text-sm font-bold tracking-wide text-white/80">
                  时间溪流 (Time Stream)
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center font-mono text-white/40 text-xs py-12">
                正在追溯时光碎片...
              </div>
            ) : (
              <div className="flex w-full gap-2 h-[500px]">
                {weeklyData.map((day) => {
                  const isActive = expandedDates[0] === day.entryDate;

                  const completedTodos = day.todos.filter(
                    (t: any) => t.completed,
                  ).length;
                  const totalTodos = day.todos.length;
                  const snippetsCount = day.snippets.length;
                  const billsCount = day.bills.length;
                  const hasJournal = !!day.journal;

                  return (
                    <div
                      key={day.entryDate}
                      onClick={() => {
                        if (!isActive) {
                          setExpandedDates([day.entryDate]);
                        }
                      }}
                      className={`relative flex flex-col rounded-[8px] border transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${
                        isActive
                          ? "flex-[8] border-white/20 bg-[#1a1a1a] shadow-lg cursor-default"
                          : "flex-[1] border-white/5 bg-[#212121] hover:bg-[#2a2a2a] hover:border-white/10 cursor-pointer"
                      }`}
                    >
                      {/* UNEXPANDED */}
                      <div
                        className={`absolute inset-0 flex flex-col items-center py-4 transition-opacity duration-300 ${
                          isActive
                            ? "opacity-0 pointer-events-none"
                            : "opacity-100"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold text-white/60 whitespace-nowrap">
                            {day.weekdayName}
                          </span>
                          <span className="text-[10px] font-mono text-white/30">
                            {day.entryDate.substring(5)}
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col justify-end items-center gap-2 pb-2">
                          {hasJournal && (
                            <div
                              className="w-1.5 h-1.5 rounded-full bg-[#c084fc] shadow-[0_0_5px_#c084fc]"
                              title="已写日记"
                            />
                          )}
                          {totalTodos > 0 && (
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${completedTodos === totalTodos ? "bg-[#fb923c] shadow-[0_0_5px_#fb923c]" : "bg-[#fb923c]/30"}`}
                              title={`待办 ${completedTodos}/${totalTodos}`}
                            />
                          )}
                          {snippetsCount > 0 && (
                            <div
                              className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] shadow-[0_0_5px_#60a5fa]"
                              title={`碎片 ${snippetsCount}`}
                            />
                          )}
                          {billsCount > 0 && (
                            <div
                              className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"
                              title={`账单 ${billsCount}`}
                            />
                          )}
                        </div>
                      </div>

                      {/* EXPANDED */}
                      <div
                        className={`absolute inset-0 p-5 flex flex-col transition-all duration-700 delay-100 ${
                          isActive
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-4 pointer-events-none"
                        }`}
                      >
                        <div className="w-full h-full flex flex-col min-w-0">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5 flex-shrink-0">
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                              <span className="text-sm font-bold text-white/90 tracking-wide flex-shrink-0">
                                {day.weekdayName}
                              </span>
                              <span className="text-xs font-mono text-white/40 flex-shrink-0">
                                {day.entryDate}
                              </span>
                            </div>
                            <div className="flex gap-4 pr-6 flex-shrink-0">
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-[#c084fc]/70 font-mono uppercase">
                                  Journal
                                </span>
                                <span className="text-xs font-bold text-white/80">
                                  {hasJournal ? "✓" : "-"}
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-[#4ade80]/70 font-mono uppercase">
                                  Bills
                                </span>
                                <span className="text-xs font-bold text-white/80">
                                  {billsCount}
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-[#fb923c]/70 font-mono uppercase">
                                  Todos
                                </span>
                                <span className="text-xs font-bold text-white/80">
                                  {completedTodos}/{totalTodos}
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-[#60a5fa]/70 font-mono uppercase">
                                  Snippets
                                </span>
                                <span className="text-xs font-bold text-white/80">
                                  {snippetsCount}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Content Stream */}
                           <div className="flex-1 flex flex-col gap-5 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] pr-2 pb-2">
                            {/* Journal */}
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1.5">
                                <BookOpen className="h-3.5 w-3.5 text-[#c084fc]/70" />
                                <span className="text-xs font-mono uppercase tracking-wider text-white/40">
                                  Journal
                                </span>
                              </div>
                              {hasJournal ? (
                                <div className="text-sm text-white/80 leading-relaxed font-normal bg-black/40 p-3.5 rounded-[6px] border border-white/5 whitespace-pre-wrap">
                                  {day.journal.content}
                                </div>
                              ) : (
                                <div className="text-xs text-white/20 font-mono py-6 bg-black/20 rounded-[6px] text-center border border-dashed border-white/5">
                                  此日未留墨迹
                                </div>
                              )}
                            </div>

                            {/* Todos */}
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1.5">
                                <CheckSquare className="h-3.5 w-3.5 text-[#fb923c]/70" />
                                <span className="text-xs font-mono uppercase tracking-wider text-white/40">
                                  Todo
                                </span>
                              </div>
                              {totalTodos === 0 ? (
                                <div className="text-xs text-white/20 font-mono py-4 bg-black/20 rounded-[6px] text-center border border-white/5">
                                  无行动待办
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {day.todos.map((todo: any) => (
                                    <div
                                      key={todo.id}
                                      className="group/todo flex items-start gap-2.5 bg-black/20 p-2.5 rounded-[6px] border border-white/5 hover:border-white/10 transition-colors"
                                    >
                                      {todo.completed ? (
                                        <CheckCircle2 className="h-4 w-4 text-white/40 flex-shrink-0 mt-0.5" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-white/40 flex-shrink-0 mt-0.5" />
                                      )}
                                      <span
                                        className={`text-sm leading-snug ${todo.completed ? "line-through text-white/30" : "text-white/70 group-hover/todo:text-white/90"}`}
                                      >
                                        {todo.text}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Snippets */}
                            {snippetsCount > 0 && (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-1.5">
                                  <StickyNote className="h-3.5 w-3.5 text-[#60a5fa]/70" />
                                  <span className="text-xs font-mono uppercase tracking-wider text-white/40">
                                    Snippets ({snippetsCount})
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {day.snippets.map((snip: any) => (
                                    <div
                                      key={snip.id}
                                      className="flex flex-col gap-1 bg-black/30 px-3 py-2 rounded-[6px] border border-white/5 hover:border-white/10 max-w-full"
                                    >
                                      <span className="text-xs font-mono text-white/30">
                                        {snip.time || "碎片"}
                                      </span>
                                      <span className="text-sm text-white/70 truncate">
                                        {snip.title || snip.content}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Bills */}
                            {billsCount > 0 && (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Receipt className="h-3.5 w-3.5 text-[#4ade80]/70" />
                                  <span className="text-xs font-mono uppercase tracking-wider text-white/40">
                                    Bills ({billsCount})
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1.5 bg-black/20 p-2 rounded-[6px] border border-white/5">
                                  {day.bills.map((bill: any) => (
                                    <div
                                      key={bill.id}
                                      className="flex justify-between items-center text-xs p-1.5 rounded hover:bg-white/5 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`w-1.5 h-1.5 rounded-full ${bill.billType === "expense" ? "bg-[#f87171]" : "bg-[#4ade80]"}`}
                                        />
                                        <span className="text-white/60">
                                          {bill.category}
                                        </span>
                                        {bill.note && (
                                          <span className="text-white/30 truncate max-w-[80px]">
                                            - {bill.note}
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className={`font-mono font-bold ${bill.billType === "expense" ? "text-red-400/80" : "text-green-400/80"}`}
                                      >
                                        {bill.billType === "expense"
                                          ? "-"
                                          : "+"}
                                        ¥{(bill.amount / 100).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
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

          {/* 周度总结 */}
          <WeeklySummaryPanel
            weekStartDate={getMonday(entryDate)}
            isEmpty={
              isLoading ||
              (stats.totalTodos === 0 &&
                stats.totalSnippets === 0 &&
                stats.journalsCount === 0 &&
                stats.totalBills === 0)
            }
          />
        </div>
      </div>
    </section>
  );
};
