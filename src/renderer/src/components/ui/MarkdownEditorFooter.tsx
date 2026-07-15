import type React from "react";

// Markdown 编辑器底栏属性。
interface MarkdownEditorFooterProps {
  // 当前 Markdown 内容。
  value: string;
  // 是否显示保存状态。
  showSaveStatus: boolean;
  // 当前内容是否已保存。
  isSaved: boolean;
}

/**
 * MarkdownEditorFooter - 展示 Markdown 字数与保存状态。
 */
export const MarkdownEditorFooter = ({
  value,
  showSaveStatus,
  isSaved,
}: MarkdownEditorFooterProps): React.JSX.Element => {
  const characterCount = Array.from(value).length;

  return (
    <div className="relative z-20 flex h-8 flex-none items-center gap-3 px-2 text-xs text-white/45">
      <span>{`字数：${characterCount}`}</span>
      {showSaveStatus && value.trim() !== "" && (
        <span aria-live="polite" className="ml-auto flex items-center gap-1.5">
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
