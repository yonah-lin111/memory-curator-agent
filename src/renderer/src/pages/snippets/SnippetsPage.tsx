import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Tag as TagIcon, StickyNote } from "lucide-react";
import { PageDateNavigator } from "@/components/ui/PageDateNavigator";
import { useHeaderStore } from "@/lib/headerStore";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";
import { SnippetsTagMap } from "@/pages/snippets/components/SnippetsTagMap";
import {
  TodayNoteEntryModal,
  type NoteItem,
} from "@/pages/today/components/TodayNoteEntryModal";
import {
  createTodayEntryDate,
  getEntryMonth,
  hasDailyBridge,
} from "@/lib/dailyShared";

// Daily 片段记录类型，直接从 bridge 签名反推。
type DailySnippetRecord = Awaited<
  ReturnType<Window["api"]["daily"]["listDay"]>
>["snippets"][number];

// 生成本地回退时间标签。
const createFallbackTimestamp = (entryDate: string): string =>
  `${entryDate} 00:00`;

/**
 * SnippetsPage 组件 - 当日片段档案页。
 */
export const SnippetsPage = (): React.JSX.Element => {
  // 全局提示实例。
  const toast = useToast();
  // 当前页面日期。
  const [entryDate, setEntryDate] = useState<string>(() =>
    createTodayEntryDate(),
  );
  // 当前月历可见月份。
  const [visibleMonth, setVisibleMonth] = useState<string>(() =>
    getEntryMonth(createTodayEntryDate()),
  );
  // 当前可见月份的片段角标映射。
  const [monthEntryCounts, setMonthEntryCounts] = useState<
    Record<string, number>
  >({});
  // 当前片段列表。
  const [snippets, setSnippets] = useState<DailySnippetRecord[]>([]);
  // 当前激活标签。
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // 加载状态。
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 月历标记是否正在加载。
  const [isMonthOverviewLoading, setIsMonthOverviewLoading] =
    useState<boolean>(true);
  // 头部导航器 setter。
  const setDateNavigator = useHeaderStore((state) => state.setDateNavigator);

  // 随记弹窗状态。
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  // 当前编辑的随记。
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  // 正在执行删除动画的随记 ID 列表。
  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  useEffect(() => {
    /**
     * 读取指定日期的片段列表。
     */
    const loadSnippets = async (): Promise<void> => {
      setIsLoading(true);

      try {
        if (!hasDailyBridge()) {
          setSnippets([]);
          return;
        }

        const todayData = await window.api.daily.listDay(entryDate);
        setSnippets(todayData.snippets);
        setActiveTag(null);
      } catch {
        toast.error("读取片段失败");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSnippets();
  }, [entryDate, toast]);

  useEffect(() => {
    /**
     * 读取当前可见月份的片段角标概览。
     */
    const loadMonthOverview = async (): Promise<void> => {
      setIsMonthOverviewLoading(true);

      try {
        if (!hasDailyBridge()) {
          setMonthEntryCounts({});
          return;
        }

        const overview = await window.api.daily.listMonthOverview(visibleMonth);
        setMonthEntryCounts(
          Object.fromEntries(
            overview.entries
              .filter((item) => item.snippetCount > 0)
              .map((item) => [item.entryDate, item.snippetCount]),
          ),
        );
      } catch {
        toast.error("读取月历标记失败");
      } finally {
        setIsMonthOverviewLoading(false);
      }
    };

    void loadMonthOverview();
  }, [toast, visibleMonth]);

  useEffect(() => {
    setDateNavigator(
      <PageDateNavigator
        entryCountMap={monthEntryCounts}
        entryDate={entryDate}
        isMonthOverviewLoading={isMonthOverviewLoading}
        visibleMonth={visibleMonth}
        onChange={(nextDate) => {
          setVisibleMonth(getEntryMonth(nextDate));
          setEntryDate(nextDate);
        }}
        onVisibleMonthChange={setVisibleMonth}
      />,
    );

    return () => {
      setDateNavigator(null);
    };
  }, [
    entryDate,
    visibleMonth,
    monthEntryCounts,
    isMonthOverviewLoading,
    setDateNavigator,
  ]);

  // 当前可见片段列表。
  const visibleSnippets = useMemo(
    () =>
      activeTag
        ? snippets.filter((snippet) => snippet.tags.includes(activeTag))
        : snippets,
    [activeTag, snippets],
  );

  // 标签统计列表。
  const tagItems = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((snippet) => {
      snippet.tags.forEach((tag) =>
        counts.set(tag, (counts.get(tag) ?? 0) + 1),
      );
    });

    return [...counts.entries()].map(([value, count]) => ({ value, count }));
  }, [snippets]);

  // 片段总数。
  const totalCount = useMemo(() => snippets.length, [snippets]);

  // 标签总数。
  const totalTagsCount = useMemo(() => tagItems.length, [tagItems]);

  // 最近更新时间。
  const lastUpdatedTime = useMemo(() => {
    if (snippets.length === 0) {
      return "--:--";
    }

    const latest = snippets.reduce((prev, current) => {
      return current.updatedAt > prev.updatedAt ? current : prev;
    }, snippets[0]);

    return latest.time || latest.updatedAt.slice(-5);
  }, [snippets]);

  /**
   * 在无 bridge 环境下创建本地片段。
   */
  const createLocalSnippet = (draft: {
    title: string;
    content: string;
    tags: string[];
  }): DailySnippetRecord => {
    // 当前本地时间。
    const now = new Date();
    // 当前小时。
    const hours = String(now.getHours()).padStart(2, "0");
    // 当前分钟。
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return {
      id: Date.now(),
      entryDate,
      title: draft.title,
      content: draft.content,
      tags: draft.tags,
      time: `${hours}:${minutes}`,
      createdAt: createFallbackTimestamp(entryDate),
      updatedAt: createFallbackTimestamp(entryDate),
    };
  };

  /**
   * 触发删除动画并回调删除逻辑
   */
  const handleDeleteNote = (event: React.MouseEvent, id: number): void => {
    event.stopPropagation();
    setDeletingIds((currentIds) => [...currentIds, id]);

    window.setTimeout(async () => {
      try {
        if (!hasDailyBridge()) {
          setSnippets((currentSnippets) =>
            currentSnippets.filter((snippet) => snippet.id !== id),
          );
          setMonthEntryCounts((currentCounts) => {
            const nextCount = Math.max(
              (currentCounts[entryDate] ?? snippets.length) - 1,
              0,
            );

            if (nextCount === 0) {
              const nextCounts = { ...currentCounts };
              delete nextCounts[entryDate];
              return nextCounts;
            }

            return {
              ...currentCounts,
              [entryDate]: nextCount,
            };
          });
          return;
        }

        await window.api.daily.deleteSnippet(id);
        setSnippets((currentSnippets) =>
          currentSnippets.filter((snippet) => snippet.id !== id),
        );
        setMonthEntryCounts((currentCounts) => {
          const nextCount = Math.max(
            (currentCounts[entryDate] ?? snippets.length) - 1,
            0,
          );

          if (nextCount === 0) {
            const nextCounts = { ...currentCounts };
            delete nextCounts[entryDate];
            return nextCounts;
          }

          return {
            ...currentCounts,
            [entryDate]: nextCount,
          };
        });
      } catch {
        toast.error("删除片段失败");
      } finally {
        setDeletingIds((currentIds) => currentIds.filter((x) => x !== id));
      }
    }, 240);
  };

  /**
   * 保存或编辑随记的回调。
   */
  const handleSaveNote = async (savedNote: {
    id?: number;
    title: string;
    content: string;
    tags: string[];
  }): Promise<boolean> => {
    try {
      if (savedNote.id) {
        if (!hasDailyBridge()) {
          setSnippets((currentSnippets) =>
            currentSnippets.map((snippet) =>
              snippet.id === savedNote.id
                ? {
                    ...snippet,
                    title: savedNote.title.trim(),
                    content: savedNote.content.trim(),
                    tags: savedNote.tags,
                    updatedAt: createFallbackTimestamp(entryDate),
                  }
                : snippet,
            ),
          );
          return true;
        }

        const updated = await window.api.daily.updateSnippet(savedNote.id, {
          title: savedNote.title.trim(),
          content: savedNote.content.trim(),
          tags: savedNote.tags,
        });
        setSnippets((currentSnippets) =>
          currentSnippets.map((snippet) =>
            snippet.id === savedNote.id ? updated : snippet,
          ),
        );
        return true;
      } else {
        if (!hasDailyBridge()) {
          const created = createLocalSnippet(savedNote);
          setSnippets((currentSnippets) => [created, ...currentSnippets]);
          setMonthEntryCounts((currentCounts) => ({
            ...currentCounts,
            [entryDate]: (currentCounts[entryDate] ?? snippets.length) + 1,
          }));
          return true;
        }

        const created = await window.api.daily.createSnippet({
          entryDate,
          title: savedNote.title.trim(),
          content: savedNote.content.trim(),
          tags: savedNote.tags,
        });
        setSnippets((currentSnippets) => [created, ...currentSnippets]);
        setMonthEntryCounts((currentCounts) => ({
          ...currentCounts,
          [entryDate]: (currentCounts[entryDate] ?? snippets.length) + 1,
        }));
        return true;
      }
    } catch {
      toast.error(savedNote.id ? "保存片段失败" : "创建片段失败");
      return false;
    }
  };

  return (
    <section
      aria-label="Snippets Page"
      className="flex h-full min-h-0 flex-col gap-3 text-white"
    >
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <div className="min-h-0 flex-1 flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold text-white/80">片段列表</h3>
            <IconButton
              aria-label="Add snippet"
              preset="add"
              onClick={() => {
                setEditingNote(null);
                setIsNoteModalOpen(true);
              }}
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5 flex flex-col">
            {isLoading ? (
              <div className="rounded-[6px] border border-white/5 bg-black/20 px-3 py-3 text-xs text-white/35">
                正在读取当日片段...
              </div>
            ) : visibleSnippets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <StickyNote className="h-7 w-7 text-white/30" />
                <h2 className="mt-3 text-sm font-bold text-white/80">
                  这一天还没有片段
                </h2>
                <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-white/40">
                  从零散想法里挑一条值得保存的记录。
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {visibleSnippets.map((snippet) => {
                  const isDeleting = deletingIds.includes(snippet.id);

                  return (
                    <div
                      key={snippet.id}
                      onClick={() => {
                        setEditingNote({
                          id: snippet.id,
                          title: snippet.title,
                          content: snippet.content,
                          tags: snippet.tags,
                          time: snippet.time,
                        });
                        setIsNoteModalOpen(true);
                      }}
                      className={`flex flex-col gap-2 rounded-[6px] border border-white/5 bg-white/[0.01] p-2.5 cursor-pointer hover:border-white/15 hover:bg-white/[0.03] transition-all duration-150 relative group/card ${
                        isDeleting
                          ? "animate-todo-item-exit"
                          : "animate-todo-item-enter"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white/80 truncate pr-2">
                          {snippet.title || "无标题片段"}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs font-mono text-white/30">
                            {snippet.time}
                          </span>
                          <IconButton
                            aria-label={`Delete snippet ${snippet.title || "Untitled snippet"}`}
                            preset="delete"
                            onClick={(e) => handleDeleteNote(e, snippet.id)}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap">
                        {snippet.content}
                      </p>
                      {snippet.tags && snippet.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {snippet.tags.map((tag) => (
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
            )}
          </div>
        </div>

        <SnippetsTagMap
          activeTag={activeTag}
          tags={tagItems}
          totalCount={totalCount}
          totalTagsCount={totalTagsCount}
          lastUpdatedTime={lastUpdatedTime}
          onChange={setActiveTag}
        />
      </div>

      {isNoteModalOpen && (
        <TodayNoteEntryModal
          note={editingNote}
          onClose={() => {
            setIsNoteModalOpen(false);
            setEditingNote(null);
          }}
          onSave={handleSaveNote}
        />
      )}
    </section>
  );
};
