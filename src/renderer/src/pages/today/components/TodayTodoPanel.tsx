import type React from "react";
import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  CheckSquare,
  ListTodo,
  Square,
  X,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import {
  getNextTodoPriority,
  type TodoItem,
  type TodoPriority,
} from "@/pages/todo/components/todoShared";

// Todo 面板属性，交由页面层托管真实持久化状态。
interface TodayTodoPanelProps {
  // 当前待办列表。
  todos: TodoItem[];
  // 是否正在加载。
  isLoading: boolean;
  // 当前错误文案。
  errorMessage: string | null;
  // 新建待办回调。
  onCreateTodo: (draft: {
    text: string;
    priority: TodoPriority;
  }) => Promise<boolean>;
  // 更新待办回调。
  onUpdateTodo: (
    id: number,
    patch: { text: string; priority: TodoPriority; completed: boolean },
  ) => Promise<boolean>;
  // 删除待办回调。
  onDeleteTodo: (id: number) => Promise<boolean>;
  // 手动排序回调。
  onSortTodos: () => Promise<boolean>;
  // 转移待办到下一天回调。
  onTransferTodos: (ids: number[]) => Promise<boolean>;
}

// 新建待办草稿，仅保留必要字段。
interface TodoComposerDraft {
  // 草稿文本。
  text: string;
  // 草稿优先级。
  priority: TodoPriority;
}

// 行内编辑草稿，仅跟踪单条待办。
interface EditingTodoDraft {
  // 正在编辑的待办 ID。
  id: number;
  // 正在编辑的文本。
  text: string;
}

// 不同优先级在激活态下的视觉样式。
const PRIORITY_TONE_MAP: Record<TodoPriority, string> = {
  P0: "border-rose-500/20 bg-rose-500/8 text-rose-400 hover:bg-rose-500/12",
  P1: "border-amber-500/20 bg-amber-500/8 text-amber-400 hover:bg-amber-500/12",
  P2: "border-sky-500/20 bg-sky-500/8 text-sky-400 hover:bg-sky-500/12",
  P3: "border-neutral-500/20 bg-neutral-500/8 text-neutral-400 hover:bg-neutral-500/12",
};

/**
 * 根据完成状态与优先级生成标签样式。
 */
const getPriorityClassName = (
  priority: TodoPriority,
  completed: boolean,
): string => {
  if (completed) {
    return "border-white/6 bg-white/[0.02] text-white/25 hover:bg-white/[0.04]";
  }

  return PRIORITY_TONE_MAP[priority];
};

/**
 * TodayTodoPanel - 提供更轻量的主流 todo 交互。
 * 常驻快速录入、点击文本编辑、点击优先级切换、完成项自动沉底。
 */
