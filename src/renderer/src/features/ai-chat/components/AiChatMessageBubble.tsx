import type React from "react";
import { Bot, Loader2 } from "lucide-react";
import type { AiChatMessage } from "@renderer/features/ai-chat/aiChatMock";
import { AiToolCallBlock } from "@renderer/features/ai-chat/components/AiToolCallBlock";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

// AI 聊天气泡组件属性类型。
type AiChatMessageBubbleProps = {
  // 当前消息数据。
  message: AiChatMessage;
};

/**
 * AiChatMessageBubble - 渲染单个用户或 AI 消息气泡。
 */
export const AiChatMessageBubble = ({
  message,
}: AiChatMessageBubbleProps): React.JSX.Element => {
  const isUser = message.role === "user";
  const isProcessing = !isUser && message.content.startsWith("正在处理：");

  return (
    <div
      className={`flex gap-3 w-full max-w-[85%] ${
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      }`}
    >
      {/* 角色头像 */}
      {!isUser && (
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/5 bg-white text-black"
        >
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}

      {/* 消息气泡主体 */}
      <div
        className={`flex flex-col gap-1 min-w-0 ${isUser ? "items-end" : "flex-1"}`}
      >
        {/* 如果有工具执行步骤，则在边框外面（气泡上方）渲染工具调用块 */}
        {!isUser && message.toolSteps && message.toolSteps.length > 0 && (
          <div className="mb-2 w-full">
            <AiToolCallBlock steps={message.toolSteps} />
          </div>
        )}

        <div
          className={`rounded-[6px] px-3.5 py-2.5 text-sm leading-relaxed break-words w-fit ${
            isUser
              ? "bg-transparent text-white font-medium"
              : "bg-white/[0.03] border border-white/5 text-white/80"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <>
              {/* 仅在非正在处理时渲染首句 content */}
              {!isProcessing && message.content && (
                <div className="text-white/80">
                  {message.content}
                </div>
              )}

              {/* 正在处理且无最终回答时，渲染 loading 替代 */}
              {isProcessing && !message.answer && (
                <div className="flex items-center gap-2 text-white/50 py-0.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs font-medium">正在处理...</span>
                </div>
              )}
            </>
          )}

          {/* 如果有最终回答，则展示最终回答 */}
          {!isUser && message.answer && (
            <div className={`markdown-preview-container select-text ${!isProcessing && message.content ? "mt-3 pt-3 border-t border-white/5" : ""}`}>
              <MdPreview
                theme="dark"
                modelValue={message.answer}
                previewTheme="default"
                codeTheme="atom"
                style={{ backgroundColor: "transparent" }}
              />
            </div>
          )}
        </div>

        {/* 消息时间 */}
        <span
          className={`text-xs font-mono mt-0.5 px-1 text-white/30 ${
            isUser ? "text-right" : "text-left"
          }`}
        >
          {message.time}
        </span>
      </div>
    </div>
  );
};
