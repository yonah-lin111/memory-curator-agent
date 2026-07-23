import { create } from "zustand"
import type { CuratorContextItem } from "@/features/curator/curatorContextBuilder"

// 全局上下文最多缓存的会话数量。
const MAX_CURATOR_CONTEXT_SESSIONS = 20

// AI 对话上下文状态类型。
type CuratorContextState = {
  // 按会话标识存储的上下文条目。
  sessionItems: Record<string, CuratorContextItem[]>
  // 获取指定会话上下文条目。
  getSessionItems: (sessionId: string) => CuratorContextItem[]
  // 添加单条上下文，按 key 去重。
  addItem: (item: CuratorContextItem) => void
  // 删除指定上下文。
  removeItem: (sessionId: string, key: string) => void
  // 清空指定会话上下文。
  clearSession: (sessionId: string) => void
  // 替换指定会话全部上下文。
  replaceSessionItems: (sessionId: string, items: CuratorContextItem[]) => void
  // 同步消息与工具上下文，并保留其他来源上下文。
  syncMessageItems: (sessionId: string, items: CuratorContextItem[]) => void
  // 重置全部上下文，主要用于测试隔离。
  resetAll: () => void
}

/**
 * 合并上下文条目并按 key 去重。
 */
const mergeUniqueItems = (
  current: CuratorContextItem[],
  next: CuratorContextItem[],
): CuratorContextItem[] => {
  const seen = new Set<string>()
  const merged: CuratorContextItem[] = []

  for (const item of [...current, ...next]) {
    if (seen.has(item.key)) {
      continue
    }

    seen.add(item.key)
    merged.push(item)
  }

  return merged
}

/**
 * 写入指定会话上下文，并按最近写入裁剪全局缓存。
 */
const setSessionItems = (
  sessionItems: Record<string, CuratorContextItem[]>,
  sessionId: string,
  items: CuratorContextItem[],
): Record<string, CuratorContextItem[]> => {
  const nextEntries = Object.entries(sessionItems).filter(([key]) => key !== sessionId)
  nextEntries.push([sessionId, items])

  while (nextEntries.length > MAX_CURATOR_CONTEXT_SESSIONS) {
    nextEntries.shift()
  }

  return Object.fromEntries(nextEntries)
}

/**
 * AI 对话全局上下文 store。
 */
export const useCuratorContextStore = create<CuratorContextState>((set, get) => ({
  sessionItems: {},
  getSessionItems: (sessionId) => get().sessionItems[sessionId] ?? [],
  addItem: (item) => {
    set((state) => {
      const current = state.sessionItems[item.sessionId] ?? []
      if (current.some((value) => value.key === item.key)) {
        return state
      }

      return {
        sessionItems: setSessionItems(state.sessionItems, item.sessionId, [...current, item]),
      }
    })
  },
  removeItem: (sessionId, key) => {
    set((state) => ({
      sessionItems: setSessionItems(
        state.sessionItems,
        sessionId,
        (state.sessionItems[sessionId] ?? []).filter((item) => item.key !== key),
      ),
    }))
  },
  clearSession: (sessionId) => {
    set((state) => ({
      sessionItems: setSessionItems(state.sessionItems, sessionId, []),
    }))
  },
  replaceSessionItems: (sessionId, items) => {
    set((state) => ({
      sessionItems: setSessionItems(state.sessionItems, sessionId, mergeUniqueItems([], items)),
    }))
  },
  syncMessageItems: (sessionId, items) => {
    set((state) => {
      const existing = state.sessionItems[sessionId] ?? []
      const preserved = existing.filter((item) => item.kind !== "message" && item.kind !== "tool")

      return {
        sessionItems: setSessionItems(
          state.sessionItems,
          sessionId,
          mergeUniqueItems(preserved, items),
        ),
      }
    })
  },
  resetAll: () => {
    set({ sessionItems: {} })
  },
}))
