import type React from "react";
import { Paperclip, SendHorizontal, SlidersHorizontal } from "lucide-react";
import type { AiChatSession } from "@renderer/components/layout/aiChatMock";
import { AiChatMessageBubble } from "@renderer/components/layout/AiChatMessageBubble";
import { IconButton } from "@renderer/components/ui/IconButton";

// AI 对话工作区组件属性类型。
type AiChatWorkspaceProps = {
  // 当前激活的 AI 会话。
  session: AiChatSession;
};

/**
 * AiChatWorkspace - 负责渲染 Header 下方的 AI 对话主体工作区。
 */
export const AiChatWorkspace = ({ session }: AiChatWorkspaceProps): React.JSX.Element => {
  return (
    <section
      aria-label="AI 对话主体"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[6px] border border-white/5 bg-[#212121] select-none"
    >
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        {session.messages.map((message) => (
          <AiChatMessageBubble key={message.id} message={message} />
        ))}
      </div>

      {/* 输入区域 (静态 Mock 展示) */}
      <div className="flex-shrink-0 border-t border-white/5 p-3 bg-black/5">
        <div className="relative rounded-[6px] border border-white/5 bg-white/[0.01] p-2 flex flex-col gap-2">
          {/* 输入框 */}
          <textarea
            rows={2}
            placeholder="输入消息，当前为 mock 展示..."
            disabled
            aria-label="AI 对话输入框"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/20 outline-none resize-none cursor-not-allowed leading-relaxed px-1"
          />

          {/* 工具栏与发送按钮 */}
          <div className="flex items-center justify-between">
            {/* 左侧附加操作 */}
            <div className="flex items-center gap-1">
              <IconButton
                aria-label="添加附件"
                disabled
                className="text-white/30 h-6 w-6 cursor-not-allowed"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                aria-label="设置工具模式"
                disabled
                className="text-white/30 h-6 w-6 cursor-not-allowed"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </IconButton>
            </div>

            {/* 右侧发送按钮 */}
            <IconButton
              aria-label="发送消息"
              disabled
              className="bg-white text-black h-6 w-6 rounded-full flex items-center justify-center opacity-30 cursor-not-allowed hover:bg-white"
            >
              <SendHorizontal className="h-3.5 w-3.5 text-black" />
            </IconButton>
          </div>
        </div>
      </div>
    </section>
  );
};
