import type React from "react";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MdEditor, config } from "md-editor-rt";
import type { ExposeParam, UploadImgEvent } from "md-editor-rt";
import { Check, X } from "lucide-react";
import "md-editor-rt/lib/style.css";
import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { EditorState, RangeSetBuilder, StateEffect, StateField, Transaction } from "@codemirror/state";
import { useMarkdownFileMention } from "@/features/prompt-design/hooks/useMarkdownFileMention";
import { MarkdownEditorFooter } from "@/components/ui/MarkdownEditorFooter";
import { MarkdownEditorToolbar } from "@/components/ui/MarkdownEditorToolbar";
import { getMarkdownEditorFontSize, saveMarkdownEditorFontSize } from "@/lib/markdownEditorFontSize";
import type { PromptDesignStatus } from "@/features/prompt-design/lib/promptDesignStatus";

// Markdown 编辑器高度。
type MarkdownEditorHeight = number | string;

// Markdown 编辑器显示模式。
type MarkdownEditorMode = "edit" | "preview" | "split";

// AI 内联审阅的单个连续文本变更块。
export type MarkdownEditorChangeBlock = {
  id: string;
  originalLines: string[];
  candidateLines: string[];
  beforeContext?: string[];
  afterContext?: string[];
  beforeLine?: string;
  afterLine?: string;
  status?: "pending" | "conflict";
};

type InlineDiffActions = {
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
};

type PositionedInlineDiffBlock = MarkdownEditorChangeBlock & { from: number; to: number };
type InlineDiffState = { decorations: DecorationSet; blocks: PositionedInlineDiffBlock[] };
type InlineDiffDecoration = PositionedInlineDiffBlock & { decoration: Decoration };

const PROMPT_DESIGN_EDITOR_ID = "prompt-design-editor";
const setInlineDiffEffect = StateEffect.define<{ blocks: MarkdownEditorChangeBlock[]; actions: InlineDiffActions }>();

/**
 * 依据变更块锚点在文档中定位原文，插入建议定位至两侧锚点之间。
 */
const getPositionedInlineDiffBlocks = (doc: string, blocks: MarkdownEditorChangeBlock[]): PositionedInlineDiffBlock[] => {
  const lines = doc === "" ? [] : doc.split("\n");
  const lineOffsets = lines.reduce<number[]>((offsets, _line, index) => {
    offsets.push(index === 0 ? 0 : offsets[index - 1] + lines[index - 1].length + 1);
    return offsets;
  }, []);

  return blocks.flatMap((block) => {
    const originalLength = block.originalLines.length;

    // 仅接受完整多行上下文的唯一匹配，避免重复文本导致错误覆盖。
    const matchedIndexes: number[] = [];
    for (let index = 0; index <= lines.length - originalLength; index += 1) {
      const isOriginalMatch = block.originalLines.every((line, offset) => lines[index + offset] === line);
      const beforeContext = block.beforeContext ?? (block.beforeLine === undefined ? [] : [block.beforeLine]);
      const afterContext = block.afterContext ?? (block.afterLine === undefined ? [] : [block.afterLine]);
      const hasBeforeContext = beforeContext.every((line, offset) => lines[index - beforeContext.length + offset] === line);
      const hasAfterContext = afterContext.every((line, offset) => lines[index + originalLength + offset] === line);
      if (isOriginalMatch && hasBeforeContext && hasAfterContext) matchedIndexes.push(index);
    }
    if (matchedIndexes.length !== 1) return [];
    const index = matchedIndexes[0];
    const from = index === lines.length ? doc.length : lineOffsets[index];
    const to = originalLength === 0 ? from : lineOffsets[index + originalLength - 1] + block.originalLines[originalLength - 1].length;
    return [{ ...block, from, to }];
  });
};

/**
 * 原生 DOM 控件避免 Widget 内部依赖 React 渲染树。
 */
class InlineDiffWidget extends WidgetType {
  constructor(private readonly block: MarkdownEditorChangeBlock, private readonly actions: InlineDiffActions) {
    super();
  }

