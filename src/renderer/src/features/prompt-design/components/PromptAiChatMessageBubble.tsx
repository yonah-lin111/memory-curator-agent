import { AiChatThinkingBlock } from "@/features/ai-chat/components/AiChatThinkingBlock";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";
import { AiToolCallBlock } from "@/features/ai-chat/components/AiToolCallBlock";
import type { AiToolStep } from "@/features/ai-chat/types";
import { Tag } from "@/components/ui/Tag";
import type { PromptAiMessage } from "./usePromptAiChatController";

export const PromptAiChatMessageBubble = ({
  message,
  isGenerating = false,
}: {
  message: PromptAiMessage & {
    reasoning?: string;
    toolSteps?: AiToolStep[];
  };
  isGenerating?: boolean;
}) => {
  const isUser = message.role === "user";

  const toolSteps = message.toolSteps;

  return (
    <div
      className={`flex gap-3 w-full scroll-mt-4 group/msg-bubble-container ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
    >
      <div
        className={`flex flex-col gap-1 min-w-0 ${isUser ? "items-end" : "flex-1"}`}
      >
        <div
          className={`rounded-[6px] px-1 py-1 text-sm leading-relaxed break-words w-fit max-w-full ${
            isUser
              ? "bg-transparent text-white font-medium whitespace-pre-wrap"
              : "text-white/80"
          }`}
        >
          {isUser ? (
            <div className="overflow-hidden w-fit max-w-full select-text pr-1 text-left">
              {message.content}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-w-full">
              {message.reasoning && (
                <AiChatThinkingBlock content={message.reasoning} />
              )}

              {toolSteps && toolSteps.length > 0 && (
                <AiToolCallBlock steps={toolSteps} />
              )}

              {message.content && (
                <div className="markdown-preview-container ai-chat-markdown-preview select-text max-w-full">
                  <MdPreview
                    theme="dark"
                    modelValue={message.content}
                    previewTheme="default"
                    codeTheme="atom"
                    style={{ backgroundColor: "transparent" }}
                    showCodeRowNumber={false}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className={`text-xs font-mono mt-0.5 px-1 text-white/30 flex items-center gap-1.5 min-h-[1.25rem] ${
            isUser ? "justify-end text-right" : "justify-start text-left"
          }`}
        >
          <span>
            {isGenerating ? (
              <span className="relative flex h-1.5 w-1.5 my-1 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/50"></span>
              </span>
            ) : (
              message.time.includes("T")
                ? new Date(message.time).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                : message.time.slice(11, 16) || message.time
            )}
          </span>
          {!isUser && message.model && (
            <Tag
              size="default"
              color="default"
              bgClass="border-white/5 bg-white/[0.03] text-white/30 select-none"
              className="scale-90 origin-left"
            >
              {message.model}
            </Tag>
          )}
        </div>
      </div>
    </div>
  );
};
