import { useEffect, useRef, useState } from "react";
import type { AiChatInputCommandId } from "@renderer/features/ai-chat/components/AiChatInput";
import { useToast } from "@renderer/components/ui/Toast";
import {
  buildMessageContextItems,
  getAiChatContextBudget,
  type AiChatContextBudget,
  type AiChatContextItem,
} from "@renderer/features/ai-chat/aiChatContextBuilder";
import { useAiChatContextStore } from "@renderer/features/ai-chat/aiChatContextStore";
import {
  type AiAgentOption,
  type AiChatEvent,
  type AiChatMessagePart,
  type AiChatSession,
  type AiChatSessionStatus,
  type AiModelProviderOption,
  type AiModelSelection,
} from "@renderer/features/ai-chat/types";

// 空上下文数组，避免 Zustand selector 在空态返回新引用。
const EMPTY_AI_CHAT_CONTEXT_ITEMS: AiChatContextItem[] = [];

// 运行消息映射关系。
type AiRunMessageMapping = {
  // 会话标识。
  sessionId: string;
  // AI 消息标识。
  messageId: string;
  // 用户发送后先写入的乐观标题。
  optimisticTitle?: string;
};

// AI 对话控制器返回值。
type UseAiChatControllerResult = {
  // AI 对话模式打开状态。
  isChatOpen: boolean;
  // AI 对话会话列表。
  chatSessions: AiChatSession[];
  // 当前激活的 AI 对话会话标识。
  activeChatId: string;
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
  // 切换 AI 对话模式。
  handleChatToggle: () => void;
  // 切换当前激活的 AI 对话会话。
  setActiveChatId: (sessionId: string) => void;
  // 切换当前选中的 AI provider 与模型。
  setSelectedAiModel: (selection: AiModelSelection) => void;
  // 新建 AI 对话会话。
  handleNewChat: () => void;
  // 更新 AI 对话标题。
  handleRenameChat: (sessionId: string, title: string) => Promise<boolean>;
  // 删除 AI 对话会话。
  handleDeleteChat: (sessionId: string) => Promise<boolean>;
  // 发送用户消息。
  handleSendMessage: (text: string) => void;
  // 重新生成最新 AI 回答。
  handleRegenerateLatestAnswer: () => Promise<void>;
  // 删除指定消息所属 QA。
  handleDeleteChatTurn: (messageId: string) => Promise<void>;
  // 执行 AI 输入框命令。
  handleAiChatCommand: (
    command: AiChatInputCommandId,
  ) => string | void | Promise<string | void>;
};

/**
 * 兜底的空白会话，避免在列表为空时频繁触发对象重建。
 */
const FALLBACK_EMPTY_SESSION: AiChatSession = {
  id: "",
  title: "新对话",
  summary: "",
  time: "",
  status: "idle",
  messages: [],
};

/**
 * 创建本地空白 AI 会话，供新建入口与最后一条删除后的兜底态复用。
 */
const createEmptyAiChatSession = (): AiChatSession => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    id: `session-${Date.now()}`,
    title: "新建对话",
    summary: "暂无对话内容",
    time: timeStr,
    status: "idle",
    messages: [],
  };
};

/**
 * 判断会话是否为可复用的空白草稿。
 */
const isEmptyAiChatDraftSession = (session: AiChatSession): boolean =>
  session.title === "新建对话" && session.messages.length === 0;

/**
 * 查找最后一轮用户对话在消息列表中的起始位置。
 */
const findLastChatTurnStartIndex = (
  messages: AiChatSession["messages"],
): number => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return index;
    }
  }

  return -1;
};

/**
 * 查找指定消息所属 QA 轮次的起止位置。
 */
