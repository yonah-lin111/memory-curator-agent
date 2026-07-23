import { useCallback, useSyncExternalStore } from "react"

// 周度总结项类型（与 preload 对齐）。
type WeeklySummaryItem = {
  id: number
  weekStartDate: string
  type: string
  title: string
  content: string
  modelUsed: string | null
  generatedAt: string
  isMeaningful: number
}

// 面板状态类型。
type PanelState = "idle" | "loading" | "streaming" | "done"

// 单周生成状态快照。
type WeeklySummaryGenerationState = {
  panelState: PanelState
  summary: WeeklySummaryItem | null
  streamText: string
  streamTick: number
}

// 单周状态映射。
type WeeklySummaryGenerationSnapshot = Record<string, WeeklySummaryGenerationState>

// 默认空状态。
const defaultState: WeeklySummaryGenerationState = {
  panelState: "loading",
  summary: null,
  streamText: "",
  streamTick: 0,
}

// 以模块级 store 承接 IPC 流，避免切换周时监听器随组件卸载而丢失。
let snapshot: WeeklySummaryGenerationSnapshot = {}
let hasInitializedIpcListeners = false
let removeDeltaListener: (() => void) | null = null
let removeDoneListener: (() => void) | null = null
const listeners = new Set<() => void>()
const generatingWeeks = new Set<string>()
let rafId: number | null = null

/**
 * 通知所有订阅者刷新当前快照。
 */
const emitChange = (): void => {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    listeners.forEach((listener) => listener())
  })
}

/**
 * 同步通知订阅者，用于非流式状态切换。
 */
const emitChangeImmediately = (): void => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  listeners.forEach((listener) => listener())
}

/**
 * 返回指定周的现有状态或默认加载状态。
 */
const getWeekState = (weekStartDate: string): WeeklySummaryGenerationState => {
  return snapshot[weekStartDate] ?? defaultState
}

/**
 * 只更新指定周，保证多周流式输出互不污染。
 */
const updateWeekState = (
  weekStartDate: string,
  updater: (current: WeeklySummaryGenerationState) => WeeklySummaryGenerationState,
  options?: { immediate?: boolean },
): void => {
  const current = getWeekState(weekStartDate)
  snapshot = {
    ...snapshot,
    [weekStartDate]: updater(current),
  }
  if (options?.immediate) {
    emitChangeImmediately()
  } else {
    emitChange()
  }
}

/**
 * 懒加载全局 IPC 监听器，确保同一渲染进程只注册一次。
 */
const ensureIpcListeners = (): void => {
  if (hasInitializedIpcListeners || !window.api?.weekly?.summary) return

  hasInitializedIpcListeners = true
  removeDeltaListener = window.api.weekly.summary.onDelta(({ weekStartDate, text }) => {
    updateWeekState(weekStartDate, (current) => ({
      ...current,
      panelState: "streaming",
      streamText: `${current.streamText}${text}`,
      streamTick: current.streamTick + 1,
    }))
  })
  removeDoneListener = window.api.weekly.summary.onDone((item) => {
    generatingWeeks.delete(item.weekStartDate)
    updateWeekState(
      item.weekStartDate,
      (current) => ({
        ...current,
        panelState: "done",
        summary: item,
        streamText: "",
        streamTick: current.streamTick + 1,
      }),
      { immediate: true },
    )
  })
}

/**
 * 订阅周度总结生成状态。
 */
const subscribe = (listener: () => void): (() => void) => {
  ensureIpcListeners()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 读取完整状态快照。
 */
const getSnapshot = (): WeeklySummaryGenerationSnapshot => snapshot

/**
 * SSR/测试兜底快照。
 */
const getServerSnapshot = (): WeeklySummaryGenerationSnapshot => snapshot

/**
 * 标记已从数据库加载到某周的初始状态。
 */
const hydrateWeeklySummaryState = (
  weekStartDate: string,
  summary: WeeklySummaryItem | null,
): void => {
  if (generatingWeeks.has(weekStartDate)) return
  const existing = snapshot[weekStartDate]
  if (existing?.panelState === "streaming" || existing?.panelState === "loading") {
    return
  }
  updateWeekState(
    weekStartDate,
    (current) => ({
      ...current,
      panelState: summary ? "done" : "idle",
      summary,
      streamText: "",
      streamTick: current.streamTick + 1,
    }),
    { immediate: true },
  )
}

/**
 * 手动触发指定周总结生成，同一周生成中时拒绝重复触发。
 */
const generateWeeklySummary = async (weekStartDate: string): Promise<void> => {
  ensureIpcListeners()
  if (generatingWeeks.has(weekStartDate)) return

  generatingWeeks.add(weekStartDate)
  updateWeekState(
    weekStartDate,
    (current) => ({
      ...current,
      panelState: "loading",
      summary: null,
      streamText: "",
      streamTick: current.streamTick + 1,
    }),
    { immediate: true },
  )

  try {
    const item = await window.api.weekly!.summary.generate({ weekStartDate })
    generatingWeeks.delete(weekStartDate)
    updateWeekState(
      weekStartDate,
      (current) => ({
        ...current,
        panelState: "done",
        summary: item,
        streamText: "",
        streamTick: current.streamTick + 1,
      }),
      { immediate: true },
    )
  } catch (err) {
    console.error("周度报告生成失败", err)
    generatingWeeks.delete(weekStartDate)
    updateWeekState(
      weekStartDate,
      (current) => ({
        ...current,
        panelState: "idle",
        streamText: "",
        streamTick: current.streamTick + 1,
      }),
      { immediate: true },
    )
  }
}

/**
 * 删除或重置指定周状态。
 */
const resetWeeklySummaryState = (weekStartDate: string): void => {
  generatingWeeks.delete(weekStartDate)
  updateWeekState(
    weekStartDate,
    (current) => ({
      ...current,
      panelState: "idle",
      summary: null,
      streamText: "",
      streamTick: current.streamTick + 1,
    }),
    { immediate: true },
  )
}

/**
 * 释放全局监听器，主要用于测试或页面彻底卸载场景。
 */
export const cleanupWeeklySummaryGeneration = (): void => {
  removeDeltaListener?.()
  removeDoneListener?.()
  removeDeltaListener = null
  removeDoneListener = null
  hasInitializedIpcListeners = false
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

/**
 * 使用按周隔离的周度总结生成状态。
 */
export const useWeeklySummaryGeneration = (weekStartDate: string) => {
  const generationSnapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const state = generationSnapshot[weekStartDate] ?? defaultState

  const hydrate = useCallback(
    (summary: WeeklySummaryItem | null) => {
      hydrateWeeklySummaryState(weekStartDate, summary)
    },
    [weekStartDate],
  )

  const generate = useCallback(() => {
    void generateWeeklySummary(weekStartDate)
  }, [weekStartDate])

  const reset = useCallback(() => {
    resetWeeklySummaryState(weekStartDate)
  }, [weekStartDate])

  return {
    ...state,
    generate,
    hydrate,
    reset,
  }
}