  eq(other: InlineDiffWidget): boolean {
    return other.block.id === this.block.id
      && other.block.originalLines.join("\n") === this.block.originalLines.join("\n")
      && other.block.candidateLines.join("\n") === this.block.candidateLines.join("\n");
  }

  toDOM(): HTMLElement {
    const root = document.createElement("div");
    root.className = "cm-ai-diff-block";
    const controls = document.createElement("div");
    controls.className = "cm-ai-diff-controls";
    const createButton = (
      label: string,
      className: string,
      icon: typeof Check,
      handler: () => void,
    ): HTMLButtonElement => {
      const button = document.createElement("button");
      const Icon = icon;
      button.type = "button";
      button.className = className;
      button.title = label;
      button.setAttribute("aria-label", label);
      button.innerHTML = `${renderToStaticMarkup(<Icon className="cm-ai-diff-icon" aria-hidden="true" />)}<span>${label}</span>`;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", handler);
      return button;
    };
    controls.append(
      createButton("Accept", "cm-ai-diff-accept", Check, () => this.actions.onAccept(this.block.id)),
      createButton("Reject", "cm-ai-diff-reject", X, () => this.actions.onReject(this.block.id)),
    );
    root.append(controls);
    const appendLines = (linesToAppend: string[], className: string, prefix: string): void => {
      if (linesToAppend.length === 0) return;
      const section = document.createElement("div");
      section.className = className;
      linesToAppend.forEach((line) => {
        const row = document.createElement("div");
        row.textContent = `${prefix} ${line || " "}`;
        section.append(row);
      });
      root.append(section);
    };
    appendLines(this.block.originalLines, "cm-ai-diff-deleted", "-");
    appendLines(this.block.candidateLines, "cm-ai-diff-added", "+");
    return root;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 创建仅供提示词设计编辑器使用的状态字段，避免污染其他 MarkdownEditor 实例。
 */
const createInlineDiffExtension = () => {
  const inlineDiffField = StateField.define<InlineDiffState>({
    create: () => ({ decorations: Decoration.none, blocks: [] }),
    update: (value, transaction) => {
      const effect = transaction.effects.find((item) => item.is(setInlineDiffEffect));
      if (!effect) {
        return {
          decorations: value.decorations.map(transaction.changes),
          blocks: value.blocks.map((block) => ({
            ...block,
            from: transaction.changes.mapPos(block.from),
            to: transaction.changes.mapPos(block.to),
          })),
        };
      }
      const positionedBlocks = getPositionedInlineDiffBlocks(transaction.state.doc.toString(), effect.value.blocks);
      const decorations = positionedBlocks.map((block): InlineDiffDecoration => ({
        ...block,
        decoration: block.from === block.to
          ? Decoration.widget({ widget: new InlineDiffWidget(block, effect.value.actions), block: true, side: 1 })
          : Decoration.replace({ widget: new InlineDiffWidget(block, effect.value.actions), block: true }),
      }));
      // 重叠建议仅保留最后生成的一项，避免过期建议覆盖最新工具结果。
      const nonOverlappingDecorations = decorations.reduceRight<InlineDiffDecoration[]>((result, decoration) => {
        const overlaps = result.some((item) => decoration.from < item.to && item.from < decoration.to
          || decoration.from === decoration.to && item.from === item.to && decoration.from === item.from
          || decoration.from === decoration.to && decoration.from >= item.from && decoration.from < item.to
          || item.from === item.to && item.from >= decoration.from && item.from < decoration.to);
        if (!overlaps) result.push(decoration);
        return result;
      }, []);
      // RangeSetBuilder 要求加入的范围按 from 与装饰 startSide 升序排列。
      const sortedDecorations = nonOverlappingDecorations.sort((a, b) =>
        a.from - b.from || a.decoration.startSide - b.decoration.startSide,
      );
      const builder = new RangeSetBuilder<Decoration>();
      sortedDecorations.forEach((item) => {
        builder.add(item.from, item.to, item.decoration);
      });
      return { decorations: builder.finish(), blocks: sortedDecorations };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });

  return [
    inlineDiffField,
    EditorState.transactionFilter.of((transaction) => {
      if (!transaction.docChanged || !transaction.annotation(Transaction.userEvent)) return transaction;
      const { blocks } = transaction.startState.field(inlineDiffField);
      let isLocked = false;
      transaction.changes.iterChanges((fromA, toA) => {
        if (isLocked) return;
        isLocked = blocks.some((block) => (
          block.from === block.to ? fromA <= block.from && toA >= block.from : fromA < block.to && toA > block.from
        ));
      });
      return isLocked ? [] : transaction;
    }),
  ];
};

// 自定义 CodeMirror 6 插件：用于精细匹配 Markdown 标记字符（#, -, [], ```, |, >, `, [link]），并添加专门的 CSS 类以单独着色
const headingDeco = Decoration.mark({ class: "cm-md-heading-mark" });
const listDeco = Decoration.mark({ class: "cm-md-list-mark" });
const taskDeco = Decoration.mark({ class: "cm-md-task-mark" });
const codeDeco = Decoration.mark({ class: "cm-md-code-mark" });
const tableDeco = Decoration.mark({ class: "cm-md-table-mark" });
const quoteDeco = Decoration.mark({ class: "cm-md-quote-mark" });
const inlineCodeDeco = Decoration.mark({ class: "cm-md-inline-code-mark" });
const linkDeco = Decoration.mark({ class: "cm-md-link-mark" });
const separatorDeco = Decoration.mark({ class: "cm-md-separator-mark" });
const boldDeco = Decoration.mark({ class: "cm-md-bold-mark" });
const italicDeco = Decoration.mark({ class: "cm-md-emphasis-mark" });
const strikethroughDeco = Decoration.mark({ class: "cm-md-strikethrough-mark" });

interface LineDecoItem {
  from: number;
  to: number;
  deco: Decoration;
}

const markdownHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: any) {
      this.decorations = this.getDeco(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.getDeco(update.view);
      }
    }

    getDeco(view: any): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      try {
        const { from, to } = view.viewport;
        let pos = from;
        while (pos < to) {
          const line = view.state.doc.lineAt(pos);
          const text = line.text;
          const lineFrom = line.from;

          const lineDecos: LineDecoItem[] = [];

          // 1. 匹配分隔线 ---, ***, ___ (优先权最高，防止被当作列表或斜体符号)
          const separatorMatch = text.match(/^(\s*)([-*_]{3,})(\s+|$)/);
          if (separatorMatch) {
            const start = lineFrom + separatorMatch[1].length;
            const end = start + separatorMatch[2].length;
            lineDecos.push({ from: start, to: end, deco: separatorDeco });
          } else {
            // 2. 匹配标题 # 号（支持 1-6 级）
            const headingMatch = text.match(/^(#{1,6})(\s+|$)/);
            if (headingMatch) {
              lineDecos.push({
                from: lineFrom,
                to: lineFrom + headingMatch[1].length,
                deco: headingDeco,
              });
            }

            // 3. 匹配引用块 > 标记
            const quoteMatch = text.match(/^(\s*)(>+)(\s+|$)/);
            if (quoteMatch) {
              const start = lineFrom + quoteMatch[1].length;
              const end = start + quoteMatch[2].length;
              lineDecos.push({ from: start, to: end, deco: quoteDeco });
            }

            // 4. 匹配列表标记 (如 -, *, +, 1.)
            const listMatch = text.match(/^(\s*)([-*+]|\d+\.)(\s+|$)/);
            if (listMatch && !text.includes("[ ]") && !text.includes("[x]") && !text.includes("[X]")) {
              const start = lineFrom + listMatch[1].length;
              const end = start + listMatch[2].length;
              lineDecos.push({ from: start, to: end, deco: listDeco });
            }

            // 5. 匹配任务列表标记 [ ] 或 [x]
            const taskMatch = text.match(/^(\s*[-*+]\s+)(\[[ xX]\])/);
            if (taskMatch) {
              // 前面的列表符号也画成 list-mark
              const listStart = lineFrom + taskMatch[1].indexOf(taskMatch[1].trim());
              const listEnd = listStart + 1;
              lineDecos.push({ from: listStart, to: listEnd, deco: listDeco });

              const start = lineFrom + taskMatch[1].length;
              const end = start + taskMatch[2].length;
              lineDecos.push({ from: start, to: end, deco: taskDeco });
            }

            // 6. 匹配代码块标志 ```
            const codeMatch = text.match(/^(\s*)(`{3,})/);
            if (codeMatch) {
              const start = lineFrom + codeMatch[1].length;
              const end = start + codeMatch[2].length;
              lineDecos.push({ from: start, to: end, deco: codeDeco });
            }

            // 7. 匹配表格分割符 |
            if (text.includes("|")) {
              let index = text.indexOf("|");
              while (index !== -1) {
                lineDecos.push({
                  from: lineFrom + index,
                  to: lineFrom + index + 1,
                  deco: tableDeco,
                });
                index = text.indexOf("|", index + 1);
              }
            }

            // 8. 匹配行内代码 `
            let inlineCodeMatch;
            const inlineCodeRegex = /`([^`\n]+)`/g;
            while ((inlineCodeMatch = inlineCodeRegex.exec(text)) !== null) {
              const matchIndex = inlineCodeMatch.index;
              lineDecos.push({
                from: lineFrom + matchIndex,
                to: lineFrom + matchIndex + 1,
                deco: inlineCodeDeco,
              });
              lineDecos.push({
                from: lineFrom + matchIndex + inlineCodeMatch[0].length - 1,
                to: lineFrom + matchIndex + inlineCodeMatch[0].length,
                deco: inlineCodeDeco,
              });
            }

            // 9. 匹配链接和图片的语法括号 ![, [, ], (, )
            let linkMatch;
            const linkRegex = /(!?\[)(.*?)(\]\()([^\)\n]+)(\))/g;
            while ((linkMatch = linkRegex.exec(text)) !== null) {
              const matchIndex = linkMatch.index;
              const openingMark = linkMatch[1];
              const closingMark = linkMatch[3];
              
              lineDecos.push({
                from: lineFrom + matchIndex,
                to: lineFrom + matchIndex + openingMark.length,
                deco: linkDeco,
              });
              lineDecos.push({
                from: lineFrom + matchIndex + openingMark.length + linkMatch[2].length,
                to: lineFrom + matchIndex + openingMark.length + linkMatch[2].length + closingMark.length,
                deco: linkDeco,
              });
              lineDecos.push({
                from: lineFrom + matchIndex + linkMatch[0].length - 1,
                to: lineFrom + matchIndex + linkMatch[0].length,
                deco: linkDeco,
              });
            }

            // 10. 匹配粗体 ** 或 __
            let boldMatch;
            const boldRegex = /\*\*|__/g;
            while ((boldMatch = boldRegex.exec(text)) !== null) {
              const matchIndex = boldMatch.index;
              lineDecos.push({
                from: lineFrom + matchIndex,
                to: lineFrom + matchIndex + 2,
                deco: boldDeco,
              });
            }

            // 11. 匹配斜体 * 或 _ (使用 lookahead/lookbehind 排除粗体标记)
            let italicMatch;
            const italicRegex = /(?<!\*)\*(?!\*)|(?<!_)_(?!_)/g;
            while ((italicMatch = italicRegex.exec(text)) !== null) {
              const matchIndex = italicMatch.index;
              lineDecos.push({
                from: lineFrom + matchIndex,
                to: lineFrom + matchIndex + 1,
                deco: italicDeco,
              });
            }

            // 12. 匹配删除线 ~~
            let strikeMatch;
            const strikeRegex = /~~/g;
            while ((strikeMatch = strikeRegex.exec(text)) !== null) {
              const matchIndex = strikeMatch.index;
              lineDecos.push({
                from: lineFrom + matchIndex,
                to: lineFrom + matchIndex + 2,
                deco: strikethroughDeco,
              });
            }
          }

          // 将本行所有的标记符号按照开始位置排序，避免 RangeSetBuilder 崩溃
          lineDecos.sort((a, b) => a.from - b.from);

          // 顺序加入 RangeSetBuilder，并严格过滤重叠范围
          let lastTo = -1;
          for (const d of lineDecos) {
            if (d.from >= lastTo && d.to > d.from) {
              builder.add(d.from, d.to, d.deco);
              lastTo = d.to;
            }
          }

          pos = line.to + 1;
        }
      } catch (error) {
        console.error("Error generating custom markdown decorations:", error);
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * 仅识别完整 URL 与具备目录层级的文件路径，避免将自然语言中的斜杠误判为路径。
 */
const getLinkOrPathRanges = (lineText: string): Array<[number, number]> => {
  const matcher = /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"'`()]+|(?<![\p{L}\p{N}])(?:~\/|\/|\.{1,2}\/)[^\s/]+(?:\/[^\s/]+)+/gu;

  return Array.from(lineText.matchAll(matcher), (match) => {
    const from = match.index ?? 0;
    return [from, from + match[0].length];
  });
};

// 全局注册 CodeMirror 6 扩展插件，实现 Markdown 语法标记独立高亮分色
config({
  codeMirrorExtensions(extensions, options) {
    return [
      // 替换默认路径规则，避免“日/常记录”这类正文被缩写为省略号。
      ...extensions.map((extension) => extension.type === "linkShortener"
        ? {
          ...extension,
          options: {
            ...extension.options,
            findTexts: ({ lineText }: { lineText: string }) => getLinkOrPathRanges(lineText),
          },
        }
        : extension),
      {
        type: "markdownHighlight",
        extension: markdownHighlightPlugin,
      },
      ...(options.editorId === PROMPT_DESIGN_EDITOR_ID
        ? [{ type: "promptInlineDiff", extension: createInlineDiffExtension() }]
        : []),
    ];
  },
});

// Markdown 编辑器控制句柄。
type MarkdownEditorCommand =
  | "bold"
  | "italic"
  | "strikeThrough"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "quote"
  | "unorderedList"
  | "orderedList"
  | "task"
  | "codeRow"
  | "code"
  | "link"
  | "table";

export interface MarkdownEditorHandle {
  // 执行 md-editor-rt 提供的 Markdown 插入命令。
  execCommand: (command: MarkdownEditorCommand) => void;
  // 切换双栏预览。
  togglePreview: (status?: boolean) => void;
  // 切换仅预览模式。
  togglePreviewOnly: (status?: boolean) => void;
  // 聚焦编辑器。
  focus: () => void;
  // 获取 CodeMirror 编辑器实例，用于撤销和重做。
  getEditorView: () => EditorView | undefined;
}

// Markdown 编辑器属性。
export interface MarkdownEditorProps {
  // 编辑器唯一标识。
  id: string;
  // 当前 Markdown 正文。
  value: string;
  // 正文变化回调。
  onChange: (value: string) => void;
  // 编辑器失焦回调。
  onBlur?: () => void;
  // 空内容提示。
  placeholder: string;
  // 编辑器高度。
  height: MarkdownEditorHeight;
  // 是否显示 Markdown 内容保存状态。
  showSaveStatus?: boolean;
  // 当前 Markdown 内容是否已保存，由父组件根据实际保存结果控制。
  isSaved?: boolean;
  // 外层类名。
  className?: string;
  // 默认显示模式：edit (仅编辑), preview (仅预览), split (双栏)
  defaultMode?: "edit" | "preview" | "split";
  // AI 待审变更块，仅提示词设计编辑器使用。
  aiChangeBlocks?: MarkdownEditorChangeBlock[];
  // 接受 AI 变更块。
  onAcceptAiChange?: (id: string) => void;
  // 拒绝 AI 变更块。
  onRejectAiChange?: (id: string) => void;
  // 接受全部 AI 变更块。
  onAcceptAllAiChanges?: () => void;
  // 拒绝全部 AI 变更块。
  onRejectAllAiChanges?: () => void;
  // 编辑器实例就绪回调。
  onEditorViewReady?: (view: EditorView) => void;
  // 编辑器右键菜单回调。
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>, view: EditorView) => void;
  // 编辑器显示模式变化回调。
  onModeChange?: (mode: MarkdownEditorMode) => void;
  // 递增时清空撤销与重做历史。
  historyResetVersion?: number;
  // 当前编辑器的独立字号持久化键，未设置时不持久化。
  fontSizeStorageKey?: string;
  // 当前提示词设计状态。
  promptDesignStatus?: PromptDesignStatus;
  // 提示词设计状态变更回调。
  onPromptDesignStatusChange?: (status: PromptDesignStatus) => void;
}

/**
 * MarkdownEditor - 项目统一 Markdown 编辑器。
 */
export const MarkdownEditor = memo(forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  height,
  showSaveStatus = false,
  isSaved = false,
  className,
  defaultMode,
  aiChangeBlocks = [],
  onAcceptAiChange,
  onRejectAiChange,
  onAcceptAllAiChanges,
  onRejectAllAiChanges,
  onEditorViewReady,
  onContextMenu,
  onModeChange,
  historyResetVersion,
  fontSizeStorageKey,
  promptDesignStatus,
  onPromptDesignStatusChange,
}, ref): React.JSX.Element => {
  // 编辑器实例引用，用于调用暴露的方法。
  const editorRef = useRef<ExposeParam>(null);
  // 当前实例字号，可按设置键独立恢复。
  const [fontSize, setFontSize] = useState(() => getMarkdownEditorFontSize(fontSizeStorageKey));
  useEffect(() => {
    setFontSize(getMarkdownEditorFontSize(fontSizeStorageKey));
  }, [fontSizeStorageKey]);
  /**
   * 更新当前实例字号，并在配置持久化键时写入本地存储。
   */
  const updateFontSize = useCallback((nextFontSize: number): void => {
    setFontSize(saveMarkdownEditorFontSize(nextFontSize, fontSizeStorageKey));
  }, [fontSizeStorageKey]);
  // 当前显示模式，用于同步工具栏高亮状态。
  const [editorMode, setEditorMode] = useState<MarkdownEditorMode>(defaultMode ?? "edit");
  // 进入仅预览前的模式，用于快捷键退出后恢复原布局。
  const modeBeforePreviewRef = useRef<Exclude<MarkdownEditorMode, "preview">>(
    defaultMode === "split" ? "split" : "edit",
  );
  /**
   * 更新编辑器显示模式，并通知外部调用方。
   */
  const changeEditorMode = useCallback((mode: MarkdownEditorMode): void => {
    setEditorMode(mode);
    onModeChange?.(mode);
  }, [onModeChange]);
  useImperativeHandle(ref, () => ({
    execCommand: (command) => editorRef.current?.execCommand(command),
    togglePreview: (status) => editorRef.current?.togglePreview(status),
    togglePreviewOnly: (status) => editorRef.current?.togglePreviewOnly(status),
    focus: () => editorRef.current?.focus(),
    getEditorView: () => editorRef.current?.getEditorView(),
  }), []);
  const { handleEditorViewReady, mentionPanel } = useMarkdownFileMention(id === PROMPT_DESIGN_EDITOR_ID);
  const aiChangeActionsRef = useRef<InlineDiffActions>({
    onAccept: () => undefined,
    onReject: () => undefined,
  });
  aiChangeActionsRef.current = {
    onAccept: onAcceptAiChange ?? (() => undefined),
    onReject: onRejectAiChange ?? (() => undefined),
  };

  useEffect(() => {
    const editorView = editorRef.current?.getEditorView();
    if (!editorView || id !== PROMPT_DESIGN_EDITOR_ID) return;
    handleEditorViewReady(editorView);
    onEditorViewReady?.(editorView);
  }, [handleEditorViewReady, id, onEditorViewReady]);

  useEffect(() => {
    const editorView = editorRef.current?.getEditorView();
    if (!editorView || id !== PROMPT_DESIGN_EDITOR_ID) return;
    editorView.dispatch({
      effects: setInlineDiffEffect.of({
        blocks: aiChangeBlocks,
        actions: aiChangeActionsRef.current,
      }),
    });
  }, [aiChangeBlocks, id, onAcceptAiChange, onRejectAiChange]);

  useEffect(() => {
    if (historyResetVersion === undefined) return;

    // 等待受控 value 同步至 md-editor-rt 后再清空历史。
    const frameId = requestAnimationFrame(() => {
      editorRef.current?.resetHistory();
    });
    return () => cancelAnimationFrame(frameId);
  }, [historyResetVersion]);

  // 注册全局/组件级快捷键
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // cmd + shift + p (兼容 Windows ctrl): 开启/关闭 md 组件的全局预览 (previewOnly)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopPropagation();
        if (editorMode === "preview") {
          editorRef.current?.togglePreviewOnly(false);
          changeEditorMode(modeBeforePreviewRef.current);
        } else {
          modeBeforePreviewRef.current = editorMode;
          editorRef.current?.togglePreviewOnly(true);
          changeEditorMode("preview");
        }
      } 
      // cmd + shift + e (兼容 Windows ctrl): 切换编辑模式 (编辑/预览双栏 vs 仅编辑)
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        e.stopPropagation();
        // 仅预览模式恢复进入前布局，其他模式在编辑与双栏间切换。
        if (editorMode === "preview") {
          editorRef.current?.togglePreviewOnly(false);
          changeEditorMode(modeBeforePreviewRef.current);
        } else {
          editorRef.current?.togglePreview();
          changeEditorMode(editorMode === "split" ? "edit" : "split");
        }
      }
    };