const findChatTurnBoundsByMessageId = (
  messages: AiChatSession["messages"],
  messageId: string,
): { startIndex: number; endIndex: number } | null => {
  const messageIndex = messages.findIndex((message) => message.id === messageId);

  if (messageIndex < 0) {
    return null;
  }

  let startIndex = messageIndex;

  while (startIndex > 0 && messages[startIndex].role !== "user") {
    startIndex -= 1;
  }

  if (messages[startIndex]?.role !== "user") {
    return null;
  }

  let endIndex = startIndex + 1;

  while (endIndex < messages.length && messages[endIndex].role !== "user") {
    endIndex += 1;
  }

  return {
    startIndex,
    endIndex,
  };
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

  // AI 对话会话列表。
  const [chatSessions, setChatSessions] =
    useState<AiChatSession[]>([]);

  // 当前激活的 AI 对话会话标识。
  const [activeChatId, setActiveChatId] = useState<string>("");

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

  // Agent 运行与消息的映射关系。
  const runMessageMapRef = useRef<Map<string, AiRunMessageMapping>>(new Map());

  // 流式文本缓冲区，用于打字机输出。
  const textBufferRef = useRef<Map<string, string>>(new Map());

  // 打字机刷新定时器集合。
  const typewriterTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // 当前激活的 AI 对话会话。
  const activeChatSession =
    chatSessions.find((session) => session.id === activeChatId) ??
    chatSessions[0] ??
    FALLBACK_EMPTY_SESSION;
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
      setActiveChatId(existingEmptySession.id);
      toast.info("已切换到空白对话");
      return;
    }

    const newSession = createEmptyAiChatSession();
    // 将新会话插到最前面，保证最新创建的对话排在最上方。
    setChatSessions((prev) => [newSession, ...prev]);
    setActiveChatId(newSession.id);
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
   * 撤销当前会话最后一轮用户对话，并同步删除持久化 run、工具调用和上下文快照。
   */
  const handleUndoLastChatTurn = async (): Promise<string | void> => {
    const session = activeChatSession;
    const turnStartIndex = findLastChatTurnStartIndex(session.messages);

    if (turnStartIndex < 0) {
      toast.warning("没有可撤销的对话");
      return;
    }

    const previousSessions = chatSessions;
    const removedMessages = session.messages.slice(turnStartIndex);
    const removedUserMessage = removedMessages.find(
      (message) => message.role === "user",
    );
    const removedMessageIds = new Set(
      removedMessages.map((message) => message.id),
    );
    const nextMessages = session.messages.slice(0, turnStartIndex);
    const nextLastUserMessage = [...nextMessages]
      .reverse()
      .find((message) => message.role === "user");
    const nextSession: AiChatSession = {
      ...session,
      title: nextMessages.length === 0 ? "新建对话" : session.title,
      summary: nextLastUserMessage?.content ?? "暂无对话内容",
      status: nextMessages.length === 0 ? "idle" : "completed",
      messages: nextMessages,
    };

    if (!window.api?.ai?.undoLastTurn) {
      removeRunMappingsByMessageIds(removedMessageIds);
      setChatSessions((prevSessions) =>
        prevSessions.map((item) => (item.id === session.id ? nextSession : item)),
      );
      toast.success("已撤销上一轮，对应问题已回填");
      return removedUserMessage?.content;
    }

    try {
      const persistedSession = await window.api.ai.undoLastTurn(session.id);
      removeRunMappingsByMessageIds(removedMessageIds);
      setChatSessions((prevSessions) =>
        prevSessions.map((item) =>
          item.id === session.id ? (persistedSession ?? nextSession) : item,
        ),
      );
      toast.success("已撤销上一轮，对应问题已回填");
      return removedUserMessage?.content;
    } catch {
      setChatSessions(previousSessions);
      toast.error("撤销对话失败");
    }
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
    const previousSessions = chatSessions;

    setChatSessions((prevSessions) =>
      prevSessions.map((session) =>
        session.id === sessionId ? { ...session, title } : session,
      ),
    );

    try {
      await window.api?.ai?.updateSessionTitle?.(sessionId, title);
      return true;
    } catch {
      setChatSessions(previousSessions);
      return false;
    }
  };

  /**
   * 删除 AI 对话；删空后保留一个本地空白会话，避免主界面无激活对象。
   */
  const handleDeleteChat = async (sessionId: string): Promise<boolean> => {
    const previousSessions = chatSessions;
    const nextSessions = previousSessions.filter(
      (session) => session.id !== sessionId,
    );
    const fallbackSession =
      nextSessions.length === 0 ? createEmptyAiChatSession() : null;
    const resolvedSessions = fallbackSession ? [fallbackSession] : nextSessions;
    const nextActiveSession =
      activeChatId === sessionId
        ? (resolvedSessions[0]?.id ?? activeChatId)
        : activeChatId;

    try {
      await window.api?.ai?.deleteSession?.(sessionId);
      setChatSessions(resolvedSessions);
      setActiveChatId(nextActiveSession);
      useAiChatContextStore.getState().clearSession(sessionId);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * 删除指定消息所属的一轮 QA，并同步清理持久化上下文快照与工具记录。
   */
  const handleDeleteChatTurn = async (messageId: string): Promise<void> => {
    const session = activeChatSession;

    if (session.status === "running") {
      toast.warning("AI 正在生成，不能删除 QA");
      return;
    }

    const turnBounds = findChatTurnBoundsByMessageId(session.messages, messageId);

    if (!turnBounds) {
      toast.warning("未找到可删除的 QA");
      return;
    }

    const previousSessions = chatSessions;
    const removedMessages = session.messages.slice(
      turnBounds.startIndex,
      turnBounds.endIndex,
    );
    const removedMessageIds = new Set(
      removedMessages.map((message) => message.id),
    );
    const nextMessages = [
      ...session.messages.slice(0, turnBounds.startIndex),
      ...session.messages.slice(turnBounds.endIndex),
    ];
    const nextLastUserMessage = [...nextMessages]
      .reverse()
      .find((message) => message.role === "user");
    const fallbackSession: AiChatSession = {
      ...session,
      title: nextMessages.length === 0 ? "新建对话" : session.title,
      summary: nextLastUserMessage?.content ?? "暂无对话内容",
      status: nextMessages.length === 0 ? "idle" : "completed",
      messages: nextMessages,
    };

    removeRunMappingsByMessageIds(removedMessageIds);
    setChatSessions((prevSessions) =>
      prevSessions.map((item) => (item.id === session.id ? fallbackSession : item)),
    );

    try {
      if (window.api?.ai?.deleteTurn) {
        const persistedSession = await window.api.ai.deleteTurn(
          session.id,
          messageId,
        );
        setChatSessions((prevSessions) =>
          prevSessions.map((item) =>
            item.id === session.id ? (persistedSession ?? fallbackSession) : item,
          ),
        );
      }

      toast.success("已删除 QA");
    } catch {
      setChatSessions(previousSessions);
      toast.error("删除 QA 失败");
    }
  };

  /**
   * 更新指定 AI 消息。
   */
  const updateAiMessage = (
    sessionId: string,
    messageId: string,
    updater: (
      message: AiChatSession["messages"][number],
    ) => AiChatSession["messages"][number],
  ): void => {
    setChatSessions((prevSessions) =>
      prevSessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages: session.messages.map((message) =>
                message.id === messageId ? updater(message) : message,
              ),
            }
          : session,
      ),
    );
  };

  /**
   * 更新指定 AI 会话状态。
   */
  const updateChatSessionStatus = (
    sessionId: string,
    status: AiChatSessionStatus,
  ): void => {
    setChatSessions((prevSessions) =>
      prevSessions.map((session) =>
        session.id === sessionId ? { ...session, status } : session,
      ),
    );
  };

  /**
   * appendAiMessageTextPart - 追加流式文本，并同步保留 answer 兼容上下文构造。
   */
  const appendAiMessageTextPart = (
    message: AiChatSession["messages"][number],
    chunk: string,
  ): AiChatSession["messages"][number] => {
    const parts = message.parts ?? [];
    const lastPart = parts[parts.length - 1];
    const nextParts: AiChatMessagePart[] =
      lastPart?.kind === "text"
        ? parts.map((part) =>
            part.id === lastPart.id && part.kind === "text"
              ? { ...part, content: `${part.content}${chunk}` }
              : part,
          )
        : [
            ...parts,
            {
              id: `${message.id}-text-${parts.length}`,
              kind: "text",
              content: chunk,
            },
          ];

    return {
      ...message,
      answer: `${message.answer ?? ""}${chunk}`,
      parts: nextParts,
    };
  };

  /**
   * appendAiMessageToolPart - 追加工具片段，避免重试时工具块被整体前置。
   */
  const appendAiMessageToolPart = (
    message: AiChatSession["messages"][number],
    stepId: string,
  ): AiChatSession["messages"][number] => {
    if (message.parts?.some((part) => part.kind === "tool" && part.stepId === stepId)) {
      return message;
    }

    return {
      ...message,
      parts: [
        ...(message.parts ?? []),
        {
          id: `${message.id}-tool-${stepId}`,
          kind: "tool",
          stepId,
        },
      ],
    };
  };

  /**
   * flushBufferedTextImmediately - 工具事件到达前落盘文本缓冲，保留事件顺序。
   */
  const flushBufferedTextImmediately = (runId: string): void => {
    const mapping = runMessageMapRef.current.get(runId);
    const bufferedText = textBufferRef.current.get(runId) ?? "";
    const timer = typewriterTimerRef.current.get(runId);

    if (timer) {
      clearTimeout(timer);
      typewriterTimerRef.current.delete(runId);
    }

    if (!mapping || !bufferedText) {
      return;
    }

    textBufferRef.current.set(runId, "");
    updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
      appendAiMessageTextPart(message, bufferedText),
    );
  };

  /**
   * 刷新指定运行的文本缓冲。
   */
  const flushTypewriterBuffer = (runId: string): void => {
    const mapping = runMessageMapRef.current.get(runId);
    const bufferedText = textBufferRef.current.get(runId) ?? "";

    if (!mapping || !bufferedText) {
      typewriterTimerRef.current.delete(runId);
      return;
    }

    const chunk = bufferedText.slice(0, 8);
    const rest = bufferedText.slice(8);
    textBufferRef.current.set(runId, rest);
    updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
      appendAiMessageTextPart(message, chunk),
    );

    if (rest) {
      const timer = setTimeout(() => flushTypewriterBuffer(runId), 28);
      typewriterTimerRef.current.set(runId, timer);
      return;
    }

    typewriterTimerRef.current.delete(runId);
  };

  /**
   * 计划指定运行的打字机刷新。
   */
  const scheduleTypewriterFlush = (runId: string): void => {
    if (typewriterTimerRef.current.has(runId)) {
      return;
    }

    const timer = setTimeout(() => flushTypewriterBuffer(runId), 28);
    typewriterTimerRef.current.set(runId, timer);
  };

  /**
   * 处理 AI 对话流式事件。
   */
  const handleAiChatEvent = (event: AiChatEvent): void => {
    const mapping = runMessageMapRef.current.get(event.runId);
    if (!mapping) {
      return;
    }

    if (event.type === "text_delta") {
      const currentBuffer = textBufferRef.current.get(event.runId) ?? "";
      textBufferRef.current.set(event.runId, `${currentBuffer}${event.delta}`);
      scheduleTypewriterFlush(event.runId);
      return;
    }

    if (event.type === "done") {
      updateChatSessionStatus(mapping.sessionId, "completed");
      return;
    }

    if (event.type === "session_title_updated") {
      setChatSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === event.sessionId &&
          mapping.optimisticTitle &&
          session.title === mapping.optimisticTitle
            ? { ...session, title: event.title }
            : session,
        ),
      );
      return;
    }

    if (event.type === "tool_started") {
      flushBufferedTextImmediately(event.runId);
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) => ({
        ...appendAiMessageToolPart(message, event.id),
        toolSteps: [
          ...(message.toolSteps ?? []),
          {
            id: event.id,
            title: "Query local People",
            status: "running",
            tool: event.name,
            input: event.input,
            observation: "Reading the local People table.",
          },
        ],
      }));
      return;
    }

    if (event.type === "tool_finished") {
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) => ({
        ...appendAiMessageToolPart(message, event.id),
        toolSteps: (message.toolSteps ?? []).some((step) => step.id === event.id)
          ? (message.toolSteps ?? []).map((step) =>
              step.id === event.id
                ? {
                    ...step,
                    status: "done",
                    input: step.input,
                    observation: event.observation,
                    data: event.data,
                  }
                : step,
            )
          : [
              ...(message.toolSteps ?? []),
              {
                id: event.id,
                title: `Tool result: ${event.name}`,
                status: "done",
                tool: event.name,
                input: {},
                observation: event.observation,
                data: event.data,
              },
            ],
      }));
      return;
    }

    if (event.type === "tool_failed") {
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) => ({
        ...appendAiMessageToolPart(message, event.id),
        toolSteps: (message.toolSteps ?? []).some((step) => step.id === event.id)
          ? (message.toolSteps ?? []).map((step) =>
              step.id === event.id
                ? {
                    ...step,
                    status: "failed",
                    input: event.input,
                    observation: `Tool execution failed: ${event.error}`,
                    data: {
                      error: event.error,
                    },
                  }
                : step,
            )
          : [
              ...(message.toolSteps ?? []),
              {
                id: event.id,
                title: `Tool failed: ${event.name}`,
                status: "failed",
                tool: event.name,
                input: event.input,
                observation: `Tool execution failed: ${event.error}`,
                data: {
                  error: event.error,
                },
              },
            ],
      }));
      return;
    }

    if (event.type === "error") {
      updateChatSessionStatus(mapping.sessionId, "failed");
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) => ({
        ...message,
        content: "AI chat execution failed",
        answer: event.message,
      }));
    }
  };

  // 订阅主进程 AI 对话事件。
  useEffect(() => {
    const unsubscribe = window.api?.ai?.onChatEvent?.(handleAiChatEvent);

    return () => {
      unsubscribe?.();
      for (const timer of typewriterTimerRef.current.values()) {
        clearTimeout(timer);
      }
      typewriterTimerRef.current.clear();
    };
  }, []);

  // 读取启用的 AI 模型选项。
  useEffect(() => {
    let isMounted = true;

    void window.api?.ai?.getModelOptions?.()
      .then((options) => {
        if (!isMounted) return;
        setAiModelOptions(options.providers);
        setAiAgentOption(options.agent);
        setSelectedAiModel(
          resolveDefaultAiModel(
            options.providers,
            options.defaultProvider,
            options.defaultModel,
          ),
        );
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

  // 启动时读取真实持久化会话；没有历史时创建空白会话。
  useEffect(() => {
    let isMounted = true;

    const listSessionsFn = window.api?.ai?.listSessions;
    if (listSessionsFn) {
      void listSessionsFn()
        .then((sessions) => {
          if (!isMounted) {
            return;
          }
          if (sessions.length === 0) {
            const empty = createEmptyAiChatSession();
            setChatSessions([empty]);
            setActiveChatId(empty.id);
            return;
          }

          setChatSessions(sessions);
          setActiveChatId(sessions[0].id);
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }
          const empty = createEmptyAiChatSession();
          setChatSessions([empty]);
          setActiveChatId(empty.id);
        });
    } else {
      const empty = createEmptyAiChatSession();
      setChatSessions([empty]);
      setActiveChatId(empty.id);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // 会话切换时按需补全消息详情，列表读取失败不阻塞现有对话。
  useEffect(() => {
    if (!window.api?.ai?.getSession) {
      return;
    }

    let isMounted = true;

    void window.api.ai
      .getSession(activeChatId)
      .then((session) => {
        if (!isMounted || !session) {
          return;
        }

        setChatSessions((prevSessions) =>
          prevSessions.map((item) => (item.id === session.id ? session : item)),
        );
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
    text: string,
    sessionId: string,
    sourceSessions: AiChatSession[] = chatSessions,
  ): void => {
    const userTime = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const runId = `run-${Date.now()}`;
    const userMessageId = `${runId}-user`;
    const assistantMessageId = `${runId}-assistant`;
    const hasAiBridge = Boolean(window.api?.ai);
    const contextItems = buildStartContextItems(sessionId, sourceSessions);
    const optimisticSessionTitle = text.slice(0, 15) + (text.length > 15 ? "..." : "");

    const userMessage = {
      id: userMessageId,
      role: "user" as const,
      content: text,
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
    runMessageMapRef.current.set(runId, {
      sessionId,
      messageId: assistantMessageId,
      optimisticTitle: optimisticSessionTitle,
    });

    // 先写入乐观消息，保证 IPC 延迟时界面即时反馈。
    setChatSessions((prevSessions) => {
      const sourceSessionsById = new Map(
        sourceSessions.map((session) => [session.id, session]),
      );

      return prevSessions.map((session) => {
        const sourceSession = sourceSessionsById.get(session.id) ?? session;

        if (sourceSession.id === sessionId) {
          const isNewSession =
            sourceSession.title === "新建对话" &&
            sourceSession.messages.length === 0;
          return {
            ...sourceSession,
            title: isNewSession ? optimisticSessionTitle : sourceSession.title,
            summary: isNewSession ? text : sourceSession.summary,
            status: "running",
            messages: [...sourceSession.messages, userMessage, aiMessage],
          };
        }

        return sourceSession;
      });
    });

    if (!window.api?.ai) {
      return;
    }

    void window.api.ai
      .startChat({
        runId,
        sessionId,
        message: text,
        provider: selectedAiModel?.provider,
        model: selectedAiModel?.model,
        context: contextItems,
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
  const handleSendMessage = (text: string): void => {
    startAiChatMessage(text, activeChatId);
  };

  /**
   * 重新生成最新一轮 AI 回答：先删除最新 QA，再用原问题和清理后的上下文重发。
   */
  const handleRegenerateLatestAnswer = async (): Promise<void> => {
    const session = activeChatSession;

    if (session.status === "running") {
      toast.warning("AI 正在生成，不能重新生成");
      return;
    }

    const assistantIndex = [...session.messages]
      .reverse()
      .findIndex((message) => message.role === "assistant");

    if (assistantIndex < 0) {
      toast.warning("没有可重新生成的回答");
      return;
    }

    const resolvedAssistantIndex = session.messages.length - 1 - assistantIndex;

    if (resolvedAssistantIndex !== session.messages.length - 1) {
      toast.warning("只能重新生成最新回答");
      return;
    }

    const userMessage = session.messages[resolvedAssistantIndex - 1];

    if (userMessage?.role !== "user") {
      toast.warning("最新回答缺少对应问题，不能重新生成");
      return;
    }

    const removedMessages = session.messages.slice(resolvedAssistantIndex - 1);
    const removedMessageIds = new Set(
      removedMessages.map((message) => message.id),
    );
    const nextMessages = session.messages.slice(0, resolvedAssistantIndex - 1);
    const nextLastUserMessage = [...nextMessages]
      .reverse()
      .find((message) => message.role === "user");
    const fallbackSession: AiChatSession = {
      ...session,
      title: nextMessages.length === 0 ? "新建对话" : session.title,
      summary: nextLastUserMessage?.content ?? "暂无对话内容",
      status: nextMessages.length === 0 ? "idle" : "completed",
      messages: nextMessages,
    };
    const previousSessions = chatSessions;

    try {
      const persistedSession = window.api?.ai?.undoLastTurn
        ? await window.api.ai.undoLastTurn(session.id)
        : null;
      const cleanSession = persistedSession ?? fallbackSession;
      const cleanSessions = previousSessions.map((item) =>
        item.id === session.id ? cleanSession : item,
      );

      removeRunMappingsByMessageIds(removedMessageIds);
      setChatSessions(cleanSessions);
      startAiChatMessage(userMessage.content, session.id, cleanSessions);
      toast.success("已重新生成回答");
    } catch {
      setChatSessions(previousSessions);
      toast.error("重新生成失败");
    }
  };

  return {
    isChatOpen,
    chatSessions,
    activeChatId,
    activeChatSession,
    activeChatContextItems,
    activeChatContextBudget,
    aiModelOptions,
    aiAgentOption,
    selectedAiModel,
    handleChatToggle,
    setActiveChatId,
    setSelectedAiModel,
    handleNewChat,
    handleRenameChat,
    handleDeleteChat,
    handleSendMessage,
    handleRegenerateLatestAnswer,
    handleDeleteChatTurn,
    handleAiChatCommand,
  };
};
