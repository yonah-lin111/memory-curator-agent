import type React from "react";
import { useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import type { ICommand } from "@uiw/react-md-editor/commands";
import { getCommands } from "@uiw/react-md-editor/commands-cn";
import { fullscreen } from "@uiw/react-md-editor/commands";
import "@uiw/react-md-editor/markdown-editor.css";
import { Columns2 } from "lucide-react";

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
  // 编辑器预览模式。
  const [previewMode, setPreviewMode] = useState<"edit" | "live">("edit");

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
        <MDEditor
          className="notes-markdown-editor"
          commands={NOTE_MARKDOWN_BASE_COMMANDS}
          data-color-mode="dark"
          extraCommands={[
            {
              name: "toggle-preview",
              keyCommand: "toggle-preview",
              buttonProps: {
                "aria-label": "切换双栏分屏预览",
                title: "切换双栏分屏预览",
              },
              icon: <Columns2 className="h-3 w-3" />,
              execute: () => {
                setPreviewMode((currentMode) =>
                  currentMode === "edit" ? "live" : "edit",
                );
              },
            },
            fullscreen,
          ]}
          height="100%"
          preview={previewMode}
          style={MARKDOWN_EDITOR_THEME_STYLE}
          textareaProps={{
            "aria-label": "日记正文",
            placeholder: "写下今天的日记与主观感受...",
            onBlur,
          }}
          value={value}
          visibleDragbar={false}
          onChange={(nextValue) => onChange(nextValue ?? "")}
        />
      </div>
    </section>
  );
};
