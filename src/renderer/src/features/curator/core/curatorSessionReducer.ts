import { createCuratorUuid } from "@/features/curator/core/curatorIds"
import type { CuratorSession, CuratorSessionStatus } from "@/features/curator/types"

// AI 对话消息类型。
type CuratorMessage = CuratorSession["messages"][number]

// AI 对话会话状态容器。
export type CuratorSessionState = {
  // AI 对话会话列表。
  sessions: CuratorSession[]
  // 当前激活的 AI 对话会话标识。
  activeId: string
}

// AI 消息更新函数。
export type CuratorMessageUpdater = (message: CuratorMessage) => CuratorMessage

// AI 会话更新函数。
export type CuratorSessionUpdater = (session: CuratorSession) => CuratorSession

/**
 * mergeSessionCancelledFlags - 将旧会话消息中的 cancelled 纯前端字段合并到新会话中，
 * 防止数据库快照覆盖时丢失取消标记。
 */
const mergeSessionCancelledFlags = (
  newSession: CuratorSession,
  oldSession: CuratorSession,
): CuratorSession => {
  // 构建旧消息 cancelled 状态的快速查找表
  const cancelledIds = new Set<string>()
  for (const msg of oldSession.messages) {
    if (msg.cancelled) {
      cancelledIds.add(msg.id)
    }
  }

  if (cancelledIds.size === 0) {
    return newSession
  }

  return {
    ...newSession,
    messages: newSession.messages.map((msg) =>
      cancelledIds.has(msg.id) ? { ...msg, cancelled: true } : msg,
    ),
  }
}

// AI 会话 reducer 动作。
export type CuratorSessionAction =
  | {
      // 动作类型。
      type: "reset"
      // 下一批会话。
      sessions: CuratorSession[]
      // 下一激活会话标识。
      activeId: string
    }
  | {
      // 动作类型。
      type: "set-active"
      // 下一激活会话标识。
      activeId: string
    }
  | {
      // 动作类型。
      type: "prepend"
      // 新建会话。
      session: CuratorSession
    }
  | {
      // 动作类型。
      type: "append"
      // 追加会话。
      sessions: CuratorSession[]
    }
  | {
      // 动作类型。
      type: "replace"
      // 要替换的会话。
      session: CuratorSession
    }
  | {
      // 动作类型。
      type: "discard"
      // 丢弃的临时会话标识。
      sessionId: string
      // 丢弃后激活的会话标识。
      activeId: string
    }
  | {
      // 动作类型。
      type: "update"
      // 会话标识。
      sessionId: string
      // 会话更新函数。
      updater: CuratorSessionUpdater
    }
  | {
      // 动作类型。
      type: "update-message"
      // 会话标识。
      sessionId: string
      // 消息标识。
      messageId: string
      // 消息更新函数。
      updater: CuratorMessageUpdater
    }
  | {
      // 动作类型。
      type: "set-status"
      // 会话标识。
      sessionId: string
      // 会话状态。
      status: CuratorSessionStatus
    }
  | {
      // 动作类型。
      type: "rename"
      // 会话标识。
      sessionId: string
      // 会话标题。
      title: string
    }
  | {
      // 动作类型。
      type: "confirm-optimistic-title"
      // 会话标识。
      sessionId: string
      // 乐观标题。
      optimisticTitle: string
      // 持久化标题。
      title: string
    }

// 空会话状态。
export const INITIAL_CURATOR_SESSION_STATE: CuratorSessionState = {
  sessions: [],
  activeId: "",
}

// 兜底的空白会话，避免在列表为空时频繁触发对象重建。
export const FALLBACK_EMPTY_SESSION: CuratorSession = {
  id: "",
  title: "新对话",
  time: "",
  status: "idle",
  messages: [],
}

/**
 * 创建本地空白 AI 会话，供新建入口与最后一条删除后的兜底态复用。
 */
export const createEmptyCuratorSession = (): CuratorSession => {
  const now = new Date()
  const dateStr = now
    .toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-")
  const timeStr = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return {
    id: createCuratorUuid(),
    title: "新建对话",
    time: `${dateStr} ${timeStr}`,
    status: "idle",
    messages: [],
  }
}

/**
 * 判断会话是否为可复用的空白草稿。
 */
export const isEmptyCuratorDraftSession = (session: CuratorSession): boolean =>
  session.title === "新建对话" && session.messages.length === 0

