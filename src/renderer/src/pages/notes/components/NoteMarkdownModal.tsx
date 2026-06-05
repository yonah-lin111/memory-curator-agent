import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Clock,
  FileText,
  Tag as TagIcon,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { Tag } from "@/components/ui/Tag";
import { Select, type SelectOption } from "@/components/ui/Select";
import type { NoteMaterialItem, NoteDraft } from "@/pages/notes/NotesPage";

// 笔记弹窗属性。
type NoteMarkdownModalProps = {
  // 弹窗关闭回调。
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

/**
 * NoteMarkdownModal - Markdown 笔记编辑弹窗。
 * 复用 Today 添加弹窗的交互模式，但为长文本编辑提供更宽的双栏空间。
 */
export const NoteMarkdownModal = ({
  onClose,
  onSave,
  initialDraft,
}: NoteMarkdownModalProps): React.JSX.Element => {
  // 当前 Markdown 草稿。
  const [draft, setDraft] = useState<NoteDraft>(
    initialDraft || INITIAL_NOTE_DRAFT,
  );
  // 属性 Popover 是否打开。
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  // 标签输入草稿。
  const [tagInput, setTagInput] = useState<string>("");
  // Popover 容器的 DOM 引用。
  const popoverRef = useRef<HTMLDivElement | null>(null);

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
        <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2 px-4">
          {/* 顶栏左侧：标题输入区，无缝结合弹窗标题与笔记标题输入 */}
          <div className="flex items-center gap-2 flex-1 max-w-[500px]">
            <FileText className="h-3.5 w-3.5 text-white/45 flex-shrink-0" />
            <input
              aria-label="Markdown note title"
              id="note-markdown-modal-title"
              className="w-full bg-transparent border-0 px-0 py-1 text-sm font-semibold text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:placeholder:text-white/10"
              placeholder={initialDraft ? "编辑 Markdown 笔记标题..." : "给这段 Markdown 一个临时标题..."}
              value={draft.title}
              onChange={(event) =>
                handleDraftChange({ title: event.target.value })
              }
            />
          </div>

          {/* 顶栏右侧：功能性关闭按钮 */}
          <div className="flex items-center gap-3.5 flex-shrink-0">
            {draft.time && (
              <div className="flex items-center gap-1 text-[11px] font-mono text-white/30 leading-none">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="text-sm">{draft.time}</span>
              </div>
            )}
            {/* 关闭按钮 */}
            <IconButton
              aria-label="Close Markdown note modal"
              preset="close"
              onClick={onClose}
            />
          </div>
        </div>

        <div className="p-3">
          <MarkdownEditor
            className="notes-markdown-editor"
            height={520}
            id="note-markdown-editor"
            placeholder="支持标题、列表、引用、表格、任务列表等 Markdown 写法..."
            value={draft.content}
            onChange={(value) => handleDraftChange({ content: value })}
          />
        </div>

        <div className="flex items-center justify-between border-t border-white/5 py-2.5 px-4">
          {/* 底部左侧：设置标签和来源渠道的悬浮 Popover 入口 */}
          <div ref={popoverRef} className="relative">
            <IconButton
              iconOnly={false}
              hoverBgClass=""
              hoverTextClass=""
              className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium outline-none ${
                isPopoverOpen
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/10 bg-black/40 text-white/50 hover:border-white/20 hover:text-white"
              }`}
              onClick={() => setIsPopoverOpen((prev) => !prev)}
            >
              <TagIcon className="h-3 w-3" />
              <span className="max-w-[120px] truncate">
                {draft.tags.length > 0 ? draft.tags.join(", ") : "无标签"}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-[11px] text-white/45">{draft.source}</span>
              <ChevronDown
                className={`h-3 w-3 text-white/35 transition-transform duration-150 ${isPopoverOpen ? "rotate-180" : ""}`}
              />
            </IconButton>

            {/* Popover 内容区域（向上弹出） */}
            {isPopoverOpen && (
              <div className="absolute left-0 bottom-[calc(100%+8px)] w-[280px] rounded-[6px] border border-white/10 bg-[#212121] p-3.5 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] animate-card-modal-in z-50 flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-white/45 uppercase tracking-wider text-left">关联标签</span>
                  <div className="rounded-[6px] border border-white/10 bg-black/40 p-2">
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {draft.tags.map((tag) => (
                        <Tag
                          key={tag}
                          prefix="#"
                          onClose={() => {
                            handleDraftChange({
                              tags: draft.tags.filter((t) => t !== tag),
                            });
                          }}
                        >
                          {tag}
                        </Tag>
                      ))}
                    </div>
                    <input
                      aria-label="Input new tag"
                      disabled={draft.tags.length >= 6}
                      className="w-full rounded-[6px] border border-white/10 bg-black px-2 py-1 text-xs font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed"
                      placeholder={draft.tags.length >= 6 ? "最多可添加 6 个标签" : "输入新标签并按回车确认..."}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const trimmed = tagInput.trim();
                          if (trimmed) {
                            if (draft.tags.length >= 6) {
                              return;
                            }
                            if (!draft.tags.includes(trimmed)) {
                              handleDraftChange({
                                tags: [...draft.tags, trimmed],
                              });
                            }
                            setTagInput("");
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-white/45 uppercase tracking-wider text-left">来源渠道</span>
                  <Select
                    value={draft.source}
                    options={NOTE_SOURCE_SELECT_OPTIONS}
                    position="up"
                    bgClass="bg-black"
                    align="left"
                    onChange={(source) => handleDraftChange({ source })}
                  />
                </div>
              </div>
            )}
          </div>

          <IconButton
            preset={initialDraft ? "confirm" : "add"}
            iconOnly={false}
            highlighted
            className="px-3 py-1.5 text-xs font-bold gap-1.5"
            disabled={!draft.title.trim() || !draft.content.trim()}
            onClick={handleSave}
          >
            {initialDraft ? "更新 Markdown 笔记" : "保存 Markdown 笔记"}
          </IconButton>
        </div>
      </section>
    </div>
  );
};
