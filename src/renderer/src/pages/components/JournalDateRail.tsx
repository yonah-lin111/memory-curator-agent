import type React from "react";
import { BookOpen, Clock3, Focus, Sparkles, Trash2 } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";

// 日记侧栏属性。
interface JournalDateRailProps {
  // 当前日期。
  entryDate: string;
  // 当前字数。
  wordCount: number;
  // 最近保存时间。
  lastSavedAt: string | null;
  // 情绪线索文案。
  moodLabel: string;
  // 是否存在未保存改动。
  isDirty: boolean;
  // 清空回调。
  onClear: () => void;
  // 聚焦编辑器回调。
  onFocusEditor: () => void;
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
  entryDate,
  wordCount,
  lastSavedAt,
  moodLabel,
  isDirty,
  onClear,
  onFocusEditor,
}: JournalDateRailProps): React.JSX.Element => {
  // 最近保存时间展示值。
  const savedLabel =
    lastSavedAt?.slice(-5) ?? (isDirty ? "等待保存" : "未保存");

  return (
    <aside className="flex min-h-0 flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/28">
          Journal Spine
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
          {entryDate}
        </p>
      </div>

      <div className="grid gap-2">
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

      <div className="mt-auto flex items-center gap-2">
        <IconButton
          aria-label="聚焦日记编辑器"
          className="h-9 px-3 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          iconOnly={false}
          onClick={onFocusEditor}
        >
          <Focus className="mr-1.5 h-3.5 w-3.5" />
          聚焦
        </IconButton>
        <IconButton
          aria-label="清空当日日记"
          className="h-9 px-3 bg-white/5 text-white/70 hover:bg-white/10 hover:text-rose-300"
          iconOnly={false}
          onClick={onClear}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {isDirty ? "清空草稿" : "清空"}
        </IconButton>
      </div>
    </aside>
  );
};