/**
 * 查找最后一轮用户对话在消息列表中的起始位置。
 */
export const findLastChatTurnStartIndex = (messages: CuratorSession["messages"]): number => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return index
    }
  }

  return -1
}

/**
 * 查找指定消息所属 QA 轮次的起止位置。
 */
export const findChatTurnBoundsByMessageId = (
  messages: CuratorSession["messages"],
  messageId: string,
): { startIndex: number; endIndex: number } | null => {
  const messageIndex = messages.findIndex((message) => message.id === messageId)

  if (messageIndex < 0) {
    return null
  }

  let startIndex = messageIndex

  while (startIndex > 0 && messages[startIndex].role !== "user") {
    startIndex -= 1
  }

  if (messages[startIndex]?.role !== "user") {
    return null
  }

  let endIndex = startIndex + 1

  while (endIndex < messages.length && messages[endIndex].role !== "user") {
    endIndex += 1
  }

  return {
    startIndex,
    endIndex,
  }
}

/**
 * 获取当前激活会话，空列表时返回稳定兜底对象。
 */
export const getActiveCuratorSession = (state: CuratorSessionState): CuratorSession =>
  state.sessions.find((session) => session.id === state.activeId) ??
  state.sessions[0] ??
  FALLBACK_EMPTY_SESSION

/**
 * 判断详情替换是否会把本地终态回滚为迟到的运行中快照。
 */
const isStaleRunningSessionSnapshot = (
  currentSession: CuratorSession,
  nextSession: CuratorSession,
): boolean => {
  const isCurrentTerminal =
    currentSession.status === "completed" || currentSession.status === "failed"

  return isCurrentTerminal && nextSession.status === "running"
}

/**
 * curatorSessionReducer - 统一管理会话列表和激活会话标识。
 */
export const curatorSessionReducer = (
  state: CuratorSessionState,
  action: CuratorSessionAction,
): CuratorSessionState => {
  switch (action.type) {
    case "reset":
      return {
        // 将旧会话中消息的 cancelled 纯前端字段合并回新会话，防止被数据库快照覆盖丢失。
        sessions: action.sessions.map((newSession) => {
          const oldSession = state.sessions.find((s) => s.id === newSession.id)
          if (!oldSession) {
            return newSession
          }
          return mergeSessionCancelledFlags(newSession, oldSession)
        }),
        activeId: action.activeId,
      }
    case "set-active":
      return {
        ...state,
        activeId: action.activeId,
      }
    case "prepend":
      return {
        sessions: [action.session, ...state.sessions],
        activeId: action.session.id,
      }
    case "append": {
      const existingSessionIds = new Set(state.sessions.map((session) => session.id))
      const nextSessions = action.sessions.filter((session) => !existingSessionIds.has(session.id))

      return {
        ...state,
        sessions: [...state.sessions, ...nextSessions],
      }
    }
    case "replace": {
      if (!action.session?.id) {
        return state
      }
      const exists = state.sessions.some((session) => session.id === action.session.id)
      if (!exists) {
        return {
          ...state,
          sessions: [action.session, ...state.sessions],
        }
      }
      return {
        ...state,
        sessions: state.sessions.map((session) => {
          if (session.id !== action.session.id) {
            return session
          }
          if (isStaleRunningSessionSnapshot(session, action.session)) {
            return session
          }
          // 合并旧消息的 cancelled 纯前端字段，防止被快照覆盖丢失。
          return mergeSessionCancelledFlags(action.session, session)
        }),
      }
    }
    case "discard": {
      const nextSessions = state.sessions.filter((session) => session.id !== action.sessionId)

      return {
        sessions: nextSessions,
        activeId: action.activeId,
      }
    }
    case "update":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId ? action.updater(session) : session,
        ),
      }
    case "update-message":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId
            ? {
                ...session,
                messages: session.messages.map((message) =>
                  message.id === action.messageId ? action.updater(message) : message,
                ),
              }
            : session,
        ),
      }
    case "set-status":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId ? { ...session, status: action.status } : session,
        ),
      }
    case "rename":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId ? { ...session, title: action.title } : session,
        ),
      }
    case "confirm-optimistic-title":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId && session.title === action.optimisticTitle
            ? { ...session, title: action.title }
            : session,
        ),
      }
  }
}
