import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@renderer/components/ui/EmptyState";
import { PageDateNavigator } from "@renderer/components/ui/PageDateNavigator";
import { useToast } from "@renderer/components/ui/Toast";
import { SnippetDetailDrawer } from "@renderer/pages/components/SnippetDetailDrawer";
import { SnippetsTagMap } from "@renderer/pages/components/SnippetsTagMap";
import {
  createTodayEntryDate,
  getEntryMonth,
  hasWorkspaceBridge,
} from "@renderer/pages/components/workspacePageShared";

// 工作台片段记录类型，直接从 bridge 签名反推。
type WorkspaceSnippetRecord =
  Awaited<ReturnType<Window["api"]["workspace"]["listDay"]>>["snippets"][number];

// 生成本地回退时间标签。
const createFallbackTimestamp = (entryDate: string): string => `${entryDate} 00:00`;

/**
 * SnippetsPage 组件 - 当日片段档案页。
 */
export const SnippetsPage = (): React.JSX.Element => {
  // 全局提示实例。
  const toast = useToast();
  // 当前页面日期。
  const [entryDate, setEntryDate] = useState<string>(() => createTodayEntryDate());
  // 当前月历可见月份。
  const [visibleMonth, setVisibleMonth] = useState<string>(() =>
    getEntryMonth(createTodayEntryDate()),
  );
  // 当前可见月份的片段角标映射。
  const [monthEntryCounts, setMonthEntryCounts] = useState<Record<string, number>>(
    {},
  );
  // 当前片段列表。
  const [snippets, setSnippets] = useState<WorkspaceSnippetRecord[]>([]);
  // 当前选中的片段 ID。
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // 当前是否处于新建态。
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  // 当前激活标签。
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // 加载状态。
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 月历标记是否正在加载。
  const [isMonthOverviewLoading, setIsMonthOverviewLoading] =
    useState<boolean>(true);

  useEffect(() => {
    /**
     * 读取指定日期的片段列表。
     */
    const loadSnippets = async (): Promise<void> => {
      setIsLoading(true);

      try {
        if (!hasWorkspaceBridge()) {
          setSnippets([]);
          setSelectedId(null);
          return;
        }

        const workspace = await window.api.workspace.listDay(entryDate);
        setSnippets(workspace.snippets);
        setSelectedId(workspace.snippets[0]?.id ?? null);
        setIsCreatingNew(false);
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
        if (!hasWorkspaceBridge()) {
          setMonthEntryCounts({});
          return;
        }

        const overview = await window.api.workspace.listMonthOverview(visibleMonth);
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
      snippet.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });

    return [...counts.entries()].map(([value, count]) => ({ value, count }));
  }, [snippets]);
  // 当前选中的片段实体。
  const selectedSnippet =
    isCreatingNew
      ? null
      : visibleSnippets.find((snippet) => snippet.id === selectedId) ?? null;

  useEffect(() => {
    if (isCreatingNew) {
      return;
    }

    if (visibleSnippets.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!visibleSnippets.some((snippet) => snippet.id === selectedId)) {
      setSelectedId(visibleSnippets[0].id);
    }
  }, [isCreatingNew, selectedId, visibleSnippets]);

  /**
   * 在无 bridge 环境下创建本地片段。
   */
  const createLocalSnippet = (draft: {
    title: string;
    content: string;
    tags: string[];
  }): WorkspaceSnippetRecord => ({
    id: Date.now(),
    entryDate,
    title: draft.title,
    content: draft.content,
    tags: draft.tags,
    time: "00:00",
    createdAt: createFallbackTimestamp(entryDate),
    updatedAt: createFallbackTimestamp(entryDate),
  });

  return (
    <section aria-label="随记 页面" className="flex h-full min-h-0 flex-col gap-3 text-white">
      <PageDateNavigator
        currentEntryCount={snippets.length}
        entryCountMap={monthEntryCounts}
        entryDate={entryDate}
        formatCountHint={(count) =>
          count > 0 ? `当日收录 ${count} 条片段` : "当日还没有片段"
        }
        isMonthOverviewLoading={isMonthOverviewLoading}
        label="Snippets"
        visibleMonth={visibleMonth}
        onChange={(nextDate) => {
          setVisibleMonth(getEntryMonth(nextDate));
          setEntryDate(nextDate);
        }}
        onVisibleMonthChange={setVisibleMonth}
      />
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <SnippetsTagMap
          activeTag={activeTag}
          tags={tagItems}
          onChange={setActiveTag}
          onCreateNew={() => {
            setIsCreatingNew(true);
            setSelectedId(null);
          }}
        />

        <div className="min-h-0 overflow-y-auto rounded-[6px] border border-white/6 bg-[#212121] p-4">
          {visibleSnippets.length === 0 && !isLoading ? (
            <EmptyState
              description="从零散想法里挑一条值得保存的记录。"
              title="这一天还没有片段"
            />
          ) : (
            <div className="grid gap-3">
              {visibleSnippets.map((snippet) => (
                <button
                  key={snippet.id}
                  className={`rounded-[6px] border p-3 text-left transition-colors ${
                    !isCreatingNew && selectedId === snippet.id
                      ? "border-white/16 bg-white/[0.05]"
                      : "border-white/8 bg-black/25 hover:border-white/18"
                  }`}
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setSelectedId(snippet.id);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white/86">{snippet.title}</p>
                    <span className="text-[10px] font-mono text-white/30">
                      {snippet.updatedAt}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/46">
                    {snippet.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <SnippetDetailDrawer
          selectedSnippet={selectedSnippet}
          onCreate={async (draft) => {
            try {
              if (!hasWorkspaceBridge()) {
                const created = createLocalSnippet(draft);
                setSnippets((currentSnippets) => [created, ...currentSnippets]);
                setMonthEntryCounts((currentCounts) => ({
                  ...currentCounts,
                  [entryDate]: (currentCounts[entryDate] ?? snippets.length) + 1,
                }));
                setIsCreatingNew(false);
                setSelectedId(created.id);
                return;
              }

              const created = await window.api.workspace.createSnippet({
                entryDate,
                ...draft,
              });
              setSnippets((currentSnippets) => [created, ...currentSnippets]);
              setMonthEntryCounts((currentCounts) => ({
                ...currentCounts,
                [entryDate]: (currentCounts[entryDate] ?? snippets.length) + 1,
              }));
              setIsCreatingNew(false);
              setSelectedId(created.id);
            } catch {
              toast.error("创建片段失败");
            }
          }}
          onDelete={async (id) => {
            try {
              if (!hasWorkspaceBridge()) {
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
                setIsCreatingNew(false);
                return;
              }

              await window.api.workspace.deleteSnippet(id);
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
              setIsCreatingNew(false);
            } catch {
              toast.error("删除片段失败");
            }
          }}
          onSave={async (id, draft) => {
            try {
              if (!hasWorkspaceBridge()) {
                setSnippets((currentSnippets) =>
                  currentSnippets.map((snippet) =>
                    snippet.id === id
                      ? {
                          ...snippet,
                          title: draft.title,
                          content: draft.content,
                          tags: draft.tags,
                          updatedAt: createFallbackTimestamp(entryDate),
                        }
                      : snippet,
                  ),
                );
                setIsCreatingNew(false);
                return;
              }

              const updated = await window.api.workspace.updateSnippet(id, draft);
              setSnippets((currentSnippets) =>
                currentSnippets.map((snippet) => (snippet.id === id ? updated : snippet)),
              );
              setIsCreatingNew(false);
            } catch {
              toast.error("保存片段失败");
            }
          }}
        />
      </div>
    </section>
  );
};
