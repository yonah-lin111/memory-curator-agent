import type { AiChatSession } from "@renderer/features/ai-chat/types";
import {
  createEmptyAiChatSession,
  findChatTurnBoundsByMessageId,
  findLastChatTurnStartIndex,
  isEmptyAiChatDraftSession,
  type AiChatSessionAction,
} from "@renderer/features/ai-chat/core/aiChatSessionReducer";

// 会话状态派发函数。
type AiChatSessionDispatch = (action: AiChatSessionAction) => void;

// Toast 提示端口。
type AiChatToastPort = {
  // 成功提示。
  success: (message: string) => void;
  // 警告提示。
  warning: (message: string) => void;
  // 错误提示。
  error: (message: string) => void;
};

// 删除运行映射端口。
type RemoveRunMappingsByMessageIds = (messageIds: Set<string>) => void;

// 删除会话持久化端口。
type DeleteAiChatSessionPort = (sessionId: string) => Promise<void>;

// 重新发送 AI 消息端口。
type StartAiChatMessage = (
  text: string,
  sessionId: string,
  sourceSessions: AiChatSession[],
) => void;

/**
 * 根据剩余消息构造会话兜底态。
 */
const buildSessionWithMessages = (
  session: AiChatSession,
  messages: AiChatSession["messages"],
): AiChatSession => {
  return {
    ...session,
    title: messages.length === 0 ? "新建对话" : session.title,
    status: messages.length === 0 ? "idle" : "completed",
    messages,
  };
};

/**
 * 更新 AI 对话标题，持久化失败时回滚本地状态。
 */
export const renameAiChatSession = async ({
  sessionId,
  title,
  sessions,
  activeId,
  updateSessionTitle,
  dispatch,
}: {
  // 会话标识。
  sessionId: string;
  // 新标题。
  title: string;
  // 当前会话列表。
  sessions: AiChatSession[];
  // 当前激活会话标识。
  activeId: string;
  // 持久化标题函数。
  updateSessionTitle?: (sessionId: string, title: string) => Promise<void>;
  // 会话状态派发函数。
  dispatch: AiChatSessionDispatch;
}): Promise<boolean> => {
  dispatch({ type: "rename", sessionId, title });

  try {
    await updateSessionTitle?.(sessionId, title);
    return true;
  } catch {
    dispatch({ type: "reset", sessions, activeId });
    return false;
  }
};

/**
 * 删除 AI 对话；删空后保留一个本地空白会话，避免主界面无激活对象。
 */
export const deleteAiChatSession = async ({
  sessionId,
  sessions,
  activeId,
  deleteSession,
  clearSessionContext,
  dispatch,
}: {
  // 会话标识。
  sessionId: string;
  // 当前会话列表。
  sessions: AiChatSession[];
  // 当前激活会话标识。
  activeId: string;
  // 持久化删除函数。
  deleteSession?: (sessionId: string) => Promise<void>;
  // 清理上下文函数。
  clearSessionContext: (sessionId: string) => void;
  // 会话状态派发函数。
  dispatch: AiChatSessionDispatch;
}): Promise<boolean> => {
  const nextSessions = sessions.filter((session) => session.id !== sessionId);
  const fallbackSession =
    nextSessions.length === 0 ? createEmptyAiChatSession() : null;
  const resolvedSessions = fallbackSession ? [fallbackSession] : nextSessions;
  const nextActiveSession =
    activeId === sessionId ? (resolvedSessions[0]?.id ?? activeId) : activeId;

  try {
    await deleteSession?.(sessionId);
    dispatch({
      type: "reset",
      sessions: resolvedSessions,
      activeId: nextActiveSession,
    });
    clearSessionContext(sessionId);
    return true;
  } catch {
    return false;
  }
};

/**
 * 删除当前会话后激活空白新建对话，避免撤销最后一轮后跳到旧历史。
 */
