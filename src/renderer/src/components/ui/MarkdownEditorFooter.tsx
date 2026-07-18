import type React from "react";
import { IconButton } from "@/components/ui/IconButton";

// Markdown 编辑器底栏属性。
interface MarkdownEditorFooterProps {
  // 当前 Markdown 内容。
  value: string;
  // 是否显示保存状态。
  showSaveStatus: boolean;
  // 当前内容是否已保存。
  isSaved: boolean;
  // 当前待审的 AI 变更块数量。
  aiChangeCount: number;
  // 接受全部 AI 变更。
  onAcceptAllAiChanges?: () => void;
  // 拒绝全部 AI 变更。
  onRejectAllAiChanges?: () => void;
}

/**
 * MarkdownEditorFooter - 展示 Markdown 字数与保存状态。
 */
export const MarkdownEditorFooter = ({
  value,
  showSaveStatus,
  isSaved,
  aiChangeCount,
  onAcceptAllAiChanges,
  onRejectAllAiChanges,
}: MarkdownEditorFooterProps): React.JSX.Element => {
  const characterCount = Array.from(value).length;

  return (
    <div className="relative z-20 flex h-8 flex-none items-center gap-3 px-2 text-xs text-white/45">
      <span>{`字数：${characterCount}`}</span>
      <span aria-hidden="true" className="min-w-0 flex-1" />
      {aiChangeCount > 0 && (
        <div className="flex items-center gap-1.5">
          <IconButton
            aria-label="Accept all"
            className="h-6 w-auto gap-1 px-1.5 text-xs"
            iconOnly={false}
            onClick={onAcceptAllAiChanges}
            preset="confirm"
            size="small"
          >
            Accept all
          </IconButton>
          <IconButton
            aria-label="Reject all"
            className="h-6 w-auto gap-1 px-1.5 text-xs"
            iconOnly={false}
            onClick={onRejectAllAiChanges}
            preset="delete"
            size="small"
          >
            Reject all
          </IconButton>
        </div>
      )}
      {showSaveStatus && value.trim() !== "" && (
        <span aria-live="polite" className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${isSaved ? "bg-emerald-400" : "bg-amber-400"}`}
          />
          <span>{isSaved ? "已保存" : "未保存"}</span>
        </span>
      )}
    </div>
  );
};
