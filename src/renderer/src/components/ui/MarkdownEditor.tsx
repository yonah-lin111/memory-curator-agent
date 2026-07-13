import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MdEditor, config } from "md-editor-rt";
import type { ExposeParam, ToolbarNames, UploadImgEvent } from "md-editor-rt";
import "md-editor-rt/lib/style.css";
import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { EditorState, RangeSetBuilder, StateEffect, StateField, Transaction } from "@codemirror/state";

// Markdown 编辑器高度。
type MarkdownEditorHeight = number | string;

// AI 内联审阅的单个连续文本变更块。
export type MarkdownEditorChangeBlock = {
  id: string;
  originalLines: string[];
  candidateLines: string[];
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

    // 优先尝试包含上下文锚点的严格匹配
    for (let index = 0; index <= lines.length - originalLength; index += 1) {
      const isOriginalMatch = block.originalLines.every((line, offset) => lines[index + offset] === line);
      const hasBeforeAnchor = block.beforeLine === undefined || lines[index - 1] === block.beforeLine;
      const hasAfterAnchor = block.afterLine === undefined || lines[index + originalLength] === block.afterLine;
      if (isOriginalMatch && hasBeforeAnchor && hasAfterAnchor) {
        const from = index === lines.length ? doc.length : lineOffsets[index];
        const to = originalLength === 0 ? from : lineOffsets[index + originalLength - 1] + block.originalLines[originalLength - 1].length;
        return [{ ...block, from, to }];
      }
    }

    // 退避方案：若严格匹配失败，且原始非空行在文档中唯一，允许无锚点匹配
    if (originalLength > 0) {
      let matchIndex = -1;
      let matchCount = 0;
      for (let index = 0; index <= lines.length - originalLength; index += 1) {
        const isOriginalMatch = block.originalLines.every((line, offset) => lines[index + offset] === line);
        if (isOriginalMatch) {
          matchCount += 1;
          matchIndex = index;
        }
      }
      if (matchCount === 1) {
        const from = lineOffsets[matchIndex];
        const to = lineOffsets[matchIndex + originalLength - 1] + block.originalLines[originalLength - 1].length;
        return [{ ...block, from, to }];
      }
    }

    return [];
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
    const createButton = (label: string, className: string, handler: () => void): HTMLButtonElement => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.title = label;
      button.setAttribute("aria-label", label);
      button.textContent = label;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", handler);
      return button;
    };
    controls.append(
      createButton("接受", "cm-ai-diff-accept", () => this.actions.onAccept(this.block.id)),
      createButton("拒绝", "cm-ai-diff-reject", () => this.actions.onReject(this.block.id)),
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
      // RangeSetBuilder 要求加入的范围必须按 from (必要时 to) 升序排列，否则会抛出异常。
      const sortedBlocks = [...positionedBlocks].sort((a, b) => a.from - b.from || a.to - b.to);
      const builder = new RangeSetBuilder<Decoration>();
      sortedBlocks.forEach((block) => {
        const widget = new InlineDiffWidget(block, effect.value.actions);
        if (block.from === block.to) builder.add(block.from, block.from, Decoration.widget({ widget, block: true, side: 1 }));
        else builder.add(block.from, block.to, Decoration.replace({ widget, block: true }));
      });
      return { decorations: builder.finish(), blocks: sortedBlocks };
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

// 全局注册 CodeMirror 6 扩展插件，实现 Markdown 语法标记独立高亮分色
config({
  codeMirrorExtensions(extensions, options) {
    return [
      ...extensions,
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

// Markdown 编辑器属性。
interface MarkdownEditorProps {
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
}

// Markdown 编辑器基础工具栏。
const MARKDOWN_EDITOR_BASE_TOOLBARS: ToolbarNames[] = [
  "bold",
  "italic",
  "strikeThrough",
  "-",
  "title",
  "quote",
  "unorderedList",
  "orderedList",
  "task",
  "-",
  "codeRow",
  "code",
  "link",
  "table",
  "=",
  "preview",
  "previewOnly",
];

// Markdown 编辑器页脚配置。
const MARKDOWN_EDITOR_FOOTERS = ["markdownTotal"] as const;

/**
 * MarkdownEditor - 项目统一 Markdown 编辑器。
 */
export const MarkdownEditor = ({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  height,
  className,
  defaultMode,
  aiChangeBlocks = [],
  onAcceptAiChange,
  onRejectAiChange,
}: MarkdownEditorProps): React.JSX.Element => {
  // 编辑器实例引用，用于调用暴露的方法。
  const editorRef = useRef<ExposeParam>(null);
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
    editorView.dispatch({
      effects: setInlineDiffEffect.of({
        blocks: aiChangeBlocks,
        actions: aiChangeActionsRef.current,
      }),
    });
  }, [aiChangeBlocks, id, onAcceptAiChange, onRejectAiChange]);

  // 编辑器内联高度，兼容像素数值与 CSS 高度。
  const editorStyle = useMemo<React.CSSProperties>(
    () => ({
      height: typeof height === "number" ? `${height}px` : height,
    }),
    [height],
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
    <MdEditor
      ref={editorRef}
      className={rootClassName}
      codeTheme="atom"
      footers={[...MARKDOWN_EDITOR_FOOTERS]}
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
      toolbars={MARKDOWN_EDITOR_BASE_TOOLBARS}
      value={value}
      onBlur={onBlur}
      onChange={onChange}
    />
  );
};
