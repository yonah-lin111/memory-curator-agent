import type React from "react";
import { useCallback, useMemo, useRef, useEffect } from "react";
import { MdEditor, config } from "md-editor-rt";
import type { ExposeParam, ToolbarNames, UploadImgEvent } from "md-editor-rt";
import "md-editor-rt/lib/style.css";
import { Decoration, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// Markdown 编辑器高度。
type MarkdownEditorHeight = number | string;

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
  codeMirrorExtensions(extensions, _options) {
    return [
      ...extensions,
      {
        type: "markdownHighlight",
        extension: markdownHighlightPlugin,
      },
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
}: MarkdownEditorProps): React.JSX.Element => {
  // 编辑器实例引用，用于调用暴露的方法。
  const editorRef = useRef<ExposeParam>(null);

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
