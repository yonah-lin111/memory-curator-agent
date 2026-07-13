import type React from "react";
import { useState } from "react";
import { StickyNote, Tag as TagIcon } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import type { NoteItem } from "./TodayNoteEntryModal";

// 编辑草稿类型
type EditDraft = {
  title: string;
  content: string;
  tags: string[];
};

interface TodaySnippetsPanelProps {
  // 自由随记卡片列表
  notes: NoteItem[];
  // 是否正在加载
  isLoading: boolean;
  // 当前错误文案
  errorMessage: string | null;
  // 删除随记卡片回调
  onDeleteNote: (id: number) => Promise<boolean>;
  // 新建随记卡片回调
  onCreateNote?: (note: {
    title: string;
    content: string;
    tags: string[];
  }) => Promise<boolean>;
  // 更新随记卡片回调（用于 Tooltip 内联编辑）
  onUpdateNote?: (note: {
    id: number;
    title: string;
    content: string;
    tags: string[];
  }) => Promise<boolean>;
}

/**
 * TodaySnippetsPanel - 自由随记片段面板
 * 统一管理卡片展示、滚动条限制，支持点击卡片打开编辑弹窗及点击新增、删除按钮。
 */
export const TodaySnippetsPanel = ({
  notes,
  isLoading,
  errorMessage,
  onDeleteNote,
  onCreateNote,
  onUpdateNote,
}: TodaySnippetsPanelProps): React.JSX.Element => {
  // 正在执行删除动画的随记 ID 列表
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  // 内联编辑草稿
  const [editDraft, setEditDraft] = useState<EditDraft>({
    title: "",
    content: "",
    tags: [],
  });
  // 新建草稿
  const [addDraft, setAddDraft] = useState<EditDraft>({
    title: "",
    content: "",
    tags: [],
  });

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

  /**
   * 将随记填入编辑草稿。
   */
  const handleStartEdit = (note: NoteItem): void => {
    setEditDraft({
      title: note.title,
      content: note.content,
      tags: note.tags,
    });
  };

  /**
   * 提交内联编辑并回调保存。
   */
  const handleEditConfirm = async (id: number): Promise<void> => {
    if (!onUpdateNote) return;
    if (!editDraft.title.trim() && !editDraft.content.trim()) return;
    await onUpdateNote({
      id,
      title: editDraft.title.trim(),
      content: editDraft.content.trim(),
      tags: editDraft.tags,
    });
  };

  /**
   * 提交新建并回调保存。
   */
  const handleAddConfirm = async (): Promise<void> => {
    if (!onCreateNote) return;
    if (!addDraft.title.trim() && !addDraft.content.trim()) return;
    const success = await onCreateNote({
      title: addDraft.title.trim(),
      content: addDraft.content.trim(),
      tags: addDraft.tags,
    });
    if (success) {
      setAddDraft({ title: "", content: "", tags: [] });
    }
  };

  /**
   * 重置新建草稿。
   */
  const handleAddCancel = (): void => {
    setAddDraft({ title: "", content: "", tags: [] });
  };

  /**
   * 渲染笔记表单（用于 Tooltip form，新建和编辑复用）。
   */
  const renderNoteForm = (
    draft: EditDraft,
    setDraft: React.Dispatch<React.SetStateAction<EditDraft>>,
  ): React.JSX.Element => {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">标题</span>
          <Input
            type="text"
            value={draft.title}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="片段标题"
            size="xs"
            className="!h-[28px]"
          />
        </div>
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">内容</span>
          <Input
            as="textarea"
            value={draft.content}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, content: e.target.value }))
            }
            placeholder="片段内容"
            size="xs"
          />
        </div>
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">标签</span>
          <Input
            as="tags"
            tags={draft.tags}
            maxTags={3}
            onChangeTags={(tags) => setDraft((prev) => ({ ...prev, tags }))}
            size="xs"
            placeholder="按回车确认标签"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 h-[360px]">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">
            自由随记片段
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip
            placement="left"
            trigger="click"
            contentClassName="!w-[320px] !p-3 !whitespace-normal flex flex-col"
            onConfirm={handleAddConfirm}
            onCancel={handleAddCancel}
            form={renderNoteForm(addDraft, setAddDraft)}
          >
            <IconButton aria-label="Add free snippet" preset="add" />
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-0.5">
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
              className={`flex flex-col gap-2 rounded-[6px] border border-white/5 bg-white/[0.01] p-2.5 hover:border-white/15 hover:bg-white/[0.03] transition-all duration-150 relative group/card ${
                isDeleting
                  ? "animate-todo-item-exit"
                  : "animate-todo-item-enter"
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white/80 truncate pr-2">
                  {note.title || "无标题片段"}
                </h4>
                <div className="flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150 flex-shrink-0">
                  <Tooltip
                    placement="top"
                    trigger="click"
                    contentClassName="!w-[320px] !p-3 !whitespace-normal flex flex-col"
                    onConfirm={() => handleEditConfirm(note.id)}
                    form={renderNoteForm(editDraft, setEditDraft)}
                  >
                    <IconButton
                      aria-label={`Edit snippet ${note.title || "Untitled snippet"}`}
                      preset="edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(note);
                      }}
                    />
                  </Tooltip>
                  <IconButton
                    aria-label={`Delete snippet ${note.title || "Untitled snippet"}`}
                    preset="delete"
                    onClick={(e) => handleDeleteNote(e, note.id)}
                  />
                </div>
              </div>
              <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
                {note.content}
              </p>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 min-w-0">
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
                <span className="text-xs font-mono text-white/30 ml-auto">
                  {note.time}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
