import type React from "react";
import { useEffect, useRef, useState } from "react";
import { BookOpen, CheckSquare, Smile, StickyNote } from "lucide-react";
import { useToast } from "@renderer/components/ui/Toast";
import { TodaySnippetsPanel } from "@renderer/pages/components/TodaySnippetsPanel";
import {
  TodayNoteEntryModal,
  type NoteItem,
} from "@renderer/pages/components/TodayNoteEntryModal";
import { TodayTodoPanel } from "@renderer/pages/components/TodayTodoPanel";
import {
  sortTodoItems,
  type TodoPriority,
} from "@renderer/pages/components/todoShared";
import { TodayJournalPanel } from "@renderer/pages/components/TodayJournalPanel";
import type { TodoItem } from "@renderer/pages/components/todoShared";

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

// Today 工作台待办项类型。
type TodayWorkspaceTodoItem = TodoItem & {
  // 待办所属日期。
  entryDate: string;
  // 排序序号。
  sortOrder: number;
  // 创建时间。
  createdAt: string;
  // 更新时间。
  updatedAt: string;
};

// Today 工作台片段项类型。
type TodayWorkspaceNoteItem = NoteItem & {
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
];

// 无 preload bridge 时使用的待办回退数据。
const FALLBACK_TODOS: TodayWorkspaceTodoItem[] = [
  {
    id: "t4",
    entryDate: "2026-05-27",
    text: "修复渲染层 TypeScript 编译错误与 Lint 规范冲突",
    completed: false,
    priority: "P1",
    sortOrder: 0,
    createdAt: "2026-05-27 09:25",
    updatedAt: "2026-05-27 09:25",
  },
  {
    id: "t3",
    entryDate: "2026-05-27",
    text: "完成 Today 工作台的三栏静态布局编码与视觉自审",
    completed: false,
    priority: "P2",
    sortOrder: 1,
    createdAt: "2026-05-27 09:20",
    updatedAt: "2026-05-27 09:20",
  },
  {
    id: "t2",
    entryDate: "2026-05-27",
    text: "对今日新输入的主观段落进行隐私过滤边界核对",
    completed: true,
    priority: "P0",
    sortOrder: 2,
    createdAt: "2026-05-27 09:15",
    updatedAt: "2026-05-27 09:15",
  },
  {
    id: "t1",
    entryDate: "2026-05-27",
    text: "整理 AEON 核心协议层关于记忆关联度衰减的计算模型",
    completed: true,
    priority: "P1",
    sortOrder: 3,
    createdAt: "2026-05-27 09:10",
    updatedAt: "2026-05-27 09:10",
  },
  {
    id: "t5",
    entryDate: "2026-05-27",
    text: "整理本周 Review 需要呈送的核心神经元演化线索",
    completed: true,
    priority: "P3",
    sortOrder: 4,
    createdAt: "2026-05-27 09:30",
    updatedAt: "2026-05-27 09:30",
  },
];

