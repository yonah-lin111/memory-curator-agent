import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { PageDateNavigator } from "@renderer/components/ui/PageDateNavigator";
import { useToast } from "@renderer/components/ui/Toast";
import { TodayTodoPanel } from "@renderer/pages/components/TodayTodoPanel";
import { TodoControlTower } from "@renderer/pages/components/TodoControlTower";
import {
  createTodayEntryDate,
  getEntryMonth,
  hasWorkspaceBridge,
} from "@renderer/pages/components/workspacePageShared";

// 工作台待办记录类型，直接从 bridge 签名反推。
type WorkspaceTodoRecord =
  Awaited<ReturnType<Window["api"]["workspace"]["listDay"]>>["todos"][number];

// 工作台待办优先级类型，直接从 createTodo 签名反推。
type WorkspaceTodoPriorityValue =
  Parameters<Window["api"]["workspace"]["createTodo"]>[0]["priority"];

/**
 * TodoPage 组件 - 单日待办执行控制台。
 */
export const TodoPage = (): React.JSX.Element => {
  // 全局提示实例。
  const toast = useToast();
  // 当前页面日期。
  const [entryDate, setEntryDate] = useState<string>(() => createTodayEntryDate());
  // 当前月历可见月份。
  const [visibleMonth, setVisibleMonth] = useState<string>(() =>
    getEntryMonth(createTodayEntryDate()),
  );
  // 当前可见月份的待办角标映射。
  const [monthEntryCounts, setMonthEntryCounts] = useState<Record<string, number>>(
    {},
  );
  // 当前待办列表。
  const [todos, setTodos] = useState<WorkspaceTodoRecord[]>([]);
  // 加载状态。
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 错误文案。
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 月历标记是否正在加载。
  const [isMonthOverviewLoading, setIsMonthOverviewLoading] =
    useState<boolean>(true);

  useEffect(() => {
    /**
     * 读取指定日期的待办列表。
     */
    const loadTodos = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        if (!hasWorkspaceBridge()) {
          setTodos([]);
          return;
        }

        const workspace = await window.api.workspace.listDay(entryDate);
        setTodos(workspace.todos);
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
        if (!hasWorkspaceBridge()) {
          setMonthEntryCounts({});
          return;
        }

        const overview = await window.api.workspace.listMonthOverview(visibleMonth);
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
    () => todos.filter((todo) => !todo.completed && todo.priority === "P0").length,
    [todos],
  );

  /**
   * 创建一条新的待办。
   */
  const handleCreateTodo = async (draft: {
    text: string;
    priority: WorkspaceTodoPriorityValue;
  }): Promise<boolean> => {
    try {
      const created = await window.api.workspace.createTodo({
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
    patch: { text: string; priority: WorkspaceTodoPriorityValue; completed: boolean },
  ): Promise<boolean> => {
    try {
      const updated = await window.api.workspace.updateTodo(id, patch);
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
      await window.api.workspace.deleteTodo(id);
      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
      setMonthEntryCounts((currentCounts) => {
        const nextCount = Math.max((currentCounts[entryDate] ?? todos.length) - 1, 0);

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
      const reordered = await window.api.workspace.sortTodos({
        entryDate,
        ids: todos.map((todo) => todo.id),
      });
      setTodos(reordered);
      return true;
    } catch {
      setErrorMessage("重排待办失败，请稍后再试。");
      toast.error("重排待办失败");
      return false;
    }
  };

  return (
    <section aria-label="Todo 页面" className="flex h-full min-h-0 flex-col gap-3 text-white">
      <PageDateNavigator
        currentEntryCount={todos.length}
        entryCountMap={monthEntryCounts}
        entryDate={entryDate}
        formatCountHint={(count) =>
          count > 0 ? `当日共有 ${count} 条待办` : "当日还没有待办"
        }
        isMonthOverviewLoading={isMonthOverviewLoading}
        label="Todo"
        visibleMonth={visibleMonth}
        onChange={(nextDate) => {
          setVisibleMonth(getEntryMonth(nextDate));
          setEntryDate(nextDate);
        }}
        onVisibleMonthChange={setVisibleMonth}
      />
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <TodayTodoPanel
          errorMessage={errorMessage}
          isLoading={isLoading}
          todos={todos}
          onCreateTodo={handleCreateTodo}
          onDeleteTodo={handleDeleteTodo}
          onSortTodos={handleSortTodos}
          onUpdateTodo={handleUpdateTodo}
        />
        <TodoControlTower
          completedCount={completedCount}
          p0Count={p0Count}
          totalCount={todos.length}
          onSort={() => {
            void handleSortTodos();
          }}
        />
      </div>
    </section>
  );
};
