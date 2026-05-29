import type React from "react";
import { Bot, UserRound } from "lucide-react";
import type { AiChatMessage } from "@renderer/components/layout/aiChatMock";
import { AiToolCallBlock } from "@renderer/components/layout/AiToolCallBlock";

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

  return (
    <div
      className={`flex gap-3 w-full max-w-[85%] ${
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      }`}
    >
      {/* 角色头像 */}
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/5 ${
          isUser ? "bg-white/5 text-white/85" : "bg-white text-black"
        }`}
      >
        {isUser ? (
          <UserRound className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      {/* 消息气泡主体 */}
      <div
        className={`flex flex-col gap-1 min-w-0 ${isUser ? "items-end" : "flex-1"}`}
      >
        <div
          className={`rounded-[6px] px-3.5 py-2.5 text-sm leading-relaxed break-words w-fit ${
            isUser
              ? "bg-transparent text-white font-medium"
              : "bg-white/[0.03] border border-white/5 text-white/80"
          }`}
        >
          {message.content}

          {/* 如果有工具执行步骤，则渲染工具调用块 */}
          {!isUser && message.toolSteps && message.toolSteps.length > 0 && (
            <AiToolCallBlock steps={message.toolSteps} />
          )}

          {/* 如果有最终回答，则展示最终回答，与工具连线保持优美留白 */}
          {!isUser && message.answer && (
            <div className="mt-2 pt-2 text-white/90 whitespace-pre-line">
              {message.answer}
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
