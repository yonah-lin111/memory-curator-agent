import type React from "react";
import { StickyNote, Tag as TagIcon, Clock3, Plus } from "lucide-react";

// 标签地图属性。
interface SnippetsTagMapProps {
  // 标签统计列表。
  tags: Array<{ value: string; count: number }>;
  // 当前激活标签。
  activeTag: string | null;
  // 标签切换回调。
  onChange: (tag: string | null) => void;
  // 新建片段回调。
  onCreateNew: () => void;
  // 片段总数。
  totalCount: number;
  // 标签总数。
  totalTagsCount: number;
  // 最近更新时间。
  lastUpdatedTime: string;
}

// 侧栏指标卡属性。
interface SnippetsMetricCardProps {
  // 指标图标。
  icon: React.ReactNode;
  // 指标标题。
  label: string;
  // 指标值。
  value: string | number;
}

/**
 * SnippetsMetricCard - 片段侧栏指标卡。
 */
const SnippetsMetricCard = ({
  icon,
  label,
  value,
}: SnippetsMetricCardProps): React.JSX.Element => (
  <div className="rounded-[6px] border border-white/8 bg-black/30 p-3">
    <div className="flex items-center gap-2 text-white/72">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p className="mt-2 text-sm font-semibold text-white">{value}</p>
  </div>
);

/**
 * SnippetsTagMap - 片段页右侧侧栏。
 */
export const SnippetsTagMap = ({
  tags,
  activeTag,
  onChange,
  onCreateNew,
  totalCount,
  totalTagsCount,
  lastUpdatedTime,
}: SnippetsTagMapProps): React.JSX.Element => (
  <aside className="flex min-h-0 flex-col gap-4 rounded-[6px] border border-white/6 bg-[#212121] p-4">
    <button
      aria-label="创建新片段"
      className="flex items-center justify-center gap-2 rounded-[6px] border border-white/8 bg-white text-center text-sm font-semibold text-black px-3 py-2 transition-colors hover:bg-white/90"
      type="button"
      onClick={onCreateNew}
    >
      <Plus className="h-4 w-4" />
      新建片段
    </button>

    <div className="grid gap-2">
      <SnippetsMetricCard
        icon={<StickyNote className="h-3.5 w-3.5" />}
        label="片段总数"
        value={totalCount}
      />
      <SnippetsMetricCard
        icon={<TagIcon className="h-3.5 w-3.5" />}
        label="使用标签"
        value={totalTagsCount}
      />
      <SnippetsMetricCard
        icon={<Clock3 className="h-3.5 w-3.5" />}
        label="最近更新"
        value={lastUpdatedTime}
      />
    </div>

    <div className="border-t border-white/5 pt-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/28">
        Tag Map
      </p>
      <p className="mt-1 text-xs text-white/46">按标签切片查看当天片段。</p>
    </div>

    <button
      className={`rounded-[6px] border px-3 py-2 text-left text-sm transition-colors ${
        activeTag === null
          ? "border-white/18 bg-white/12 text-white"
          : "border-white/8 bg-black/25 text-white/84 hover:border-white/16 hover:bg-black/35"
      }`}
      type="button"
      onClick={() => onChange(null)}
    >
      全部片段
    </button>

    <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-0.5">
      {tags.map((tag) => (
        <button
          key={tag.value}
          aria-label={`筛选标签 ${tag.value}`}
          className={`rounded-[6px] border px-2.5 py-1 text-xs font-semibold transition-colors ${
            activeTag === tag.value
              ? "border-white/18 bg-white/12 text-white"
              : "border-white/8 bg-black/25 text-white/62 hover:border-white/16 hover:text-white"
          }`}
          type="button"
          onClick={() => onChange(tag.value)}
        >
          #{tag.value} · {tag.count}
        </button>
      ))}
    </div>
  </aside>
);
