import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import type {
  AiChatSession,
  AiModelProviderOption,
  AiModelSelection,
} from "@renderer/features/ai-chat/aiChatMock";
import { AiChatMessageBubble } from "@renderer/features/ai-chat/components/AiChatMessageBubble";
import { AiChatInput } from "@renderer/features/ai-chat/components/AiChatInput";
import {
  buildMessageContextItems,
  getAiChatContextBudget,
  type AiChatContextItem,
} from "@renderer/features/ai-chat/aiChatContextBuilder";
import { useAiChatContextStore } from "@renderer/features/ai-chat/aiChatContextStore";

// 空上下文数组，避免 Zustand selector 在空态返回新引用。
const EMPTY_CONTEXT_ITEMS: AiChatContextItem[] = [];

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
  const syncMessageItems = useAiChatContextStore((state) => state.syncMessageItems);
  const contextItems = useAiChatContextStore(
    (state) => state.sessionItems[session.id] ?? EMPTY_CONTEXT_ITEMS,
  );
  const messageContextItems = useMemo(
    () => buildMessageContextItems(session.id, session.messages),
    [session.id, session.messages],
  );
  const contextBudget = useMemo(
    () =>
      getAiChatContextBudget({
        items: contextItems,
        modelOptions,
        selectedModel,
      }),
    [contextItems, modelOptions, selectedModel],
  );

  // 记录上一次的 session.id 与消息长度。
  const prevSessionIdRef = useRef(session.id);
  const prevMessagesLengthRef = useRef(session.messages.length);

  // 当切换会话（session.id 变化）时，立即跳转至底部。
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "auto" });
  }, [session.id]);

  // 当用户在当前会话发送新消息时，平滑滚动至最底部。
  useEffect(() => {
    const prevSessionId = prevSessionIdRef.current;
    const prevLength = prevMessagesLengthRef.current;
    const currentLength = session.messages.length;

    // 更新 ref 状态值
    prevSessionIdRef.current = session.id;
    prevMessagesLengthRef.current = currentLength;

    // 如果 session.id 发生改变（切换会话），则在此不处理滚动，已由切换会话的 useEffect 处理。
    if (session.id !== prevSessionId) {
      return;
    }

    // 仅在当前会话的新增消息中包含用户消息时，触发平滑滚动。
    if (currentLength > prevLength) {
      const addedMessages = session.messages.slice(prevLength);
      const hasNewUserMessage = addedMessages.some((msg) => msg.role === "user");
      if (hasNewUserMessage) {
        messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
      }
    }
  }, [session.messages, session.id]);

  // 将当前消息列表同步为全局上下文中的 message 来源。
  useEffect(() => {
    syncMessageItems(session.id, messageContextItems);
  }, [messageContextItems, session.id, syncMessageItems]);

  return (
    <section
      aria-label="AI 对话主体"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[6px] border border-white/5 bg-[#212121]"
    >
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        {session.messages.map((message, index) => {
          const isLast = index === session.messages.length - 1;
          const isGenerating =
            isLast && session.status === "运行中" && message.role === "assistant";
          return (
            <AiChatMessageBubble
              key={message.id}
              message={message}
              isGenerating={isGenerating}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <AiChatInput
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        contextUsagePercent={contextBudget.usagePercent}
        contextTokens={contextBudget.totalTokens}
        contextLimit={contextBudget.contextLimit}
        onSendMessage={onSendMessage}
        onModelChange={onModelChange}
      />
    </section>
  );
};
