import type React from "react";
import { useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import type { ICommand } from "@uiw/react-md-editor/commands";
import { fullscreen } from "@uiw/react-md-editor/commands";
import { getCommands } from "@uiw/react-md-editor/commands-cn";
import "@uiw/react-md-editor/markdown-editor.css";
import { BookOpen, Columns2, HelpCircle } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";

type MarkdownEditorThemeStyle = React.CSSProperties &
  Record<`--${string}`, string>;

// Markdown 编辑器黑色主题变量。
const MARKDOWN_EDITOR_THEME_STYLE: MarkdownEditorThemeStyle = {
  "--color-canvas-default": "#000000",
  "--color-fg-default": "rgba(255,255,255,0.82)",
  "--color-border-default": "rgba(255,255,255,0.1)",
  "--color-neutral-muted": "rgba(255,255,255,0.08)",
  "--color-accent-fg": "#ffffff",
  "--color-danger-fg": "#ffffff",
  "--md-editor-background-color": "#000000",
  "--md-editor-box-shadow-color": "rgba(255,255,255,0.1)",
  "--md-editor-font-family":
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  borderRadius: "6px",
  overflow: "hidden",
};

// Markdown 基础工具栏命令，移除默认帮助问号。
const NOTE_MARKDOWN_BASE_COMMANDS: ICommand[] = [
  ...getCommands().filter(
    (command) => command.name !== "help" && command.keyCommand !== "help",
  ),
];

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
  // 派生情绪状态。
  predictedMood: string;
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
  isSaving,
  lastSavedAt,
  errorMessage,
  predictedMood,
  onJournalContentChange,
  onJournalBlur,
}: TodayJournalPanelProps): React.JSX.Element => {
  // 日记 MDEditor 预览模式。
  const [journalPreviewMode, setJournalPreviewMode] = useState<
    "edit" | "preview" | "live"
  >("edit");

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
          <span>•</span>
          <span className="text-emerald-400">情绪感知: {predictedMood}</span>
          <span>•</span>
          <IconButton
            aria-label="切换双栏分屏预览"
            className={`h-5 w-5 ${
              journalPreviewMode === "live"
                ? "bg-white/10 text-white hover:bg-white/20 hover:text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
            onClick={() => {
              setJournalPreviewMode((currentMode) =>
                currentMode === "live" ? "edit" : "live",
              );
            }}
          >
            <Columns2 className="h-3 w-3" />
          </IconButton>
        </div>
      </div>
      <div className="p-1">
        <MDEditor
          className="notes-markdown-editor"
          commands={NOTE_MARKDOWN_BASE_COMMANDS}
          data-color-mode="dark"
          extraCommands={[fullscreen]}
          height={450}
          preview={journalPreviewMode}
          style={MARKDOWN_EDITOR_THEME_STYLE}
          textareaProps={{
            "aria-label": "日记正文",
            placeholder: "写下今天的日记与主观感受...",
            onBlur: onJournalBlur,
          }}
          value={journalContent}
          visibleDragbar={false}
          onChange={(value) => onJournalContentChange(value ?? "")}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span
          className={errorMessage ? "text-rose-300/80" : "text-white/35"}
        >
          {errorMessage ??
            (isSaving
              ? "正在自动保存..."
              : "保留完整表达，拒绝以摘要过滤真实情绪感受。")}
        </span>
        <span className="text-white/30">{journalContent.length} 字</span>
      </div>
    </div>
  );
};
