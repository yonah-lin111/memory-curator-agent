import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

// 最新 AI 回答贴近视口顶部时保留的视觉间距。
const LATEST_ASSISTANT_TOP_OFFSET = 4;

// 加速滚动动画时长，放慢末段滚动避免突兀冲刺。
const ACCELERATED_SCROLL_DURATION_MS = 250;

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
  // 消息滚动容器引用。
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // 消息底部哨兵节点引用。
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 最新 AI 消息外层节点引用。
  const latestAssistantMessageRef = useRef<HTMLDivElement>(null);
  // 需要置顶显示的最新 AI 消息标识。
  const [topPinnedAssistantId, setTopPinnedAssistantId] = useState<
    string | null
  >(null);
  const syncMessageItems = useAiChatContextStore(
    (state) => state.syncMessageItems,
  );
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
  // 当前加速滚动动画帧。
  const acceleratedScrollFrameRef = useRef<number | null>(null);

  /**
   * 获取当前消息列表中最后一条 AI 消息标识。
   */
  const getLatestAssistantMessageId = (): string | null => {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      const message = session.messages[index];
      if (message.role === "assistant") {
        return message.id;
      }
    }

    return null;
  };

  /**
   * 取消未完成的加速滚动，避免连续切换会话时动画互相抢滚动条。
   */
  const cancelAcceleratedScroll = (): void => {
    if (acceleratedScrollFrameRef.current === null) {
      return;
    }

    cancelAnimationFrame(acceleratedScrollFrameRef.current);
    acceleratedScrollFrameRef.current = null;
  };

  /**
   * 用原生瞬时滚动写入指定位置，动画曲线由组件自行控制。
   */
  const setMessagesScrollTop = (
    container: HTMLDivElement,
    top: number,
  ): void => {
    if (typeof container.scrollTo === "function") {
      container.scrollTo({
        top,
        behavior: "auto",
      });
      return;
    }

    container.scrollTop = top;
  };

  /**
   * 将消息容器滚到指定位置；smooth 模式使用速度递增的 ease-in 曲线。
   */
  const scrollMessagesToPosition = (
    targetTop: number,
    behavior: ScrollBehavior,
  ): void => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    cancelAcceleratedScroll();

    if (behavior !== "smooth") {
      setMessagesScrollTop(container, targetTop);
      return;
    }

    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    let startedAt: number | null = null;

    /**
     * 每一帧按二次方缓入推进，距离增量会逐帧变大。
     */
    const animate = (timestamp: number): void => {
      if (startedAt === null) {
        startedAt = timestamp;
      }

      const elapsed = Math.max(timestamp - startedAt, 0);
      const progress = Math.min(elapsed / ACCELERATED_SCROLL_DURATION_MS, 1);
      const easedProgress = progress ** 2;
      const nextTop = startTop + distance * easedProgress;
      setMessagesScrollTop(container, nextTop);

      if (progress < 1) {
        acceleratedScrollFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      acceleratedScrollFrameRef.current = null;
    };

    acceleratedScrollFrameRef.current = requestAnimationFrame(animate);
  };

  /**
   * 将消息容器滚动到底部。
   */
  const scrollMessagesToBottom = (behavior: ScrollBehavior): void => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    scrollMessagesToPosition(container.scrollHeight, behavior);
  };

  /**
   * 将最新 AI 回答滚动到消息视口顶部。
   */
  const scrollLatestAssistantToTop = (behavior: ScrollBehavior): void => {
    const container = messagesContainerRef.current;
    const assistantMessage = latestAssistantMessageRef.current;
    if (!container || !assistantMessage) {
      return;
    }

    const targetTop = Math.max(
      assistantMessage.offsetTop - LATEST_ASSISTANT_TOP_OFFSET,
      0,
    );
    scrollMessagesToPosition(targetTop, behavior);
  };

  // 当切换会话（session.id 变化）时，复用发送消息后的最新 AI 回答定位效果。
  useEffect(() => {
    const latestAssistantMessageId = getLatestAssistantMessageId();
    if (latestAssistantMessageId) {
      setTopPinnedAssistantId(latestAssistantMessageId);
      return undefined;
    }

    setTopPinnedAssistantId(null);
    const animationFrame = requestAnimationFrame(() => {
      scrollMessagesToBottom("smooth");
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      cancelAcceleratedScroll();
    };
  }, [session.id]);

  // 当用户在当前会话发送新消息时，优先将最新 AI 回答置顶显示。
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

    // 仅在当前会话的新增消息中包含用户消息时，触发对话定位。
    if (currentLength > prevLength) {
      const addedMessages = session.messages.slice(prevLength);
      const hasNewUserMessage = addedMessages.some(
        (msg) => msg.role === "user",
      );
      if (hasNewUserMessage) {
        const latestAssistantMessageId = getLatestAssistantMessageId();
        if (latestAssistantMessageId) {
          setTopPinnedAssistantId(latestAssistantMessageId);
          return;
        }

        messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
      }
    }
  }, [session.messages, session.id]);

  // 补足最新 AI 回答底部空间后，再将其滚到视口顶部。
  useLayoutEffect(() => {
    if (!topPinnedAssistantId) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      scrollLatestAssistantToTop("smooth");
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      cancelAcceleratedScroll();
    };
  }, [topPinnedAssistantId, session.messages.length]);

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
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] p-4 flex flex-col gap-4"
      >
        {session.messages.map((message, index) => {
          const isLast = index === session.messages.length - 1;
          const isGenerating =
            isLast &&
            session.status === "running" &&
            message.role === "assistant";
          const shouldPinToTop = message.id === topPinnedAssistantId;
          return (
            <div
              key={message.id}
              ref={shouldPinToTop ? latestAssistantMessageRef : null}
              className={
                shouldPinToTop
                  ? "min-h-[calc(100%_-_1rem)] flex flex-col justify-start"
                  : undefined
              }
            >
              <AiChatMessageBubble
                message={message}
                isGenerating={isGenerating}
              />
            </div>
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
