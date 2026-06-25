import type React from "react";
import { RotateCcw } from "lucide-react";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconButton } from "@/components/ui/IconButton";

// 标签地图属性。
interface SnippetsTagMapProps {
  // 标签统计列表。
  tags: Array<{ value: string; count: number }>;
  // 当前激活标签。
  activeTag: string | null;
  // 标签切换回调。
  onChange: (tag: string | null) => void;
}

/**
 * SnippetsTagMap - 片段页右侧侧栏。
 */
export const SnippetsTagMap = ({
  tags,
  activeTag,
  onChange,
}: SnippetsTagMapProps): React.JSX.Element => (
  <aside className="flex min-h-0 w-full lg:w-[300px] flex-col gap-4 rounded-[6px] border border-white/6 bg-[#212121] p-4 flex-shrink-0">
    <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-shrink-0 mb-[-8px]">
      <span className="text-sm font-bold text-white/80">条件筛选</span>
      <Tooltip placement="bottom" title="重置全部筛选条件">
        <IconButton
          size="medium"
          onClick={() => onChange(null)}
          className="text-white/40 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
        </IconButton>
      </Tooltip>
    </div>

    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-bold text-white/80">标签筛选</span>
      </div>
      <div className="flex flex-wrap gap-1.5 overflow-y-scroll custom-scrollbar max-h-[300px] pr-0.5">
        {tags.length === 0 ? (
          <span className="text-xs text-white/30 py-4 text-center w-full">
            暂无标签
          </span>
        ) : (
          <>
            <Tag
              highlighted={activeTag === null}
              onClick={() => onChange(null)}
              className="font-medium cursor-pointer"
            >
              全部
            </Tag>
            {tags.map((tag) => (
              <Tag
                key={tag.value}
                highlighted={activeTag === tag.value}
                onClick={() =>
                  onChange(activeTag === tag.value ? null : tag.value)
                }
                className="font-medium cursor-pointer"
                prefix="#"
              >
                {tag.value}
              </Tag>
            ))}
          </>
        )}
      </div>
    </div>
  </aside>
);
