import type React from "react";
import { useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { Columns2 } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";

// 日记编辑器区域属性。
interface JournalEditorSurfaceProps {
  // 当前正文内容。
  value: string;
  // 底部状态文案。
  statusText: string;
  // 错误提示文案。
  errorMessage: string | null;
  // 内容变化回调。
  onChange: (value: string) => void;
  // 失焦回调。
  onBlur: () => void;
}

/**
 * JournalEditorSurface - 日记页右侧沉浸编辑器。
 */
export const JournalEditorSurface = ({
  value,
  statusText,
  errorMessage,
  onChange,
  onBlur,
}: JournalEditorSurfaceProps): React.JSX.Element => {
  // 编辑器预览模式。
  const [previewMode, setPreviewMode] = useState<"edit" | "live">("edit");

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[6px] border border-white/6 bg-[#212121] p-4">
      <div className="mb-3 flex items-center justify-between border-b border-white/6 pb-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/28">
            Long-form Entry
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
            日记条目回看
          </h2>
        </div>
        <IconButton
          aria-label="切换双栏预览"
          className="h-8 w-8 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
          onClick={() =>
            setPreviewMode((currentMode) =>
              currentMode === "edit" ? "live" : "edit",
            )
          }
        >
          <Columns2 className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[6px] border border-white/6 bg-black/25 p-2">
        <MDEditor
          value={value}
          preview={previewMode}
          visibleDragbar={false}
          height={560}
          textareaProps={{ "aria-label": "日记正文", onBlur }}
          onChange={(nextValue) => onChange(nextValue ?? "")}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className={errorMessage ? "text-rose-300" : "text-white/38"}>
          {errorMessage ?? statusText}
        </span>
        <span className="text-white/30">{value.length} 字</span>
      </div>
    </section>
  );
};
