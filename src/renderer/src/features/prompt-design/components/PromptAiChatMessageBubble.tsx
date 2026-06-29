import { AiChatThinkingBlock } from "@/features/ai-chat/components/AiChatThinkingBlock";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";
import { AiToolCallBlock } from "@/features/ai-chat/components/AiToolCallBlock";
import type { AiToolStep } from "@/features/ai-chat/types";
import { Tag } from "@/components/ui/Tag";

// 这是一个纯静态 mock 气泡组件
export const PromptAiChatMessageBubble = ({
  message
}: {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    toolCall?: { name: string; args: string; result?: string; status: "success" | "running" };
    time: string;
    model?: string;
  };
}) => {
  const isUser = message.role === "user";
  
  const toolSteps: AiToolStep[] | undefined = message.toolCall ? [{
    id: "mock-tool-call",
    title: `Using tool: ${message.toolCall.name}`,
    status: message.toolCall.status === "success" ? "done" : "running",
    tool: message.toolCall.name,
    input: message.toolCall.args,
    observation: message.toolCall.result || (message.toolCall.status === "running" ? "Running..." : "Done.")
  }] : undefined;

  return (
    <div className={`flex gap-3 w-full max-w-[85%] scroll-mt-4 group/msg-bubble-container ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
      
      <div className={`flex flex-col gap-1 min-w-0 ${isUser ? "items-end" : "flex-1"}`}>
        <div
          className={`rounded-[6px] px-1 py-1 text-sm leading-relaxed break-words w-fit max-w-full ${
            isUser ? "bg-transparent text-white font-medium whitespace-pre-wrap" : "text-white/80"
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
          <span>{message.time}</span>
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
