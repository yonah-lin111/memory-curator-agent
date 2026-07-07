import type React from "react";
import { useCallback, useMemo, useRef, useEffect } from "react";
import { MdEditor } from "md-editor-rt";
import type { ExposeParam, ToolbarNames, UploadImgEvent } from "md-editor-rt";
import "md-editor-rt/lib/style.css";

// Markdown 编辑器高度。
type MarkdownEditorHeight = number | string;

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
      className={className}
      codeTheme="atom"
      footers={[...MARKDOWN_EDITOR_FOOTERS]}
      id={id}
      language="zh-CN"
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
