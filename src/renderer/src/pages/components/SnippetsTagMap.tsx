import type React from "react";

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
}

/**
 * SnippetsTagMap - 片段页左侧标签地图。
 */
export const SnippetsTagMap = ({
  tags,
  activeTag,
  onChange,
  onCreateNew,
}: SnippetsTagMapProps): React.JSX.Element => (
  <aside className="flex min-h-0 flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/28">
        Tag Map
      </p>
      <p className="mt-1 text-sm text-white/82">按标签切片查看当天片段。</p>
    </div>

    <button
      aria-label="创建新片段"
      className="rounded-[6px] border border-white/8 bg-white text-left text-sm font-semibold text-black px-3 py-2 transition-colors hover:bg-white/90"
      type="button"
      onClick={onCreateNew}
    >
      新建片段
    </button>

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

    <div className="flex flex-wrap gap-2">
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
          {tag.value} · {tag.count}
        </button>
      ))}
    </div>
  </aside>
);
