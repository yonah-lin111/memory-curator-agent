import type React from "react";
import { useState } from "react";
import {
  CheckSquare,
  FileText,
  BookOpen,
  Brain,
  Plus,
  Tag,
  ClipboardList,
  Square,
} from "lucide-react";
import { AddEntryModal, type AddEntryModalKind } from "./AddEntryModal";

/* ==========================================
 * TS 类型定义 (Interfaces & Types)
 * ========================================== */

// 今日统计数据项类型，描述顶层关键指标。
type StatItem = {
  // 统计项标识。
  id: string;
  // 统计项名称。
  label: string;
  // 统计数值。
  value: number;
  // 显示图标。
  icon: React.ComponentType<{ className?: string }>;
};

// 每日待办事项类型，用于今日计划区。
type TodoItem = {
  // 待办唯一标识。
  id: string;
  // 待办内容文本。
  text: string;
  // 是否已完成。
  completed: boolean;
  // 创建时间标识或安排时间。
  time: string;
};

// 今日自由笔记类型，用于灵感闪念。
type NoteItem = {
  // 笔记唯一标识。
  id: string;
  // 笔记标题。
  title: string;
  // 笔记正文。
  content: string;
  // 笔记关联的标签列表。
  tags: string[];
  // 记录的具体时间。
  time: string;
};

// 今日主观日记类型，用于完整、私密的情感和思考记录。
type JournalEntry = {
  // 记录的具体时间。
  time: string;
  // 日记正文原文（保留主观表述不压缩）。
  content: string;
  // 用户自行记录的轻量级情绪与状态感知。
  mood: string;
};

/* ==========================================
 * 静态 Mock 数据 (Static Mock Data)
 * ========================================== */

// 顶部卡片今日数据统计。
const TODAY_STATS: StatItem[] = [
  { id: "todo", label: "待办任务", value: 5, icon: CheckSquare },
  { id: "notes", label: "自由随记", value: 3, icon: FileText },
  { id: "journal", label: "日记段落", value: 1, icon: BookOpen },
  { id: "clues", label: "关联线索", value: 4, icon: Brain },
];

