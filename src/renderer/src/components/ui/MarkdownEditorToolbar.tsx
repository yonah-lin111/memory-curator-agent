import type React from "react";
import { redo, undo } from "@codemirror/commands";
import {
  Bold,
  Code,
  Code2,
  Eye,
  Italic,
  Keyboard,
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
import { useMemo, useState } from "react";
import type { RefObject } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
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
  // 编辑器当前显示模式。
  mode: MarkdownPreviewMode;
  // 编辑器显示模式变更回调。
  onModeChange: (mode: MarkdownPreviewMode) => void;
}

// Markdown 编辑器预览模式。
type MarkdownPreviewMode = "edit" | "preview" | "split";

// 表格网格尺寸。
interface MarkdownTableSize {
  columns: number;
  rows: number;
}

// Markdown 编辑器快捷键配置。
interface MarkdownShortcut {
  // 快捷键按键组合。
  keys: string;
  // 快捷键功能说明。
  description: string;
}

// Markdown 编辑器可用快捷键。
const markdownShortcuts: MarkdownShortcut[] = [
  { keys: "Tab", description: "插入缩进" },
  { keys: "Shift + Tab", description: "减少缩进" },
  { keys: "Ctrl / Cmd + C", description: "复制选区或当前行" },
  { keys: "Ctrl / Cmd + X", description: "剪切选区或当前行" },
  { keys: "Ctrl / Cmd + D", description: "删除选区或当前行" },
  { keys: "Ctrl / Cmd + S", description: "保存" },
  { keys: "Ctrl / Cmd + B", description: "粗体" },
  { keys: "Ctrl / Cmd + U", description: "下划线" },
  { keys: "Ctrl / Cmd + I", description: "斜体" },
  { keys: "Ctrl / Cmd + 1 - 6", description: "一级至六级标题" },
  { keys: "Ctrl / Cmd + ↑", description: "上标" },
  { keys: "Ctrl / Cmd + ↓", description: "下标" },
  { keys: "Ctrl / Cmd + O", description: "有序列表" },
  { keys: "Ctrl / Cmd + L", description: "插入链接" },
  { keys: "Ctrl / Cmd + Z", description: "撤销" },
  { keys: "Ctrl / Cmd + F", description: "查找与替换" },
  { keys: "Ctrl / Cmd + Shift + S", description: "删除线" },
  { keys: "Ctrl / Cmd + Shift + U", description: "无序列表" },
  { keys: "Ctrl / Cmd + Shift + C", description: "代码块" },
  { keys: "Ctrl / Cmd + Shift + I", description: "插入图片" },
  { keys: "Ctrl / Cmd + Shift + Z", description: "重做" },
  { keys: "Ctrl / Cmd + Shift + F", description: "格式化内容" },
  { keys: "Ctrl / Cmd + Alt + C", description: "行内代码" },
  { keys: "Ctrl / Cmd + Shift + Alt + T", description: "插入表格" },
  { keys: "Ctrl / Cmd + Shift + E", description: "切换双栏预览" },
  { keys: "Ctrl / Cmd + Shift + P", description: "切换仅预览" },
  { keys: "Ctrl / Cmd + Shift + O", description: "打开 AI 输入框" },
];

// 生成带表头和默认数据行的 Markdown 表格。
const createMarkdownTable = ({ columns, rows }: MarkdownTableSize): string => {
  const createRow = (firstCell = ""): string =>
    `| ${firstCell} |${"  |".repeat(columns - 1)}\n`;
  const headerRow = createRow("Header");
  const separatorRow = `|${" --- |".repeat(columns)}\n`;
  const firstContentRow = createRow("Content");
  const emptyContentRow = createRow();
  return `${headerRow}${separatorRow}${firstContentRow}${emptyContentRow.repeat(rows - 1)}`;
};

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
  // 自定义 Tooltip 内容。
  tooltipContent?: React.ReactNode;
  // Tooltip 触发方式。
  tooltipTrigger?: "hover" | "click" | "both";
  // Tooltip 触发元素鼠标进入回调。
  onMouseEnter?: () => void;
}

