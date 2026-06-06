import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Sparkles,
  Tag as TagIcon,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { NoteMarkdownPanel } from "@/pages/notes/components/NoteMarkdownPanel";

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
  // 笔记来源渠道。
  source: "随手速记" | "聊天粘贴" | "截图文字" | "会议摘要";
  // 关联标签列表。
  tags: string[];
  // 记录日期与时间。
  time: string;
  // 是否已经被周度策展或长期主题吸纳。
  isCurated: boolean;
  // Agent 提取的可能进入的主题或线索提示。
  clue?: string;
}

// 统计指标项类型。
interface StatsSummaryItem {
  // 指标标识。
  id: string;
  // 指标名称。
  label: string;
  // 指标数值。
  value: number;
  // 显示图标。
  icon: React.ComponentType<{ className?: string }>;
  // 是否突出显示。
  highlight: boolean;
}

// 笔记筛选类型。
type NotesFilter = "all" | "pending" | "curated";

// Markdown 编辑草稿类型。
export interface NoteDraft {
  // 草稿标题。
  title: string;
  // 草稿 Markdown 正文。
  content: string;
  // 草稿来源。
  source: NoteMaterialItem["source"];
  // 草稿标签列表。
  tags: string[];
  // 草稿记录日期与时间。
  time?: string;
}

// 侧栏属性。
interface NotesSidebarProps {
  // 统计指标列表。
  stats: StatsSummaryItem[];
  // 标签统计列表。
  tags: Array<{ value: string; count: number }>;
  // 当前激活标签。
  activeTag: string | null;
  // 标签切换回调。
  onTagChange: (tag: string | null) => void;
}

/**
 * 创建动态统计项。
 */
const createStatsItems = (notes: NoteMaterialItem[]): StatsSummaryItem[] => {
  const pendingCount = notes.filter((note) => !note.isCurated).length;
  const curatedCount = notes.filter((note) => note.isCurated).length;
  const clueCount = notes.filter((note) => note.clue).length;

  return [
    {
      id: "total",
      label: "素材池总数",
      value: notes.length,
      icon: FileText,
      highlight: false,
    },
    {
      id: "pending",
      label: "待整理素材",
      value: pendingCount,
      icon: HelpCircle,
      highlight: false,
    },
    {
      id: "curated",
      label: "已策展归档",
      value: curatedCount,
      icon: CheckCircle2,
      highlight: false,
    },
    {
      id: "clues",
      label: "发现主题线索",
      value: clueCount,
      icon: Brain,
      highlight: false,
    },
  ];
};

/**
 * 按当前筛选条件与标签过滤笔记。
 */
const filterNotes = (
  notes: NoteMaterialItem[],
  activeFilter: NotesFilter,
  activeTag: string | null,
): NoteMaterialItem[] => {
  let filtered = notes;

  if (activeFilter === "pending") {
    filtered = filtered.filter((note) => !note.isCurated);
  } else if (activeFilter === "curated") {
    filtered = filtered.filter((note) => note.isCurated);
  }

  if (activeTag) {
    filtered = filtered.filter((note) => note.tags.includes(activeTag));
  }

  return filtered;
};

/**
 * NotesSidebar - 笔记页右侧侧栏。
 */
const NotesSidebar = ({
  stats,
  tags,
  activeTag,
  onTagChange,
}: NotesSidebarProps): React.JSX.Element => (
  <aside className="flex min-h-0 flex-col gap-4 rounded-[6px] border border-white/6 bg-[#212121] p-4">
    <div className="grid grid-cols-2 gap-2">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            className="rounded-[6px] border border-white/8 bg-black/30 p-2.5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-1.5 text-white/50">
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-[11px] font-medium leading-none">
                {stat.label}
              </span>
            </div>
            <p className="mt-2 text-base font-bold font-mono text-white leading-none">
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>

    <div className="border-t border-white/5 pt-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/28">
        Tag Map
      </p>
      <p className="mt-1 text-xs text-white/46">按标签切片筛选素材库。</p>
    </div>

    <button
      className={`rounded-[6px] border px-3 py-2 text-left text-xs transition-colors ${
        activeTag === null
          ? "border-white/18 bg-white/12 text-white"
          : "border-white/8 bg-black/25 text-white/84 hover:border-white/16 hover:bg-black/35"
      }`}
      type="button"
      onClick={() => onTagChange(null)}
    >
      全部素材
    </button>

    <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-0.5">
      {tags.map((tag) => (
        <button
          key={tag.value}
          aria-label={`Filter tag ${tag.value}`}
          className={`rounded-[6px] border px-2 py-0.5 text-xs font-semibold transition-colors ${
            activeTag === tag.value
              ? "border-white/18 bg-white/12 text-white"
              : "border-white/8 bg-black/25 text-white/62 hover:border-white/16 hover:text-white"
          }`}
          type="button"
          onClick={() => onTagChange(tag.value)}
        >
          #{tag.value} · {tag.count}
        </button>
      ))}
    </div>
  </aside>
);

