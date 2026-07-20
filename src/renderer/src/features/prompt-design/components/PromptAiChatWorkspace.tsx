import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useToast } from "@/components/ui/Toast";
import { Bot } from "lucide-react";
import { PromptAiChatMessageBubble, type PromptAiMessageContextMenuRequest } from "@/features/prompt-design/components/PromptAiChatMessageBubble";
import { PromptAiMessageContextMenu } from "@/features/prompt-design/components/PromptAiMessageContextMenu";
import { PromptAiChatInput } from "@/features/prompt-design/components/PromptAiChatInput";
import { usePromptAiChatController } from "@/features/prompt-design/components/usePromptAiChatController";
import type { PromptDesignReference } from "@/features/prompt-design/types";

// 底部占位计算所需的 DOM 参数。
type BottomSpacerParams = {
  container: HTMLDivElement;
  triggerMessage: HTMLDivElement;
  currentSpacerHeight: number;
  topOffset: number;
};

/**
 * calculateBottomSpacerHeight - 计算用户消息置顶时需要保留的底部空间。
 */
const calculateBottomSpacerHeight = ({
  container,
  triggerMessage,
  currentSpacerHeight,
  topOffset,
}: BottomSpacerParams): number => {
  const viewportHeight = container.clientHeight;
  const targetScrollTop = Math.max(triggerMessage.offsetTop - topOffset, 0);

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
    onReferenceSelect?: (reference: PromptDesignReference) => void;
    chatInputFocusVersion?: number;
    mcpStatus?: {
      total: number;
      connected: number;
      failed: number;
      names: string[];
      failedNames: string[];
    };
  }
