import type React from "react";
import { BookOpen, Clock3, Smile } from "lucide-react";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";

// 日记编辑器区域属性。
interface JournalEditorSurfaceProps {
  // 当前正文内容。
  value: string;
  // 当前字数。
  wordCount: number;
  // 最近保存时间。
  lastSavedAt: string | null;
  // 情绪线索文案。
  moodLabel: string;
  // 是否存在未保存改动。
  isDirty: boolean;
  // 内容变化回调。
  onChange: (value: string) => void;
  // 失焦回调。
  onBlur: () => void;
}

/**
 * JournalEditorSurface - 日记页沉浸编辑器与状态栏。
 */
export const JournalEditorSurface = ({
  value,
  wordCount,
  lastSavedAt,
  moodLabel,
  isDirty,
  onChange,
  onBlur,
}: JournalEditorSurfaceProps): React.JSX.Element => {
  // 最近保存时间展示值。
  const savedLabel = lastSavedAt 
    ? (lastSavedAt.includes("T") ? new Date(lastSavedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : lastSavedAt.slice(-5))
    : (isDirty ? "等待保存" : "未保存");

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[6px] border border-white/6 bg-[#212121] p-4 gap-3">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white/80">今日日记</span>
        </div>
        <div className="flex items-center gap-4 text-white/50 text-xs">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3" />
            <span>{wordCount} 字</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smile className="h-3 w-3" />
            <span>{moodLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock3 className="h-3 w-3" />
            <span>{savedLabel}</span>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-1">
        <MarkdownEditor
          className="notes-markdown-editor"
          height="100%"
          id="journal-page-editor"
          placeholder="写下今天的日记与主观感受..."
          value={value}
          onBlur={onBlur}
          onChange={(nextValue) => onChange(nextValue ?? "")}
        />
      </div>
    </section>
  );
};
