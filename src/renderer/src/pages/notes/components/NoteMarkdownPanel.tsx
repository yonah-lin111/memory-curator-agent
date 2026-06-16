import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { FileText, Folder, Tag as TagIcon } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import { useHeaderStore } from "@/lib/headerStore";
import type { NoteDraft } from "@/pages/notes/NotesPage";
import type { NoteCategory } from "@/pages/notes/components/NoteCategoryPanel";

// 笔记编辑面板属性。
type NoteMarkdownPanelProps = {
  // 面板关闭回调。
  onClose: () => void;
  // 保存 Markdown 笔记回调。
  onSave: (draft: NoteDraft) => void;
  // 初始草稿（编辑时传入）。
  initialDraft?: NoteDraft;
  // 可选分类列表。
  categories: NoteCategory[];
};

// Markdown 笔记初始草稿。
const INITIAL_NOTE_DRAFT: NoteDraft = {
  title: "",
  content:
    "## 今天的新素材\n\n- [ ] 先保留原始想法\n- [ ] 再交给 Agent 做主题策展\n\n> Markdown 支持标题、列表、引用、表格与任务列表。\n\n| 字段 | 状态 |\n| --- | --- |\n| 分类 | 待整理 |",
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
  categories,
}: NoteMarkdownPanelProps): React.JSX.Element => {
  // 当前 Markdown 草稿。
  const [draft, setDraft] = useState<NoteDraft>(
    initialDraft || INITIAL_NOTE_DRAFT,
  );
  // 全局标题与右侧动作 Store。
  const { setCustomTitle, setExtraActions, setHideChatButton, resetHeader } =
    useHeaderStore();

  // 分类下拉选项（含"无分类"项，用空字符串表示）。
  // 用 useMemo 稳定引用，避免每次渲染产生新数组触发 useEffect 循环。
  const categorySelectOptions: SelectOption<string>[] = useMemo(
    () => [
      { value: "", label: "无分类" },
      ...categories.map((cat) => ({ value: String(cat.id), label: cat.name })),
    ],
    [categories],
  );

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
  }, [
    draft.title,
    initialDraft,
    setCustomTitle,
    setHideChatButton,
    resetHeader,
  ]);

  // 2. 同步设置标签、分类的 Tooltip 弹出面板，以及关闭和保存按钮至全局 Header 右侧
  useEffect(() => {
    const isSaveDisabled = !draft.title.trim() || !draft.content.trim();
    const activeCategory = categories.find((c) => c.id === draft.categoryId);

    setExtraActions(
      <div className="flex items-center gap-1.5 animate-card-modal-in">
        {/* 设置标签和分类的 Tooltip */}
        <Tooltip
          trigger="click"
          placement="bottom"
          contentClassName="!w-[280px] !p-3.5 !whitespace-normal flex flex-col gap-3.5"
          content={
            <>
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
                  所属分类
                </span>
                <Select
                  value={draft.categoryId !== undefined ? String(draft.categoryId) : ""}
                  options={categorySelectOptions}
                  position="down"
                  align="left"
                  onChange={(val) =>
                    handleDraftChange({
                      categoryId: val ? Number(val) : undefined,
                    })
                  }
                />
              </div>
            </>
          }
        >
          <IconButton
            iconOnly={false}
            hoverBgClass=""
            hoverTextClass=""
            className="flex items-center gap-1.5 border border-white/10 bg-[#303030] text-white/50 hover:text-white px-2.5 py-1 text-xs font-medium outline-none h-7 rounded-[6px] transition-colors duration-150"
          >
            <TagIcon className="h-3 w-3" />
            <span className="max-w-[120px] truncate text-xs">
              {draft.tags.length > 0 ? draft.tags.join(", ") : "无标签"}
            </span>
            <span className="text-white/20">|</span>
            <Folder className="h-3 w-3" />
            <span className="text-[11px] text-white/45">
              {activeCategory ? activeCategory.name : "无分类"}
            </span>
          </IconButton>
        </Tooltip>

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
  }, [draft, initialDraft, onClose, setExtraActions, categories, categorySelectOptions]);

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