const deleteAiChatSessionAndOpenDraft = async ({
  sessionId,
  sessions,
  deleteSession,
  clearSessionContext,
  dispatch,
}: {
  // 会话标识。
  sessionId: string;
  // 当前会话列表。
  sessions: AiChatSession[];
  // 持久化删除函数。
  deleteSession?: DeleteAiChatSessionPort;
  // 清理上下文函数。
  clearSessionContext: (sessionId: string) => void;
  // 会话状态派发函数。
  dispatch: AiChatSessionDispatch;
}): Promise<boolean> => {
  const remainingSessions = sessions.filter((session) => session.id !== sessionId);
  const existingDraft = remainingSessions.find(isEmptyAiChatDraftSession);
  const draftSession = existingDraft ?? createEmptyAiChatSession();
  const resolvedSessions = existingDraft
    ? [
        existingDraft,
        ...remainingSessions.filter((session) => session.id !== existingDraft.id),
      ]
    : [draftSession, ...remainingSessions];

  try {
    await deleteSession?.(sessionId);
    dispatch({
      type: "reset",
      sessions: resolvedSessions,
      activeId: draftSession.id,
    });
    clearSessionContext(sessionId);
    return true;
  } catch {
    return false;
  }
};

/**
 * 撤销当前会话最后一轮用户对话，并同步删除持久化 run、工具调用和上下文快照。
 */
export const undoLastAiChatTurn = async ({
  session,
  sessions,
  activeId,
  undoLastTurn,
  deleteSession,
  clearSessionContext = () => undefined,
  removeRunMappingsByMessageIds,
  dispatch,
  toast,
}: {
  // 当前会话。
  session: AiChatSession;
  // 当前会话列表。
  sessions: AiChatSession[];
  // 当前激活会话标识。
  activeId: string;
  // 持久化撤销函数。
  undoLastTurn?: (sessionId: string) => Promise<AiChatSession | null>;
  // 持久化删除会话函数。
  deleteSession?: DeleteAiChatSessionPort;
  // 清理上下文函数。
  clearSessionContext?: (sessionId: string) => void;
  // 清理运行映射函数。
  removeRunMappingsByMessageIds: RemoveRunMappingsByMessageIds;
  // 会话状态派发函数。
  dispatch: AiChatSessionDispatch;
  // Toast 提示端口。
  toast: AiChatToastPort;
}): Promise<string | void> => {
  const turnStartIndex = findLastChatTurnStartIndex(session.messages);

  if (turnStartIndex < 0) {
    toast.warning("没有可撤销的对话");
    return;
  }

  const removedMessages = session.messages.slice(turnStartIndex);
  const removedUserMessage = removedMessages.find(
    (message) => message.role === "user",
  );
  const removedMessageIds = new Set(removedMessages.map((message) => message.id));
  const nextSession = buildSessionWithMessages(
    session,
    session.messages.slice(0, turnStartIndex),
  );

  if (!undoLastTurn) {
    removeRunMappingsByMessageIds(removedMessageIds);
    if (nextSession.messages.length === 0) {
      const isDeleted = await deleteAiChatSessionAndOpenDraft({
        sessionId: session.id,
        sessions,
        deleteSession,
        clearSessionContext,
        dispatch,
      });

      if (!isDeleted) {
        dispatch({ type: "replace", session: nextSession });
        toast.error("撤销后删除空对话失败");
        return;
      }

      toast.success("已撤销上一轮并删除空对话，对应问题已回填");
      return removedUserMessage?.content;
    }

    dispatch({ type: "replace", session: nextSession });
    toast.success("已撤销上一轮，对应问题已回填");
    return removedUserMessage?.content;
  }

  try {
    const persistedSession = await undoLastTurn(session.id);
    const resolvedSession = persistedSession ?? nextSession;

    removeRunMappingsByMessageIds(removedMessageIds);
    if (resolvedSession.messages.length === 0) {
      const isDeleted = await deleteAiChatSessionAndOpenDraft({
        sessionId: session.id,
        sessions,
        deleteSession,
        clearSessionContext,
        dispatch,
      });

      if (!isDeleted) {
        dispatch({ type: "replace", session: resolvedSession });
        toast.error("撤销后删除空对话失败");
        return;
      }

      toast.success("已撤销上一轮并删除空对话，对应问题已回填");
      return removedUserMessage?.content;
    }

    dispatch({
      type: "replace",
      session: resolvedSession,
    });
    toast.success("已撤销上一轮，对应问题已回填");
    return removedUserMessage?.content;
  } catch {
    dispatch({ type: "reset", sessions, activeId });
    toast.error("撤销对话失败");
  }
};

