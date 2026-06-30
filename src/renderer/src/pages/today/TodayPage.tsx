import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CheckSquare,
  Smile,
  StickyNote,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { TodaySnippetsPanel } from "@/pages/today/components/TodaySnippetsPanel";
import { type NoteItem } from "@/pages/today/components/TodayNoteEntryModal";
import { TodayTodoPanel } from "@/pages/today/components/TodayTodoPanel";
import {
  sortTodoItems,
  type TodoPriority,
} from "@/pages/todo/components/todoShared";
import { TodayJournalPanel } from "@/pages/today/components/TodayJournalPanel";
import type { TodoItem } from "@/pages/todo/components/todoShared";
import { PageDateNavigator } from "@/components/ui/PageDateNavigator";
import { useHeaderStore } from "@/lib/headerStore";
import { getEntryMonth } from "@/lib/dailyShared";
import {
  TodayBillPanel,
  type TodaySummary,
} from "@/pages/today/components/TodayBillPanel";
import { formatAmount } from "@/pages/bills/components/billShared";

// 今日统计数据项类型，描述顶层关键指标。
type StatItem = {
  // 统计项标识。
  id: string;
  // 统计项名称。
  label: string;
  // 统计数值或文本状态。
  value: number | string;
  // 显示图标。
  icon: React.ComponentType<{ className?: string }>;
};

// Today 待办项类型。
type TodayTodoItem = TodoItem & {
  // 待办所属日期。
  entryDate: string;
  // 排序序号。
  sortOrder: number;
  // 创建时间。
  createdAt: string;
  // 更新时间。
  updatedAt: string;
};

// Today 片段项类型。
type TodayNoteItem = NoteItem & {
  // 片段所属日期。
  entryDate: string;
  // 创建时间。
  createdAt: string;
  // 更新时间。
  updatedAt: string;
};

// 顶部卡片今日数据统计。
const TODAY_STATS: StatItem[] = [
  { id: "todo", label: "待办任务", value: 0, icon: CheckSquare },
  { id: "notes", label: "自由随记", value: 0, icon: StickyNote },
  { id: "journal", label: "日记字数", value: 0, icon: BookOpen },
  { id: "clues", label: "心情预测", value: "平静", icon: Smile },
  { id: "expense", label: "今日支出", value: "¥0.00", icon: ArrowDownRight },
  { id: "income", label: "今日收入", value: "¥0.00", icon: ArrowUpRight },
];

// 无 preload bridge 时使用的待办回退数据。
const FALLBACK_TODOS: TodayTodoItem[] = [
  {
    id: 4,
    entryDate: "2026-05-27",
    text: "修复渲染层 TypeScript 编译错误与 Lint 规范冲突",
    completed: false,
    priority: "P1",
    sortOrder: 0,
    createdAt: "2026-05-27T09:25:00.000Z",
    updatedAt: "2026-05-27T09:25:00.000Z",
  },
  {
    id: 3,
    entryDate: "2026-05-27",
    text: "完成 Today 工作台的三栏静态布局编码与视觉自审",
    completed: false,
    priority: "P2",
    sortOrder: 1,
    createdAt: "2026-05-27T09:20:00.000Z",
    updatedAt: "2026-05-27T09:20:00.000Z",
  },
  {
    id: 2,
    entryDate: "2026-05-27",
    text: "对今日新输入的主观段落进行隐私过滤边界核对",
    completed: true,
    priority: "P0",
    sortOrder: 2,
    createdAt: "2026-05-27T09:15:00.000Z",
    updatedAt: "2026-05-27T09:15:00.000Z",
  },
  {
    id: 1,
    entryDate: "2026-05-27",
    text: "整理 AEON 核心协议层关于记忆关联度衰减的计算模型",
    completed: true,
    priority: "P1",
    sortOrder: 3,
    createdAt: "2026-05-27T09:10:00.000Z",
    updatedAt: "2026-05-27T09:10:00.000Z",
  },
  {
    id: 5,
    entryDate: "2026-05-27",
    text: "整理本周 Review 需要呈送的核心神经元演化线索",
    completed: true,
    priority: "P3",
    sortOrder: 4,
    createdAt: "2026-05-27T09:30:00.000Z",
    updatedAt: "2026-05-27T09:30:00.000Z",
  },
];

