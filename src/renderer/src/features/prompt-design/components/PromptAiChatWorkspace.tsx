import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useToast } from "@/components/ui/Toast";
import { Bot } from "lucide-react";
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

export type PromptAiChatWorkspaceHandle = {
  scrollLatestUserToTop: (behavior: ScrollBehavior, onComplete?: () => void) => void;
};

export const PromptAiChatWorkspace = forwardRef<
  PromptAiChatWorkspaceHandle,
  {
    controller: ReturnType<typeof usePromptAiChatController>;
  }
>(({ controller }, ref) => {
  const { messages, sendMessage, isGenerating, LATEST_ASSISTANT_TOP_OFFSET } =
    controller;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestUserMessageRef = useRef<HTMLDivElement>(null);
  const prevScrolledUserMessageIdRef = useRef<string | null>(null);
  const [bottomSpacerHeight, setBottomSpacerHeight] = useState(0);
  const [injectedText, setInjectedText] = useState<string | undefined>(undefined);
  const escCancelStateRef = useRef<"idle" | "pending">("idle");
  const escCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

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

  /**
   * 双击 Esc 时取消当前生成，避免单次误触打断流式输出。
   */
  const handleCancelEsc = useCallback((): void => {
    if (!isGenerating) {
      return;
    }

    if (escCancelStateRef.current === "idle") {
      escCancelStateRef.current = "pending";
      toast.info("再按一次 Esc 取消 AI 回答");
      escCancelTimerRef.current = setTimeout(() => {
        escCancelStateRef.current = "idle";
        escCancelTimerRef.current = null;
      }, 2000);
      return;
    }

    escCancelStateRef.current = "idle";
    if (escCancelTimerRef.current) {
      clearTimeout(escCancelTimerRef.current);
      escCancelTimerRef.current = null;
    }
    void controller.handleCancelGeneration().then((prompt) => {
      if (prompt) {
        setInjectedText(prompt);
      }
    });
  }, [controller.handleCancelGeneration, isGenerating, toast]);

  useEffect(() => {
    if (!isGenerating) {
      escCancelStateRef.current = "idle";
      if (escCancelTimerRef.current) {
        clearTimeout(escCancelTimerRef.current);
        escCancelTimerRef.current = null;
      }
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        handleCancelEsc();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (escCancelTimerRef.current) {
        clearTimeout(escCancelTimerRef.current);
        escCancelTimerRef.current = null;
      }
    };
  }, [handleCancelEsc, isGenerating]);

  const getUserMessageTargetTop = (userMessage: HTMLDivElement): number => {
    return Math.max(userMessage.offsetTop - LATEST_ASSISTANT_TOP_OFFSET, 0);
  };

  const scrollLatestUserToTop = (behavior: ScrollBehavior, onComplete?: () => void) => {
    const container = scrollContainerRef.current;
    const userMessage = latestUserMessageRef.current;
    if (!container || !userMessage) {
      onComplete?.();
      return;
    }

    const targetTop = getUserMessageTargetTop(userMessage);
    
    // 如果需要底部留白才能滚到该位置，先计算
    const requiredSpacer = calculateBottomSpacerHeight({
      container,
      userMessage,
      currentSpacerHeight: bottomSpacerHeight,
      topOffset: LATEST_ASSISTANT_TOP_OFFSET,
    });
    
    if (Math.abs(bottomSpacerHeight - requiredSpacer) > 3) {
      setBottomSpacerHeight(requiredSpacer);
      // Wait for next frame to scroll after spacer is updated
      requestAnimationFrame(() => {
        container.scrollTo({ top: targetTop, behavior });
        // Use a small timeout to let smooth scroll finish before onComplete
        if (onComplete) {
          if (behavior === 'smooth') {
             setTimeout(onComplete, 300);
          } else {
             requestAnimationFrame(onComplete);
          }
        }
      });
    } else {
      container.scrollTo({ top: targetTop, behavior });
      if (onComplete) {
        if (behavior === 'smooth') {
           setTimeout(onComplete, 300);
        } else {
           requestAnimationFrame(onComplete);
        }
      }
    }
  };

  useImperativeHandle(ref, () => ({
    scrollLatestUserToTop,
  }));

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
  }, [latestUserMessageId, messages.length, LATEST_ASSISTANT_TOP_OFFSET]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#212121]">
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
            className="flex-1 relative overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] [overflow-anchor:none] py-4 flex flex-col min-w-0 transition-all duration-300 ease-in-out"
          >
            <div className="max-w-[860px] mx-auto w-full flex flex-col gap-4 flex-1">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center p-8 select-none my-auto animate-fade-in">
                  <div className="flex items-center justify-center w-12 h-12 rounded-[6px] bg-white/5 border border-white/5 mb-4 text-white/30 animate-pulse">
                    <Bot className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white/80 mb-1.5 font-mono">// 提示词 AI 助手</h3>
                  <p className="text-xs text-white/40 leading-relaxed max-w-[280px]">
                    在此与 AI 助手交流。输入你想调整的提示词思路，或让它为你润色、检查或优化当前选中的提示词设计。
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isLatestUser =
                    message.role === "user" && message.id === latestUserMessageId;
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
                        onSubmitAskAnswer={controller.handleSubmitAskAnswer}
                        onSubmitToolConfirmationAnswer={
                          controller.handleSubmitToolConfirmationAnswer
                        }
                      />
                    </div>
                  );
                })
              )}
              {bottomSpacerHeight > 0 && (
                <div
                  data-curator-bottom-spacer="true"
                  style={{ height: `${bottomSpacerHeight}px` }}
                  className="flex-shrink-0"
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 输入区域 */}
          <PromptAiChatInput
            onSend={handleSend}
            disabled={isGenerating}
            onNewChat={controller.handleNewChat}
            onUndo={controller.handleUndo}
            onSessionChange={controller.handleSessionChange}
            chatSessions={controller.sessions}
            injectedText={injectedText}
            onInjectedTextConsumed={() => setInjectedText(undefined)}
          />
        </div>
      </div>
    </div>
  );
});

PromptAiChatWorkspace.displayName = "PromptAiChatWorkspace";
