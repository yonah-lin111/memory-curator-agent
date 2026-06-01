import type React from "react";
import { useState, useEffect, useRef } from "react";
import { JournalPage } from "@renderer/pages/journal/JournalPage";
import { MemoriesPage } from "@renderer/pages/memories/MemoriesPage";
import { NotesPage } from "@renderer/pages/notes/NotesPage";
import { ThemesPage } from "@renderer/pages/themes/ThemesPage";
import { WeeklyReviewPage } from "@renderer/pages/weekly-review/WeeklyReviewPage";
import { TodoPage } from "@renderer/pages/todo/TodoPage";
import { SnippetsPage } from "@renderer/pages/snippets/SnippetsPage";
import { PeoplePage } from "@renderer/pages/people/PeoplePage";
import {
  Sidebar,
  type SidebarPageId,
} from "@renderer/components/layout/Sidebar";
import { Header } from "@renderer/components/layout/Header";
import { TodayPage } from "@renderer/pages/today/TodayPage";
import { ToastProvider } from "@renderer/components/ui/Toast";
import { AiChatWorkspace } from "@renderer/features/ai-chat/components/AiChatWorkspace";
import { AiChatContextBar } from "@renderer/features/ai-chat/components/AiChatContextBar";
import {
  buildMessageContextItems,
  getAiChatContextBudget,
  type AiChatContextItem,
} from "@renderer/features/ai-chat/aiChatContextBuilder";
import { useAiChatContextStore } from "@renderer/features/ai-chat/aiChatContextStore";
import {
  AI_CHAT_SESSIONS,
  type AiAgentOption,
  type AiChatEvent,
  type AiChatMessagePart,
  type AiChatSession,
  type AiChatSessionStatus,
  type AiModelProviderOption,
  type AiModelSelection,
} from "@renderer/features/ai-chat/aiChatMock";

// 空上下文数组，避免 Zustand selector 在空态返回新引用。
const EMPTY_AI_CHAT_CONTEXT_ITEMS: AiChatContextItem[] = [];

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
 * 记忆策展 Agent 的主应用布局。
 * 通过左侧导航与中间页面区域组织日输入、策展回顾和 Agent 编写页面。
 */
