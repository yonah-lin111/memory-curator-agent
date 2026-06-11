import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { AiChatInputCommandId } from "@/features/ai-chat/components/AiChatInput";
import type {
  AiAskAnswerSubmitPayload,
  AiToolConfirmationAnswerSubmitPayload,
} from "@/features/ai-chat/components/AiAskRequestPanel";
import { useToast } from "@/components/ui/Toast";
import {
  buildMessageContextItems,
  getAiChatContextBudget,
  type AiChatContextBudget,
  type AiChatContextItem,
} from "@/features/ai-chat/aiChatContextBuilder";
import { useAiChatContextStore } from "@/features/ai-chat/aiChatContextStore";
import {
  type AiAgentOption,
  type AiChatSession,
  type AiModelProviderOption,
  type AiModelSelection,
} from "@/features/ai-chat/types";
import {
  clearAiChatTypewriterTimers,
  createAiChatEventHandler,
  type AiRunMessageMapping,
  type AiTypewriterTimer,
} from "@/features/ai-chat/core/aiChatEventAdapter";
import { createAiChatUuid } from "@/features/ai-chat/core/aiChatIds";
import {
  aiChatSessionReducer,
  createEmptyAiChatSession,
  getActiveAiChatSession,
  INITIAL_AI_CHAT_SESSION_STATE,
  isEmptyAiChatDraftSession,
  findChatTurnBoundsByMessageId,
  type AiChatMessageUpdater,
} from "@/features/ai-chat/core/aiChatSessionReducer";
import {
  deleteAiChatSession,
  deleteAiChatTurn,
  regenerateLatestAiChatAnswer,
  renameAiChatSession,
  undoLastAiChatTurn,
} from "@/features/ai-chat/core/aiChatSessionCommands";
import {
  toAiChatAgentHints,
  type AiChatSendPayload,
} from "@/features/ai-chat/aiChatAgentMentions";

// 空上下文数组，避免 Zustand selector 在空态返回新引用。
const EMPTY_AI_CHAT_CONTEXT_ITEMS: AiChatContextItem[] = [];

// AI 历史每页读取数量。
const AI_CHAT_HISTORY_PAGE_SIZE = 20;

// AI 对话发送输入。
type AiChatSendInput = string | AiChatSendPayload;

// 用于本地缓存所选 AI 模型的 Key。
const LOCAL_STORAGE_AI_MODEL_KEY = "ai-chat-selected-model";

/**
 * 创建列表使用的年月日时分时间戳。
 */