// 今日待办任务静态列表。
const TODO_ITEMS: TodoItem[] = [
  {
    id: "t1",
    text: "整理 AEON 核心协议层关于记忆关联度衰减的计算模型",
    completed: true,
    time: "09:30",
  },
  {
    id: "t2",
    text: "对今日新输入的主观段落进行隐私过滤边界核对",
    completed: true,
    time: "11:00",
  },
  {
    id: "t3",
    text: "完成 Today 工作台的三栏静态布局编码与视觉自审",
    completed: false,
    time: "14:00",
  },
  {
    id: "t4",
    text: "修复渲染层 TypeScript 编译错误与 Lint 规范冲突",
    completed: false,
    time: "16:30",
  },
  {
    id: "t5",
    text: "整理本周 Review 需要呈送的核心神经元演化线索",
    completed: true,
    time: "18:00",
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

// 今日完整主观日记。
const JOURNAL_DATA: JournalEntry = {
  time: "21:45",
  content:
    "今天上海又下了小雨。在写完了 Today 工作台的布局后，看着黑色的背景板 and 克制的白色边框，有一种异样的平静。人脑里的记忆其实也是这样，乱七八糟，而我们需要一个外在的、数字化的“海马体”来帮我们整理。我把那些写在碎纸片和微信文件传输助手里的垃圾信息全都归档了，只留下了最重要的几条。今晚不需要焦虑，明天继续推进 AEON 神经关联图谱的设计。",
  mood: "平静 / 专注",
};

/**
 * TodayWorkspace 组件 - 负责中间列 Today 主工作台。
 * 提供静态信息展示，保障小屏纵向流与大屏多栏的自适应响应。
 */
export const TodayWorkspace = (): React.JSX.Element => {
  // 当前打开的添加弹窗类型。
  const [activeAddModal, setActiveAddModal] =
    useState<AddEntryModalKind | null>(null);

  return (
    <section
      aria-label="中间内容容器"
      className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto lg:overflow-hidden px-1 lg:px-2"
    >
      {/* 顶部标题栏 */}
      <header className="flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
          <span>TODAY</span>
          <span>/</span>
          <span>2026-05-25</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-white">
          今天的计划、素材与主观记录
        </h1>
      </header>

      {/* 工作台主体滚动区域（大屏独立滚动，小屏自适应流动） */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3">
        {/* 1. 快速输入区 (静态展示，防止假输入提交) */}
        <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 flex-shrink-0">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-ms font-bold tracking-wide text-white/80">
              快速输入与捕获
            </span>
            <div className="flex gap-1.5">
              <span className="rounded-[6px] bg-white/5 px-2 py-0.5 text-xs text-white/40">
                文本输入
              </span>
              <span className="rounded-[6px] bg-white/5 px-2 py-0.5 text-xs text-white/40">
                聊天粘贴
              </span>
              <span className="rounded-[6px] bg-white/5 px-2 py-0.5 text-xs text-white/40">
                粘贴素材
              </span>
            </div>
          </div>
          <textarea
            aria-label="快速捕获输入区域（静态只读）"
            readOnly
            className="w-full h-24 bg-[#000000] border border-white/5 rounded-[6px] p-3 text-sm text-white/50 placeholder-white/20 focus:outline-none resize-none custom-scrollbar"
            placeholder="[静态只读占位] 有什么新的闪念、日记片段，在此处输入。此区域当前仅作展示..."
            defaultValue="正在构思新协议下的轻量持久化模型，稍后整理至笔记..."
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30 font-mono">
              本地键盘捕获已启用 (⌘I)
            </span>
            <button
              disabled
              aria-disabled="true"
              className="rounded-[6px] bg-white/10 text-white/40 px-4 py-1.5 text-xs font-semibold cursor-not-allowed"
            >
              静态预览
            </button>
          </div>
        </div>

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
                    {stat.value}
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
          {/* 左侧：每日 Todo */}
          <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-white/60" />
                <span className="text-sm font-bold tracking-wide text-white/80">
                  每日待办计划
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/40">
                  已完成 3/5
                </span>
                <button
                  type="button"
                  aria-label="添加每日待办计划"
                  className="group flex h-7 w-7 items-center justify-center rounded-[6px] border border-white/10 bg-black text-white/65 transition-all duration-150 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                  onClick={() => setActiveAddModal("todo")}
                >
                  <Plus className="h-3.5 w-3.5 transition-transform duration-150 group-hover:rotate-90" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-0.5">
              {TODO_ITEMS.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-start gap-2.5 rounded-[6px] bg-white/[0.02] p-2"
                >
                  <div className="mt-0.5 flex-shrink-0 text-white/40">
                    {todo.completed ? (
                      <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span
                      className={`text-sm leading-normal ${
                        todo.completed
                          ? "text-white/30 line-through"
                          : "text-white/80"
                      }`}
                    >
                      {todo.text}
                    </span>
                    <span className="text-xs font-mono text-white/30">
                      {todo.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：自由笔记 */}
          <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-white/60" />
                <span className="text-sm font-bold tracking-wide text-white/80">
                  自由随记卡片
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1 text-xs text-white/30 font-medium sm:flex">
                  <Plus className="h-3 w-3" />
                  自动同步
                </span>
                <button
                  type="button"
                  aria-label="添加自由随记卡片"
                  className="group flex h-7 w-7 items-center justify-center rounded-[6px] border border-white/10 bg-black text-white/65 transition-all duration-150 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                  onClick={() => setActiveAddModal("note")}
                >
                  <Plus className="h-3.5 w-3.5 transition-transform duration-150 group-hover:rotate-90" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-0.5">
              {NOTE_ITEMS.map((note) => (
                <div
                  key={note.id}
                  className="flex flex-col gap-2 rounded-[6px] border border-white/5 bg-white/[0.01] p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white/80 truncate pr-2">
                      {note.title}
                    </h4>
                    <span className="text-xs font-mono text-white/30 flex-shrink-0">
                      {note.time}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
                    {note.content}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-0.5 rounded-[6px] bg-white/5 px-1.5 py-0.5 text-xs text-white/40"
                      >
                        <Tag className="h-2 w-2" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. 日记与主观表达区域 (完整显示原文) */}
        <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 flex-shrink-0 mb-1">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-white/60" />
              <span className="text-sm font-bold tracking-wide text-white/80">
                日记与主观表达
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-white/40">
              <span>记录时间: {JOURNAL_DATA.time}</span>
              <span>•</span>
              <span className="text-emerald-400">
                情绪感知: {JOURNAL_DATA.mood}
              </span>
            </div>
          </div>
          <div className="rounded-[6px] bg-[#000000] border border-white/5 p-3.5">
            <p className="text-sm text-white/80 leading-relaxed font-sans whitespace-pre-wrap">
              {JOURNAL_DATA.content}
            </p>
          </div>
          <div className="flex items-center justify-end">
            <span className="text-xs text-white/30">
              * 保留完整表达，拒绝以摘要过滤真实情绪感受。
            </span>
          </div>
        </div>
      </div>
      {activeAddModal ? (
        <AddEntryModal
          kind={activeAddModal}
          onClose={() => setActiveAddModal(null)}
        />
      ) : null}
    </section>
  );
};
