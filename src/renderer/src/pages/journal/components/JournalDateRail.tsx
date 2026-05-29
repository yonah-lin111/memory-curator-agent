import type React from "react";
import { BookOpen, Clock3, Sparkles } from "lucide-react";

// 日记侧栏属性。
interface JournalDateRailProps {
  // 当前字数。
  wordCount: number;
  // 最近保存时间。
  lastSavedAt: string | null;
  // 情绪线索文案。
  moodLabel: string;
  // 是否存在未保存改动。
  isDirty: boolean;
}

// 左侧指标卡片属性。
interface JournalMetricCardProps {
  // 指标图标。
  icon: React.ReactNode;
  // 指标标题。
  label: string;
  // 指标值。
  value: string | number;
}

/**
 * JournalMetricCard - 日记侧栏指标卡。
 */
const JournalMetricCard = ({
  icon,
  label,
  value,
}: JournalMetricCardProps): React.JSX.Element => (
  <div className="rounded-[6px] border border-white/8 bg-black/30 p-3">
    <div className="flex items-center gap-2 text-white/72">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p className="mt-2 text-sm font-semibold text-white">{value}</p>
  </div>
);

/**
 * JournalDateRail - 日记页左侧日期脊柱和状态摘要。
 */
export const JournalDateRail = ({
  wordCount,
  lastSavedAt,
  moodLabel,
  isDirty,
}: JournalDateRailProps): React.JSX.Element => {
  // 最近保存时间展示值。
  const savedLabel =
    lastSavedAt?.slice(-5) ?? (isDirty ? "等待保存" : "未保存");

  return (
    <aside className="flex min-h-0 flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
      <div className="grid grid-cols-2 gap-2">
        <JournalMetricCard
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="字数"
          value={wordCount}
        />
        <JournalMetricCard
          icon={<Clock3 className="h-3.5 w-3.5" />}
          label="最近保存"
          value={savedLabel}
        />
        <JournalMetricCard
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="情绪线索"
          value={moodLabel}
        />
      </div>
    </aside>
  );
};
