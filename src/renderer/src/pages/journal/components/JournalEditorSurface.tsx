import type React from "react";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";

// 日记编辑器区域属性。
interface JournalEditorSurfaceProps {
  // 当前正文内容。
  value: string;
  // 内容变化回调。
  onChange: (value: string) => void;
  // 失焦回调。
  onBlur: () => void;
  // 左侧头部日期选择器
  headerLeft?: React.ReactNode;
}

/**
 * JournalEditorSurface - 日记页右侧沉浸编辑器。
 */
export const JournalEditorSurface = ({
  value,
  onChange,
  onBlur,
  headerLeft,
}: JournalEditorSurfaceProps): React.JSX.Element => {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[6px] border border-white/6 bg-[#212121] p-4 gap-3">
      {headerLeft && (
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            {headerLeft}
          </div>
        </div>
      )}
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
