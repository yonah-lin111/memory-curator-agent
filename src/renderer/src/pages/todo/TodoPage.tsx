import type React from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import { ArrowUpDown, CheckSquare, Square } from "lucide-react";
import { PageDateNavigator } from "@/components/ui/PageDateNavigator";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/IconButton";
import { TodoControlTower } from "@/pages/todo/components/TodoControlTower";
import {
  sortTodoItems,
  getNextTodoPriority,
} from "@/pages/todo/components/todoShared";
import {
  createTodayEntryDate,
  getEntryMonth,
  hasDailyBridge,
} from "@/lib/dailyShared";

// 待办记录类型，直接从 bridge 签名反推。
type DailyTodoRecord = Awaited<
  ReturnType<Window["api"]["daily"]["listDay"]>
>["todos"][number];

// 待办优先级类型，直接从 createTodo 签名反推。
type DailyTodoPriorityValue = Parameters<
  Window["api"]["daily"]["createTodo"]
>[0]["priority"];

// 新建待办草稿，仅保留必要字段。
interface TodoComposerDraft {
  // 草稿文本。
  text: string;
  // 草稿优先级。
  priority: DailyTodoPriorityValue;
}

// 行内编辑草稿，仅跟踪单条待办。
interface EditingTodoDraft {
  // 正在编辑的待办 ID。
  id: number;
  // 正在编辑的文本。
  text: string;
}

// 不同优先级在激活态下的视觉样式。
const PRIORITY_TONE_MAP: Record<DailyTodoPriorityValue, string> = {
  P0: "border-rose-500/20 bg-rose-500/8 text-rose-400 hover:bg-rose-500/12",
  P1: "border-amber-500/20 bg-amber-500/8 text-amber-400 hover:bg-amber-500/12",
  P2: "border-sky-500/20 bg-sky-500/8 text-sky-400 hover:bg-sky-500/12",
  P3: "border-neutral-500/20 bg-neutral-500/8 text-neutral-400 hover:bg-neutral-500/12",
};

/**
 * 根据完成状态与优先级生成标签样式。
 */
const getPriorityClassName = (
  priority: DailyTodoPriorityValue,
  completed: boolean,
): string => {
  if (completed) {
    return "border-white/6 bg-white/[0.02] text-white/25 hover:bg-white/[0.04]";
  }

  return PRIORITY_TONE_MAP[priority];
};

/**
 * TodoPage 组件 - 单日待办执行控制台。
 */