export const App = (): React.JSX.Element => {
  // 左侧导航栏折叠状态。
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // AI 对话模式打开状态。
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  // AI 对话会话列表。
  const [chatSessions, setChatSessions] = useState<AiChatSession[]>(AI_CHAT_SESSIONS);

  // 当前激活的 AI 对话会话标识。
  const [activeChatId, setActiveChatId] = useState<string>(AI_CHAT_SESSIONS[0].id);

  // 已启用的 AI provider 与模型选项。
  const [aiModelOptions, setAiModelOptions] = useState<AiModelProviderOption[]>([]);

  // AI Agent 非密钥行为配置。
  const [aiAgentOption, setAiAgentOption] = useState<AiAgentOption | null>(null);

  // 当前选中的 AI provider 与模型。
  const [selectedAiModel, setSelectedAiModel] = useState<AiModelSelection | null>(null);

  // Agent 运行与消息的映射关系。
  const runMessageMapRef = useRef<
    Map<string, { sessionId: string; messageId: string; optimisticTitle?: string }>
  >(new Map());

  // 流式文本缓冲区，用于打字机输出。
  const textBufferRef = useRef<Map<string, string>>(new Map());

  // 打字机刷新定时器集合。
  const typewriterTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 当前激活的 AI 对话会话。
  const activeChatSession =
    chatSessions.find((session) => session.id === activeChatId) ??
    chatSessions[0];
  const activeChatContextItems = useAiChatContextStore(
    (state) => state.sessionItems[activeChatId] ?? EMPTY_AI_CHAT_CONTEXT_ITEMS,
  );
  const activeChatContextBudget = getAiChatContextBudget({
    items: activeChatContextItems,
    modelOptions: aiModelOptions,
    selectedModel: selectedAiModel,
  });

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
      return;
    }

    const newSession = createEmptyAiChatSession();
    // 将新会话插到最前面，保证最新创建的对话排在最上方。
    setChatSessions((prev) => [newSession, ...prev]);
    setActiveChatId(newSession.id);
  };

  /**
   * 更新 AI 对话标题，持久化失败时回滚本地状态。
   */
  const handleRenameChat = async (sessionId: string, title: string): Promise<boolean> => {
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
    const nextSessions = previousSessions.filter((session) => session.id !== sessionId);
    const fallbackSession = nextSessions.length === 0 ? createEmptyAiChatSession() : null;
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
   * 更新指定 AI 消息。
   */
  const updateAiMessage = (
    sessionId: string,
    messageId: string,
    updater: (message: AiChatSession["messages"][number]) => AiChatSession["messages"][number],
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
  const updateChatSessionStatus = (sessionId: string, status: AiChatSessionStatus): void => {
    setChatSessions((prevSessions) =>
      prevSessions.map((session) => (session.id === sessionId ? { ...session, status } : session)),
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
            title: "查询本地 People",
            status: "running",
            tool: event.name,
            input: event.input,
            observation: "正在读取本地 People 表。",
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
                title: `工具结果：${event.name}`,
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
                    observation: `工具执行失败：${event.error}`,
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
                title: `工具失败：${event.name}`,
                status: "failed",
                tool: event.name,
                input: event.input,
                observation: `工具执行失败：${event.error}`,
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
        content: "AI 对话执行失败",
        answer: event.message,
      }));
    }
  };

  // 订阅主进程 AI 对话事件。
  useEffect(() => {
    const unsubscribe = window.api?.ai?.onChatEvent(handleAiChatEvent);

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
          resolveDefaultAiModel(options.providers, options.defaultProvider, options.defaultModel),
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

  // 启动时读取真实持久化会话；没有历史时继续保留静态示例。
  useEffect(() => {
    let isMounted = true;

    void window.api?.ai?.listSessions?.()
      .then((sessions) => {
        if (!isMounted || sessions.length === 0) {
          return;
        }

        setChatSessions(sessions);
        setActiveChatId(sessions[0].id);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
      });

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
  const buildStartContextItems = (sessionId: string): AiChatContextItem[] => {
    const session = chatSessions.find((item) => item.id === sessionId);
    const storeItems = useAiChatContextStore.getState().getSessionItems(sessionId);
    const preservedItems = storeItems.filter((item) => item.kind !== "message" && item.kind !== "tool");
    const messageItems = buildMessageContextItems(sessionId, session?.messages ?? []);
    const itemsByKey = new Map<string, AiChatContextItem>();

    for (const item of [...preservedItems, ...messageItems]) {
      if (!itemsByKey.has(item.key)) {
        itemsByKey.set(item.key, item);
      }
    }

    return Array.from(itemsByKey.values());
  };

  /**
   * 发送用户消息并触发 AI 回答。
   */
  const handleSendMessage = (text: string): void => {
    const userTime = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sessionId = activeChatId;
    const runId = `run-${Date.now()}`;
    const userMessageId = `${runId}-user`;
    const assistantMessageId = `${runId}-assistant`;
    const hasAiBridge = Boolean(window.api?.ai);
    const contextItems = buildStartContextItems(sessionId);
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
      content: hasAiBridge ? `正在处理：“${text}”` : "AI 桥接未就绪",
      time: userTime,
      toolSteps: [],
      answer: hasAiBridge ? "" : "当前运行环境没有暴露 AI IPC 桥接。",
    };
    runMessageMapRef.current.set(runId, {
      sessionId,
      messageId: assistantMessageId,
      optimisticTitle: optimisticSessionTitle,
    });

    // 1. 更新当前会话，添加用户消息。如果当前会话处于初始状态，自动更新标题与摘要。
    setChatSessions((prevSessions) => {
      return prevSessions.map((session) => {
        if (session.id === sessionId) {
          const isNewSession = session.title === "新建对话" && session.messages.length === 0;
          return {
            ...session,
            title: isNewSession ? optimisticSessionTitle : session.title,
            summary: isNewSession ? text : session.summary,
            status: "running",
            messages: [...session.messages, userMessage, aiMessage],
          };
        }
        return session;
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
          content: "AI 对话启动失败",
          answer: error instanceof Error ? error.message : "AI 对话启动失败",
        }));
      });
  };

  // 根据当前 URL pathname 获取初始页面标识，默认为 'today'。
  const getPageFromPathname = (): SidebarPageId => {
    const path = window.location.pathname.replace(/^\/|\/$/g, "");
    const validPages: SidebarPageId[] = [
      "today",
      "notes",
      "journal",
      "weekly",
      "themes",
      "memories",
      "todo",
      "snippets",
      "people",
    ];
    if (validPages.includes(path as SidebarPageId)) {
      return path as SidebarPageId;
    }
    return "today";
  };

  // 当前中间主内容页面。
  const [activePage, setActivePage] =
    useState<SidebarPageId>(getPageFromPathname);

  // 获取页面的分类名称。
  const getPageCategory = (pageId: SidebarPageId): string => {
    switch (pageId) {
      case "today":
        return "DAILY";
      case "notes":
      case "journal":
      case "todo":
      case "snippets":
      case "people":
        return "LIBRARY";
      case "weekly":
      case "themes":
      case "memories":
        return "CURATION";
      default:
        return "DAILY";
    }
  };

  // 监听 URL 路由 pathname 变化，确保与页面状态双向同步。
  useEffect(() => {
    const handlePopState = () => {
      const page = getPageFromPathname();
      setActivePage(page);
    };

    // 初始化如果 pathname 为根路径，则默认写入 /today 路由
    const initialPath = window.location.pathname;
    if (initialPath === "/" || initialPath === "") {
      window.history.replaceState({}, "", "/today");
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);
  /**
   * 根据当前侧栏页面渲染中间主内容。
   */
  const renderActivePage = (): React.JSX.Element => {
    switch (activePage) {
      case "today":
        return <TodayPage />;
      case "notes":
        return <NotesPage />;
      case "journal":
        return <JournalPage />;
      case "weekly":
        return <WeeklyReviewPage />;
      case "themes":
        return <ThemesPage />;
      case "memories":
        return <MemoriesPage />;
      case "todo":
        return <TodoPage />;
      case "snippets":
        return <SnippetsPage />;
      case "people":
        return <PeoplePage />;
    }
  };

  return (
    <ToastProvider>
      <main className="flex flex-col lg:flex-row h-screen w-screen bg-[#000000] p-3 gap-3 text-white antialiased overflow-y-auto lg:overflow-hidden">
        {/* 左侧多维导航栏 */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          activePage={activePage}
          mode={isChatOpen ? "chat" : "navigation"}
          chatSessions={chatSessions}
          activeChatId={activeChatId}
          onCollapsedChange={setIsSidebarCollapsed}
          onPageChange={(pageId) => {
            window.history.pushState({}, "", `/${pageId}`);
            setActivePage(pageId);
          }}
          onChatSessionChange={setActiveChatId}
          onNewChat={handleNewChat}
          onRenameChat={handleRenameChat}
          onDeleteChat={handleDeleteChat}
        />

        {/* 中间主工作区 */}
        <div className="flex-1 flex flex-col h-auto lg:h-full overflow-hidden min-w-0">
          {/* 固定的顶部栏 */}
          <Header
            category={isChatOpen ? "AGENT" : getPageCategory(activePage)}
            activePage={isChatOpen ? "chat" : activePage}
            isChatOpen={isChatOpen}
            onChatToggle={handleChatToggle}
            chatTitle={activeChatSession.title}
            chatLeadingAction={
              isChatOpen ? (
                <AiChatContextBar
                  items={activeChatContextItems}
                  budget={activeChatContextBudget}
                  agent={aiAgentOption}
                />
              ) : null
            }
          />

          <div className="flex-1 min-h-0 relative overflow-hidden">
            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                isChatOpen
                  ? "pointer-events-none opacity-0"
                  : "pointer-events-auto opacity-100"
              }`}
              aria-hidden={isChatOpen}
            >
              <div className="w-full h-full">{renderActivePage()}</div>
            </div>

            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                isChatOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
              aria-hidden={!isChatOpen}
            >
              <AiChatWorkspace
                session={activeChatSession}
                modelOptions={aiModelOptions}
                selectedModel={selectedAiModel}
                onSendMessage={handleSendMessage}
                onModelChange={setSelectedAiModel}
              />
            </div>
          </div>
        </div>
      </main>
    </ToastProvider>
  );
};
