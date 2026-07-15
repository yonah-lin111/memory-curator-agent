import type React from "react";
import { redo, undo } from "@codemirror/commands";
import {
  Bold,
  Code,
  Code2,
  Eye,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  SquareSplitHorizontal,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { IconButton } from "@/components/ui/IconButton";
import type { MarkdownEditorHandle } from "@/components/ui/MarkdownEditor";
import { Tooltip } from "@/components/ui/Tooltip";

// 工具栏图标类型。
type MarkdownToolbarIcon = React.ComponentType<{ className?: string }>;

// 工具栏按钮命令类型。
type MarkdownToolbarCommand = Parameters<
  MarkdownEditorHandle["execCommand"]
>[0];

// 独立 Markdown 编辑器工具栏属性。
interface MarkdownEditorToolbarProps {
  // Markdown 编辑器控制句柄。
  editorRef: RefObject<MarkdownEditorHandle | null>;
  // 编辑器默认预览模式。
  defaultMode?: "edit" | "preview" | "split";
}

// Markdown 编辑器预览模式。
type MarkdownPreviewMode = "edit" | "preview" | "split";

// 工具项配置。
interface MarkdownToolbarActionProps {
  // 工具项图标。
  icon: MarkdownToolbarIcon;
  // 工具项名称。
  label: string;
  // 工具项点击回调。
  onClick: () => void;
  // 是否将工具项推到工具栏最右侧。
  alignRight?: boolean;
  // 是否使用选中状态样式。
  highlighted?: boolean;
}

// 工具栏按钮。
const MarkdownToolbarAction = ({
  icon: Icon,
  label,
  onClick,
  alignRight = false,
  highlighted = false,
}: MarkdownToolbarActionProps): React.JSX.Element => (
  <Tooltip
    className={alignRight ? "ml-auto" : ""}
    content={label}
    placement="bottom"
    trigger="hover"
  >
    <IconButton
      aria-label={label}
      className="h-7 w-7"
      highlighted={highlighted}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </IconButton>
  </Tooltip>
);

/**
 * MarkdownEditorToolbar - 单行 Markdown 编辑工具栏。
 */
export const MarkdownEditorToolbar = ({
  editorRef,
  defaultMode = "edit",
}: MarkdownEditorToolbarProps): React.JSX.Element => {
  const [previewMode, setPreviewMode] = useState<MarkdownPreviewMode>(defaultMode);

  useEffect(() => {
    setPreviewMode(defaultMode);
  }, [defaultMode]);

  /**
   * 设置编辑器预览模式，并同步工具栏按钮高亮状态。
   */
  const changePreviewMode = (mode: MarkdownPreviewMode): void => {
    if (mode === "preview") {
      editorRef.current?.togglePreviewOnly(true);
    } else {
      editorRef.current?.togglePreviewOnly(false);
      editorRef.current?.togglePreview(mode === "split");
    }
    setPreviewMode(mode);
  };

  /**
   * 执行 Markdown 命令并将焦点还给编辑器，保持当前选区可继续操作。
   */
  const execute = (command: MarkdownToolbarCommand): void => {
    editorRef.current?.execCommand(command);
    editorRef.current?.focus();
  };

  /**
   * 使用 CodeMirror 历史记录撤销最近一次编辑。
   */
  const undoEdit = (): void => {
    const view = editorRef.current?.getEditorView();
    if (view) undo(view);
  };

  /**
   * 使用 CodeMirror 历史记录恢复最近一次撤销的编辑。
   */
  const redoEdit = (): void => {
    const view = editorRef.current?.getEditorView();
    if (view) redo(view);
  };

  const actions: MarkdownToolbarActionProps[] = [
    { icon: Undo2, label: "撤回", onClick: undoEdit },
    { icon: Redo2, label: "重做", onClick: redoEdit },
    { icon: Bold, label: "粗体", onClick: () => execute("bold") },
    { icon: Italic, label: "斜体", onClick: () => execute("italic") },
    {
      icon: Strikethrough,
      label: "删除线",
      onClick: () => execute("strikeThrough"),
    },
    { icon: List, label: "无序列表", onClick: () => execute("unorderedList") },
    {
      icon: ListOrdered,
      label: "有序列表",
      onClick: () => execute("orderedList"),
    },
    { icon: ListTodo, label: "任务列表", onClick: () => execute("task") },
    { icon: Quote, label: "引用", onClick: () => execute("quote") },
    { icon: Code2, label: "行内代码", onClick: () => execute("codeRow") },
    { icon: Code, label: "代码块", onClick: () => execute("code") },
    { icon: Link, label: "链接", onClick: () => execute("link") },
    { icon: Table2, label: "表格", onClick: () => execute("table") },
    {
      icon: SquareSplitHorizontal,
      label: "双栏预览",
      onClick: () => changePreviewMode(previewMode === "split" ? "edit" : "split"),
      alignRight: true,
      highlighted: previewMode === "split",
    },
    {
      icon: Eye,
      label: "仅预览",
      onClick: () => changePreviewMode(previewMode === "preview" ? "edit" : "preview"),
      highlighted: previewMode === "preview",
    },
  ];

  return (
    <div className="relative z-20 flex h-8 flex-none items-center gap-0.5 overflow-x-auto px-1">
      {actions.map((action) => (
        <MarkdownToolbarAction key={action.label} {...action} />
      ))}
    </div>
  );
};
