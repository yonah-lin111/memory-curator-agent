import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { PromptAiChatMessageBubble } from "./PromptAiChatMessageBubble";
import { PromptAiChatInput } from "./PromptAiChatInput";
import { usePromptAiChatController } from "./usePromptAiChatController";

export const PromptAiChatWorkspace = ({ controller }: { controller: ReturnType<typeof usePromptAiChatController> }) => {
  const { messages, sendMessage, isGenerating, LATEST_ASSISTANT_TOP_OFFSET } = controller;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestUserMessageRef = useRef<HTMLDivElement>(null);
  const [bottomSpacerHeight, setBottomSpacerHeight] = useState(0);

  const latestUserMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "user") {
        return message.id;
      }
    }

    return null;
  }, [messages]);

  const handleSend = (text: string, selectedModel?: string) => {
    sendMessage(text, selectedModel);
  };

  const getUserMessageTargetTop = (
    container: HTMLDivElement,
    userMessage: HTMLDivElement,
  ): number => {
    const containerRect = container.getBoundingClientRect();
    const userMessageRect = userMessage.getBoundingClientRect();

    return Math.max(
      container.scrollTop +
        userMessageRect.top -
        containerRect.top -
        LATEST_ASSISTANT_TOP_OFFSET,
      0,
    );
  };

  useLayoutEffect(() => {
    if (!latestUserMessageId) {
      setBottomSpacerHeight(0);
      return;
    }

    const container = scrollContainerRef.current;
    const userMessage = latestUserMessageRef.current;

    if (container && userMessage) {
      setBottomSpacerHeight((prev) => {
        const viewportHeight = container.clientHeight;
        const targetScrollTop = getUserMessageTargetTop(
          container,
          userMessage,
        );
        const requiredSpacer = Math.round(
          Math.max(
            0,
            targetScrollTop + viewportHeight - container.scrollHeight + prev,
          ),
        );

        return Math.abs(prev - requiredSpacer) > 3 ? requiredSpacer : prev;
      });
    }
  }, [latestUserMessageId, messages, LATEST_ASSISTANT_TOP_OFFSET]);

  useLayoutEffect(() => {
    if (
      latestUserMessageId &&
      latestUserMessageRef.current &&
      scrollContainerRef.current
    ) {
      const targetTop = getUserMessageTargetTop(
        scrollContainerRef.current,
        latestUserMessageRef.current,
      );
      scrollContainerRef.current.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });
    } else if (messagesEndRef.current) {
      // scroll to bottom if no pinned message
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [
    latestUserMessageId,
    messages.length,
    bottomSpacerHeight,
    LATEST_ASSISTANT_TOP_OFFSET,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* 消息区域容器 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧：消息区域（消息列表 + 输入区域） */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* 消息列表 */}
          <div
            ref={scrollContainerRef}
            style={{
              paddingLeft: "1rem",
              paddingRight: "1rem",
            }}
            className="flex-1 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] [overflow-anchor:none] py-4 flex flex-col min-w-0"
          >
            <div className="max-w-[860px] mx-auto w-full flex flex-col gap-4 flex-1">
              {messages.map((message) => {
                const isLatestUser =
                  message.role === "user" &&
                  message.id === latestUserMessageId;
                const isGeneratingMessage =
                  isGenerating &&
                  message.role !== "user" &&
                  message.id === messages[messages.length - 1]?.id;

                return (
                  <div
                    key={message.id}
                    ref={isLatestUser ? latestUserMessageRef : null}
                  >
                    <PromptAiChatMessageBubble
                      message={message as any}
                      isGenerating={isGeneratingMessage}
                    />
                  </div>
                );
              })}
              {bottomSpacerHeight > 0 && (
                <div
                  data-ai-chat-bottom-spacer="true"
                  style={{ height: `${bottomSpacerHeight}px` }}
                  className="flex-shrink-0"
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 输入区域 */}
          <PromptAiChatInput onSend={handleSend} disabled={isGenerating} />
        </div>
      </div>
    </div>
  );
};
