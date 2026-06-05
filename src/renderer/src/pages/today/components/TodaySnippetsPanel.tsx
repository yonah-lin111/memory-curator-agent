import type React from "react";
import { useState } from "react";
import { StickyNote, Tag as TagIcon, HelpCircle } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";
import type { NoteItem } from "./TodayNoteEntryModal";

interface TodaySnippetsPanelProps {
  // 自由随记卡片列表
  notes: NoteItem[];
  // 是否正在加载
  isLoading: boolean;
  // 当前错误文案
  errorMessage: string | null;
  // 新增随记卡片回调
  onAddNote: () => void;
  // 编辑/查看随记卡片回调
  onEditNote: (note: NoteItem) => void;
  // 删除随记卡片回调
  onDeleteNote: (id: number) => Promise<boolean>;
}

/**
 * TodaySnippetsPanel - 自由随记片段面板
 * 统一管理卡片展示、滚动条限制，支持点击卡片打开编辑弹窗及点击新增、删除按钮。
 */
export const TodaySnippetsPanel = ({
  notes,
  isLoading,
  errorMessage,
  onAddNote,
  onEditNote,
  onDeleteNote,
}: TodaySnippetsPanelProps): React.JSX.Element => {
  // 正在执行删除动画的随记 ID 列表
  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  /**
   * 触发删除动画并回调删除逻辑
   */
  const handleDeleteNote = (event: React.MouseEvent, id: number): void => {
    event.stopPropagation();
    setDeletingIds((currentIds) => [...currentIds, id]);

    window.setTimeout(async () => {
      try {
        await onDeleteNote(id);
      } finally {
        setDeletingIds((currentIds) => currentIds.filter((x) => x !== id));
      }
    }, 240);
  };

  return (
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">
            自由随记片段
          </span>
          <div className="relative group inline-flex items-center">
            <HelpCircle className="h-3.5 w-3.5 text-white/30 hover:text-white/60 cursor-help transition-colors" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 w-48 rounded-[6px] bg-[#000000] border border-white/10 p-2 text-xs font-normal text-white/70 leading-normal whitespace-normal z-50 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              快速捕捉瞬间的想法、灵感或临时便签片段，支持打上标签分类管理。
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            aria-label="Add free snippet"
            preset="add"
            onClick={onAddNote}
          />
        </div>
      </div>

      <div className="max-h-[360px] flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-0.5">
        {errorMessage ? (
          <div className="rounded-[6px] border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-300">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-[6px] border border-white/5 bg-black/20 px-3 py-3 text-xs text-white/35">
            正在读取今日片段...
          </div>
        ) : null}

        {!isLoading && notes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <StickyNote className="h-7 w-7 text-white/30" />
            <h2 className="mt-3 text-sm font-bold text-white/80">
              暂无自由随记
            </h2>
            <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-white/40">
              今天还没有片段，点击右上角加号，捕捉第一条瞬时想法。
            </p>
          </div>
        ) : null}

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
                  {note.title || "无标题片段"}
                </h4>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-mono text-white/30">
                    {note.time}
                  </span>
                  <IconButton
                    aria-label={`Delete snippet ${note.title || "Untitled snippet"}`}
                    preset="delete"
                    className="opacity-0 group-hover/card:opacity-100"
                    onClick={(e) => handleDeleteNote(e, note.id)}
                  />
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
