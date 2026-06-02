import type React from "react";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

// AI 思考块组件属性类型。
type AiChatThinkingBlockProps = {
  // Markdown 思考内容。
  content: string;
  // 是否正在生成中。
  isGenerating?: boolean;
};

/**
 * AiChatThinkingBlock - 使用 Markdown 预览渲染模型思考内容。
 */
export const AiChatThinkingBlock = ({
  content,
  isGenerating = false,
}: AiChatThinkingBlockProps): React.JSX.Element => (
  <div
    className="ai-chat-thinking-block markdown-preview-container select-text max-w-full border-l border-white/10 pl-3 text-white/50"
    data-testid="ai-chat-thinking-block"
    style={{ fontSize: "13px" }}
  >
    <MdPreview
      theme="dark"
      modelValue={content}
      previewTheme="default"
      codeTheme="atom"
      style={{ backgroundColor: "transparent" }}
      // 思考流式输出时不折叠代码块，避免用户看到突然跳变的代码区域。
      autoFoldThreshold={isGenerating ? Infinity : 0}
      showCodeRowNumber={false}
    />
  </div>
);