    // 使用捕获阶段，确保能优先拦截
    el.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => el.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [changeEditorMode, editorMode, id]);

  // 编辑器内联高度，兼容像素数值与 CSS 高度。
  const editorStyle = useMemo<React.CSSProperties>(
    () => ({
      height: typeof height === "number" ? `${height}px` : height,
      fontSize: `${fontSize}px`,
    }),
    [fontSize, height],
  );

  // 组合外层类名。
  const rootClassName = useMemo(
    () => [className, "md-editor-clean"].filter(Boolean).join(" "),
    [className],
  );

  // 根据 defaultMode 设置初始预览状态。
  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (defaultMode === "preview") {
      editorRef.current.togglePreviewOnly(true);
    } else if (defaultMode === "edit") {
      editorRef.current.togglePreview(false);
    } else if (defaultMode === "split") {
      editorRef.current.togglePreview(true);
    }
    if (defaultMode) {
      setEditorMode(defaultMode);
    }
  }, [defaultMode]);

  // 图片上传回调，覆盖粘贴图片与工具栏图片上传。
  const handleUploadImg = useCallback<UploadImgEvent>((files, callback) => {
    void (async () => {
      try {
        const savedImages = await Promise.all(
          files.map(async (file) =>
            window.api.files.saveMarkdownImage({
              name: file.name,
              mimeType: file.type,
              bytes: await file.arrayBuffer(),
            }),
          ),
        );

        callback(savedImages.map((image) => image.url));
      } catch {
        callback([]);
      }
    })();
  }, []);

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      data-markdown-editor-root
      onContextMenu={(event) => {
        const view = editorRef.current?.getEditorView();
        if (view && onContextMenu) onContextMenu(event, view);
      }}
    >
      <MarkdownEditorToolbar editorRef={editorRef} mode={editorMode} onModeChange={changeEditorMode} />
      <div className="min-h-0 flex-1">
        <MdEditor
          ref={editorRef}
          className={rootClassName}
          codeTheme="atom"
          footers={[]}
          id={id}
          language="zh-CN"
          noPrettier
          onUploadImg={handleUploadImg}
          placeholder={placeholder}
          preview
          previewTheme="default"
          showCodeRowNumber
          style={editorStyle}
          theme="dark"
          toolbars={[]}
          value={value}
          onBlur={onBlur}
          onChange={onChange}
        />
      </div>
      <MarkdownEditorFooter
        aiChangeCount={aiChangeBlocks.length}
        fontSize={fontSize}
        isSaved={isSaved}
        onAcceptAllAiChanges={onAcceptAllAiChanges}
        onRejectAllAiChanges={onRejectAllAiChanges}
        onFontSizeChange={updateFontSize}
        status={promptDesignStatus}
        onStatusChange={onPromptDesignStatusChange}
        showSaveStatus={showSaveStatus}
        value={value}
      />
      {id === PROMPT_DESIGN_EDITOR_ID && mentionPanel}
    </div>
  );
}));

MarkdownEditor.displayName = "MarkdownEditor";