export const TodayTodoPanel = ({
  todos,
  isLoading,
  errorMessage,
  onCreateTodo,
  onUpdateTodo,
  onDeleteTodo,
  onSortTodos,
  onTransferTodos,
}: TodayTodoPanelProps): React.JSX.Element => {
  // 全局提示实例。
  const toast = useToast();
  // 快速录入草稿。
  const [composerDraft, setComposerDraft] = useState<TodoComposerDraft>({
    text: "",
    priority: "P1",
  });
  // 控制是否显示快速录入输入框。
  const [showComposer, setShowComposer] = useState(false);
  // 当前行内编辑草稿。
  const [editingTodo, setEditingTodo] = useState<EditingTodoDraft | null>(null);
  // 正在执行删除动画的待办 ID 列表。
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  // 快速录入输入框引用，用于头部按钮聚焦。
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  // 是否处于批量选择模式。
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  // 选中的待办 ID 列表。
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // 已完成统计，避免重复遍历表达式散落在 JSX 里。
  const completedCount = todos.filter((todo) => todo.completed).length;
  // 未完成待办列表。
  const uncompletedTodos = todos.filter((todo) => !todo.completed);

  /**
   * 全选 / 取消全选.
   */
  const handleToggleSelectAll = (): void => {
    const allUncompletedSelected = uncompletedTodos.every((todo) =>
      selectedIds.includes(todo.id),
    );
    if (allUncompletedSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(uncompletedTodos.map((todo) => todo.id));
    }
  };

  /**
   * 批量转移所选项到下一天.
   */
  const handleBatchTransfer = async (): Promise<void> => {
    if (selectedIds.length === 0) {
      return;
    }
    const success = await onTransferTodos(selectedIds);
    if (success) {
      setIsSelectionMode(false);
      setSelectedIds([]);
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
      priority: getNextTodoPriority(currentDraft.priority),
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

    const isCreated = await onCreateTodo({
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
  const handleToggleTodo = async (todo: TodoItem): Promise<void> => {
    await onUpdateTodo(todo.id, {
      text: todo.text,
      priority: todo.priority,
      completed: !todo.completed,
    });
  };

  /**
   * 直接切换单条待办的优先级，无需进入编辑态。
   */
  const handleCycleTodoPriority = async (todo: TodoItem): Promise<void> => {
    await onUpdateTodo(todo.id, {
      text: todo.text,
      priority: getNextTodoPriority(todo.priority),
      completed: todo.completed,
    });
  };

  /**
   * 开始编辑待办文本。
   */
  const handleStartEdit = (todo: TodoItem): void => {
    setEditingTodo({
      id: todo.id,
      text: todo.text,
    });
  };

  /**
   * 提交行内编辑结果；空文本时保持原值，避免误删。
   */
  const handleCommitEdit = async (todo: TodoItem): Promise<void> => {
    if (!editingTodo) {
      return;
    }

    const nextText = editingTodo.text.trim();

    if (!nextText) {
      setEditingTodo(null);
      return;
    }

    const isUpdated = await onUpdateTodo(todo.id, {
      text: nextText,
      priority: todo.priority,
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
  const handleDeleteTodo = (id: number): void => {
    setDeletingIds((currentIds) => [...currentIds, id]);

    window.setTimeout(async () => {
      try {
        await onDeleteTodo(id);
      } finally {
        setDeletingIds((currentIds) => currentIds.filter((x) => x !== id));

        if (editingTodo?.id === id) {
          setEditingTodo(null);
        }
      }
    }, 240);
  };

  return (
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 h-[360px]">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">
            每日待办计划
          </span>
        </div>
        {isSelectionMode ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-violet-400 font-bold mr-1">
              已选 {selectedIds.length} 项
            </span>
            <IconButton
              aria-label="Select all todos"
              onClick={handleToggleSelectAll}
              title={
                selectedIds.length === uncompletedTodos.length &&
                uncompletedTodos.length > 0
                  ? "取消全选"
                  : "全选"
              }
            >
              <CheckSquare className="h-3.5 w-3.5 text-white/60" />
            </IconButton>
            <IconButton
              aria-label="Move selected todos to next day"
              onClick={() => void handleBatchTransfer()}
              disabled={selectedIds.length === 0}
              title="转移下一天"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              aria-label="Cancel selection mode"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
              title="取消"
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-white/40">
              已完成 {completedCount}/{todos.length}
            </span>
            <IconButton
              aria-label="Toggle selection mode"
              onClick={() => {
                setIsSelectionMode(true);
                setSelectedIds([]);
              }}
              title="批量操作"
            >
              <ListTodo className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              aria-label="One-click sort"
              onClick={() => void onSortTodos()}
              title="手动排序"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              aria-label="Toggle add todo composer"
              preset="add"
              className={showComposer ? "bg-white/5 text-white" : ""}
              onClick={() => {
                setShowComposer((prev) => {
                  const next = !prev;
                  if (next) {
                    window.setTimeout(() => {
                      focusComposer();
                    }, 50);
                  }
                  return next;
                });
              }}
              title="添加待办"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-0.5">
        {showComposer && (
          <Input
            as="textarea"
            autosize
            ref={composerInputRef}
            placeholder="添加一个待办，回车保存"
            value={composerDraft.text}
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
            prefix={
              <button
                aria-label={`Toggle new todo priority ${composerDraft.priority}`}
                className={`flex-shrink-0 w-[30px] h-[18px] flex items-center justify-center p-0 rounded-[4px] border text-[10px] font-mono font-bold leading-none transition-colors duration-300 ${getPriorityClassName(composerDraft.priority, false)}`}
                type="button"
                onClick={handleCycleComposerPriority}
              >
                {composerDraft.priority}
              </button>
            }
            suffix={
              <IconButton
                aria-label="Add todo"
                preset="add"
                disabled={!composerDraft.text.trim()}
                onClick={() => void handleAddTodo()}
              />
            }
          />
        )}

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
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <CheckSquare className="h-7 w-7 text-white/30" />
            <h2 className="mt-3 text-sm font-bold text-white/80">
              暂无每日待办
            </h2>
            <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-white/40">
              今天还没有待办，点击右上角加号，写下第一条。
            </p>
          </div>
        ) : null}

        {todos.map((todo) => {
          const isEditing = editingTodo?.id === todo.id;
          const isDeleting = deletingIds.includes(todo.id);
          const isSelected = selectedIds.includes(todo.id);

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
              } ${isSelected ? "border-violet-500/20 bg-violet-500/4" : ""}`}
              data-testid="today-todo-item"
            >
              {isSelectionMode ? (
                <button
                  aria-label={isSelected ? "Deselect item" : "Select item"}
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center transition-colors relative ${
                    todo.completed
                      ? "opacity-40 cursor-not-allowed text-white/20"
                      : isSelected
                        ? "text-violet-400"
                        : "text-violet-500/40 hover:text-violet-400"
                  }`}
                  type="button"
                  onClick={() => {
                    if (todo.completed) {
                      toast.warning("已完成的待办不能被选择");
                      return;
                    }
                    setSelectedIds((prev) =>
                      prev.includes(todo.id)
                        ? prev.filter((id) => id !== todo.id)
                        : [...prev, todo.id],
                    );
                  }}
                >
                  <Square
                    className={`absolute h-4 w-4 transition-all duration-300 ease-out ${
                      isSelected
                        ? "scale-0 opacity-0 rotate-45"
                        : "scale-100 opacity-100 rotate-0"
                    }`}
                  />
                  <CheckSquare
                    className={`absolute h-4 w-4 text-violet-400 transition-all duration-300 ease-out ${
                      isSelected
                        ? "scale-100 opacity-100 rotate-0"
                        : "scale-0 opacity-0 -rotate-45"
                    }`}
                  />
                </button>
              ) : (
                <button
                  aria-label={
                    todo.completed ? "Mark as incomplete" : "Mark as completed"
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
              )}

              <button
                aria-label={`Toggle priority of ${todo.text}`}
                className={`flex-shrink-0 w-[30px] h-[18px] flex items-center justify-center p-0 rounded-[4px] border text-[10px] font-mono font-bold leading-none transition-colors duration-300 ${getPriorityClassName(todo.priority, todo.completed)}`}
                type="button"
                onClick={() => {
                  if (!isSelectionMode) {
                    void handleCycleTodoPriority(todo);
                  }
                }}
                disabled={isSelectionMode}
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
                  onClick={() => {
                    if (isSelectionMode) {
                      if (todo.completed) {
                        toast.warning("已完成的待办不能被选择");
                        return;
                      }
                      setSelectedIds((prev) =>
                        prev.includes(todo.id)
                          ? prev.filter((id) => id !== todo.id)
                          : [...prev, todo.id],
                      );
                    } else {
                      handleStartEdit(todo);
                    }
                  }}
                >
                  <span className="break-words">{todo.text}</span>
                </button>
              )}

              <IconButton
                aria-label={`Delete todo ${todo.text}`}
                preset="delete"
                className={`opacity-0 group-hover:opacity-100 ${isSelectionMode ? "pointer-events-none !opacity-0" : ""}`}
                onClick={() => handleDeleteTodo(todo.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
