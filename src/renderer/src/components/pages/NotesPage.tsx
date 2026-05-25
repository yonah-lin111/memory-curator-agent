import type React from "react";
import { useEffect, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import type { ICommand } from "@uiw/react-md-editor/commands";
import { getCommands } from "@uiw/react-md-editor/commands-cn";
import "@uiw/react-md-editor/markdown-editor.css";
import {
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit2,
  Eye,
  FileText,
  HelpCircle,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";

/* ==========================================
 * TS 类型定义
 * ========================================== */

// 自由笔记素材项类型。
type NoteMaterialItem = {
  // 笔记唯一标识。
  id: string;
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
};

// 统计指标项类型。
type StatsSummaryItem = {
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
};

// 笔记筛选类型。
type NotesFilter = "all" | "pending" | "curated";

// Markdown 编辑草稿类型。
type NoteDraft = {
  // 草稿标题。
  title: string;
  // 草稿 Markdown 正文。
  content: string;
  // 草稿来源。
  source: NoteMaterialItem["source"];
  // 草稿标签字符串。
  tags: string;
};

// Markdown 编辑器主题样式类型。
type MarkdownEditorThemeStyle = React.CSSProperties &
  Record<`--${string}`, string>;

// Markdown 编辑器预览模式。
type MarkdownPreviewMode = "edit" | "preview";

// 笔记弹窗属性。
type NoteMarkdownModalProps = {
  // 弹窗关闭回调。
  onClose: () => void;
  // 保存 Markdown 笔记回调。
  onSave: (draft: NoteDraft) => void;
  // 初始草稿（编辑时传入）。
  initialDraft?: NoteDraft;
};

/* ==========================================
 * 静态模拟数据
 * ========================================== */

// 笔记来源选项。
const NOTE_SOURCE_OPTIONS: NoteMaterialItem["source"][] = [
  "随手速记",
  "聊天粘贴",
  "截图文字",
  "会议摘要",
];

// Markdown 笔记初始草稿。
const INITIAL_NOTE_DRAFT: NoteDraft = {
  title: "",
  content:
    "## 今天的新素材\n\n- [ ] 先保留原始想法\n- [ ] 再交给 Agent 做主题策展\n\n> Markdown 支持标题、列表、引用、表格与任务列表。\n\n| 字段 | 状态 |\n| --- | --- |\n| 来源 | 待整理 |",
  source: "随手速记",
  tags: "灵感, 待整理",
};

// Markdown 编辑器黑色主题变量。
const MARKDOWN_EDITOR_THEME_STYLE: MarkdownEditorThemeStyle = {
  "--color-canvas-default": "#000000",
  "--color-fg-default": "rgba(255,255,255,0.82)",
  "--color-border-default": "rgba(255,255,255,0.1)",
  "--color-neutral-muted": "rgba(255,255,255,0.08)",
  "--color-accent-fg": "#ffffff",
  "--color-danger-fg": "#ffffff",
  "--md-editor-background-color": "#000000",
  "--md-editor-box-shadow-color": "rgba(255,255,255,0.1)",
  "--md-editor-font-family":
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  borderRadius: "6px",
  overflow: "hidden",
};

// Markdown 基础工具栏命令，移除默认帮助问号。
const NOTE_MARKDOWN_BASE_COMMANDS: ICommand[] = [
  ...getCommands().filter(
    (command) => command.name !== "help" && command.keyCommand !== "help",
  ),
];

// 自由笔记素材静态列表。
const INITIAL_NOTES: NoteMaterialItem[] = [
  {
    id: "n-1",
    title: "分布式节点状态同步算法重试机制",
    content:
      "在弱网环境下，AEON 核心协议层的节点状态同步容易丢失。可以设计一个基于指数退避时间的重试算法，同时引入主观连接信任度，当信任度低于 0.3 时直接进入离线暂存模式。明天和 Yonah 讨论一下。",
    source: "随手速记",
    tags: ["架构", "协议层"],
    time: "2026-05-25 10:15",
    isCurated: false,
    clue: "可能关联主题「本地优先架构」",
  },
  {
    id: "n-2",
    title: "微信聊天记录粘贴：遗忘曲线机制探讨",
    content:
      "[14:22] A: 数字海马体不能做成纯粹的记事本。人脑能正常运转是因为大脑会自动遗忘 90% 的垃圾信息。B: 同意。所以我们的 Agent 在周整理时，应该鼓励用户“丢弃”或“归档”那些时效性已过的随记。遗忘机制才是核心。",
    source: "聊天粘贴",
    tags: ["机制探讨", "数字海马体"],
    time: "2026-05-24 16:45",
    isCurated: false,
    clue: "可能关联主题「数字海马体」",
  },
  {
    id: "n-3",
    title: "截屏 OCR：极简黑白客户端设计准则",
    content:
      "界面背景：#000000（纯黑）。次级卡片：#212121（暗灰）。圆角：6px。严格禁止使用多色渐变。一切界面的交互通过留白、层级、微弱的白边框以及极其克制的微交互来传达。设计需要新颖，同时体现绝对的冷静。",
    source: "截图文字",
    tags: ["UI-UX", "规范"],
    time: "2026-05-24 11:30",
    isCurated: true,
    clue: "已关联主题「数字海马体」的设计系统",
  },
  {
    id: "n-4",
    title: "海马体主动策展交互层构想",
    content:
      "Agent 的角色绝对不能是诊断式的。如果 Agent 直接对用户说“你今天很焦虑”，这不仅生硬，而且可能引起抵触。相反，它应该作为一根绳索，把“计划延后”和“工作时间过长”这两个事实摆在用户面前。让用户自己去连线。",
    source: "随手速记",
    tags: ["AI-Agent", "UX"],
    time: "2026-05-23 15:20",
    isCurated: false,
    clue: "可能关联主题「数字海马体」",
  },
  {
    id: "n-5",
    title: "关于本地加密存储的讨论摘要",
    content:
      "在本地优先架构下，密钥直接托管于硬件级的 Keychain。数据的解密与神经元关联计算完全是在本地沙盒内完成。任何外部云同步都必须在数据完全碎块化加密后进行，保证即使云端被攻破，攻击者也只能拿到无意义的碎块。",
    source: "会议摘要",
    tags: ["本地存储", "安全"],
    time: "2026-05-22 09:10",
    isCurated: true,
    clue: "已关联主题「本地优先架构」",
  },
  {
    id: "n-6",
    title: "拖延症的本质与应对设计",
    content:
      "今天再次把“Today 工作台 visual 审核”这个任务延后了。这其实是个信号，代表我对目前的渲染层 Lint 规则感到烦躁。如果能将延后任务与当时记录的主观日记进行关联，或许能帮我找出“抗拒某项工作”的底层心理根源。",
    source: "随手速记",
    tags: ["心理学", "行为记录"],
    time: "2026-05-21 18:40",
    isCurated: false,
    clue: "可能关联主题「计划延后模式」",
  },
  {
    id: "n-7",
    title: "微信群摘录：AI 协同与个人边界",
    content:
      "“现在的 AI 都在教你如何快速输出，但没有人在教你如何保护你的注意力。我们每天写下的随记，是极为珍贵的个人脑电波映射。如果直接打包发给公共大模型，就是在慢性让渡思维主权。必须建立本地的策展边界。”",
    source: "聊天粘贴",
    tags: ["思想", "AI-Agent"],
    time: "2026-05-20 22:15",
    isCurated: false,
    clue: "可能关联主题「数字海马体」",
  },
  {
    id: "n-8",
    title: "客户端冷启动性能指标",
    content:
      "本地优先客户端最核心的体验就是“快”。目前冷启动耗时在 120ms 左右。需要对多维关联图谱的首次加载进行预加载分片。在 App 启动时，只初始化基础 UI 树和 Today 页面，其他页面的关联网格在后台线程中懒加载。",
    source: "随手速记",
    tags: ["架构", "性能"],
    time: "2026-05-19 14:00",
    isCurated: true,
    clue: "已关联主题「本地优先架构」",
  },
];

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
      highlight: true,
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
 * 按当前筛选条件过滤笔记。
 */
const filterNotes = (
  notes: NoteMaterialItem[],
  activeFilter: NotesFilter,
): NoteMaterialItem[] => {
  if (activeFilter === "pending") {
    return notes.filter((note) => !note.isCurated);
  }

  if (activeFilter === "curated") {
    return notes.filter((note) => note.isCurated);
  }

  return notes;
};

/**
 * 将标签输入解析为稳定的标签列表。
 */
const parseTags = (tags: string): string[] =>
  tags
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

/**
 * Markdown 笔记编辑弹窗。
 * 复用 Today 添加弹窗的交互模式，但为长文本编辑提供更宽的双栏空间。
 */
const NoteMarkdownModal = ({
  onClose,
  onSave,
  initialDraft,
}: NoteMarkdownModalProps): React.JSX.Element => {
  // 当前 Markdown 草稿。
  const [draft, setDraft] = useState<NoteDraft>(
    initialDraft || INITIAL_NOTE_DRAFT,
  );
  // 当前 Markdown 编辑器预览模式。
  const [previewMode, setPreviewMode] = useState<MarkdownPreviewMode>("edit");
  // 来源下拉框是否打开。
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  // 下拉框容器的 DOM 引用。
  const selectRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    /**
     * 处理点击外部区域时自动关闭下拉框。
     */
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsSelectOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Markdown 预览切换按钮命令。
  const previewToggleCommand: ICommand = {
    name: "preview-toggle",
    keyCommand: "preview-toggle",
    buttonProps: {
      "aria-label": previewMode === "edit" ? "切换到预览" : "切换到编辑",
    },
    icon:
      previewMode === "edit" ? (
        <Eye className="h-3 w-3" />
      ) : (
        <FileText className="h-3 w-3" />
      ),
    execute: () => {
      setPreviewMode((currentMode) =>
        currentMode === "edit" ? "preview" : "edit",
      );
    },
  };

  /**
   * 更新草稿局部字段。
   */
  const handleDraftChange = (patch: Partial<NoteDraft>): void => {
    setDraft((currentDraft) => ({ ...currentDraft, ...patch }));
  };

  /**
   * 保存当前 Markdown 草稿。
   */
  const handleSave = (): void => {
    if (!draft.title.trim() || !draft.content.trim()) {
      return;
    }

    onSave(draft);
  };

  useEffect(() => {
    /**
     * 处理 Escape 快捷关闭。
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] animate-modal-backdrop-in sm:p-6">
      <section
        aria-labelledby="note-markdown-modal-title"
        aria-modal="true"
        className="w-full max-w-[920px] rounded-[6px] border border-white/15 bg-[#212121] shadow-[0_28px_90px_rgba(0,0,0,0.76)] animate-card-modal-in"
        role="dialog"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2.5 px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-white/60" />
            <h2
              id="note-markdown-modal-title"
              className="text-sm font-bold text-white"
            >
              {initialDraft ? "编辑 Markdown 笔记" : "编写 Markdown 笔记"}
            </h2>
          </div>
          <button
            type="button"
            aria-label="关闭 Markdown 笔记弹窗"
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] text-white/45 transition-colors duration-150 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[82vh] overflow-y-auto p-3.5 custom-scrollbar">
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr_148px]">
              <label className="flex flex-col gap-1 text-sm font-semibold tracking-wide text-white/55">
                笔记标题
                <input
                  aria-label="Markdown 笔记标题"
                  className="rounded-[6px] border border-white/10 bg-black px-3 py-1.5 text-sm font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                  placeholder="给这段 Markdown 一个临时标题"
                  value={draft.title}
                  onChange={(event) =>
                    handleDraftChange({ title: event.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold tracking-wide text-white/55">
                标签
                <input
                  aria-label="Markdown 笔记标签"
                  className="rounded-[6px] border border-white/10 bg-black px-3 py-1.5 text-sm font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                  placeholder="用逗号分隔，例如 架构, 待整理"
                  value={draft.tags}
                  onChange={(event) =>
                    handleDraftChange({ tags: event.target.value })
                  }
                />
              </label>
              <div
                ref={selectRef}
                className="relative flex flex-col gap-1 text-sm font-semibold tracking-wide text-white/55"
              >
                来源
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={isSelectOpen}
                  aria-label="Markdown 笔记来源"
                  className="flex h-[30px] w-full items-center justify-between rounded-[6px] border border-white/10 bg-black px-3 py-1.5 text-sm font-normal text-white/80 outline-none transition-colors duration-150 hover:border-white/20 focus:border-white/25"
                  onClick={() => setIsSelectOpen((prev) => !prev)}
                >
                  <span>{draft.source}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-white/55 transition-transform duration-150 ${isSelectOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isSelectOpen && (
                  <div
                    role="listbox"
                    className="absolute top-[100%] left-0 z-50 mt-1 w-full rounded-[6px] border border-white/10 bg-black p-1 shadow-lg"
                  >
                    {NOTE_SOURCE_OPTIONS.map((source) => {
                      const isSelected = draft.source === source;
                      return (
                        <button
                          key={source}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`flex w-full items-center justify-between rounded-[4px] px-2.5 py-1.5 text-xs font-normal outline-none transition-colors duration-150 hover:bg-white/10 hover:text-white ${
                            isSelected
                              ? "bg-white/5 text-white"
                              : "text-white/70"
                          }`}
                          onClick={() => {
                            handleDraftChange({ source });
                            setIsSelectOpen(false);
                          }}
                        >
                          <span>{source}</span>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-white" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 text-sm font-semibold tracking-wide text-white/55">
              Markdown 正文
              <MDEditor
                className="notes-markdown-editor"
                commands={NOTE_MARKDOWN_BASE_COMMANDS}
                data-color-mode="dark"
                extraCommands={[previewToggleCommand]}
                height={430}
                preview={previewMode}
                style={MARKDOWN_EDITOR_THEME_STYLE}
                textareaProps={{
                  "aria-label": "Markdown 笔记正文",
                  placeholder:
                    "支持标题、列表、引用、表格、任务列表等 Markdown 写法...",
                }}
                value={draft.content}
                visibleDragbar={false}
                onChange={(value) =>
                  handleDraftChange({ content: value ?? "" })
                }
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 py-2.5 px-4">
          <span className="font-mono text-xs text-white/30">
            ESC 关闭 / 当前仅保存到本地页面状态
          </span>
          <button
            type="button"
            className="group flex items-center gap-1.5 rounded-[6px] bg-white px-3 py-1.5 text-xs font-bold text-black transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
            disabled={!draft.title.trim() || !draft.content.trim()}
            onClick={handleSave}
          >
            {initialDraft ? (
              <Check className="h-3.5 w-3.5 text-black" />
            ) : (
              <Plus className="h-3.5 w-3.5 transition-transform duration-150 group-hover:rotate-90" />
            )}
            {initialDraft ? "更新 Markdown 笔记" : "保存 Markdown 笔记"}
          </button>
        </div>
      </section>
    </div>
  );
};

/**
 * NotesPage 组件 - 展示自由笔记素材池。
 * 提供素材筛选与新建 Markdown 笔记交互。
 */
export const NotesPage = (): React.JSX.Element => {
  // 当前页面笔记列表。
  const [notes, setNotes] = useState<NoteMaterialItem[]>(INITIAL_NOTES);
  // 当前激活的笔记筛选。
  const [activeFilter, setActiveFilter] = useState<NotesFilter>("all");
  // Markdown 编辑弹窗是否打开。
  const [isMarkdownModalOpen, setIsMarkdownModalOpen] = useState(false);
  // 正在编辑的笔记。若为 null 则表示非编辑状态。
  const [editingNote, setEditingNote] = useState<NoteMaterialItem | null>(null);

  // 当前页面统计项。
  const statsItems = createStatsItems(notes);
  // 当前筛选后的笔记列表。
  const visibleNotes = filterNotes(notes, activeFilter);

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
  const handleDeleteNote = (id: string): void => {
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
  };

  /**
   * 更新素材池中的笔记。
   */
  const handleUpdateNote = (id: string, draft: NoteDraft): void => {
    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === id
          ? {
              ...note,
              title: draft.title.trim(),
              content: draft.content.trim(),
              source: draft.source,
              tags: parseTags(draft.tags),
            }
          : note,
      ),
    );
    setEditingNote(null);
  };

  /**
   * 保存 Markdown 笔记到当前页面素材池。
   */
  const handleSaveMarkdownNote = (draft: NoteDraft): void => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timeStr = `${year}-${month}-${date} ${hours}:${minutes}`;

    const newNote: NoteMaterialItem = {
      id: `n-${now.getTime()}`,
      title: draft.title.trim(),
      content: draft.content.trim(),
      source: draft.source,
      tags: parseTags(draft.tags),
      time: timeStr,
      isCurated: false,
      clue: "可能关联主题「Markdown 新素材」",
    };

    setNotes((currentNotes) => [newNote, ...currentNotes]);
    setActiveFilter("all");
    setIsMarkdownModalOpen(false);
  };

  return (
    <section
      aria-label="自由笔记素材池页面"
      className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto lg:overflow-hidden px-1 lg:px-2"
    >
      {/* 顶部标题栏 */}
      <header className="flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
          <span>LIBRARY</span>
          <span>/</span>
          <span>NOTES</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-white">
          自由笔记素材池
        </h1>
      </header>

      {/* 笔记页面主体滚动区域 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3">
        {/* 顶部指标卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
          {statsItems.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className={`rounded-[6px] border p-3 flex items-center justify-between ${
                  stat.highlight
                    ? "border-white/10 bg-[#212121]"
                    : "border-white/5 bg-[#212121]"
                }`}
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

        {/* 分类视图与工具栏 */}
        <div className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[#000000] p-1 rounded-[6px] border border-white/5 self-start">
            {[
              {
                id: "all" as const,
                label: `全部素材 (${statsItems[0].value})`,
              },
              {
                id: "pending" as const,
                label: `待整理 (${statsItems[1].value})`,
              },
              {
                id: "curated" as const,
                label: `已整理 (${statsItems[2].value})`,
              },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`px-3 py-1 text-xs rounded-[6px] transition-all duration-150 ${
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30 font-mono">
              本地剪贴板监听自动捕获已启用
            </span>
            <button
              type="button"
              aria-label="新建 Markdown 素材"
              className="group flex h-7 w-7 items-center justify-center rounded-[6px] border border-white/10 bg-black text-white/65 transition-all duration-150 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
              onClick={() => setIsMarkdownModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 transition-transform duration-150 group-hover:rotate-90" />
            </button>
          </div>
        </div>

        {/* 自由随记卡片瀑布流布局 */}
        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-3 w-full mb-1">
          {visibleNotes.map((note) => (
            <div
              key={note.id}
              className={`group break-inside-avoid mb-3 rounded-[6px] border p-3.5 flex flex-col gap-3 transition-all duration-150 ${
                note.isCurated
                  ? "border-white/5 bg-[#212121]/40"
                  : "border-white/10 bg-[#212121]"
              }`}
            >
              {/* 卡片头部：时间与操作按钮（编辑/删除） */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-mono text-white/30">
                  <Clock className="h-2.5 w-2.5" />
                  <span>{note.time}</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-50 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center rounded-[4px] text-white/40 hover:bg-white/10 hover:text-white transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                    onClick={() => handleEditNote(note)}
                    title="编辑笔记"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center rounded-[4px] text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                    onClick={() => handleDeleteNote(note.id)}
                    title="删除笔记"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
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
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-[6px] bg-white/10 px-1.5 py-0.5 text-[11px] text-white/60 font-medium">
                  {note.source}
                </span>
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
      </div>

      {isMarkdownModalOpen || editingNote ? (
        <NoteMarkdownModal
          initialDraft={
            editingNote
              ? {
                  title: editingNote.title,
                  content: editingNote.content,
                  source: editingNote.source,
                  tags: editingNote.tags.join(", "),
                }
              : undefined
          }
          onClose={() => {
            setIsMarkdownModalOpen(false);
            setEditingNote(null);
          }}
          onSave={(draft) => {
            if (editingNote) {
              handleUpdateNote(editingNote.id, draft);
            } else {
              handleSaveMarkdownNote(draft);
            }
          }}
        />
      ) : null}
    </section>
  );
};