export const TodoPage = (): React.JSX.Element => {
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
  // 当前可见月份的待办角标映射。
  const [monthEntryCounts, setMonthEntryCounts] = useState<
    Record<string, number>
  >({});
  // 当前待办列表。
  const [todos, setTodos] = useState<DailyTodoRecord[]>([]);
  // 加载状态。
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 错误文案。
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 月历标记是否正在加载。
  const [isMonthOverviewLoading, setIsMonthOverviewLoading] =
    useState<boolean>(true);

  // 快速录入草稿。
  const [composerDraft, setComposerDraft] = useState<TodoComposerDraft>({
    text: "",
    priority: "P1",
  });
  // 当前行内编辑草稿。
  const [editingTodo, setEditingTodo] = useState<EditingTodoDraft | null>(null);
  // 正在执行删除动画的待办 ID 列表。
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  // 快速录入输入框引用，用于头部按钮聚焦。
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    /**
     * 读取指定日期的待办列表。
     */
    const loadTodos = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        if (!hasDailyBridge()) {
          setTodos([]);
          return;
        }

        const todayData = await window.api.daily.listDay(entryDate);
        setTodos(todayData.todos);
      } catch {
        setErrorMessage("读取待办失败，请稍后再试。");
        toast.error("读取待办失败");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTodos();
  }, [entryDate, toast]);

  useEffect(() => {
    /**
     * 读取当前可见月份的待办角标概览。
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
              .filter((item) => item.todoCount > 0)
              .map((item) => [item.entryDate, item.todoCount]),
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

  // 已完成数量。
  const completedCount = useMemo(
    () => todos.filter((todo) => todo.completed).length,
    [todos],
  );
  // 未完成 P0 数量。
  const p0Count = useMemo(
    () =>
      todos.filter((todo) => !todo.completed && todo.priority === "P0").length,
    [todos],
  );

  /**
   * 创建一条新的待办。
   */
  const handleCreateTodo = async (draft: {
    text: string;
    priority: DailyTodoPriorityValue;
  }): Promise<boolean> => {
    try {
      const created = await window.api.daily.createTodo({
        entryDate,
        ...draft,
      });
      setTodos((currentTodos) => [created, ...currentTodos]);
      setMonthEntryCounts((currentCounts) => ({
        ...currentCounts,
        [entryDate]: (currentCounts[entryDate] ?? todos.length) + 1,
      }));
      return true;
    } catch {
      setErrorMessage("保存待办失败，请稍后再试。");
      toast.error("保存待办失败");
      return false;
    }
  };

  /**
   * 更新一条待办。
   */
  const handleUpdateTodo = async (
    id: number,
    patch: {
      text: string;
      priority: DailyTodoPriorityValue;
      completed: boolean;
    },
  ): Promise<boolean> => {
    try {
      const updated = await window.api.daily.updateTodo(id, patch);
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === id ? updated : todo)),
      );
      return true;
    } catch {
      setErrorMessage("更新待办失败，请稍后再试。");
      toast.error("更新待办失败");
      return false;
    }
  };

  /**
   * 删除一条待办。
   */
  const handleDeleteTodo = async (id: number): Promise<boolean> => {
    try {
      await window.api.daily.deleteTodo(id);
      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
      setMonthEntryCounts((currentCounts) => {
        const nextCount = Math.max(
          (currentCounts[entryDate] ?? todos.length) - 1,
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
      return true;
    } catch {
      setErrorMessage("删除待办失败，请稍后再试。");
      toast.error("删除待办失败");
      return false;
    }
  };

  /**
   * 按当前顺序持久化待办列表。
   */
  const handleSortTodos = async (): Promise<boolean> => {
    try {
      const reordered = await window.api.daily.sortTodos({
        entryDate,
        ids: sortTodoItems(todos).map((todo) => todo.id),
      });
      setTodos(reordered);
      return true;
    } catch {
      setErrorMessage("重排待办失败，请稍后再试。");
      toast.error("重排待办失败");
      return false;
    }
  };

  /**
   * 聚焦快速录入框，维持主流列表的单入口添加体验。
   */
  const focusComposer = (): void => {
    composerInputRef.current?.focus();
  };

  /**
   * 切换新待办优先级。
   */
  const handleCycleComposerPriority = (): void => {
    setComposerDraft((currentDraft) => ({
      ...currentDraft,
      priority: getNextTodoPriority(
        currentDraft.priority,
      ) as DailyTodoPriorityValue,
    }));
  };

  /**
   * 提交一条新的待办。
   */
  const handleAddTodo = async (): Promise<void> => {
    const nextText = composerDraft.text.trim();

    if (!nextText) {
      return;
    }

    const isCreated = await handleCreateTodo({
      text: nextText,
      priority: composerDraft.priority,
    });

    if (!isCreated) {
      return;
    }

    setComposerDraft({
      text: "",
      priority: composerDraft.priority,
    });
    focusComposer();
  };

  /**
   * 切换待办完成状态。
   */
  const handleToggleTodo = async (todo: DailyTodoRecord): Promise<void> => {
    await handleUpdateTodo(todo.id, {
      text: todo.text,
      priority: todo.priority as DailyTodoPriorityValue,
      completed: !todo.completed,
    });
  };

  /**
   * 直接切换单条待办的优先级，无需进入编辑态。
   */
  const handleCycleTodoPriority = async (
    todo: DailyTodoRecord,
  ): Promise<void> => {
    await handleUpdateTodo(todo.id, {
      text: todo.text,
      priority: getNextTodoPriority(todo.priority) as DailyTodoPriorityValue,
      completed: todo.completed,
    });
  };

  /**
   * 开始编辑待办文本。
   */
  const handleStartEdit = (todo: DailyTodoRecord): void => {
    setEditingTodo({
      id: todo.id,
      text: todo.text,
    });
  };

  /**
   * 提交行内编辑结果；空文本时保持原值，避免误删。
   */
  const handleCommitEdit = async (todo: DailyTodoRecord): Promise<void> => {
    if (!editingTodo) {
      return;
    }

    const nextText = editingTodo.text.trim();

    if (!nextText) {
      setEditingTodo(null);
      return;
    }

    const isUpdated = await handleUpdateTodo(todo.id, {
      text: nextText,
      priority: todo.priority as DailyTodoPriorityValue,
      completed: todo.completed,
    });

    if (!isUpdated) {
      return;
    }

    setEditingTodo(null);
  };

  /**
   * 删除指定待办（附带优雅缩放淡出与折叠动画）。
   */
  const handleDeleteTodoWithAnimation = (id: number): void => {
    setDeletingIds((currentIds) => [...currentIds, id]);

    window.setTimeout(async () => {
      try {
        await handleDeleteTodo(id);
      } finally {
        setDeletingIds((currentIds) => currentIds.filter((x) => x !== id));

        if (editingTodo?.id === id) {
          setEditingTodo(null);
        }
      }
    }, 240);
  };

  return (
    <section
      aria-label="Todo Page"
      className="flex h-full min-h-0 flex-col gap-3 text-white"
    >
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 min-h-0 flex-1">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
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
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-white/40">
                已完成 {completedCount}/{todos.length}
              </span>
              <IconButton
                aria-label="One-click sort"
                onClick={() => void handleSortTodos()}
                title="手动排序"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-0.5">
            <div className="flex items-center gap-2 rounded-[6px] border border-white/8 bg-black/30 px-2 py-2 transition-all duration-300 ease-out focus-within:border-white/20 focus-within:bg-black">
              <button
                aria-label={`Toggle new todo priority ${composerDraft.priority}`}
                className={`flex-shrink-0 w-[30px] h-[18px] flex items-center justify-center p-0 rounded-[4px] border text-[10px] font-mono font-bold leading-none transition-colors duration-300 ${getPriorityClassName(composerDraft.priority, false)}`}
                type="button"
                onClick={handleCycleComposerPriority}
              >
                {composerDraft.priority}
              </button>
              <div className="relative min-w-0 flex-1">
                <div
                  className="invisible text-sm px-1.5 py-0 border border-transparent break-words whitespace-pre-wrap pointer-events-none min-h-[19.5px]"
                  aria-hidden="true"
                  style={{
                    fontSize: "13px",
                    lineHeight: "19.5px",
                    maxHeight: "58.5px",
                  }}
                >
                  {composerDraft.text || " "}
                </div>
                <textarea
                  ref={composerInputRef}
                  className="absolute inset-0 w-full h-full min-w-0 bg-transparent px-1.5 py-0 text-sm text-white placeholder:text-white/20 outline-none resize-none overflow-y-auto custom-scrollbar min-h-0"
                  style={{
                    fontSize: "13px",
                    lineHeight: "19.5px",
                    maxHeight: "58.5px",
                  }}
                  onChange={(event) =>
                    setComposerDraft((currentDraft) => ({
                      ...currentDraft,
                      text: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing) {
                      return;
                    }
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleAddTodo();
                    }
                    if (event.key === "Tab") {
                      event.preventDefault();
                      handleCycleComposerPriority();
                    }
                  }}
                  placeholder="添加一个待办，回车保存"
                  rows={1}
                  value={composerDraft.text}
                />
              </div>
              <IconButton
                aria-label="Add todo"
                preset="add"
                disabled={!composerDraft.text.trim()}
                onClick={() => void handleAddTodo()}
              />
            </div>

            {errorMessage ? (
              <div className="rounded-[6px] border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-300">
                {errorMessage}
              </div>
            ) : null}

            {isLoading ? (
              <div className="rounded-[6px] border border-white/5 bg-black/20 px-3 py-3 text-xs text-white/35">
                正在读取今日待办...
              </div>
            ) : null}

            {!isLoading && todos.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-white/8 bg-black/20 px-3 py-4 text-xs text-white/30">
                今天还没有待办，先写下第一条。
              </div>
            ) : null}

            {todos.map((todo) => {
              const isEditing = editingTodo?.id === todo.id;
              const isDeleting = deletingIds.includes(todo.id);

              return (
                <div
                  key={todo.id}
                  className={`group flex items-center gap-2.5 rounded-[6px] border px-2 py-2 transition-all duration-300 ease-out ${
                    isDeleting
                      ? "animate-todo-item-exit"
                      : "animate-todo-item-enter"
                  } ${
                    todo.completed
                      ? "border-white/[0.03] bg-white/[0.02]"
                      : "border-transparent bg-white/[0.02] hover:border-white/8 hover:bg-white/[0.04]"
                  }`}
                  data-testid="today-todo-item"
                >
                  <button
                    aria-label={
                      todo.completed
                        ? "Mark as incomplete"
                        : "Mark as completed"
                    }
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center transition-colors relative ${
                      todo.completed
                        ? "text-emerald-500"
                        : "text-white/35 hover:text-white"
                    }`}
                    type="button"
                    onClick={() => void handleToggleTodo(todo)}
                  >
                    <Square
                      className={`absolute h-4 w-4 transition-all duration-300 ease-out ${
                        todo.completed
                          ? "scale-0 opacity-0 rotate-45"
                          : "scale-100 opacity-100 rotate-0"
                      }`}
                    />
                    <CheckSquare
                      className={`absolute h-4 w-4 text-emerald-500 transition-all duration-300 ease-out ${
                        todo.completed
                          ? "scale-100 opacity-100 rotate-0"
                          : "scale-0 opacity-0 -rotate-45"
                      }`}
                    />
                  </button>

                  <button
                    aria-label={`Toggle priority of ${todo.text}`}
                    className={`flex-shrink-0 w-[30px] h-[18px] flex items-center justify-center p-0 rounded-[4px] border text-[10px] font-mono font-bold leading-none transition-colors duration-300 ${getPriorityClassName(todo.priority as DailyTodoPriorityValue, todo.completed)}`}
                    type="button"
                    onClick={() => void handleCycleTodoPriority(todo)}
                  >
                    {todo.priority}
                  </button>

                  {isEditing ? (
                    <div className="relative min-w-0 flex-1 -ml-1.5">
                      <div
                        className="invisible text-sm px-1.5 py-0 border border-transparent break-words whitespace-pre-wrap pointer-events-none min-h-0"
                        aria-hidden="true"
                        style={{ fontSize: "13px", lineHeight: "19.5px" }}
                      >
                        {editingTodo.text || " "}
                      </div>
                      <textarea
                        autoFocus
                        className="absolute inset-0 w-full h-full min-w-0 rounded-[4px] border border-transparent bg-transparent px-1.5 py-0 text-sm text-white outline-none focus:border-transparent resize-none overflow-hidden min-h-0"
                        style={{ fontSize: "13px", lineHeight: "19.5px" }}
                        onBlur={() => void handleCommitEdit(todo)}
                        onChange={(event) =>
                          setEditingTodo((currentDraft) =>
                            currentDraft
                              ? { ...currentDraft, text: event.target.value }
                              : currentDraft,
                          )
                        }
                        onFocus={(event) => event.target.select()}
                        onKeyDown={(event) => {
                          if (event.nativeEvent.isComposing) {
                            return;
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleCommitEdit(todo);
                          }
                          if (event.key === "Tab") {
                            event.preventDefault();
                            void handleCycleTodoPriority(todo);
                          }

                          if (event.key === "Escape") {
                            setEditingTodo(null);
                          }
                        }}
                        value={editingTodo.text}
                      />
                    </div>
                  ) : (
                    <button
                      className={`min-w-0 flex-1 rounded-[4px] border border-transparent px-1.5 py-0 text-left text-sm transition-all duration-300 -ml-1.5 line-through decoration-transparent ${
                        todo.completed
                          ? "text-white/30 decoration-white/20"
                          : "text-white/80 hover:text-white decoration-transparent"
                      }`}
                      style={{ fontSize: "13px", lineHeight: "19.5px" }}
                      type="button"
                      onClick={() => handleStartEdit(todo)}
                    >
                      <span className="break-words">{todo.text}</span>
                    </button>
                  )}

                  <IconButton
                    aria-label={`Delete todo ${todo.text}`}
                    preset="delete"
                    onClick={() => handleDeleteTodoWithAnimation(todo.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <TodoControlTower
          completedCount={completedCount}
          p0Count={p0Count}
          totalCount={todos.length}
        />
      </div>
    </section>
  );
};
