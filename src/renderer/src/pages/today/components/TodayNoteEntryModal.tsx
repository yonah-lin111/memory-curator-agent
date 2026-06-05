import type React from "react";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";

export type NoteItem = {
  // 片段唯一标识。
  id: number;
  // 片段标题。
  title: string;
  // 片段正文。
  content: string;
  // 片段标签列表。
  tags: string[];
  // 列表展示时间。
  time: string;
};

type TodayNoteEntryModalProps = {
  // 当前编辑的随记卡片（新建时为 null 或 undefined）
  note?: NoteItem | null;
  // 关闭弹窗回调
  onClose: () => void;
  // 保存回调，参数支持带 id 的更新，不带 id 的新建
  onSave: (note: { id?: number; title: string; content: string; tags: string[] }) => Promise<boolean>;
};

/**
 * TodayNoteEntryModal - 自由随记卡片弹窗组件
 * 支持新建和编辑自由随记卡片，带标题、内容、灵感标签功能，并在回车后动态绑定标签。
 */
export const TodayNoteEntryModal = ({
  note,
  onClose,
  onSave,
}: TodayNoteEntryModalProps): React.JSX.Element => {
  // 是否正在保存。
  const [isSaving, setIsSaving] = useState(false);
  // 当前是否为编辑态。
  const isEdit = !!note;
  // 标题输入值。
  const [title, setTitle] = useState(note?.title ?? "");
  // 内容输入值。
  const [content, setContent] = useState(note?.content ?? "");
  // 标签列表。
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  // 标签输入草稿。
  const [tagInput, setTagInput] = useState<string>("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (): Promise<void> => {
    if (!title.trim() && !content.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const isSaved = await onSave({
        id: note?.id,
        title: title.trim(),
        content: content.trim(),
        tags,
      });

      if (!isSaved) {
        return;
      }

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      data-testid="add-entry-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] animate-modal-backdrop-in sm:p-6"
    >
      <section
        aria-labelledby="add-entry-modal-title"
        className="w-full max-w-[520px] rounded-[6px] border border-white/15 bg-[#212121] shadow-[0_28px_90px_rgba(0,0,0,0.76)] animate-card-modal-in"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2.5 px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-white/60" />
            <h2
              id="add-entry-modal-title"
              className="text-sm font-bold text-white"
            >
              {isEdit ? "编辑自由随记卡片" : "新建自由随记卡片"}
            </h2>
          </div>
          <IconButton
            aria-label="Close modal"
            preset="close"
            onClick={onClose}
          />
        </div>

        <div className="flex flex-col gap-2.5 p-3.5">
          <label className="flex flex-col gap-1 text-sm font-semibold tracking-wide text-white/55">
            随记标题
            <input
              aria-label="Snippet title"
              className="rounded-[6px] border border-white/10 bg-black px-3 py-1.5 text-sm font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
              placeholder="给这段想法一个临时标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold tracking-wide text-white/55">
            随记内容
            <textarea
              aria-label="Snippet content"
              className="min-h-24 resize-none rounded-[6px] border border-white/10 bg-black p-2.5 text-sm font-normal leading-relaxed text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
              placeholder="保留原始表达，不急着归类..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold tracking-wide text-white/55">
              灵感标签
            </span>
            <div className="rounded-[6px] border border-white/10 bg-black/40 p-2.5">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Tag
                    key={tag}
                    prefix="#"
                    onClose={() => {
                      setTags((current) => current.filter((t) => t !== tag));
                    }}
                  >
                    {tag}
                  </Tag>
                ))}
              </div>
              <input
                aria-label="Input new tag"
                disabled={tags.length >= 6}
                className="w-full rounded-[6px] border border-white/10 bg-black px-3 py-1.5 text-xs font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed"
                placeholder={tags.length >= 6 ? "最多可添加 6 个标签" : "输入新标签并按回车确认..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = tagInput.trim();
                    if (trimmed) {
                      if (tags.length >= 6) {
                        return;
                      }
                      if (!tags.includes(trimmed)) {
                        setTags((current) => [...current, trimmed]);
                      }
                      setTagInput("");
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 py-2.5 px-4">
          <span className="font-mono text-xs text-white/30">
            ESC 关闭 / 已接入本地持久化
          </span>
          <IconButton
            preset="save"
            iconOnly={false}
            highlighted
            className="px-3 py-1.5 text-xs font-bold gap-1.5"
            disabled={isSaving || (!title.trim() && !content.trim())}
            onClick={() => void handleSubmit()}
          >
            {isSaving ? "保存中..." : "保存随记卡片"}
          </IconButton>
        </div>
      </section>
    </div>
  );
};
