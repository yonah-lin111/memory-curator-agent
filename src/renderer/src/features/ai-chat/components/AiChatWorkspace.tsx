import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  AiChatSession,
  AiModelProviderOption,
  AiModelSelection,
} from "@renderer/features/ai-chat/types";
import {
  AiChatMessageBubble,
  type AiChatMessageContextMenuRequest,
} from "@renderer/features/ai-chat/components/AiChatMessageBubble";
import { AiChatMessageContextMenu } from "@renderer/features/ai-chat/components/AiChatMessageContextMenu";
import {
  AiChatInput,
  type AiChatInputCommandId,
} from "@renderer/features/ai-chat/components/AiChatInput";
import type {
  AiAskAnswerSubmitPayload,
  AiToolConfirmationAnswerSubmitPayload,
} from "@renderer/features/ai-chat/components/AiAskRequestPanel";
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

/**
 * copyTextToClipboard - 写入系统剪贴板，兼容缺失 Clipboard API 的运行时。
 */
const copyTextToClipboard = async (content: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

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
  // 提交 Ask 回答回调。
  onSubmitAskAnswer: (payload: AiAskAnswerSubmitPayload) => void | Promise<void>;
  // 提交工具确认回答回调。
  onSubmitToolConfirmationAnswer?: (
    payload: AiToolConfirmationAnswerSubmitPayload,
  ) => void | Promise<void>;
  // 重新生成最新 AI 回答回调。
  onRegenerateLatestAnswer: () => void;
  // 删除指定消息所属 QA 回调。
  onDeleteChatTurn: (messageId: string) => void;
  // 执行输入框命令回调。
  onCommandExecute: (command: AiChatInputCommandId) => void;
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
  onSubmitAskAnswer,
  onSubmitToolConfirmationAnswer,
  onRegenerateLatestAnswer,
  onDeleteChatTurn,
  onCommandExecute,
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
  // 当前打开的消息右键菜单；工作区内只允许存在一个菜单实例。
  const [messageContextMenu, setMessageContextMenu] =
    useState<AiChatMessageContextMenuRequest | null>(null);
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
  const latestAssistantMessageId = useMemo(() => {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      const message = session.messages[index];
      if (message.role === "assistant") {
        return message.id;
      }
    }

    return null;
  }, [session.messages]);

  // 记录上一次的 session.id 与消息长度。
  const prevSessionIdRef = useRef(session.id);
  const prevMessagesLengthRef = useRef(session.messages.length);
  // 记录上一次最新 AI 消息标识，覆盖重新生成时消息数量不变的场景。
  const prevLatestAssistantMessageIdRef = useRef(latestAssistantMessageId);
  // 当前加速滚动动画帧。
  const acceleratedScrollFrameRef = useRef<number | null>(null);

  /**
   * 获取当前消息列表中最后一条 AI 消息标识。
   */
  const getLatestAssistantMessageId = (): string | null => {
    return latestAssistantMessageId;
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
    const prevLatestAssistantMessageId =
      prevLatestAssistantMessageIdRef.current;
    const currentLength = session.messages.length;

    // 更新 ref 状态值
    prevSessionIdRef.current = session.id;
    prevMessagesLengthRef.current = currentLength;
    prevLatestAssistantMessageIdRef.current = latestAssistantMessageId;

    // 如果 session.id 发生改变（切换会话），则在此不处理滚动，已由切换会话的 useEffect 处理。
    if (session.id !== prevSessionId) {
      return;
    }

    if (currentLength < prevLength) {
      setTopPinnedAssistantId(null);
      cancelAcceleratedScroll();
      return;
    }

    // 发送和重新生成都会产生新的 AI 消息 ID；删除 QA 导致数量减少时不触发滚动。
    if (
      latestAssistantMessageId &&
      latestAssistantMessageId !== prevLatestAssistantMessageId &&
      currentLength >= prevLength
    ) {
      setTopPinnedAssistantId(latestAssistantMessageId);
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
    const isDeletingMessages =
      session.id === prevSessionIdRef.current &&
      session.messages.length < prevMessagesLengthRef.current;

    if (isDeletingMessages) {
      cancelAcceleratedScroll();
      return;
    }

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

  useEffect(() => {
    if (!messageContextMenu) {
      return undefined;
    }

    /**
     * 关闭当前消息右键菜单。
     */
    const closeContextMenu = (): void => {
      setMessageContextMenu(null);
    };

    /**
     * 按 Escape 关闭当前消息右键菜单。
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
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
   * 打开消息右键菜单；覆盖旧状态保证工作区内只存在一个菜单。
   */
  const handleOpenMessageContextMenu = (
    request: AiChatMessageContextMenuRequest,
  ): void => {
    setMessageContextMenu(request);
  };

  /**
   * 复制当前菜单指向消息的纯文本内容。
   */
  const handleCopyText = (): void => {
    if (!messageContextMenu) {
      return;
    }

    void copyTextToClipboard(messageContextMenu.plainTextContent);
    setMessageContextMenu(null);
  };

  /**
   * 复制当前菜单指向消息的 Markdown 内容。
   */
  const handleCopyMarkdown = (): void => {
    if (!messageContextMenu) {
      return;
    }

    void copyTextToClipboard(messageContextMenu.markdownContent);
    setMessageContextMenu(null);
  };

  /**
   * 重新生成当前菜单指向的最新回答。
   */
  const handleRegenerate = (): void => {
    setMessageContextMenu(null);
    onRegenerateLatestAnswer();
  };

  /**
   * 删除当前菜单指向消息所属的 QA。
   */
  const handleDeleteQa = (): void => {
    if (!messageContextMenu) {
      return;
    }

    const { messageId } = messageContextMenu;
    setMessageContextMenu(null);
    onDeleteChatTurn(messageId);
  };

  return (
    <section
      aria-label="AI Chat Workspace"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[6px] border border-white/5 bg-[#212121]"
    >
      {/* 消息列表 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] p-4 flex flex-col gap-4"
      >
        {session.messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center p-8 select-none">
            <div className="mb-2 text-base font-medium text-white/95">整理记忆与行动启发</div>
            <p className="max-w-md text-xs text-white/40 leading-relaxed">
              在此向 AI 提问。它可以基于你的 Today 待办、随记和日记草稿等上下文，为你梳理核心记忆线索并生成具体行动建议。
            </p>
          </div>
        ) : (
          session.messages.map((message, index) => {
            const isLast = index === session.messages.length - 1;
            const isGenerating =
              isLast &&
              session.status === "running" &&
              message.role === "assistant";
            const previousMessage = session.messages[index - 1];
            const canRegenerate =
              message.role === "assistant" &&
              isLast &&
              message.id === latestAssistantMessageId &&
              previousMessage?.role === "user" &&
              session.status !== "running";
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
                  canRegenerate={canRegenerate}
                  onSubmitAskAnswer={onSubmitAskAnswer}
                  onSubmitToolConfirmationAnswer={
                    onSubmitToolConfirmationAnswer
                  }
                  onOpenContextMenu={handleOpenMessageContextMenu}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {messageContextMenu ? (
        <AiChatMessageContextMenu
          x={messageContextMenu.x}
          y={messageContextMenu.y}
          canRegenerate={messageContextMenu.canRegenerate}
          onCopyText={handleCopyText}
          onCopyMarkdown={handleCopyMarkdown}
          onRegenerate={handleRegenerate}
          onDeleteQa={handleDeleteQa}
        />
      ) : null}

      {/* 输入区域 */}
      <AiChatInput
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        contextUsagePercent={contextBudget.usagePercent}
        contextTokens={contextBudget.totalTokens}
        contextLimit={contextBudget.contextLimit}
        isGenerating={session.status === "running"}
        onSendMessage={onSendMessage}
        onCommandExecute={onCommandExecute}
        onModelChange={onModelChange}
      />
    </section>
  );
};
