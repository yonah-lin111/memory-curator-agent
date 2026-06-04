import type React from "react";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

// Explain 预览组件属性类型。
type AiToolExplainPreviewProps = {
  // Markdown 说明内容。
  content: string;
  // 是否正在生成中。
  isGenerating?: boolean;
};

/**
 * AiToolExplainPreview - 使用 Markdown 预览渲染写入前说明。
 */
export const AiToolExplainPreview = ({
  content,
  isGenerating = false,
}: AiToolExplainPreviewProps): React.JSX.Element => {
  return (
    <div
      className="ai-tool-explain-preview markdown-preview-container select-text max-w-full text-white/50"
      data-testid="ai-tool-explain-preview"
      style={{ fontSize: "13px" }}
    >
      <MdPreview
        theme="dark"
        modelValue={content}
        previewTheme="default"
        codeTheme="atom"
        style={{ backgroundColor: "transparent" }}
        autoFoldThreshold={isGenerating ? Infinity : 0}
        showCodeRowNumber={false}
      />
    </div>
  );
};