// 工具栏按钮。
const MarkdownToolbarAction = ({
  icon: Icon,
  label,
  onClick,
  alignRight = false,
  highlighted = false,
  tooltipContent,
  tooltipTrigger = "hover",
  onMouseEnter,
}: MarkdownToolbarActionProps): React.JSX.Element => (
  <Tooltip
    className={alignRight ? "ml-auto" : ""}
    content={tooltipContent ?? label}
    contentClassName={tooltipContent ? "!p-1.5 !whitespace-normal" : ""}
    placement="bottom"
    trigger={tooltipTrigger}
  >
    <IconButton
      aria-label={label}
      className="h-7 w-7"
      highlighted={highlighted}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
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
  mode,
  onModeChange,
}: MarkdownEditorToolbarProps): React.JSX.Element => {
  const [tableSize, setTableSize] = useState<MarkdownTableSize | null>(null);
  const [shortcutQuery, setShortcutQuery] = useState("");
  const isMacOS = navigator.userAgent.includes("Macintosh");

  // 按快捷键或功能说明筛选，便于在完整列表中快速定位。
  const filteredShortcuts = useMemo(() => {
    const query = shortcutQuery.trim().toLocaleLowerCase();
    if (!query) return markdownShortcuts;

    return markdownShortcuts.filter(({ keys, description }) =>
      `${keys} ${description}`.toLocaleLowerCase().includes(query),
    );
  }, [shortcutQuery]);

  /**
   * 将跨平台快捷键转换为当前系统对应的修饰键显示。
   */
  const getShortcutKeys = (keys: string): string =>
    keys.replace("Ctrl / Cmd", isMacOS ? "Cmd" : "Ctrl");

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
    onModeChange(mode);
  };

  /**
   * 执行 Markdown 命令并将焦点还给编辑器，保持当前选区可继续操作。
   */
  const execute = (command: MarkdownToolbarCommand): void => {
    editorRef.current?.execCommand(command);
    editorRef.current?.focus();
  };

  /**
   * 将选择的表格插入当前编辑器选区，并把焦点还给编辑器。
   */
  const insertTable = (size: MarkdownTableSize): void => {
    const view = editorRef.current?.getEditorView();
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const markdown = createMarkdownTable(size);
    view.dispatch({
      changes: { from, to, insert: markdown },
      selection: { anchor: from + markdown.length },
    });
    editorRef.current?.focus();
    setTableSize(null);
  };

  // 根据鼠标悬停位置高亮表格网格区域。
  const tablePicker = (
    <div aria-label="选择表格大小" className="flex flex-col gap-1">
      <div className="px-0.5 text-center text-[11px] text-white/70" aria-live="polite">
        {tableSize ? `${tableSize.columns} × ${tableSize.rows}` : "选择表格大小"}
      </div>
      <div className="grid grid-cols-5 gap-1" role="grid">
        {Array.from({ length: 4 }, (_, rowIndex) =>
          Array.from({ length: 5 }, (_, columnIndex) => {
            const columns = columnIndex + 1;
            const rows = rowIndex + 1;
            const isHighlighted =
              tableSize !== null && columns <= tableSize.columns && rows <= tableSize.rows;

            return (
              <button
                key={`${columns}-${rows}`}
                aria-label={`${columns} 列 ${rows} 行`}
                className={`h-3.5 w-3.5 rounded-[3px] border transition-colors ${
                  isHighlighted
                    ? "border-[#737373] bg-[#666666]"
                    : "border-[#555555] bg-[#454545] hover:border-[#737373] hover:bg-[#666666]"
                }`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setTableSize({ columns, rows })}
                onClick={() => insertTable({ columns, rows })}
              />
            );
          }),
        )}
      </div>
    </div>
  );

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

  const shortcutList = (
    <div className="flex w-80 flex-col gap-2" aria-label="Markdown 编辑器快捷键">
      <Input
        aria-label="筛选快捷键"
        className="!px-2 !py-1 !text-xs"
        placeholder="筛选快捷键或说明"
        value={shortcutQuery}
        onChange={(event) => setShortcutQuery(event.target.value)}
      />
      <div className="max-h-72 overflow-y-auto custom-scrollbar">
        <div className="space-y-0.5">
          {filteredShortcuts.map(({ keys, description }) => (
            <div
              key={keys}
              className="flex min-h-7 items-center justify-between gap-3 rounded-[3px] px-1.5 text-xs hover:bg-white/5"
            >
              <kbd className="shrink-0 font-mono text-[11px] text-white/75">
                {getShortcutKeys(keys)}
              </kbd>
              <span className="min-w-0 text-right text-white/55">{description}</span>
            </div>
          ))}
        </div>
        {filteredShortcuts.length === 0 && (
          <div className="py-4 text-center text-xs text-white/45">未找到匹配的快捷键</div>
        )}
      </div>
    </div>
  );

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
    {
      icon: Table2,
      label: "表格",
      onClick: () => setTableSize(null),
      onMouseEnter: () => setTableSize(null),
      tooltipContent: tablePicker,
      tooltipTrigger: "both",
    },
    {
      icon: Keyboard,
      label: "快捷键",
      onClick: () => undefined,
      alignRight: true,
      tooltipContent: shortcutList,
      tooltipTrigger: "click",
    },
    {
      icon: SquareSplitHorizontal,
      label: "双栏预览",
      onClick: () => changePreviewMode(mode === "split" ? "edit" : "split"),
      highlighted: mode === "split",
    },
    {
      icon: Eye,
      label: "仅预览",
      onClick: () => changePreviewMode(mode === "preview" ? "edit" : "preview"),
      highlighted: mode === "preview",
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
