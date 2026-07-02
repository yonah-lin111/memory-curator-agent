import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PromptAiChatMessageBubble } from "./PromptAiChatMessageBubble";
import { PromptAiChatInput } from "./PromptAiChatInput";
import { usePromptAiChatController } from "./usePromptAiChatController";

// 底部占位计算所需的 DOM 参数。
type BottomSpacerParams = {
  container: HTMLDivElement;
  userMessage: HTMLDivElement;
  currentSpacerHeight: number;
  topOffset: number;
};

/**
 * calculateBottomSpacerHeight - 计算用户消息置顶时需要保留的底部空间。
 */
const calculateBottomSpacerHeight = ({
  container,
  userMessage,
  currentSpacerHeight,
  topOffset,
}: BottomSpacerParams): number => {
  const viewportHeight = container.clientHeight;
  const targetScrollTop = Math.max(userMessage.offsetTop - topOffset, 0);

  return Math.round(
    Math.max(
      0,
      targetScrollTop +
        viewportHeight -
        container.scrollHeight +
        currentSpacerHeight,
    ),
  );
};

export const PromptAiChatWorkspace = ({ controller }: { controller: ReturnType<typeof usePromptAiChatController> }) => {
  const { messages, sendMessage, isGenerating, LATEST_ASSISTANT_TOP_OFFSET } = controller;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestUserMessageRef = useRef<HTMLDivElement>(null);
  const prevScrolledUserMessageIdRef = useRef<string | null>(null);
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

  const getUserMessageTargetTop = (userMessage: HTMLDivElement): number => {
    return Math.max(userMessage.offsetTop - LATEST_ASSISTANT_TOP_OFFSET, 0);
  };

  useLayoutEffect(() => {
    if (!latestUserMessageId) {
      setBottomSpacerHeight(0);
      prevScrolledUserMessageIdRef.current = null;
      return;
    }

    const container = scrollContainerRef.current;
    const userMessage = latestUserMessageRef.current;

    if (container && userMessage) {
      setBottomSpacerHeight((prev) => {
        const requiredSpacer = calculateBottomSpacerHeight({
          container,
          userMessage,
          currentSpacerHeight: prev,
          topOffset: LATEST_ASSISTANT_TOP_OFFSET,
        });

        return Math.abs(prev - requiredSpacer) > 3 ? requiredSpacer : prev;
      });
    }
  }, [latestUserMessageId, LATEST_ASSISTANT_TOP_OFFSET]);

  useEffect(() => {
    const handleResize = () => {
      const container = scrollContainerRef.current;
      const userMessage = latestUserMessageRef.current;

      if (container && userMessage && latestUserMessageId) {
        setBottomSpacerHeight((prev) =>
          calculateBottomSpacerHeight({
            container,
            userMessage,
            currentSpacerHeight: prev,
            topOffset: LATEST_ASSISTANT_TOP_OFFSET,
          }),
        );
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [latestUserMessageId, LATEST_ASSISTANT_TOP_OFFSET]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const userMessage = latestUserMessageRef.current;

    if (
      !latestUserMessageId ||
      !container ||
      !userMessage ||
      typeof window.ResizeObserver === "undefined"
    ) {
      return undefined;
    }

    let pendingRafId: number | null = null;

    const resizeObserver = new ResizeObserver(() => {
      if (pendingRafId !== null) {
        return;
      }

      pendingRafId = requestAnimationFrame(() => {
        pendingRafId = null;
        setBottomSpacerHeight((prev) => {
          const requiredSpacer = calculateBottomSpacerHeight({
            container,
            userMessage,
            currentSpacerHeight: prev,
            topOffset: LATEST_ASSISTANT_TOP_OFFSET,
          });

          return Math.abs(prev - requiredSpacer) > 3 ? requiredSpacer : prev;
        });
      });
    });

    const wrapper = container.firstElementChild;
    const elementsToObserve = wrapper
      ? Array.from(wrapper.children)
      : Array.from(container.children);

    for (const child of elementsToObserve) {
      if (
        child instanceof HTMLElement &&
        child.dataset.aiChatBottomSpacer !== "true"
      ) {
        resizeObserver.observe(child);
      }
    }

    return () => {
      resizeObserver.disconnect();
      if (pendingRafId !== null) {
        cancelAnimationFrame(pendingRafId);
      }
    };
  }, [latestUserMessageId, messages.length, LATEST_ASSISTANT_TOP_OFFSET]);

  useLayoutEffect(() => {
    if (
      latestUserMessageId &&
      latestUserMessageRef.current &&
      scrollContainerRef.current
    ) {
      if (prevScrolledUserMessageIdRef.current === latestUserMessageId) {
        return;
      }

      const targetTop = getUserMessageTargetTop(latestUserMessageRef.current);
      const animationFrame = requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({
          top: targetTop,
          behavior: "smooth",
        });
      });

      prevScrolledUserMessageIdRef.current = latestUserMessageId;

      return () => {
        cancelAnimationFrame(animationFrame);
      };
    }

    return undefined;
  }, [
    latestUserMessageId,
    messages.length,
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
            className="flex-1 relative overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] [overflow-anchor:none] py-4 flex flex-col min-w-0"
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
