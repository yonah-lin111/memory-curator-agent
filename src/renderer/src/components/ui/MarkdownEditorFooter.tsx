import type React from "react";
import { useEffect, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import {
  MAX_MARKDOWN_EDITOR_FONT_SIZE,
  MIN_MARKDOWN_EDITOR_FONT_SIZE,
} from "@/lib/markdownEditorFontSize";

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
  // 当前编辑器字号。
  fontSize: number;
  // 编辑器字号变更回调。
  onFontSizeChange: (fontSize: number) => void;
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
  fontSize,
  onFontSizeChange,
}: MarkdownEditorFooterProps): React.JSX.Element => {
  const characterCount = Array.from(value).length;
  const [fontSizeInput, setFontSizeInput] = useState(String(fontSize));

  useEffect(() => {
    setFontSizeInput(String(fontSize));
  }, [fontSize]);

  /**
   * 将输入字号限制在编辑器支持的范围内。
   */
  const updateFontSize = (nextFontSize: number): void => {
    const clampedFontSize = Math.min(
      MAX_MARKDOWN_EDITOR_FONT_SIZE,
      Math.max(MIN_MARKDOWN_EDITOR_FONT_SIZE, nextFontSize),
    );
    setFontSizeInput(String(clampedFontSize));
    onFontSizeChange(clampedFontSize);
  };

  /**
   * 提交手动输入的字号，并恢复无效输入。
   */
  const commitFontSizeInput = (): void => {
    const nextFontSize = Number(fontSizeInput);
    if (fontSizeInput === "" || !Number.isInteger(nextFontSize)) {
      setFontSizeInput(String(fontSize));
      return;
    }

    updateFontSize(nextFontSize);
  };

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
      <div className="flex items-center gap-0.5">
        <IconButton
          aria-label="缩小字号"
          disabled={fontSize <= MIN_MARKDOWN_EDITOR_FONT_SIZE}
          onClick={() => updateFontSize(fontSize - 1)}
          size="small"
          title="缩小字号"
        >
          <ZoomOut className="h-3 w-3" />
        </IconButton>
        <input
          aria-label="编辑器字号"
          className="h-5 w-8 appearance-none bg-transparent p-0 text-center text-xs tabular-nums text-white outline-none transition-colors"
          inputMode="numeric"
          onBlur={commitFontSizeInput}
          onChange={(event) => {
            if (/^\d*$/.test(event.target.value)) setFontSizeInput(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          pattern="\d*"
          type="text"
          value={fontSizeInput}
        />
        <IconButton
          aria-label="放大字号"
          disabled={fontSize >= MAX_MARKDOWN_EDITOR_FONT_SIZE}
          onClick={() => updateFontSize(fontSize + 1)}
          size="small"
          title="放大字号"
        >
          <ZoomIn className="h-3 w-3" />
        </IconButton>
      </div>
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