/**
 * 删除指定消息所属的一轮 QA，并同步清理持久化上下文快照与工具记录。
 */
export const deleteAiChatTurn = async ({
  messageId,
  session,
  sessions,
  activeId,
  deleteTurn,
  removeRunMappingsByMessageIds,
  dispatch,
  toast,
}: {
  // 消息标识。
  messageId: string;
  // 当前会话。
  session: AiChatSession;
  // 当前会话列表。
  sessions: AiChatSession[];
  // 当前激活会话标识。
  activeId: string;
  // 持久化删除函数。
  deleteTurn?: (
    sessionId: string,
    messageId: string,
  ) => Promise<AiChatSession | null>;
  // 清理运行映射函数。
  removeRunMappingsByMessageIds: RemoveRunMappingsByMessageIds;
  // 会话状态派发函数。
  dispatch: AiChatSessionDispatch;
  // Toast 提示端口。
  toast: AiChatToastPort;
}): Promise<void> => {
  if (session.status === "running") {
    toast.warning("AI 正在生成，不能删除 QA");
    return;
  }

  const turnBounds = findChatTurnBoundsByMessageId(session.messages, messageId);

  if (!turnBounds) {
    toast.warning("未找到可删除的 QA");
    return;
  }

  const removedMessages = session.messages.slice(
    turnBounds.startIndex,
    turnBounds.endIndex,
  );
  const removedMessageIds = new Set(removedMessages.map((message) => message.id));
  const fallbackSession = buildSessionWithMessages(session, [
    ...session.messages.slice(0, turnBounds.startIndex),
    ...session.messages.slice(turnBounds.endIndex),
  ]);

  removeRunMappingsByMessageIds(removedMessageIds);
  dispatch({ type: "replace", session: fallbackSession });

  try {
    if (deleteTurn) {
      const persistedSession = await deleteTurn(session.id, messageId);
      dispatch({
        type: "replace",
        session: persistedSession ?? fallbackSession,
      });
    }

    toast.success("已删除 QA");
  } catch {
    dispatch({ type: "reset", sessions, activeId });
    toast.error("删除 QA 失败");
  }
};

/**
 * 重新生成最新一轮 AI 回答：先删除最新 QA，再用原问题和清理后的上下文重发。
 */
export const regenerateLatestAiChatAnswer = async ({
  session,
  sessions,
  activeId,
  undoLastTurn,
  removeRunMappingsByMessageIds,
  startAiChatMessage,
  dispatch,
  toast,
}: {
  // 当前会话。
  session: AiChatSession;
  // 当前会话列表。
  sessions: AiChatSession[];
  // 当前激活会话标识。
  activeId: string;
  // 持久化撤销函数。
  undoLastTurn?: (sessionId: string) => Promise<AiChatSession | null>;
  // 清理运行映射函数。
  removeRunMappingsByMessageIds: RemoveRunMappingsByMessageIds;
  // 重新发送消息函数。
  startAiChatMessage: StartAiChatMessage;
  // 会话状态派发函数。
  dispatch: AiChatSessionDispatch;
  // Toast 提示端口。
  toast: AiChatToastPort;
}): Promise<void> => {
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
  const removedMessageIds = new Set(removedMessages.map((message) => message.id));
  const fallbackSession = buildSessionWithMessages(
    session,
    session.messages.slice(0, resolvedAssistantIndex - 1),
  );

  try {
    const persistedSession = undoLastTurn ? await undoLastTurn(session.id) : null;
    const cleanSession = persistedSession ?? fallbackSession;
    const cleanSessions = sessions.map((item) =>
      item.id === session.id ? cleanSession : item,
    );

    removeRunMappingsByMessageIds(removedMessageIds);
    dispatch({ type: "reset", sessions: cleanSessions, activeId });
    startAiChatMessage(userMessage.content, session.id, cleanSessions);
    toast.success("已重新生成回答");
  } catch {
    dispatch({ type: "reset", sessions, activeId });
    toast.error("重新生成失败");
  }
};
