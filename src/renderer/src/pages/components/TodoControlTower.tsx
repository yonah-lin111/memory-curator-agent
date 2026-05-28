import type React from "react";
import { CheckCircle2, Layers3, ListTodo } from "lucide-react";

// Todo 控制塔属性。
interface TodoControlTowerProps {
  // 任务总数。
  totalCount: number;
  // 已完成数量。
  completedCount: number;
  // 未完成 P0 数量。
  p0Count: number;
}

// 统计卡片属性。
interface TodoMetricCardProps {
  // 指标图标。
  icon: React.ReactNode;
  // 指标名称。
  label: string;
  // 指标数值。
  value: number;
}

/**
 * TodoMetricCard - Todo 统计卡片。
 */
const TodoMetricCard = ({
  icon,
  label,
  value,
}: TodoMetricCardProps): React.JSX.Element => (
  <div className="rounded-[6px] border border-white/8 bg-black/30 p-3">
    <div className="flex items-center gap-2 text-white/70">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
  </div>
);

/**
 * TodoControlTower - 待办页右侧统计和动作侧栏。
 */
export const TodoControlTower = ({
  totalCount,
  completedCount,
  p0Count,
}: TodoControlTowerProps): React.JSX.Element => (
  <aside className="flex min-h-0 flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
    <TodoMetricCard
      icon={<ListTodo className="h-3.5 w-3.5" />}
      label="总任务"
      value={totalCount}
    />
    <TodoMetricCard
      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
      label="已完成"
      value={completedCount}
    />
    <TodoMetricCard
      icon={<Layers3 className="h-3.5 w-3.5" />}
      label="P0 聚焦"
      value={p0Count}
    />
  </aside>
);
