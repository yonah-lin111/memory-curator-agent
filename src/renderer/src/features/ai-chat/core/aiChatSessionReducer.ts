import type {
  AiChatSession,
  AiChatSessionStatus,
} from "@renderer/features/ai-chat/types";

// AI 对话消息类型。
type AiChatMessage = AiChatSession["messages"][number];

// AI 对话会话状态容器。
export type AiChatSessionState = {
  // AI 对话会话列表。
  sessions: AiChatSession[];
  // 当前激活的 AI 对话会话标识。
  activeId: string;
};

// AI 消息更新函数。
export type AiChatMessageUpdater = (message: AiChatMessage) => AiChatMessage;

// AI 会话更新函数。
export type AiChatSessionUpdater = (session: AiChatSession) => AiChatSession;

// AI 会话 reducer 动作。
export type AiChatSessionAction =
  | {
      // 动作类型。
      type: "reset";
      // 下一批会话。
      sessions: AiChatSession[];
      // 下一激活会话标识。
      activeId: string;
    }
  | {
      // 动作类型。
      type: "set-active";
      // 下一激活会话标识。
      activeId: string;
    }
  | {
      // 动作类型。
      type: "prepend";
      // 新建会话。
      session: AiChatSession;
    }
  | {
      // 动作类型。
      type: "replace";
      // 要替换的会话。
      session: AiChatSession;
    }
  | {
      // 动作类型。
      type: "update";
      // 会话标识。
      sessionId: string;
      // 会话更新函数。
      updater: AiChatSessionUpdater;
    }
  | {
      // 动作类型。
      type: "update-message";
      // 会话标识。
      sessionId: string;
      // 消息标识。
      messageId: string;
      // 消息更新函数。
      updater: AiChatMessageUpdater;
    }
  | {
      // 动作类型。
      type: "set-status";
      // 会话标识。
      sessionId: string;
      // 会话状态。
      status: AiChatSessionStatus;
    }
  | {
      // 动作类型。
      type: "rename";
      // 会话标识。
      sessionId: string;
      // 会话标题。
      title: string;
    }
  | {
      // 动作类型。
      type: "confirm-optimistic-title";
      // 会话标识。
      sessionId: string;
      // 乐观标题。
      optimisticTitle: string;
      // 持久化标题。
      title: string;
    };

// 空会话状态。
export const INITIAL_AI_CHAT_SESSION_STATE: AiChatSessionState = {
  sessions: [],
  activeId: "",
};

// 兜底的空白会话，避免在列表为空时频繁触发对象重建。
export const FALLBACK_EMPTY_SESSION: AiChatSession = {
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
export const createEmptyAiChatSession = (): AiChatSession => {
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
export const isEmptyAiChatDraftSession = (session: AiChatSession): boolean =>
  session.title === "新建对话" && session.messages.length === 0;

/**
 * 查找最后一轮用户对话在消息列表中的起始位置。
 */
export const findLastChatTurnStartIndex = (
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
export const findChatTurnBoundsByMessageId = (
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
 * 获取当前激活会话，空列表时返回稳定兜底对象。
 */
export const getActiveAiChatSession = (
  state: AiChatSessionState,
): AiChatSession =>
  state.sessions.find((session) => session.id === state.activeId) ??
  state.sessions[0] ??
  FALLBACK_EMPTY_SESSION;

/**
 * aiChatSessionReducer - 统一管理会话列表和激活会话标识。
 */
export const aiChatSessionReducer = (
  state: AiChatSessionState,
  action: AiChatSessionAction,
): AiChatSessionState => {
  switch (action.type) {
    case "reset":
      return {
        sessions: action.sessions,
        activeId: action.activeId,
      };
    case "set-active":
      return {
        ...state,
        activeId: action.activeId,
      };
    case "prepend":
      return {
        sessions: [action.session, ...state.sessions],
        activeId: action.session.id,
      };
    case "replace":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.session.id ? action.session : session,
        ),
      };
    case "update":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId ? action.updater(session) : session,
        ),
      };
    case "update-message":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId
            ? {
                ...session,
                messages: session.messages.map((message) =>
                  message.id === action.messageId
                    ? action.updater(message)
                    : message,
                ),
              }
            : session,
        ),
      };
    case "set-status":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId
            ? { ...session, status: action.status }
            : session,
        ),
      };
    case "rename":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId
            ? { ...session, title: action.title }
            : session,
        ),
      };
    case "confirm-optimistic-title":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId &&
          session.title === action.optimisticTitle
            ? { ...session, title: action.title }
            : session,
        ),
      };
  }
};