/**
 * NotesPage 组件 - 展示自由笔记素材池。
 * 提供素材筛选与新建 Markdown 笔记交互。
 */
export const NotesPage = (): React.JSX.Element => {
  // 当前页面笔记列表。
  const [notes, setNotes] = useState<NoteMaterialItem[]>([]);
  // 当前激活的笔记筛选。
  const [activeFilter, setActiveFilter] = useState<NotesFilter>("all");
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

  // 当前页面统计项。
  const statsItems = createStatsItems(notes);
  // 当前筛选和标签过滤后的笔记列表。
  const visibleNotes = filterNotes(notes, activeFilter, activeTag);

  // 标签统计列表。
  const tagItems = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach((note) => {
      note.tags.forEach((tag) => {
        const cleanTag = tag.trim();
        if (cleanTag) {
          counts.set(cleanTag, (counts.get(cleanTag) ?? 0) + 1);
        }
      });
    });

    return [...counts.entries()].map(([value, count]) => ({ value, count }));
  }, [notes]);

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

  useEffect(() => {
    void loadNotes();
  }, []);

  /**
   * 切换素材筛选范围。
   */
  const handleFilterChange = (nextFilter: NotesFilter): void => {
    setActiveFilter(nextFilter);
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
        source: draft.source,
        tags: draft.tags,
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
        source: draft.source,
        tags: draft.tags,
      });

      setNotes((currentNotes) => [newNote, ...currentNotes]);
      setActiveFilter("all");
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
                  source: editingNote.source,
                  tags: editingNote.tags,
                  time: editingNote.time,
                }
              : undefined
          }
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
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          {/* 左侧主素材展示区 */}
          <div className="min-h-0 flex-1 flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white/80">素材列表</span>
                <div className="flex items-center gap-1 bg-black p-1 rounded-[6px] border border-white/5">
                  {[
                    {
                      id: "all" as const,
                      label: `全部 (${notes.length})`,
                    },
                    {
                      id: "pending" as const,
                      label: `待整理 (${notes.filter((n) => !n.isCurated).length})`,
                    },
                    {
                      id: "curated" as const,
                      label: `已整理 (${notes.filter((n) => n.isCurated).length})`,
                    },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      className={`px-2.5 py-1 text-[11px] rounded-[6px] transition-all duration-150 ${
                        activeFilter === filter.id
                          ? "bg-white text-black font-semibold"
                          : "text-white/40 hover:bg-white/5 hover:text-white/70"
                      }`}
                      onClick={() => handleFilterChange(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
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
                      className={`group h-[258px] overflow-hidden rounded-[6px] border p-3.5 flex flex-col gap-3 transition-all duration-150 ${
                        note.isCurated
                          ? "border-white/5 bg-white/[0.01] hover:border-white/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                      }`}
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
                            <IconButton
                              preset="delete"
                              title="删除笔记"
                            />
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
                        <span className="rounded-[6px] bg-white/10 px-1.5 py-0.5 text-[11px] text-white/60 font-medium">
                          {note.source}
                        </span>
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

                      {/* 智能线索分析提示 */}
                      {note.clue && (
                        <div className="pt-2 border-t border-white/5 flex items-start gap-1.5 mt-1">
                          <Sparkles
                            className={`h-3 w-3 mt-0.5 flex-shrink-0 ${
                              note.isCurated ? "text-white/20" : "text-white/70"
                            }`}
                          />
                          <span
                            className={`text-xs leading-relaxed ${
                              note.isCurated
                                ? "text-white/25 line-through"
                                : "text-white/65 font-medium"
                            }`}
                          >
                            {note.clue}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧侧栏统计与标签地图 */}
          <NotesSidebar
            stats={statsItems}
            tags={tagItems}
            activeTag={activeTag}
            onTagChange={setActiveTag}
          />
        </div>
      )}
    </section>
  );
};