>(({ controller, mcpStatus, onReferenceSelect, chatInputFocusVersion }, ref) => {
  const { messages, sendMessage, isGenerating, LATEST_ASSISTANT_TOP_OFFSET } =
    controller;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestTriggerMessageRef = useRef<HTMLDivElement>(null);
  const prevScrolledTriggerMessageIdRef = useRef<string | null>(null);
  const [bottomSpacerHeight, setBottomSpacerHeight] = useState(0);
  // 手动刷新建议问题时递增，用于通知对应消息气泡重新请求。
  const [suggestedQuestionGenerationVersion, setSuggestedQuestionGenerationVersion] = useState(0);
  // 手动命令指定的建议问题目标，独立于自动触发开关。
  const [manualSuggestedQuestionMessageId, setManualSuggestedQuestionMessageId] = useState<string | null>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<PromptAiMessageContextMenuRequest | null>(null);
  const escCancelStateRef = useRef<"idle" | "pending">("idle");
  const escCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  const latestTriggerMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "user" || message.role === "system_command") {
        return message.id;
      }
    }

    return null;
  }, [messages]);

  const latestAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant") {
        return message.id;
      }
    }

    return null;
  }, [messages]);

  const handleSend = (text: string, selectedModel?: string, options?: { references?: typeof controller.references }) => {
    sendMessage(text, selectedModel, options);
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
    void controller.handleCancelGeneration();
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

  const getTriggerMessageTargetTop = (triggerMessage: HTMLDivElement): number => {
    return Math.max(triggerMessage.offsetTop - LATEST_ASSISTANT_TOP_OFFSET, 0);
  };

  const scrollLatestUserToTop = (behavior: ScrollBehavior, onComplete?: () => void) => {
    const container = scrollContainerRef.current;
    const triggerMessage = latestTriggerMessageRef.current;
    if (!container || !triggerMessage) {
      onComplete?.();
      return;
    }

    const targetTop = getTriggerMessageTargetTop(triggerMessage);
    
    // 如果需要底部留白才能滚到该位置，先计算
    const requiredSpacer = calculateBottomSpacerHeight({
      container,
      triggerMessage,
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
    if (!latestTriggerMessageId) {
      setBottomSpacerHeight(0);
      prevScrolledTriggerMessageIdRef.current = null;
      return;
    }

    const container = scrollContainerRef.current;
    const triggerMessage = latestTriggerMessageRef.current;

    if (container && triggerMessage) {
      setBottomSpacerHeight((prev) => {
        const requiredSpacer = calculateBottomSpacerHeight({
          container,
          triggerMessage,
          currentSpacerHeight: prev,
          topOffset: LATEST_ASSISTANT_TOP_OFFSET,
        });

        return Math.abs(prev - requiredSpacer) > 3 ? requiredSpacer : prev;
      });
    }
  }, [latestTriggerMessageId, LATEST_ASSISTANT_TOP_OFFSET]);

  useEffect(() => {
    const handleResize = () => {
      const container = scrollContainerRef.current;
      const triggerMessage = latestTriggerMessageRef.current;

      if (container && triggerMessage && latestTriggerMessageId) {
        setBottomSpacerHeight((prev) =>
          calculateBottomSpacerHeight({
            container,
            triggerMessage,
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
  }, [latestTriggerMessageId, LATEST_ASSISTANT_TOP_OFFSET]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const triggerMessage = latestTriggerMessageRef.current;

    if (
      !latestTriggerMessageId ||
      !container ||
      !triggerMessage ||
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
            triggerMessage,
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
  }, [latestTriggerMessageId, messages.length, LATEST_ASSISTANT_TOP_OFFSET]);

  useLayoutEffect(() => {
    if (
      latestTriggerMessageId &&
      latestTriggerMessageRef.current &&
      scrollContainerRef.current
    ) {
      if (prevScrolledTriggerMessageIdRef.current === latestTriggerMessageId) {
        return;
      }

      const targetTop = getTriggerMessageTargetTop(latestTriggerMessageRef.current);
      const animationFrame = requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({
          top: targetTop,
          behavior: "smooth",
        });
      });

      prevScrolledTriggerMessageIdRef.current = latestTriggerMessageId;

      return () => {
        cancelAnimationFrame(animationFrame);
      };
    }

    return undefined;
  }, [latestTriggerMessageId, messages.length, LATEST_ASSISTANT_TOP_OFFSET]);

  useEffect(() => {
    if (!messageContextMenu) return undefined;
    const closeContextMenu = (): void => setMessageContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeContextMenu();
    };
    document.addEventListener("click", closeContextMenu);
    document.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", closeContextMenu);
      document.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [messageContextMenu]);

  /**
   * 写入系统剪贴板，兼容缺失 Clipboard API 的运行时。
   */
  const copyTextToClipboard = async (content: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handleCopyText = (): void => {
    if (!messageContextMenu) return;
    void copyTextToClipboard(messageContextMenu.plainTextContent);
    setMessageContextMenu(null);
  };
  const handleCopyMarkdown = (): void => {
    if (!messageContextMenu) return;
    void copyTextToClipboard(messageContextMenu.markdownContent);
    setMessageContextMenu(null);
  };
  const handleRegenerate = (): void => {
    setMessageContextMenu(null);
    void controller.handleRegenerateLatestAnswer();
  };
  const handleDeleteQa = (): void => {
    if (!messageContextMenu) return;
    const { messageId } = messageContextMenu;
    setMessageContextMenu(null);
    void controller.handleDeleteTurn(messageId);
  };
  const handleEdit = (): void => {
    messageContextMenu?.onEdit?.();
    setMessageContextMenu(null);
  };

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
            className="flex-1 relative overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] [overflow-anchor:none] flex flex-col min-w-0 transition-all duration-300 ease-in-out"
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
                  const isLatestTriggerMessage =
                    (message.role === "user" || message.role === "system_command") &&
                    message.id === latestTriggerMessageId;
                  const isGeneratingMessage =
                    isGenerating &&
                    message.role !== "user" &&
                    message.id === messages[messages.length - 1]?.id;

                  return (
                    <div
                      key={message.id}
                      ref={isLatestTriggerMessage ? latestTriggerMessageRef : null}
                    >
                      <PromptAiChatMessageBubble
                        message={message as any}
                        isGenerating={isGeneratingMessage}
                        canRegenerate={
                          !isGenerating &&
                          message.role === "assistant" &&
                          message.id === messages[messages.length - 1]?.id
                        }
                        onOpenContextMenu={setMessageContextMenu}
                        onEditAndResendUserMessage={controller.handleEditAndResendUserMessage}
                        onSubmitAskAnswer={controller.handleSubmitAskAnswer}
                        onSubmitToolConfirmationAnswer={
                          controller.handleSubmitToolConfirmationAnswer
                        }
                        onReferenceSelect={onReferenceSelect}
                        suggestedQuestionContext={
                          (message.id === controller.suggestedQuestionMessageId ||
                            message.id === manualSuggestedQuestionMessageId) &&
                          message.role === "assistant" &&
                          message.id === messages[messages.length - 1]?.id
                            ? messages
                              .filter((item): item is typeof item & { role: "user" | "assistant" } => item.role === "user" || item.role === "assistant")
                              .map((item) => ({ role: item.role, content: item.content }))
                            : undefined
                        }
                        suggestedQuestionGenerationVersion={suggestedQuestionGenerationVersion}
                        onSendSuggestedQuestion={(question) => { void controller.sendMessage(question); }}
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
            mcpStatus={mcpStatus}
            onSend={handleSend}
            disabled={isGenerating}
            onNewChat={controller.handleNewChat}
            onUndo={controller.handleUndo}
            onSessionChange={controller.handleSessionChange}
            onMcp={controller.showMcpTools}
            onSuggestQuestions={() => {
              if (!latestAssistantMessageId || isGenerating) {
                return;
              }
              setManualSuggestedQuestionMessageId(latestAssistantMessageId);
              setSuggestedQuestionGenerationVersion((version) => version + 1);
              requestAnimationFrame(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              });
            }}
            chatSessions={controller.sessions}
            references={controller.references}
            onReferenceRemove={(id) => controller.setReferences((items) => items.filter((item) => item.id !== id))}
            onReferencesClear={() => controller.setReferences([])}
            onReferenceSelect={onReferenceSelect}
            focusVersion={chatInputFocusVersion}
          />
        </div>
      </div>
      {messageContextMenu ? (
        <PromptAiMessageContextMenu
          x={messageContextMenu.x}
          y={messageContextMenu.y}
          canRegenerate={messageContextMenu.canRegenerate}
          onCopyText={handleCopyText}
          onCopyMarkdown={handleCopyMarkdown}
          onRegenerate={handleRegenerate}
          onDeleteQa={handleDeleteQa}
          onEdit={messageContextMenu.onEdit ? handleEdit : undefined}
        />
      ) : null}
    </div>
  );
});

PromptAiChatWorkspace.displayName = "PromptAiChatWorkspace";
