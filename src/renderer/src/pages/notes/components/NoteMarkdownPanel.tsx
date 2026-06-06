import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Tag as TagIcon } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useHeaderStore } from "@/lib/headerStore";
import type { NoteMaterialItem, NoteDraft } from "@/pages/notes/NotesPage";

// 笔记编辑面板属性。
type NoteMarkdownPanelProps = {
  // 面板关闭回调。
  onClose: () => void;
  // 保存 Markdown 笔记回调。
  onSave: (draft: NoteDraft) => void;
  // 初始草稿（编辑时传入）。
  initialDraft?: NoteDraft;
};

// 笔记来源选项。
const NOTE_SOURCE_OPTIONS: NoteMaterialItem["source"][] = [
  "随手速记",
  "聊天粘贴",
  "截图文字",
  "会议摘要",
];

// 笔记来源下拉选项。
const NOTE_SOURCE_SELECT_OPTIONS: SelectOption<NoteMaterialItem["source"]>[] =
  NOTE_SOURCE_OPTIONS.map((source) => ({
    value: source,
    label: source,
  }));

// Markdown 笔记初始草稿。
const INITIAL_NOTE_DRAFT: NoteDraft = {
  title: "",
  content:
    "## 今天的新素材\n\n- [ ] 先保留原始想法\n- [ ] 再交给 Agent 做主题策展\n\n> Markdown 支持标题、列表、引用、表格与任务列表。\n\n| 字段 | 状态 |\n| --- | --- |\n| 来源 | 待整理 |",
  source: "随手速记",
  tags: [],
};

// 顶部标题输入框受控组件。
type HeaderTitleInputProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

const HeaderTitleInput = ({
  value,
  placeholder,
  onChange,
}: HeaderTitleInputProps): React.JSX.Element => {
  const [val, setVal] = useState(value);

  // 监听外部 value 属性的变化（用于初始草稿加载）
  useEffect(() => {
    setVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setVal(newVal);
    onChange(newVal);
  };

  return (
    <input
      aria-label="Markdown note title"
      className="w-full bg-transparent border-0 px-0 py-1 text-sm font-semibold text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:placeholder:text-white/10"
      placeholder={placeholder}
      value={val}
      onChange={handleChange}
    />
  );
};

/**
 * NoteMarkdownPanel - Markdown 笔记编辑面板。
 * 嵌入在主素材页面中，且将所有操作和标题输入完美同步至系统顶栏。
 */
export const NoteMarkdownPanel = ({
  onClose,
  onSave,
  initialDraft,
}: NoteMarkdownPanelProps): React.JSX.Element => {
  // 当前 Markdown 草稿。
  const [draft, setDraft] = useState<NoteDraft>(
    initialDraft || INITIAL_NOTE_DRAFT,
  );
  // 属性 Popover 是否打开。
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  // Popover 容器的 DOM 引用。
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // 全局标题与右侧动作 Store。
  const { setCustomTitle, setExtraActions, setHideChatButton, resetHeader } =
    useHeaderStore();

  useEffect(() => {
    /**
     * 处理点击外部区域时自动关闭 Popover。
     */
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;

      // 如果点击在 popover 外部，则关闭整个 popover
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // 1. 同步标题输入框至全局 Header 面包屑后面
  useEffect(() => {
    setCustomTitle(
      <div className="flex items-center gap-1.5 flex-1 max-w-[400px]">
        <FileText className="h-3.5 w-3.5 text-white/45 flex-shrink-0" />
        <HeaderTitleInput
          value={draft.title}
          placeholder={
            initialDraft ? "编辑笔记标题..." : "给笔记一个临时标题..."
          }
          onChange={(val) => handleDraftChange({ title: val })}
        />
      </div>,
    );
    setHideChatButton(true);

    return () => {
      resetHeader();
    };
  }, [draft.title, initialDraft, setCustomTitle, setHideChatButton, resetHeader]);

  // 2. 同步设置标签、来源渠道的 Popover，以及关闭和保存按钮至全局 Header 右侧
  useEffect(() => {
    const isSaveDisabled = !draft.title.trim() || !draft.content.trim();

    setExtraActions(
      <div className="flex items-center gap-1.5 animate-card-modal-in">
        {/* 底部设置标签和来源渠道的悬浮 Popover 入口 */}
        <div ref={popoverRef} className="relative">
          <IconButton
            iconOnly={false}
            hoverBgClass=""
            hoverTextClass=""
            className={`flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium outline-none h-7 rounded-[6px] ${
              isPopoverOpen
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 bg-black/40 text-white/50 hover:border-white/20 hover:text-white"
            }`}
            onClick={() => setIsPopoverOpen((prev) => !prev)}
          >
            <TagIcon className="h-3 w-3" />
            <span className="max-w-[120px] truncate text-xs">
              {draft.tags.length > 0 ? draft.tags.join(", ") : "无标签"}
            </span>
            <span className="text-white/20">|</span>
            <span className="text-[11px] text-white/45">{draft.source}</span>
            <ChevronDown
              className={`h-3 w-3 text-white/35 transition-transform duration-150 ${isPopoverOpen ? "rotate-180" : ""}`}
            />
          </IconButton>

          {/* Popover 内容区域（向下弹出） */}
          {isPopoverOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[280px] rounded-[6px] border border-white/10 bg-[#212121] p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] animate-card-modal-in z-50 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-white/45 uppercase tracking-wider text-left">
                  关联标签
                </span>
                <Input
                  as="tags"
                  tags={draft.tags}
                  onChangeTags={(tags) => handleDraftChange({ tags })}
                  size="xs"
                  aria-label="Input new tag"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-white/45 uppercase tracking-wider text-left">
                  来源渠道
                </span>
                <Select
                  value={draft.source}
                  options={NOTE_SOURCE_SELECT_OPTIONS}
                  position="down"
                  align="left"
                  onChange={(source) => handleDraftChange({ source })}
                />
              </div>
            </div>
          )}
        </div>

        {/* 保存按钮 */}
        <IconButton
          preset="save"
          onClick={handleSave}
          disabled={isSaveDisabled}
          title={initialDraft ? "更新笔记" : "保存笔记"}
          aria-label="Save"
        />

        {/* 关闭按钮 */}
        <IconButton
          preset="close"
          onClick={onClose}
          title="取消编辑"
          aria-label="Cancel"
        />
      </div>,
    );
  }, [draft, isPopoverOpen, initialDraft, onClose, setExtraActions]);

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-card-modal-in rounded-[6px] border border-white/6 bg-[#212121]">
      <div className="flex-1 p-3 min-h-0">
        <MarkdownEditor
          className="notes-markdown-editor h-full"
          height="100%"
          id="note-markdown-editor"
          placeholder="支持标题、列表、引用、表格、任务列表等 Markdown 写法..."
          value={draft.content}
          onChange={(value) => handleDraftChange({ content: value })}
        />
      </div>
    </div>
  );
};
