import type React from "react";
import { useState, useEffect, useRef } from "react";
import { Paperclip, SendHorizontal, SlidersHorizontal } from "lucide-react";
import type { AiChatSession } from "@renderer/components/layout/aiChatMock";
import { AiChatMessageBubble } from "@renderer/components/layout/AiChatMessageBubble";
import { IconButton } from "@renderer/components/ui/IconButton";

// AI 对话工作区组件属性类型。
type AiChatWorkspaceProps = {
  // 当前激活的 AI 会话。
  session: AiChatSession;
  // 发送消息回调。
  onSendMessage: (text: string) => void;
};

/**
 * AiChatWorkspace - 负责渲染 Header 下方的 AI 对话主体工作区。
 */
export const AiChatWorkspace = ({
  session,
  onSendMessage,
}: AiChatWorkspaceProps): React.JSX.Element => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 当消息列表更新时，平滑滚动至最底部。
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [session.messages]);

  // 发送消息处理函数。
  const handleSend = (): void => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  // 处理输入框键盘按键事件，支持 Enter 键发送消息，Shift + Enter 换行。
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section
      aria-label="AI 对话主体"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[6px] border border-white/5 bg-[#212121]"
    >
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        {session.messages.map((message) => (
          <AiChatMessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="flex-shrink-0 border-t border-white/5 p-3 bg-black/5">
        <div className="relative rounded-[6px] border border-white/5 bg-white/[0.01] p-2 flex flex-col gap-2">
          {/* 输入框 */}
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题..."
            aria-label="AI 对话输入框"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/20 outline-none resize-none leading-relaxed px-1"
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
              onClick={handleSend}
              disabled={!inputText.trim()}
              className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                inputText.trim()
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              <SendHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      </div>
    </section>
  );
};
