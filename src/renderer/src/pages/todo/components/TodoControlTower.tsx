import type React from "react";
import { useEffect, useRef } from "react";
import * as echarts from "echarts";

// Todo 控制塔属性。
interface TodoControlTowerProps {
  // 任务总数。
  totalCount: number;
  // 已完成数量。
  completedCount: number;
  // 未完成 P0 数量。
  p0Count: number;
}

/**
 * TodoControlTower - 待办页右侧统计和动作侧栏，使用 ECharts 展示竖直柱形图。
 */
export const TodoControlTower = ({
  totalCount,
  completedCount,
  p0Count,
}: TodoControlTowerProps): React.JSX.Element => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const pendingCount = totalCount - completedCount;

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const uncompletedOtherCount = Math.max(0, pendingCount - p0Count);

    const option = {
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
      grid: {
        top: 30,
        bottom: 25,
        left: 20,
        right: 20,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: ["已完成", "P0聚焦", "未完成"],
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
      yAxis: {
        type: "value",
        name: "COUNT",
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
      series: [
        {
          type: "bar",
          data: [
            {
              value: completedCount,
              itemStyle: { color: "#ffffff", borderRadius: [3, 3, 0, 0] },
            },
            {
              value: p0Count,
              itemStyle: { color: "#f87171", borderRadius: [3, 3, 0, 0] },
            },
            {
              value: uncompletedOtherCount,
              itemStyle: {
                color: "rgba(255, 255, 255, 0.12)",
                borderRadius: [3, 3, 0, 0],
              },
            },
          ],
          barWidth: 16,
          label: {
            show: true,
            position: "top",
            color: "rgba(255,255,255,0.8)",
            fontSize: 11,
            fontFamily: "monospace",
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [totalCount, completedCount, p0Count, pendingCount]);

  return (
    <aside className="flex min-h-0 flex-col gap-4 rounded-[6px] border border-white/6 bg-[#212121] p-4 flex-shrink-0">
      {/* 图表模块 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <span className="text-sm font-bold text-white/80">待办分布</span>
        </div>

        {totalCount === 0 ? (
          <div className="flex items-center justify-center text-xs text-white/30 py-8 w-full">
            暂无数据
          </div>
        ) : (
          <div className="h-[180px] w-full relative">
            <div ref={chartRef} className="absolute inset-0 w-full h-full" />
          </div>
        )}
      </div>
    </aside>
  );
};
