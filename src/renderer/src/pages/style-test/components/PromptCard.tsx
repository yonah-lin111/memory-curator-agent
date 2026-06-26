import type React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Handle, Position } from "@xyflow/react";

/**
 * 提示词卡片组件的 Props
 */
interface PromptCardProps {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  updatedAt: number;
  isSelected?: boolean;
  onDelete?: () => void;
  onAddCard?: () => void;
}

/**
 * 提示词卡片组件
 */
export const PromptCard = ({
  title,
  content,
  tags = [],
  updatedAt,
  isSelected = false,
  onDelete,
  onAddCard,
}: PromptCardProps): React.JSX.Element => {
  // 格式化时间为 mm-dd HH:MM 格式
  const formattedTime = new Date(updatedAt)
    .toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/\//g, "-");

  return (
    <div className="relative group w-[280px]">
      {/* 所有的连接点容器 */}
      <div
        className={`absolute -inset-[30px] z-10 pointer-events-none transition-opacity duration-300 delay-500 opacity-0 group-hover:opacity-100 group-hover:delay-0`}
      >
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="!w-4 !h-4 bg-[#212121] border-2 border-white/40 hover:bg-white/80 transition-colors pointer-events-auto"
          style={{ top: 16, left: "50%" }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-4 !h-4 bg-[#212121] border-2 border-white/40 hover:bg-white/80 transition-colors pointer-events-auto"
          style={{ left: 16 }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-4 !h-4 bg-[#212121] border-2 border-white/40 hover:bg-white/80 transition-colors pointer-events-auto"
          style={{ right: 16 }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!w-4 !h-4 bg-[#212121] border-2 border-white/40 hover:bg-white/80 transition-colors pointer-events-auto"
          style={{ bottom: 16, left: "50%" }}
        />
      </div>

      <div
        className={`
          relative flex flex-col gap-2 rounded-[6px] p-3 transition-colors duration-200 cursor-grab active:cursor-grabbing z-20
          ${
            isSelected
              ? "bg-[#212121] border border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
              : "bg-[#212121] border border-white/5 hover:border-white/10"
          }
        `}
      >
        {/* 顶部：标题和标签 */}
        <div className="flex flex-col gap-1.5 pointer-events-none">
          <span className="text-sm font-bold text-white/90 truncate">
            {title}
          </span>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-1.5 py-0.5 rounded-[4px] bg-white/5 text-[12px] text-white/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 中部：内容预览 */}
        <div className="text-[12px] text-white/50 line-clamp-3 min-h-[54px] leading-relaxed pointer-events-none">
          {content || "无内容"}
        </div>

        {/* 底部：时间与操作栏 */}
        <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/5 pointer-events-none">
          <span className="text-[12px] text-white/30">{formattedTime}</span>

          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative z-30 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()} // 阻止拖拽冒泡，允许点击按钮
          >
            <button
              type="button"
              className="p-1 rounded-[4px] hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              title="新建并关联卡片"
              onClick={(e) => {
                e.stopPropagation();
                onAddCard?.();
              }}
            >
              <Plus size={14} />
            </button>

            <button
              type="button"
              className="p-1 rounded-[4px] hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
