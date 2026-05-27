import type React from "react";
import { useState } from "react";
import { StickyNote, Plus, Trash2, Tag as TagIcon } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import { Tag } from "@renderer/components/ui/Tag";
import type { NoteItem } from "./TodayNoteEntryModal";

interface TodayThoughtsPanelProps {
  // 自由随记卡片列表
  notes: NoteItem[];
  // 新增随记卡片回调
  onAddNote: () => void;
  // 编辑/查看随记卡片回调
  onEditNote: (note: NoteItem) => void;
  // 删除随记卡片回调
  onDeleteNote: (id: string) => void;
}

/**
 * TodayThoughtsPanel - 自由随记卡片面板
 * 统一管理卡片展示、滚动条限制，支持点击卡片打开编辑弹窗及点击新增、删除按钮。
 */
export const TodayThoughtsPanel = ({
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
}: TodayThoughtsPanelProps): React.JSX.Element => {
  // 正在执行删除动画的随记 ID 列表
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  /**
   * 触发删除动画并回调删除逻辑
   */
  const handleDeleteNote = (event: React.MouseEvent, id: string): void => {
    event.stopPropagation();
    setDeletingIds((currentIds) => [...currentIds, id]);

    setTimeout(() => {
      onDeleteNote(id);
      setDeletingIds((currentIds) => currentIds.filter((x) => x !== id));
    }, 240);
  };

  return (
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">
            自由随记卡片
          </span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            aria-label="添加自由随记卡片"
            className="bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            onClick={onAddNote}
          >
            <Plus className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="max-h-[360px] flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-0.5">
        {notes.map((note) => {
          const isDeleting = deletingIds.includes(note.id);

          return (
            <div
              key={note.id}
              onClick={() => onEditNote(note)}
              className={`flex flex-col gap-2 rounded-[6px] border border-white/5 bg-white/[0.01] p-2.5 cursor-pointer hover:border-white/15 hover:bg-white/[0.03] transition-all duration-150 relative group/card ${
                isDeleting ? "animate-todo-item-exit" : "animate-todo-item-enter"
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white/80 truncate pr-2">
                  {note.title || "无标题想法"}
                </h4>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-mono text-white/30">
                    {note.time}
                  </span>
                  <button
                    aria-label={`删除随记 ${note.title || "无标题想法"}`}
                    className="opacity-0 group-hover/card:opacity-100 flex h-5 w-5 items-center justify-center rounded-[4px] text-white/30 transition-all hover:bg-white/5 hover:text-rose-400"
                    type="button"
                    onClick={(e) => handleDeleteNote(e, note.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
                {note.content}
              </p>
              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {note.tags.map((tag) => (
                    <Tag
                      key={tag}
                      size="small"
                      prefix={<TagIcon className="h-2.5 w-2.5" />}
                      bgClass="border-white/5 bg-white/[0.02] text-white/40"
                    >
                      {tag}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
