import type React from "react";
import { useState } from "react";
import { CheckSquare, StickyNote, BookOpen, Smile } from "lucide-react";
import { TodaySnippetsPanel } from "@renderer/pages/components/TodaySnippetsPanel";
import {
  TodayNoteEntryModal,
  type NoteItem,
} from "@renderer/pages/components/TodayNoteEntryModal";
import { TodayTodoPanel } from "@renderer/pages/components/TodayTodoPanel";
import {
  type TodoItem,
  sortTodoItems,
} from "@renderer/pages/components/todoShared";
import { TodayJournalPanel, JOURNAL_DATA } from "@renderer/pages/components/TodayJournalPanel";

/* ==========================================
 * TS 类型定义 (Interfaces & Types)
 * ========================================== */

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

/* ==========================================
 * 静态 Mock 数据 (Static Mock Data)
 * ========================================== */

// 顶部卡片今日数据统计。
const TODAY_STATS: StatItem[] = [
  { id: "todo", label: "待办任务", value: 5, icon: CheckSquare },
  { id: "notes", label: "自由随记", value: 3, icon: StickyNote },
  { id: "journal", label: "日记字数", value: 0, icon: BookOpen },
  { id: "clues", label: "心情预测", value: "平静", icon: Smile },
];

// 今日待办任务静态列表。
const TODO_ITEMS: TodoItem[] = [
  {
    id: "t1",
    text: "整理 AEON 核心协议层关于记忆关联度衰减的计算模型",
    completed: true,
    priority: "P1",
  },
  {
    id: "t2",
    text: "对今日新输入的主观段落进行隐私过滤边界核对",
    completed: true,
    priority: "P0",
  },
  {
    id: "t3",
    text: "完成 Today 工作台的三栏静态布局编码与视觉自审",
    completed: false,
    priority: "P2",
  },
  {
    id: "t4",
    text: "修复渲染层 TypeScript 编译错误与 Lint 规范冲突",
    completed: false,
    priority: "P1",
  },
  {
    id: "t5",
    text: "整理本周 Review 需要呈送的核心神经元演化线索",
    completed: true,
    priority: "P3",
  },
];

// 今日自由笔记静态列表（标签使用稳定字作为 key）。
const NOTE_ITEMS: NoteItem[] = [
  {
    id: "n1",
    title: "关于记忆持久化的思考",
    content:
      "所有的临时闪念都不应该直接成为长期记忆，必须经过一个类似海马体的主动策展层。今天看到一个概念：信息不仅需要被存储，更需要主动被遗忘以保持高信噪比。",
    tags: ["方法论", "产品思考"],
    time: "10:15",
  },
  {
    id: "n2",
    title: "本地持久化方案表现",
    content:
      "目前使用本地优先的文件存取，在处理高并发的多维关联查询时表现优异，读写响应时间极短，很适合桌面客户端。",
    tags: ["架构", "本地存储"],
    time: "13:40",
  },
  {
    id: "n3",
    title: "主题线索设计启发",
    content:
      "Agent 不需要给出诊断式结论（比如直接断定你焦虑了），它只需要默默地把“关系消耗”、“计划延后”作为一根根绳索摆在你面前，让你自己去连线和确认。",
    tags: ["UX", "AI-Agent"],
    time: "15:20",
  },
];

/**
 * TodayWorkspace 组件 - 负责中间列 Today 主工作台。
 * 提供静态信息展示，保障小屏纵向流与大屏多栏的自适应响应。
 */
export const TodayWorkspace = (): React.JSX.Element => {
  // 随记卡片列表状态。
  const [notes, setNotes] = useState<NoteItem[]>(NOTE_ITEMS);

  // 随记编辑弹窗是否打开。
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // 当前正在编辑的随记（若为新建则为 null）
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);

  // 待办事项状态列表。
  const [todos, setTodos] = useState<TodoItem[]>(() =>
    sortTodoItems(TODO_ITEMS),
  );

  // 今日日记正文状态。
  const [journalContent, setJournalContent] = useState<string>(
    JOURNAL_DATA.content,
  );

  // 简单的心情预测计算属性（根据日记文本中是否含特定关键词动态推断）。
  const predictedMood = journalContent.includes("焦虑")
    ? "波动 / 焦虑"
    : journalContent.includes("雨")
      ? "平静 / 专注"
      : "良好 / 稳定";

  /**
   * 保存或更新随记卡片
   */
  const handleSaveNote = (savedNote: {
    id?: string;
    title: string;
    content: string;
    tags: string[];
  }): void => {
    if (savedNote.id) {
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === savedNote.id
            ? {
                ...note,
                title: savedNote.title,
                content: savedNote.content,
                tags: savedNote.tags,
              }
            : note,
        ),
      );
    } else {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const newNote: NoteItem = {
        id: `note-${Date.now()}`,
        title: savedNote.title,
        content: savedNote.content,
        tags: savedNote.tags,
        time: timeStr,
      };
      setNotes((currentNotes) => [newNote, ...currentNotes]);
    }
  };

  return (
    <section
      aria-label="中间内容容器"
      className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto custom-scrollbar px-1 lg:px-2 [scrollbar-gutter:stable]"
    >
      {/* 工作台主体滚动区域（大屏独立滚动，小屏自适应流动） */}
      <div className="flex-1 flex flex-col gap-3 pr-1">
        {/* 2. 今日概览统计（小屏 2 列，桌面 4 列） */}
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

        {/* 3. 计划与随记分栏区（小屏 1 列，宽屏 2 列） */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[300px] flex-shrink-0">
          <TodayTodoPanel setTodos={setTodos} todos={todos} />

          {/* 右侧：自由随记 */}
          <TodaySnippetsPanel
            notes={notes}
            onAddNote={() => {
              setEditingNote(null);
              setIsNoteModalOpen(true);
            }}
            onEditNote={(note) => {
              setEditingNote(note);
              setIsNoteModalOpen(true);
            }}
            onDeleteNote={(id) => {
              setNotes((currentNotes) =>
                currentNotes.filter((n) => n.id !== id),
              );
            }}
          />
        </div>

        {/* 4. 日记 */}
        <TodayJournalPanel
          journalContent={journalContent}
          onJournalContentChange={setJournalContent}
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
