import type React from "react";
import { useEffect, useRef } from "react";
import type {
  AiChatSession,
  AiModelProviderOption,
  AiModelSelection,
} from "@renderer/features/ai-chat/aiChatMock";
import { AiChatMessageBubble } from "@renderer/features/ai-chat/components/AiChatMessageBubble";
import { AiChatInput } from "@renderer/features/ai-chat/components/AiChatInput";

// AI 对话工作区组件属性类型。
type AiChatWorkspaceProps = {
  // 当前激活的 AI 会话。
  session: AiChatSession;
  // 可切换的 AI provider 与模型列表。
  modelOptions: AiModelProviderOption[];
  // 当前选中的 AI provider 与模型。
  selectedModel: AiModelSelection | null;
  // 发送消息回调。
  onSendMessage: (text: string) => void;
  // AI 模型切换回调。
  onModelChange: (selection: AiModelSelection) => void;
};

/**
 * AiChatWorkspace - 负责渲染 Header 下方的 AI 对话主体工作区。
 */
export const AiChatWorkspace = ({
  session,
  modelOptions,
  selectedModel,
  onSendMessage,
  onModelChange,
}: AiChatWorkspaceProps): React.JSX.Element => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 当消息列表更新时，平滑滚动至最底部。
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [session.messages]);

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
      <AiChatInput
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSendMessage={onSendMessage}
        onModelChange={onModelChange}
      />
    </section>
  );
};