const createSessionListTimestamp = (): string => {
  const now = new Date();
  const dateStr = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\//g, "-");
  const timeStr = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateStr} ${timeStr}`;
};

/**
 * 归一化 AI 对话发送输入，历史重发路径不恢复旧 agent。
 */
const normalizeAiChatSendInput = (input: AiChatSendInput): AiChatSendPayload =>
  typeof input === "string"
    ? {
        text: input,
        agents: [],
      }
    : input;

// AI 对话控制器返回值。
type UseAiChatControllerResult = {
  // AI 对话模式打开状态。
  isChatOpen: boolean;
  // AI 对话会话列表。
  chatSessions: AiChatSession[];
  // 当前激活的 AI 对话会话标识。
  activeChatId: string;
  // 已完成但尚未查看的 AI 会话 ID。
  completionNoticeSessionIds: Set<string>;
  // 当前激活的 AI 对话会话。
  activeChatSession: AiChatSession;
  // 当前会话上下文条目。
  activeChatContextItems: AiChatContextItem[];
  // 当前会话上下文预算。
  activeChatContextBudget: AiChatContextBudget;
  // 已启用的 AI provider 与模型选项。
  aiModelOptions: AiModelProviderOption[];
  // AI Agent 非密钥行为配置。
  aiAgentOption: AiAgentOption | null;
  // 当前选中的 AI provider 与模型。
  selectedAiModel: AiModelSelection | null;
  // AI 历史是否还有下一页。
  hasMoreChatSessions: boolean;
  // AI 历史是否正在加载下一页。
  isLoadingMoreChatSessions: boolean;
  // 切换 AI 对话模式。
  handleChatToggle: () => void;
  // 切换当前激活的 AI 对话会话。
  setActiveChatId: (sessionId: string) => void;
  // 清理指定 AI 对话完成提醒。
  clearCompletionNoticeSession: (sessionId: string) => void;
  // 切换当前选中的 AI provider 与模型。
  setSelectedAiModel: (selection: AiModelSelection) => void;
  // 新建 AI 对话会话。
  handleNewChat: () => void;
  // 更新 AI 对话标题。
  handleRenameChat: (sessionId: string, title: string) => Promise<boolean>;
  // 删除 AI 对话会话。
  handleDeleteChat: (sessionId: string) => Promise<boolean>;
  // 批量删除 AI 对话会话。
  handleBatchDeleteChats: (sessionIds: string[]) => Promise<boolean>;
  // 加载更多 AI 历史会话。
  handleLoadMoreChatSessions: () => Promise<void>;
  // 发送用户消息。
  handleSendMessage: (payload: AiChatSendPayload) => void;
  // 提交 Ask 回答。
  handleSubmitAskAnswer: (payload: AiAskAnswerSubmitPayload) => Promise<void>;
  // 提交工具确认回答。
  handleSubmitToolConfirmationAnswer: (
    payload: AiToolConfirmationAnswerSubmitPayload,
  ) => Promise<void>;
  // 重新生成最新 AI 回答。
  handleRegenerateLatestAnswer: () => Promise<void>;
  // 编辑并重新发送用户消息。
  handleEditAndResendUserMessage: (messageId: string, text: string) => Promise<void>;
  // 删除指定消息所属 QA。
  handleDeleteChatTurn: (messageId: string) => Promise<void>;
  // 执行 AI 输入框命令。
  handleAiChatCommand: (
    command: AiChatInputCommandId,
  ) => string | void | Promise<string | void>;
};

/**
 * 从启用模型列表中解析默认选择。
 */
const resolveDefaultAiModel = (
  providers: AiModelProviderOption[],
  defaultProvider: string,
  defaultModel: string,
): AiModelSelection | null => {
  const provider =
    providers.find((item) => item.id === defaultProvider) ??
    providers.find((item) => item.models.length > 0);
  const model =
    provider?.models.find((item) => item.id === defaultModel) ??
    provider?.models[0];

  if (!provider || !model) {
    return null;
  }

  return {
    provider: provider.id,
    model: model.id,
  };
};

/**
 * useAiChatController - 集中管理 AI 对话状态、IPC 事件与上下文构造。
 */
export const useAiChatController = (): UseAiChatControllerResult => {
  // AI 对话模式打开状态。
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  // AI 对话会话状态。
  const [chatState, dispatchChatState] = useReducer(
    aiChatSessionReducer,
    INITIAL_AI_CHAT_SESSION_STATE,
  );
  const chatSessions = chatState.sessions;
  const activeChatId = chatState.activeId;
  const activeChatIdRef = useRef<string>(activeChatId);
  activeChatIdRef.current = activeChatId;

  // 已启用的 AI provider 与模型选项。
  const [aiModelOptions, setAiModelOptions] = useState<
    AiModelProviderOption[]
  >([]);

  // AI Agent 非密钥行为配置。
  const [aiAgentOption, setAiAgentOption] = useState<AiAgentOption | null>(null);

  // 当前选中的 AI provider 与模型。
  const [selectedAiModel, setSelectedAiModel] =
    useState<AiModelSelection | null>(null);
  const toast = useToast();

  // 持久化历史已经加载的数量，不包含本地空白草稿。
  const [loadedHistoryCount, setLoadedHistoryCount] = useState<number>(0);

  // AI 历史是否还有下一页。
  const [hasMoreChatSessions, setHasMoreChatSessions] = useState<boolean>(false);

  // AI 历史是否正在加载下一页。
  const [isLoadingMoreChatSessions, setIsLoadingMoreChatSessions] =
    useState<boolean>(false);

  // 已完成但尚未查看的 AI 会话 ID。
  const [completionNoticeSessionIds, setCompletionNoticeSessionIds] =
    useState<Set<string>>(() => new Set());

  // Agent 运行与消息的映射关系。
  const runMessageMapRef = useRef<Map<string, AiRunMessageMapping>>(new Map());

  // 流式文本缓冲区，用于打字机输出。
  const textBufferRef = useRef<Map<string, string>>(new Map());

  // 打字机刷新定时器集合。
  const typewriterTimerRef = useRef<Map<string, AiTypewriterTimer>>(
    new Map(),
  );

  // 搜索命中但不属于当前分页列表的临时会话。
  const transientSearchSessionIdsRef = useRef<Set<string>>(new Set());

  // 当前激活的 AI 对话会话。
  const activeChatSession = getActiveAiChatSession(chatState);
  const activeChatContextItems = useAiChatContextStore(
    (state) => state.sessionItems[activeChatId] ?? EMPTY_AI_CHAT_CONTEXT_ITEMS,
  );
  const activeChatContextBudget = getAiChatContextBudget({
    items: activeChatContextItems,
    modelOptions: aiModelOptions,
    selectedModel: selectedAiModel,
  });

  /**
   * 切换 AI 对话模式。
   */
  const handleChatToggle = (): void => {
    setIsChatOpen((current) => !current);
  };

  /**
   * 新建 AI 对话会话并自动切换激活。
   * 保证新创建的空白对话仅存在一个，若已存在空白对话则直接激活该对话，避免重复创建。
   */
  const handleNewChat = (): void => {
    const existingEmptySession = chatSessions.find(isEmptyAiChatDraftSession);
    if (existingEmptySession) {
      dispatchChatState({
        type: "set-active",
        activeId: existingEmptySession.id,
      });
      toast.info("已切换到空白对话");
      return;
    }

    const newSession = createEmptyAiChatSession();
    dispatchChatState({ type: "prepend", session: newSession });
    toast.success("已新建对话");
  };

  /**
   * 清理已被删除消息关联的运行状态，避免迟到流式事件重新污染 UI。
   */
  const removeRunMappingsByMessageIds = (messageIds: Set<string>): void => {
    for (const [runId, mapping] of runMessageMapRef.current.entries()) {
      if (messageIds.has(mapping.messageId)) {
        runMessageMapRef.current.delete(runId);
        textBufferRef.current.delete(runId);
        const timer = typewriterTimerRef.current.get(runId);
        if (timer) {
          clearTimeout(timer);
          typewriterTimerRef.current.delete(runId);
        }
      }
    }
  };

  /**
   * 取消指定会话中等待用户回答的 Ask，不中断仍在流式输出的 run。
   */
  const cancelPendingAiChatAsks = useCallback((sessionId?: string): void => {
    for (const [runId, mapping] of runMessageMapRef.current.entries()) {
      if (sessionId && mapping.sessionId !== sessionId) {
        continue;
      }

      void window.api?.ai?.cancelAsk?.(runId).catch(() => undefined);
    }
  }, []);

  /**
   * 撤销当前会话最后一轮用户对话，并同步删除持久化 run、工具调用和上下文快照。
   */
  const handleUndoLastChatTurn = async (): Promise<string | void> => {
    return undoLastAiChatTurn({
      session: activeChatSession,
      sessions: chatSessions,
      activeId: activeChatId,
      undoLastTurn: window.api?.ai?.undoLastTurn,
      deleteSession: async (sessionId) => {
        await window.api?.ai?.deleteSession?.(sessionId);
        setLoadedHistoryCount((currentCount) => Math.max(0, currentCount - 1));
      },
      clearSessionContext: useAiChatContextStore.getState().clearSession,
      removeRunMappingsByMessageIds,
      dispatch: dispatchChatState,
      toast,
    });
  };

  /**
   * 执行 AI 输入框斜杠命令。
   */
  const handleAiChatCommand = (
    command: AiChatInputCommandId,
  ): string | void | Promise<string | void> => {
    if (command === "clear") {
      handleNewChat();
      return;
    }

    if (command === "undo") {
      return handleUndoLastChatTurn();
    }
  };

  /**
   * 更新 AI 对话标题，持久化失败时回滚本地状态。
   */
  const handleRenameChat = async (
    sessionId: string,
    title: string,
  ): Promise<boolean> => {
    return renameAiChatSession({
      sessionId,
      title,
      sessions: chatSessions,
      activeId: activeChatId,
      updateSessionTitle: window.api?.ai?.updateSessionTitle,
      dispatch: dispatchChatState,
    });
  };

  /**
   * 删除 AI 对话；删空后保留一个本地空白会话，避免主界面无激活对象。
   */
  const handleDeleteChat = async (sessionId: string): Promise<boolean> => {
    const isDeleted = await deleteAiChatSession({
      sessionId,
      sessions: chatSessions,
      activeId: activeChatId,
      deleteSession: window.api?.ai?.deleteSession,
      clearSessionContext: useAiChatContextStore.getState().clearSession,
      dispatch: dispatchChatState,
    });

    if (isDeleted) {
      setLoadedHistoryCount((currentCount) => Math.max(0, currentCount - 1));
    }

    return isDeleted;
  };

  /**
   * 批量删除 AI 对话；删除失败时停止后续删除，避免本地状态与持久化状态继续分叉。
   */
  const handleBatchDeleteChats = async (
    sessionIds: string[],
  ): Promise<boolean> => {
    const uniqueSessionIds = Array.from(new Set(sessionIds));

    for (const sessionId of uniqueSessionIds) {
      const isDeleted = await handleDeleteChat(sessionId);

      if (!isDeleted) {
        toast.error("批量删除对话失败");
        return false;
      }
    }

    if (uniqueSessionIds.length > 0) {
      toast.success(`已删除 ${uniqueSessionIds.length} 个对话`);
    }

    return true;
  };

  /**
   * 删除指定消息所属的一轮 QA，并同步清理持久化上下文快照与工具记录。
   */
  const handleDeleteChatTurn = async (messageId: string): Promise<void> => {
    await deleteAiChatTurn({
      messageId,
      session: activeChatSession,
      sessions: chatSessions,
      activeId: activeChatId,
      deleteTurn: window.api?.ai?.deleteTurn,
      removeRunMappingsByMessageIds,
      dispatch: dispatchChatState,
      toast,
    });
  };

  /**
   * 更新指定 AI 消息。
   */
  const updateAiMessage = (
    sessionId: string,
    messageId: string,
    updater: AiChatMessageUpdater,
  ): void => {
    dispatchChatState({
      type: "update-message",
      sessionId,
      messageId,
      updater,
    });
  };

  /**
   * 更新指定 AI 会话状态。
   */
  const updateChatSessionStatus = (
    sessionId: string,
    status: AiChatSession["status"],
  ): void => {
    const shouldRefreshTime = status === "completed" || status === "failed";
    const nextTime = shouldRefreshTime ? createSessionListTimestamp() : undefined;

    dispatchChatState({
      type: "update",
      sessionId,
      updater: (session) => ({
        ...session,
        status,
        time: nextTime ?? session.time,
      }),
    });

    setCompletionNoticeSessionIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (status === "completed" && sessionId !== activeChatIdRef.current) {
        nextIds.add(sessionId);
        return nextIds;
      }

      if (status === "running" || sessionId === activeChatIdRef.current) {
        nextIds.delete(sessionId);
      }

      return nextIds.size === currentIds.size ? currentIds : nextIds;
    });
  };

  /**
   * 清理指定 AI 对话完成提醒。
   */
  const clearCompletionNoticeSession = (sessionId: string): void => {
    setCompletionNoticeSessionIds((currentIds) => {
      if (!currentIds.has(sessionId)) {
        return currentIds;
      }

      const nextIds = new Set(currentIds);
      nextIds.delete(sessionId);
      return nextIds;
    });
  };

  /**
   * 确认服务端生成的真实标题。
   */
  const confirmOptimisticTitle = (
    sessionId: string,
    optimisticTitle: string,
    title: string,
  ): void => {
    dispatchChatState({
      type: "confirm-optimistic-title",
      sessionId,
      optimisticTitle,
      title,
    });
  };

  // 订阅主进程 AI 对话事件。
  useEffect(() => {
    const handleAiChatEvent = createAiChatEventHandler({
      runMessageMapRef,
      textBufferRef,
      typewriterTimerRef,
      updateAiMessage,
      updateChatSessionStatus,
      confirmOptimisticTitle,
    });
    const unsubscribe = window.api?.ai?.onChatEvent?.(handleAiChatEvent);

    return () => {
      cancelPendingAiChatAsks();
      unsubscribe?.();
      clearAiChatTypewriterTimers(typewriterTimerRef);
    };
  }, [cancelPendingAiChatAsks]);

  // 页面刷新或窗口销毁时只作废等待用户回答的 Ask，已输出内容仍由主进程继续落库。
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      cancelPendingAiChatAsks();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [cancelPendingAiChatAsks]);

  // 读取启用的 AI 模型选项。
  useEffect(() => {
    let isMounted = true;

    void window.api?.ai?.getModelOptions?.()
      .then((options) => {
        if (!isMounted) return;
        setAiModelOptions(options.providers);
        setAiAgentOption(options.agent);

        // 尝试从 localStorage 读取上次选择的模型。
        let savedModel: AiModelSelection | null = null;
        try {
          const saved = localStorage.getItem(LOCAL_STORAGE_AI_MODEL_KEY);
          if (saved) {
            savedModel = JSON.parse(saved);
          }
        } catch {
          // 忽略解析错误
        }

        // 验证缓存中的模型是否有效且目前依然可用。
        const isValidModel =
          savedModel &&
          options.providers.some((provider) =>
            provider.id === savedModel!.provider &&
            provider.models.some((model) => model.id === savedModel!.model),
          );

        if (isValidModel) {
          setSelectedAiModel(savedModel);
        } else {
          setSelectedAiModel(
            resolveDefaultAiModel(
              options.providers,
              options.defaultProvider,
              options.defaultModel,
            ),
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setAiModelOptions([]);
        setAiAgentOption(null);
        setSelectedAiModel(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 当 selectedAiModel 发生变化时，保存到 localStorage 缓存中。
  useEffect(() => {
    if (selectedAiModel) {
      try {
        localStorage.setItem(LOCAL_STORAGE_AI_MODEL_KEY, JSON.stringify(selectedAiModel));
      } catch {
        // 忽略可能存在的 Storage 写入异常
      }
    }
  }, [selectedAiModel]);

  // 启动时读取真实持久化会话；没有历史时创建空白会话。
  useEffect(() => {
    let isMounted = true;

    const listSessionsFn = window.api?.ai?.listSessions;
    if (listSessionsFn) {
      void listSessionsFn({
        limit: AI_CHAT_HISTORY_PAGE_SIZE + 1,
        offset: 0,
      })
        .then((sessions) => {
          if (!isMounted) {
            return;
          }
          const visibleSessions = sessions.slice(0, AI_CHAT_HISTORY_PAGE_SIZE);

          setLoadedHistoryCount(visibleSessions.length);
          setHasMoreChatSessions(sessions.length > AI_CHAT_HISTORY_PAGE_SIZE);

          if (visibleSessions.length === 0) {
            const empty = createEmptyAiChatSession();
            dispatchChatState({
              type: "reset",
              sessions: [empty],
              activeId: empty.id,
            });
            return;
          }

          dispatchChatState({
            type: "reset",
            sessions: visibleSessions,
            activeId: visibleSessions[0].id,
          });
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }
          const empty = createEmptyAiChatSession();
          setLoadedHistoryCount(0);
          setHasMoreChatSessions(false);
          dispatchChatState({
            type: "reset",
            sessions: [empty],
            activeId: empty.id,
          });
        });
    } else {
      const empty = createEmptyAiChatSession();
      setLoadedHistoryCount(0);
      setHasMoreChatSessions(false);
      dispatchChatState({
        type: "reset",
        sessions: [empty],
        activeId: empty.id,
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * 触底加载下一页 AI 历史会话。
   */
  const handleLoadMoreChatSessions = async (): Promise<void> => {
    if (
      isLoadingMoreChatSessions ||
      !hasMoreChatSessions ||
      !window.api?.ai?.listSessions
    ) {
      return;
    }

    setIsLoadingMoreChatSessions(true);

    try {
      const sessions = await window.api.ai.listSessions({
        limit: AI_CHAT_HISTORY_PAGE_SIZE + 1,
        offset: loadedHistoryCount,
      });
      const visibleSessions = sessions.slice(0, AI_CHAT_HISTORY_PAGE_SIZE);

      dispatchChatState({ type: "append", sessions: visibleSessions });
      setLoadedHistoryCount((currentCount) => currentCount + visibleSessions.length);
      setHasMoreChatSessions(sessions.length > AI_CHAT_HISTORY_PAGE_SIZE);
    } finally {
      setIsLoadingMoreChatSessions(false);
    }
  };

  // 会话切换时按需补全消息详情，列表读取失败不阻塞现有对话。
  useEffect(() => {
    if (!activeChatId || !window.api?.ai?.getSession) {
      return;
    }

    let isMounted = true;

    void window.api.ai
      .getSession(activeChatId)
      .then((session) => {
        if (!isMounted || !session) {
          return;
        }

        if (!chatSessions.some((item) => item.id === session.id)) {
          transientSearchSessionIdsRef.current.add(session.id);
        }

        dispatchChatState({ type: "replace", session });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeChatId]);

  /**
   * 构造发送给主进程的上下文，优先使用当前 React 状态中的消息避免 store 同步延迟。
   */
  const buildStartContextItems = (
    sessionId: string,
    sourceSessions: AiChatSession[] = chatSessions,
  ): AiChatContextItem[] => {
    const session = sourceSessions.find((item) => item.id === sessionId);
    const storeItems = useAiChatContextStore
      .getState()
      .getSessionItems(sessionId);
    const preservedItems = storeItems.filter(
      (item) => item.kind !== "message" && item.kind !== "tool",
    );
    const messageItems = buildMessageContextItems(
      sessionId,
      session?.messages ?? [],
    );
    const itemsByKey = new Map<string, AiChatContextItem>();

    for (const item of [...preservedItems, ...messageItems]) {
      if (!itemsByKey.has(item.key)) {
        itemsByKey.set(item.key, item);
      }
    }

    return Array.from(itemsByKey.values());
  };

  /**
   * 在指定会话中追加用户消息并触发 AI 回答。
   */
  const startAiChatMessage = (
    input: AiChatSendInput,
    sessionId: string,
    sourceSessions: AiChatSession[] = chatSessions,
  ): void => {
    const sendPayload = normalizeAiChatSendInput(input);
    const text = sendPayload.text.trim();
    const agents = toAiChatAgentHints(sendPayload.agents);

    if (!text) {
      return;
    }

    const userTime = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sessionTime = createSessionListTimestamp();
    const runId = createAiChatUuid();
    const userMessageId = createAiChatUuid();
    const assistantMessageId = createAiChatUuid();
    const hasAiBridge = Boolean(window.api?.ai);
    const contextItems = buildStartContextItems(sessionId, sourceSessions);
    const optimisticSessionTitle = text.slice(0, 15) + (text.length > 15 ? "..." : "");

    const userMessage = {
      id: userMessageId,
      role: "user" as const,
      content: text,
      parts: sendPayload.parts,
      time: userTime,
    };
    const aiMessage = {
      id: assistantMessageId,
      role: "assistant" as const,
      content: hasAiBridge ? `Processing: "${text}"` : "AI bridge is not ready",
      time: userTime,
      toolSteps: [],
      answer: hasAiBridge ? "" : "The current runtime does not expose the AI IPC bridge.",
    };
    // 先写入乐观消息，保证 IPC 延迟时界面即时反馈。
    const sourceSessionsById = new Map(
      sourceSessions.map((session) => [session.id, session]),
    );
    const sourceSession = sourceSessionsById.get(sessionId);
    const isNewSession = sourceSession
      ? sourceSession.title === "新建对话" && sourceSession.messages.length === 0
      : false;

    runMessageMapRef.current.set(runId, {
      sessionId,
      messageId: assistantMessageId,
      optimisticTitle: optimisticSessionTitle,
      runState: "running",
      titleState: isNewSession ? "pending" : "not-required",
    });

    dispatchChatState({
      type: "update",
      sessionId,
      updater: (session) => {
        const currentSession = sourceSession ?? session;
        return {
          ...currentSession,
          title: isNewSession ? optimisticSessionTitle : currentSession.title,
          time: sessionTime,
          status: "running",
          messages: [...currentSession.messages, userMessage, aiMessage],
        };
      },
    });
    transientSearchSessionIdsRef.current.delete(sessionId);

    if (!window.api?.ai) {
      return;
    }

    void window.api.ai
      .startChat({
        runId,
        userMessageId,
        assistantMessageId,
        sessionId,
        message: text,
        parts: sendPayload.parts,
        provider: selectedAiModel?.provider,
        model: selectedAiModel?.model,
        context: contextItems,
        agents,
      })
      .catch((error: unknown) => {
        updateAiMessage(sessionId, assistantMessageId, (message) => ({
          ...message,
          content: "AI chat failed to start",
          answer:
            error instanceof Error ? error.message : "AI chat failed to start",
        }));
      });
  };

  /**
   * 发送用户消息并触发 AI 回答。
   */
  const handleSendMessage = (payload: AiChatSendPayload): void => {
    startAiChatMessage(payload, activeChatId);
  };

  /**
   * 提交 Ask 回答，主进程会在同一个 Agent run 内继续执行。
   */
  const handleSubmitAskAnswer = async (
    payload: AiAskAnswerSubmitPayload,
  ): Promise<void> => {
    if (!window.api?.ai?.submitAskAnswer) {
      throw new Error("AI Ask bridge is not ready");
    }

    await window.api.ai.submitAskAnswer(payload);
  };

  /**
   * 提交工具确认回答，主进程会继续或取消对应工具执行。
   */
  const handleSubmitToolConfirmationAnswer = async (
    payload: AiToolConfirmationAnswerSubmitPayload,
  ): Promise<void> => {
    if (!window.api?.ai?.submitToolConfirmationAnswer) {
      throw new Error("AI tool confirmation bridge is not ready");
    }

    await window.api.ai.submitToolConfirmationAnswer(payload);
  };

  /**
   * 重新生成最新一轮 AI 回答：先删除最新 QA，再用原问题和清理后的上下文重发。
   */
  const handleRegenerateLatestAnswer = async (): Promise<void> => {
    await regenerateLatestAiChatAnswer({
      session: activeChatSession,
      sessions: chatSessions,
      activeId: activeChatId,
      undoLastTurn: window.api?.ai?.undoLastTurn,
      removeRunMappingsByMessageIds,
      startAiChatMessage,
      dispatch: dispatchChatState,
      toast,
    });
  };

  /**
   * 编辑指定用户消息，并删除该消息之后的所有对话记录，然后基于新文本重新触发 AI 对话。
   */
  const handleEditAndResendUserMessage = async (messageId: string, text: string): Promise<void> => {
    if (activeChatSession.status === "running") {
      toast.warning("AI 正在生成，不能编辑消息");
      return;
    }

    const messages = activeChatSession.messages;
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex < 0 || messages[messageIndex].role !== "user") {
      toast.error("未找到有效的用户消息");
      return;
    }

    // 1. 删除此用户消息之后的所有消息（包含它自己，但在重新发送前我们会把它删除，或者我们直接通过持久层接口处理）。
    // 在这里，我们可以通过 deleteTurn/deleteTurnByMessageId 来清除。
    // deleteTurnByMessageId 会删除 messageId 所在的 QA 以及之后的所有 QA (因为它是多轮对话，如果删了中间的，后面的也会由于上下文改变而被删除。其实在持久层，deleteTurnByMessageId 已经自动删除了该 QA 到末尾的所有消息，见 deleteTurnByRange(..., messages, turnStartIndex, messages.length))。
    // 来看 deleteTurnByMessageId 的具体实现：它传入的是 messageId，然后获取所在 turn 的起止位置，并删除从 turnStartIndex 到 messages.length (末尾) 的所有消息！
    // 恰好完全符合“删除此消息及其后所有对话记录”的需求！
    try {
      const deleteTurnFn = window.api?.ai?.deleteTurn;
      if (deleteTurnFn) {
        const persistedSession = await deleteTurnFn(activeChatSession.id, messageId);
        // 先在前端状态中同步清除后面的消息
        const turnBounds = findChatTurnBoundsByMessageId(messages, messageId);
        if (turnBounds) {
          const removedMessages = messages.slice(turnBounds.startIndex);
          const removedMessageIds = new Set(removedMessages.map((m) => m.id));
          removeRunMappingsByMessageIds(removedMessageIds);

          const fallbackSession = {
            ...activeChatSession,
            title: turnBounds.startIndex === 0 ? "新建对话" : activeChatSession.title,
            status: turnBounds.startIndex === 0 ? ("idle" as const) : ("completed" as const),
            messages: messages.slice(0, turnBounds.startIndex),
          };

          const cleanSessions = chatSessions.map((item) =>
            item.id === activeChatId ? (persistedSession ?? fallbackSession) : item,
          );
          dispatchChatState({ type: "reset", sessions: cleanSessions, activeId: activeChatId });

          // 2. 基于新的文本发送消息
          startAiChatMessage(text, activeChatId, cleanSessions);
        }
      } else {
        // 无持久层 fallback
        const turnBounds = findChatTurnBoundsByMessageId(messages, messageId);
        if (turnBounds) {
          const removedMessages = messages.slice(turnBounds.startIndex);
          const removedMessageIds = new Set(removedMessages.map((m) => m.id));
          removeRunMappingsByMessageIds(removedMessageIds);

          const fallbackSession = {
            ...activeChatSession,
            title: turnBounds.startIndex === 0 ? "新建对话" : activeChatSession.title,
            status: turnBounds.startIndex === 0 ? ("idle" as const) : ("completed" as const),
            messages: messages.slice(0, turnBounds.startIndex),
          };

          const cleanSessions = chatSessions.map((item) =>
            item.id === activeChatId ? fallbackSession : item,
          );
          dispatchChatState({ type: "reset", sessions: cleanSessions, activeId: activeChatId });

          // 基于新文本发送消息
          startAiChatMessage(text, activeChatId, cleanSessions);
        }
      }
    } catch {
      toast.error("编辑消息失败");
    }
  };

  /**
   * 切换当前激活的 AI 对话会话。
   */
  const handleActiveChatChange = (sessionId: string): void => {
    if (sessionId !== activeChatId) {
      cancelPendingAiChatAsks(activeChatId);
    }

    clearCompletionNoticeSession(sessionId);

    if (
      sessionId !== activeChatId &&
      transientSearchSessionIdsRef.current.has(activeChatId)
    ) {
      transientSearchSessionIdsRef.current.delete(activeChatId);
      useAiChatContextStore.getState().clearSession(activeChatId);
      dispatchChatState({
        type: "discard",
        sessionId: activeChatId,
        activeId: sessionId,
      });
      return;
    }

    dispatchChatState({ type: "set-active", activeId: sessionId });
  };

  return {
    isChatOpen,
    chatSessions,
    activeChatId,
    completionNoticeSessionIds,
    activeChatSession,
    activeChatContextItems,
    activeChatContextBudget,
    aiModelOptions,
    aiAgentOption,
    selectedAiModel,
    hasMoreChatSessions,
    isLoadingMoreChatSessions,
    handleChatToggle,
    setActiveChatId: handleActiveChatChange,
    clearCompletionNoticeSession,
    setSelectedAiModel,
    handleNewChat,
    handleRenameChat,
    handleDeleteChat,
    handleBatchDeleteChats,
    handleLoadMoreChatSessions,
    handleSendMessage,
    handleSubmitAskAnswer,
    handleSubmitToolConfirmationAnswer,
    handleRegenerateLatestAnswer,
    handleEditAndResendUserMessage,
    handleDeleteChatTurn,
    handleAiChatCommand,
  };
};