// 无 preload bridge 时使用的片段回退数据。
const FALLBACK_NOTES: TodayNoteItem[] = [
  {
    id: 1,
    entryDate: "2026-05-27",
    title: "关于记忆持久化的思考",
    content:
      "所有的临时闪念都不应该直接成为长期记忆，必须经过一个类似海马体的主动策展层。今天看到一个概念：信息不仅需要被存储，更需要主动被遗忘以保持高信噪比。",
    tags: ["方法论", "产品思考"],
    time: "10:15",
    createdAt: "2026-05-27T10:15:00.000Z",
    updatedAt: "2026-05-27T10:15:00.000Z",
  },
  {
    id: 2,
    entryDate: "2026-05-27",
    title: "本地持久化方案表现",
    content:
      "目前使用本地优先的文件存取，在处理高并发的多维关联查询时表现优异，读写响应时间极短，很适合桌面客户端。",
    tags: ["架构", "本地存储"],
    time: "13:40",
    createdAt: "2026-05-27T13:40:00.000Z",
    updatedAt: "2026-05-27T13:40:00.000Z",
  },
  {
    id: 3,
    entryDate: "2026-05-27",
    title: "主题线索设计启发",
    content:
      "Agent 不需要给出诊断式结论（比如直接断定你焦虑了），它只需要默默地把“关系消耗”、“计划延后”作为一根根绳索摆在你面前，让你自己去连线和确认。",
    tags: ["UX", "AI-Agent"],
    time: "15:20",
    createdAt: "2026-05-27T15:20:00.000Z",
    updatedAt: "2026-05-27T15:20:00.000Z",
  },
];

/**
 * 生成今天对应的 entry_date。
 */
const createTodayEntryDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
};

/**
 * 生成当前时间戳，供无 bridge 环境回退使用。
 */
const createCurrentTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${date} ${hours}:${minutes}`;
};

/**
 * TodayPage 组件 - 负责中间列 Today 主页面。
 * 接入本地 SQLite，默认只展示当天数据。
 */
export const TodayPage = (): React.JSX.Element => {
  // 当前运行环境是否存在 daily bridge。
  const hasDailyApi = Boolean(window.api?.daily);
  // 当前日期。
  const [entryDate, setEntryDate] = useState<string>(() =>
    createTodayEntryDate(),
  );
  // 当前月历可见月份。
  const [visibleMonth, setVisibleMonth] = useState<string>(() =>
    getEntryMonth(entryDate),
  );
  // 每一天是否有内容的数量字典。
  const [monthEntryCounts, setMonthEntryCounts] = useState<
    Record<string, number>
  >({});
  // 月历加载状态。
  const [isMonthOverviewLoading, setIsMonthOverviewLoading] =
    useState<boolean>(false);
  // 头部导航器 setter。
  const setDateNavigator = useHeaderStore((state) => state.setDateNavigator);
  // 随记卡片列表状态。
  const [notes, setNotes] = useState<TodayNoteItem[]>([]);
  // 待办事项状态列表。
  const [todos, setTodos] = useState<TodayTodoItem[]>([]);
  // 页面是否正在读取。
  const [isTodayLoading, setIsTodayLoading] = useState(true);
  // 账单统计数据状态。
  const [billSummary, setBillSummary] = useState<TodaySummary | null>(null);
  // 页面错误文案。
  const [todayError, setTodayError] = useState<string | null>(null);
  // 今日日记正文状态。
  const [journalContent, setJournalContent] = useState<string>("");
  // 最近一次成功保存的日记正文。
  const [savedJournalContent, setSavedJournalContent] = useState<string>("");
  // 最近一次成功保存时间。
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  // 日记是否正在保存。
  const [isJournalSaving, setIsJournalSaving] = useState(false);
  // 日记错误文案。
  const [journalError, setJournalError] = useState<string | null>(null);
  // 日记最新内容引用，避免防抖和卸载时读到旧值。
  const journalContentRef = useRef(journalContent);
  // 日记最近一次成功落库内容引用。
  const savedJournalContentRef = useRef(savedJournalContent);
  // 日记持久化方法引用，避免 effect 依赖被函数身份抖动污染。
  const persistJournalRef = useRef<(rawContent: string) => Promise<void>>(
    async () => undefined,
  );
  // 全局消息提示。
  const toast = useToast();

  // 简单的心情预测计算属性（根据日记文本中是否含特定关键词动态推断）。
  const predictedMood = journalContent.includes("焦虑")
    ? "波动 / 焦虑"
    : journalContent.includes("雨")
      ? "平静 / 专注"
      : "良好 / 稳定";

  useEffect(() => {
    journalContentRef.current = journalContent;
  }, [journalContent]);

  useEffect(() => {
    savedJournalContentRef.current = savedJournalContent;
  }, [savedJournalContent]);

  persistJournalRef.current = async (rawContent: string): Promise<void> => {
    const normalizedContent = rawContent.trim();
    const normalizedSavedContent = savedJournalContentRef.current.trim();

    if (normalizedContent === normalizedSavedContent) {
      return;
    }

    setIsJournalSaving(true);
    setJournalError(null);

    try {
      if (!hasDailyApi) {
        setSavedJournalContent(normalizedContent);
        setLastSavedAt(normalizedContent ? createCurrentTimestamp() : null);
        return;
      }

      if (!normalizedContent) {
        await window.api.daily.deleteJournal(entryDate);
        setSavedJournalContent("");
        setLastSavedAt(null);
        return;
      }

      const saved = await window.api.daily.saveJournal({
        entryDate,
        content: rawContent,
      });
      setSavedJournalContent(saved.content);
      setLastSavedAt(saved.updatedAt);
    } catch {
      setJournalError("保存日记失败，请稍后重试");
      toast.error("保存日记失败，请稍后重试");
    } finally {
      setIsJournalSaving(false);
    }
  };

  /**
   * 加载今日账单摘要。
   */
  const loadBillSummary = async (): Promise<void> => {
    if (!window.api?.bill) {
      if (!billSummary) {
        setBillSummary({
          expenseTotal: 0,
          incomeTotal: 0,
          recentItems: [],
        });
      }
      return;
    }
    try {
      const result = await window.api.bill.todaySummary(entryDate);
      setBillSummary(result);
    } catch {
      // 忽略错误
    }
  };

  /**
   * 从 SQLite 读取当天数据。
   */
  const loadToday = async (): Promise<void> => {
    setIsTodayLoading(true);
    setTodayError(null);

    try {
      if (!hasDailyApi) {
        setTodos(FALLBACK_TODOS);
        setNotes(FALLBACK_NOTES);
        setJournalContent("");
        setSavedJournalContent("");
        setLastSavedAt(null);
        setJournalError(null);
        void loadBillSummary();
        return;
      }

      const todayData = await window.api.daily.listDay(entryDate);
      setTodos(todayData.todos);
      setNotes(todayData.snippets);
      setJournalContent(todayData.journal?.content ?? "");
      setSavedJournalContent(todayData.journal?.content ?? "");
      setLastSavedAt(todayData.journal?.updatedAt ?? null);
      setJournalError(null);
      void loadBillSummary();
    } catch {
      setTodayError("无法读取今日数据");
    } finally {
      setIsTodayLoading(false);
    }
  };

  useEffect(() => {
    void loadToday();
  }, [entryDate]);

  /**
   * 切换当前选中日期。
   */
  const handleEntryDateChange = async (nextDate: string): Promise<void> => {
    if (journalContent.trim() !== savedJournalContent.trim()) {
      await persistJournalRef.current(journalContent);
    }
    setVisibleMonth(getEntryMonth(nextDate));
    setEntryDate(nextDate);
  };

  useEffect(() => {
    /**
     * 读取当前可见月份的记录数概览。
     */
    const loadMonthOverview = async (): Promise<void> => {
      setIsMonthOverviewLoading(true);

      try {
        if (!hasDailyApi) {
          setMonthEntryCounts({});
          return;
        }

        const overview = await window.api.daily.listMonthOverview(visibleMonth);
        setMonthEntryCounts(
          Object.fromEntries(
            overview.entries
              .map((item) => [
                item.entryDate,
                item.todoCount +
                  item.snippetCount +
                  (item.journalCount > 0 ? 1 : 0),
              ])
              .filter(([_, count]) => (count as number) > 0),
          ),
        );
      } catch {
        toast.error("读取月历标记失败");
      } finally {
        setIsMonthOverviewLoading(false);
      }
    };

    void loadMonthOverview();
  }, [visibleMonth]);

  useEffect(() => {
    setDateNavigator(
      <PageDateNavigator
        entryCountMap={monthEntryCounts}
        entryDate={entryDate}
        isMonthOverviewLoading={isMonthOverviewLoading}
        visibleMonth={visibleMonth}
        onChange={handleEntryDateChange}
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
    journalContent,
    savedJournalContent,
    setDateNavigator,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void persistJournalRef.current(journalContent);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [journalContent]);

  useEffect(() => {
    return () => {
      if (
        journalContentRef.current.trim() !==
        savedJournalContentRef.current.trim()
      ) {
        void persistJournalRef.current(journalContentRef.current);
      }
    };
  }, []);

  /**
   * 在失焦时强制提交尚未落库的日记内容。
   */
  const handleJournalBlur = (): void => {
    void persistJournalRef.current(journalContentRef.current);
  };

  /**
   * 创建待办并在写入成功后刷新本地状态。
   */
  const handleCreateTodo = async (draft: {
    text: string;
    priority: TodoPriority;
  }): Promise<boolean> => {
    setTodayError(null);

    try {
      if (!hasDailyApi) {
        const nextOrder =
          todos.reduce(
            (maxOrder, todo) => Math.max(maxOrder, todo.sortOrder),
            -1,
          ) + 1;
        const created: TodayTodoItem = {
          id: Date.now(),
          entryDate,
          text: draft.text.trim(),
          completed: false,
          priority: draft.priority,
          sortOrder: nextOrder,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setTodos((currentTodos) => [created, ...currentTodos]);
        return true;
      }

      const created = await window.api.daily.createTodo({
        entryDate,
        text: draft.text.trim(),
        priority: draft.priority,
      });
      setTodos((currentTodos) => [created, ...currentTodos]);
      return true;
    } catch {
      setTodayError("保存待办失败，请稍后重试");
      toast.error("保存待办失败，请稍后重试");
      return false;
    }
  };

  /**
   * 更新待办并在写入成功后同步本地状态。
   */
  const handleUpdateTodo = async (
    id: number,
    patch: { text: string; priority: TodoPriority; completed: boolean },
  ): Promise<boolean> => {
    setTodayError(null);

    try {
      if (!hasDailyApi) {
        setTodos((currentTodos) =>
          currentTodos.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  text: patch.text.trim(),
                  priority: patch.priority,
                  completed: patch.completed,
                }
              : todo,
          ),
        );
        return true;
      }

      const updated = await window.api.daily.updateTodo(id, {
        text: patch.text.trim(),
        priority: patch.priority,
        completed: patch.completed,
      });
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === id ? updated : todo)),
      );
      return true;
    } catch {
      setTodayError("更新待办失败，请稍后重试");
      toast.error("更新待办失败，请稍后重试");
      return false;
    }
  };

  /**
   * 删除待办并在写入成功后同步本地状态。
   */
  const handleDeleteTodo = async (id: number): Promise<boolean> => {
    setTodayError(null);

    try {
      if (!hasDailyApi) {
        setTodos((currentTodos) =>
          currentTodos.filter((todo) => todo.id !== id),
        );
        return true;
      }

      await window.api.daily.deleteTodo(id);
      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
      return true;
    } catch {
      setTodayError("删除待办失败，请稍后重试");
      toast.error("删除待办失败，请稍后重试");
      return false;
    }
  };

  /**
   * 持久化一键排序结果。
   */
  const handleSortTodos = async (): Promise<boolean> => {
    setTodayError(null);

    try {
      if (!hasDailyApi) {
        const reorderedIds = sortTodoItems(todos).map((todo) => todo.id);
        setTodos((currentTodos) =>
          currentTodos
            .map((todo) => ({
              ...todo,
              sortOrder: reorderedIds.indexOf(todo.id),
            }))
            .sort(
              (left, right) =>
                Number(left.completed) - Number(right.completed) ||
                left.sortOrder - right.sortOrder,
            ),
        );
        return true;
      }

      const reordered = await window.api.daily.sortTodos({
        entryDate,
        ids: sortTodoItems(todos).map((todo) => todo.id),
      });
      setTodos(reordered);
      return true;
    } catch {
      setTodayError("排序待办失败，请稍后重试");
      toast.error("排序待办失败，请稍后重试");
      return false;
    }
  };

  /**
   * 保存或更新随记片段。
   */
  const handleSaveNote = async (savedNote: {
    id?: number;
    title: string;
    content: string;
    tags: string[];
  }): Promise<boolean> => {
    setTodayError(null);

    try {
      if (!hasDailyApi) {
        if (savedNote.id) {
          setNotes((currentNotes) =>
            currentNotes.map((note) =>
              note.id === savedNote.id
                ? {
                    ...note,
                    title: savedNote.title.trim(),
                    content: savedNote.content.trim(),
                    tags: savedNote.tags,
                  }
                : note,
            ),
          );
          return true;
        }

        const created: TodayNoteItem = {
          id: Date.now(),
          entryDate,
          title: savedNote.title.trim(),
          content: savedNote.content.trim(),
          tags: savedNote.tags,
          time: "00:00",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setNotes((currentNotes) => [created, ...currentNotes]);
        return true;
      }

      if (savedNote.id) {
        const updated = await window.api.daily.updateSnippet(savedNote.id, {
          title: savedNote.title.trim(),
          content: savedNote.content.trim(),
          tags: savedNote.tags,
        });
        setNotes((currentNotes) =>
          currentNotes.map((note) =>
            note.id === savedNote.id ? updated : note,
          ),
        );
        return true;
      }

      const created = await window.api.daily.createSnippet({
        entryDate,
        title: savedNote.title.trim(),
        content: savedNote.content.trim(),
        tags: savedNote.tags,
      });
      setNotes((currentNotes) => [created, ...currentNotes]);
      return true;
    } catch {
      setTodayError("保存片段失败，请稍后重试");
      toast.error("保存片段失败，请稍后重试");
      return false;
    }
  };

  /**
   * 删除随记片段并在写入成功后同步本地状态。
   */
  const handleDeleteNote = async (id: number): Promise<boolean> => {
    setTodayError(null);

    try {
      if (!hasDailyApi) {
        setNotes((currentNotes) =>
          currentNotes.filter((note) => note.id !== id),
        );
        return true;
      }

      await window.api.daily.deleteSnippet(id);
      setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
      return true;
    } catch {
      setTodayError("删除片段失败，请稍后重试");
      toast.error("删除片段失败，请稍后重试");
      return false;
    }
  };

  return (
    <section
      aria-label="Main content container"
      className="flex h-full min-h-0 flex-col gap-3 text-white text-sm overflow-y-auto custom-scrollbar"
    >
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex gap-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3 flex-1 max-h-[360px] overflow-y-auto custom-scrollbar">
            {TODAY_STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.id}
                  className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex items-center justify-between"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white/40">
                      {stat.label}
                    </span>
                    <span className="text-lg font-bold font-mono text-white">
                      {stat.id === "todo"
                        ? todos.length
                        : stat.id === "notes"
                          ? notes.length
                          : stat.id === "journal"
                            ? journalContent.length
                            : stat.id === "clues"
                              ? predictedMood
                              : stat.id === "expense"
                                ? `¥${formatAmount(billSummary?.expenseTotal ?? 0)}`
                                : stat.id === "income"
                                  ? `¥${formatAmount(billSummary?.incomeTotal ?? 0)}`
                                  : stat.value}
                    </span>
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-white/5 text-white/60">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex-1 h-[300px]">
            <TodayBillPanel
              summary={billSummary}
              entryDate={entryDate}
              onRefresh={loadBillSummary}
              setSummary={setBillSummary}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[300px] flex-shrink-0">
          <TodayTodoPanel
            errorMessage={todayError}
            isLoading={isTodayLoading}
            onCreateTodo={handleCreateTodo}
            onDeleteTodo={handleDeleteTodo}
            onSortTodos={handleSortTodos}
            onUpdateTodo={handleUpdateTodo}
            todos={todos}
          />

          <TodaySnippetsPanel
            errorMessage={todayError}
            isLoading={isTodayLoading}
            notes={notes}
            onCreateNote={handleSaveNote}
            onDeleteNote={handleDeleteNote}
            onUpdateNote={handleSaveNote}
          />
        </div>

        <TodayJournalPanel
          errorMessage={journalError}
          isSaving={isJournalSaving}
          journalContent={journalContent}
          lastSavedAt={lastSavedAt}
          onJournalBlur={handleJournalBlur}
          onJournalContentChange={setJournalContent}
        />
      </div>
    </section>
  );
};