// 无 preload bridge 时使用的片段回退数据。
const FALLBACK_NOTES: TodayWorkspaceNoteItem[] = [
  {
    id: "n1",
    entryDate: "2026-05-27",
    title: "关于记忆持久化的思考",
    content:
      "所有的临时闪念都不应该直接成为长期记忆，必须经过一个类似海马体的主动策展层。今天看到一个概念：信息不仅需要被存储，更需要主动被遗忘以保持高信噪比。",
    tags: ["方法论", "产品思考"],
    time: "10:15",
    createdAt: "2026-05-27 10:15",
    updatedAt: "2026-05-27 10:15",
  },
  {
    id: "n2",
    entryDate: "2026-05-27",
    title: "本地持久化方案表现",
    content:
      "目前使用本地优先的文件存取，在处理高并发的多维关联查询时表现优异，读写响应时间极短，很适合桌面客户端。",
    tags: ["架构", "本地存储"],
    time: "13:40",
    createdAt: "2026-05-27 13:40",
    updatedAt: "2026-05-27 13:40",
  },
  {
    id: "n3",
    entryDate: "2026-05-27",
    title: "主题线索设计启发",
    content:
      "Agent 不需要给出诊断式结论（比如直接断定你焦虑了），它只需要默默地把“关系消耗”、“计划延后”作为一根根绳索摆在你面前，让你自己去连线和确认。",
    tags: ["UX", "AI-Agent"],
    time: "15:20",
    createdAt: "2026-05-27 15:20",
    updatedAt: "2026-05-27 15:20",
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
 * TodayWorkspace 组件 - 负责中间列 Today 主工作台。
 * 接入本地 SQLite，默认只展示当天工作台数据。
 */
export const TodayWorkspace = (): React.JSX.Element => {
  // 当前运行环境是否存在 workspace bridge。
  const hasWorkspaceApi = Boolean(window.api?.workspace);
  // 当前工作台日期。
  const [entryDate] = useState<string>(() => createTodayEntryDate());
  // 随记卡片列表状态。
  const [notes, setNotes] = useState<TodayWorkspaceNoteItem[]>([]);
  // 随记编辑弹窗是否打开。
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  // 当前正在编辑的随记。
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  // 待办事项状态列表。
  const [todos, setTodos] = useState<TodayWorkspaceTodoItem[]>([]);
  // 工作台是否正在读取。
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  // 工作台错误文案。
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
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
      if (!hasWorkspaceApi) {
        setSavedJournalContent(normalizedContent);
        setLastSavedAt(normalizedContent ? createCurrentTimestamp() : null);
        return;
      }

      if (!normalizedContent) {
        await window.api.workspace.deleteJournal(entryDate);
        setSavedJournalContent("");
        setLastSavedAt(null);
        return;
      }

      const saved = await window.api.workspace.saveJournal({
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
   * 从 SQLite 读取当天工作台数据。
   */
  const loadWorkspace = async (): Promise<void> => {
    setIsWorkspaceLoading(true);
    setWorkspaceError(null);

    try {
      if (!hasWorkspaceApi) {
        setTodos(FALLBACK_TODOS);
        setNotes(FALLBACK_NOTES);
        setJournalContent("");
        setSavedJournalContent("");
        setLastSavedAt(null);
        setJournalError(null);
        return;
      }

      const workspace = await window.api.workspace.listDay(entryDate);
      setTodos(workspace.todos);
      setNotes(workspace.snippets);
      setJournalContent(workspace.journal?.content ?? "");
      setSavedJournalContent(workspace.journal?.content ?? "");
      setLastSavedAt(workspace.journal?.updatedAt ?? null);
      setJournalError(null);
    } catch {
      setWorkspaceError("无法读取今日工作台数据");
    } finally {
      setIsWorkspaceLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [entryDate]);

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
    setWorkspaceError(null);

    try {
      if (!hasWorkspaceApi) {
        const nextOrder =
          todos.reduce(
            (maxOrder, todo) => Math.max(maxOrder, todo.sortOrder),
            -1,
          ) + 1;
        const created: TodayWorkspaceTodoItem = {
          id: `todo-${Date.now()}`,
          entryDate,
          text: draft.text.trim(),
          completed: false,
          priority: draft.priority,
          sortOrder: nextOrder,
          createdAt: `${entryDate} 00:00`,
          updatedAt: `${entryDate} 00:00`,
        };
        setTodos((currentTodos) => [created, ...currentTodos]);
        return true;
      }

      const created = await window.api.workspace.createTodo({
        entryDate,
        text: draft.text.trim(),
        priority: draft.priority,
      });
      setTodos((currentTodos) => [created, ...currentTodos]);
      return true;
    } catch {
      setWorkspaceError("保存待办失败，请稍后重试");
      toast.error("保存待办失败，请稍后重试");
      return false;
    }
  };

  /**
   * 更新待办并在写入成功后同步本地状态。
   */
  const handleUpdateTodo = async (
    id: string,
    patch: { text: string; priority: TodoPriority; completed: boolean },
  ): Promise<boolean> => {
    setWorkspaceError(null);

    try {
      if (!hasWorkspaceApi) {
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

      const updated = await window.api.workspace.updateTodo(id, {
        text: patch.text.trim(),
        priority: patch.priority,
        completed: patch.completed,
      });
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === id ? updated : todo)),
      );
      return true;
    } catch {
      setWorkspaceError("更新待办失败，请稍后重试");
      toast.error("更新待办失败，请稍后重试");
      return false;
    }
  };

  /**
   * 删除待办并在写入成功后同步本地状态。
   */
  const handleDeleteTodo = async (id: string): Promise<boolean> => {
    setWorkspaceError(null);

    try {
      if (!hasWorkspaceApi) {
        setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
        return true;
      }

      await window.api.workspace.deleteTodo(id);
      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
      return true;
    } catch {
      setWorkspaceError("删除待办失败，请稍后重试");
      toast.error("删除待办失败，请稍后重试");
      return false;
    }
  };

  /**
   * 持久化一键排序结果。
   */
  const handleSortTodos = async (): Promise<boolean> => {
    setWorkspaceError(null);

    try {
      if (!hasWorkspaceApi) {
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

      const reordered = await window.api.workspace.sortTodos({
        entryDate,
        ids: sortTodoItems(todos).map((todo) => todo.id),
      });
      setTodos(reordered);
      return true;
    } catch {
      setWorkspaceError("排序待办失败，请稍后重试");
      toast.error("排序待办失败，请稍后重试");
      return false;
    }
  };

  /**
   * 保存或更新随记片段。
   */
  const handleSaveNote = async (savedNote: {
    id?: string;
    title: string;
    content: string;
    tags: string[];
  }): Promise<boolean> => {
    setWorkspaceError(null);

    try {
      if (!hasWorkspaceApi) {
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

        const created: TodayWorkspaceNoteItem = {
          id: `note-${Date.now()}`,
          entryDate,
          title: savedNote.title.trim(),
          content: savedNote.content.trim(),
          tags: savedNote.tags,
          time: "00:00",
          createdAt: `${entryDate} 00:00`,
          updatedAt: `${entryDate} 00:00`,
        };
        setNotes((currentNotes) => [created, ...currentNotes]);
        return true;
      }

      if (savedNote.id) {
        const updated = await window.api.workspace.updateSnippet(savedNote.id, {
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

      const created = await window.api.workspace.createSnippet({
        entryDate,
        title: savedNote.title.trim(),
        content: savedNote.content.trim(),
        tags: savedNote.tags,
      });
      setNotes((currentNotes) => [created, ...currentNotes]);
      return true;
    } catch {
      setWorkspaceError("保存片段失败，请稍后重试");
      toast.error("保存片段失败，请稍后重试");
      return false;
    }
  };

  /**
   * 删除随记片段并在写入成功后同步本地状态。
   */
  const handleDeleteNote = async (id: string): Promise<boolean> => {
    setWorkspaceError(null);

    try {
      if (!hasWorkspaceApi) {
        setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
        return true;
      }

      await window.api.workspace.deleteSnippet(id);
      setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
      return true;
    } catch {
      setWorkspaceError("删除片段失败，请稍后重试");
      toast.error("删除片段失败，请稍后重试");
      return false;
    }
  };

  return (
    <section
      aria-label="中间内容容器"
      className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto custom-scrollbar px-1 lg:px-2 [scrollbar-gutter:stable]"
    >
      <div className="flex-1 flex flex-col gap-3 pr-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[300px] flex-shrink-0">
          <TodayTodoPanel
            errorMessage={workspaceError}
            isLoading={isWorkspaceLoading}
            onCreateTodo={handleCreateTodo}
            onDeleteTodo={handleDeleteTodo}
            onSortTodos={handleSortTodos}
            onUpdateTodo={handleUpdateTodo}
            todos={todos}
          />

          <TodaySnippetsPanel
            errorMessage={workspaceError}
            isLoading={isWorkspaceLoading}
            notes={notes}
            onAddNote={() => {
              setEditingNote(null);
              setIsNoteModalOpen(true);
            }}
            onDeleteNote={handleDeleteNote}
            onEditNote={(note) => {
              setEditingNote(note);
              setIsNoteModalOpen(true);
            }}
          />
        </div>

        <TodayJournalPanel
          errorMessage={journalError}
          isSaving={isJournalSaving}
          journalContent={journalContent}
          lastSavedAt={lastSavedAt}
          onJournalBlur={handleJournalBlur}
          onJournalContentChange={setJournalContent}
          predictedMood={predictedMood}
        />
      </div>
      {isNoteModalOpen ? (
        <TodayNoteEntryModal
          note={editingNote}
          onClose={() => {
            setIsNoteModalOpen(false);
            setEditingNote(null);
          }}
          onSave={handleSaveNote}
        />
      ) : null}
    </section>
  );
};
