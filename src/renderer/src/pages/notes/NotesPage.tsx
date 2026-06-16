import type React from "react";
import { useEffect, useState } from "react";
import { Clock, FileText, Tag as TagIcon, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { NoteMarkdownPanel } from "@/pages/notes/components/NoteMarkdownPanel";
import {
  NoteCategoryPanel,
  type NoteCategory,
} from "@/pages/notes/components/NoteCategoryPanel";

/* ==========================================
 * TS 类型定义
 * ========================================== */

// 自由笔记素材项类型。
export interface NoteMaterialItem {
  // 笔记唯一标识。
  id: number;
  // 笔记标题。
  title: string;
  // 笔记正文。
  content: string;
  // 关联标签列表。
  tags: string[];
  // 记录日期与时间。
  time: string;
  // 分类 ID。
  categoryId?: number;
  // 分类名称。
  categoryName?: string;
}

// Markdown 编辑草稿类型。
export interface NoteDraft {
  // 草稿标题。
  title: string;
  // 草稿 Markdown 正文。
  content: string;
  // 草稿标签列表。
  tags: string[];
  // 分类 ID。
  categoryId?: number;
  // 草稿记录日期与时间。
  time?: string;
}

/**
 * 按当前分类与标签过滤笔记。
 */
const filterNotes = (
  notes: NoteMaterialItem[],
  activeCategoryId: number | null,
  activeTag: string | null,
): NoteMaterialItem[] => {
  let filtered = notes;

  if (activeCategoryId !== null) {
    filtered = filtered.filter((note) => note.categoryId === activeCategoryId);
  }

  if (activeTag) {
    filtered = filtered.filter((note) => note.tags.includes(activeTag));
  }

  return filtered;
};

/**
 * NotesPage 组件 - 展示自由笔记素材池。
 * 提供分类管理、标签筛选与新建 Markdown 笔记交互。
 */
export const NotesPage = (): React.JSX.Element => {
  // 当前页面笔记列表。
  const [notes, setNotes] = useState<NoteMaterialItem[]>([]);
  // 分类列表。
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  // 当前激活的分类筛选。
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  // 当前激活的标签过滤。
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // Markdown 编辑弹窗是否打开。
  const [isMarkdownModalOpen, setIsMarkdownModalOpen] = useState(false);
  // 正在编辑的笔记。若为 null 则表示非编辑状态。
  const [editingNote, setEditingNote] = useState<NoteMaterialItem | null>(null);
  // 笔记数据库是否正在读取。
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  // 笔记数据库错误文案。
  const [notesError, setNotesError] = useState<string | null>(null);
  // 全局消息提示。
  const toast = useToast();

  // 当前分类和标签过滤后的笔记列表。
  const visibleNotes = filterNotes(notes, activeCategoryId, activeTag);

  /**
   * 从 SQLite 读取笔记列表。
   */
  const loadNotes = async (): Promise<void> => {
    setIsLoadingNotes(true);
    setNotesError(null);

    try {
      const storedNotes = await window.api.notes.list();
      setNotes(storedNotes);
    } catch {
      setNotesError("无法读取本地笔记数据库");
    } finally {
      setIsLoadingNotes(false);
    }
  };

  /**
   * 从 SQLite 读取分类列表。
   */
  const loadCategories = async (): Promise<void> => {
    try {
      const cats = await window.api.noteCategories.list();
      setCategories(cats);
    } catch {
      // 分类加载失败不阻塞页面
    }
  };

  useEffect(() => {
    void loadNotes();
    void loadCategories();
  }, []);

  /**
   * 创建分类。
   */
  const handleCreateCategory = async (name: string): Promise<void> => {
    try {
      const created = await window.api.noteCategories.create(name);
      setCategories((prev) => [...prev, created]);
      toast.success("分类已创建");
    } catch {
      toast.error("创建分类失败");
    }
  };

  /**
   * 更新分类名称。
   */
  const handleUpdateCategory = async (
    id: number,
    name: string,
  ): Promise<void> => {
    try {
      const updated = await window.api.noteCategories.update(id, name);
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast.success("分类已更新");
    } catch {
      toast.error("更新分类失败");
    }
  };

  /**
   * 删除分类。
   */
  const handleDeleteCategory = async (id: number): Promise<void> => {
    try {
      await window.api.noteCategories.delete(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (activeCategoryId === id) {
        setActiveCategoryId(null);
      }
      toast.success("分类已删除");
    } catch {
      toast.error("删除分类失败");
    }
  };

  /**
   * 编辑笔记，打开弹窗。
   */
  const handleEditNote = (note: NoteMaterialItem): void => {
    setEditingNote(note);
  };

  /**
   * 删除素材。
   */
  const handleDeleteNote = async (id: number): Promise<void> => {
    setNotesError(null);

    try {
      await window.api.notes.delete(id);
      setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
      toast.success("笔记已成功删除");
    } catch {
      setNotesError("删除笔记失败，请稍后重试");
      toast.error("删除笔记失败，请稍后重试");
    }
  };

  /**
   * 更新素材池中的笔记。
   */
  const handleUpdateNote = async (
    id: number,
    draft: NoteDraft,
  ): Promise<void> => {
    setNotesError(null);

    try {
      const updatedNote = await window.api.notes.update(id, {
        title: draft.title.trim(),
        content: draft.content.trim(),
        tags: draft.tags,
        categoryId: draft.categoryId,
      });

      setNotes((currentNotes) =>
        currentNotes.map((note) => (note.id === id ? updatedNote : note)),
      );
      setEditingNote(null);
      toast.success("笔记已更新");
    } catch {
      setNotesError("更新笔记失败，请稍后重试");
      toast.error("更新笔记失败，请稍后重试");
    }
  };

  /**
   * 保存 Markdown 笔记到当前页面素材池。
   */
  const handleSaveMarkdownNote = async (draft: NoteDraft): Promise<void> => {
    setNotesError(null);

    try {
      const newNote = await window.api.notes.create({
        title: draft.title.trim(),
        content: draft.content.trim(),
        tags: draft.tags,
        categoryId: draft.categoryId,
      });

      setNotes((currentNotes) => [newNote, ...currentNotes]);
      setIsMarkdownModalOpen(false);
      toast.success("新笔记保存成功");
    } catch {
      setNotesError("保存笔记失败，请稍后重试");
      toast.error("保存笔记失败，请稍后重试");
    }
  };

  return (
    <section
      aria-label="Notes library page"
      className="flex h-full min-h-0 flex-col gap-3 text-white"
    >
      {isMarkdownModalOpen || editingNote ? (
        <NoteMarkdownPanel
          initialDraft={
            editingNote
              ? {
                  title: editingNote.title,
                  content: editingNote.content,
                  tags: editingNote.tags,
                  categoryId: editingNote.categoryId,
                  time: editingNote.time,
                }
              : undefined
          }
          categories={categories}
          onClose={() => {
            setIsMarkdownModalOpen(false);
            setEditingNote(null);
          }}
          onSave={(draft) => {
            if (editingNote) {
              void handleUpdateNote(editingNote.id, draft);
            } else {
              void handleSaveMarkdownNote(draft);
            }
          }}
        />
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_30vw]">
          {/* 左侧主素材展示区 */}
          <div className="min-h-0 flex-1 flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white/80">
                  素材列表
                </span>
                <span className="text-[11px] text-white/30">
                  ({notes.length})
                </span>
                {activeTag && (
                  <div className="flex items-center gap-1 rounded-[6px] border border-white/5 bg-white/5 px-2 py-0.5 text-xs text-white/60">
                    <TagIcon className="h-2.5 w-2.5" />
                    <span>{activeTag}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTag(null)}
                      className="ml-1 text-white/40 hover:text-white"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <IconButton
                  aria-label="New Markdown note"
                  preset="add"
                  onClick={() => setIsMarkdownModalOpen(true)}
                />
              </div>
            </div>

            {notesError && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-[6px] border border-white/10 bg-black/40 p-3 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between flex-shrink-0"
              >
                <span>{notesError}</span>
                <button
                  type="button"
                  className="self-start rounded-[6px] border border-white/10 bg-black px-2.5 py-1 text-xs font-semibold text-white/70 transition-colors duration-150 hover:border-white/25 hover:text-white sm:self-auto"
                  onClick={() => void loadNotes()}
                >
                  重新读取
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5 flex flex-col">
              {isLoadingNotes ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[258px] rounded-[6px] border border-white/5 bg-[#212121] p-3.5"
                    >
                      <div className="h-3 w-24 rounded-[4px] bg-white/10" />
                      <div className="mt-5 h-4 w-3/4 rounded-[4px] bg-white/10" />
                      <div className="mt-4 flex flex-col gap-2">
                        <div className="h-2.5 w-full rounded-[4px] bg-white/5" />
                        <div className="h-2.5 w-11/12 rounded-[4px] bg-white/5" />
                        <div className="h-2.5 w-2/3 rounded-[4px] bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : visibleNotes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <FileText className="h-7 w-7 text-white/30" />
                  <h2 className="mt-3 text-sm font-bold text-white/80">
                    暂无匹配笔记素材
                  </h2>
                  <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-white/40">
                    {activeTag
                      ? "当前标签下无素材，试着清除标签过滤或新建素材。"
                      : "点击右上角加号创建第一条 Markdown 素材，内容会写入本地 SQLite。"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-1">
                  {visibleNotes.map((note) => (
                    <div
                      key={note.id}
                      className="group h-[230px] overflow-hidden rounded-[6px] border border-white/10 p-3.5 flex flex-col gap-3 transition-all duration-150 hover:border-white/20 bg-white/[0.03]"
                    >
                      {/* 卡片头部：时间与操作按钮（编辑/删除） */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[11px] font-mono text-white/30 leading-none">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="text-xs">{note.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-50 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                          <IconButton
                            preset="edit"
                            onClick={() => handleEditNote(note)}
                            title="编辑笔记"
                          />
                          <Tooltip
                            title="确认要删除该笔记吗？"
                            description="删除后，笔记将被永久擦除，此操作无法撤销。"
                            onConfirm={() => void handleDeleteNote(note.id)}
                            variant="danger"
                          >
                            <IconButton preset="delete" title="删除笔记" />
                          </Tooltip>
                        </div>
                      </div>

                      {/* 卡片标题 */}
                      <h3 className="text-sm font-bold text-white/85 leading-tight">
                        {note.title}
                      </h3>

                      {/* 卡片正文 */}
                      <p className="text-xs text-white/50 leading-relaxed font-sans line-clamp-6">
                        {note.content}
                      </p>

                      {/* 来源分类与关联标签 */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-auto">
                        {note.categoryName && (
                          <span className="rounded-[6px] border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/50 font-medium">
                            {note.categoryName}
                          </span>
                        )}
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧分类管理面板 */}
          <NoteCategoryPanel
            categories={categories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
            onCreate={handleCreateCategory}
            onUpdate={handleUpdateCategory}
            onDelete={handleDeleteCategory}
          />
        </div>
      )}
    </section>
  );
};
