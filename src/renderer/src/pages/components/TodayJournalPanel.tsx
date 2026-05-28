import type React from "react";
import { BookOpen, HelpCircle } from "lucide-react";
import { MarkdownEditor } from "@renderer/components/ui/MarkdownEditor";

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
  return (
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 flex-shrink-0 mb-1">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">
            日记与主观表达
          </span>
          <div className="relative group inline-flex items-center">
            <HelpCircle className="h-3.5 w-3.5 text-white/30 hover:text-white/60 cursor-help transition-colors" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 w-48 rounded-[6px] bg-[#000000] border border-white/10 p-2 text-xs font-normal text-white/70 leading-normal whitespace-normal z-50 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              写下今日的深度思考与心路历程，保留真实完整的数字记忆。
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-white/40">
          <span>最近保存: {lastSavedAt ?? "未保存"}</span>
        </div>
      </div>
      <div className="p-1">
        <MarkdownEditor
          className="notes-markdown-editor"
          height={450}
          id="today-journal-editor"
          placeholder="写下今天的日记与主观感受..."
          value={journalContent}
          onBlur={onJournalBlur}
          onChange={onJournalContentChange}
        />
      </div>
    </div>
  );
};
