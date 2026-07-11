import type React from "react";
import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";

// TodayJournalPanel 组件的 Props 接口定义。
interface TodayJournalPanelProps {
  // 今日日记的正文。
  journalContent: string;
  // 是否正在保存。
  isSaving: boolean;
  // 最近一次保存时间。
  lastSavedAt: string | null;
  // 保存失败提示。
  errorMessage: string | null;
  // 日记内容改变时的回调函数。
  onJournalContentChange: (value: string) => void;
  // 编辑器失焦时的回调函数。
  onJournalBlur: () => void;
}

/**
 * TodayJournalPanel - 日记与主观表达面板组件
 */
export const TodayJournalPanel = ({
  journalContent,
  lastSavedAt,
  onJournalContentChange,
  onJournalBlur,
}: TodayJournalPanelProps): React.JSX.Element => {
  const savedLabel = useMemo(() => {
    if (!lastSavedAt) {
      return "未保存";
    }

    return lastSavedAt.includes("T")
      ? new Date(lastSavedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
      : lastSavedAt.slice(-5);
  }, [lastSavedAt]);

  return (
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 flex-shrink-0 mb-1">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">
            日记与主观表达
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-white/40">
          <span>最近保存: {savedLabel}</span>
        </div>
      </div>
      <div className="p-1">
        <MarkdownEditor
          className="notes-markdown-editor"
          height={"77vh"}
          id="today-journal-editor"
          placeholder="写下今天的日记与主观感受..."
          value={journalContent}
          defaultMode="split"
          onBlur={onJournalBlur}
          onChange={onJournalContentChange}
        />
      </div>
    </div>
  );
};
