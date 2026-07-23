import type { MutableRefObject } from "react"
import {
  isCuratorAskRequest,
  isCuratorToolConfirmationAnswer,
  isCuratorToolConfirmationRequest,
} from "@/components/ai-shared/AskRequestPanel"
import {
  appendAiMessageReasoningPart,
  appendAiMessageTextPart,
  appendAiMessageToolPart,
  completeAiMessageReasoningParts,
} from "@/features/curator/core/curatorMessageParts"
import type { CuratorMessageUpdater } from "@/features/curator/core/curatorSessionReducer"
import type { CuratorEvent, CuratorSession, CuratorSessionStatus } from "@/features/curator/types"

// Ask 被作废时主进程返回的固定错误文本。
const ASK_CANCELLED_MESSAGE = "Ask request was cancelled."

// 工具确认被作废时主进程返回的固定错误文本。
const TOOL_CONFIRMATION_CANCELLED_MESSAGE = "Tool confirmation request was cancelled."

// 整个 AI run 被硬取消时的固定错误文本。
const CURATOR_CANCELLED_MESSAGE = "AI chat request was cancelled"

/**
 * 判断工具结果是否仍在等待后续输入或执行。
 */
const isToolStillRunning = (data: unknown): boolean =>
  isCuratorAskRequest(data) ||
  isCuratorToolConfirmationRequest(data) ||
  (isCuratorToolConfirmationAnswer(data) && data.action === "confirm")

// AI run 主流程生命周期。
type CuratorRunState = "running" | "finished"

// AI run 标题生成生命周期。
type CuratorRunTitleState = "not-required" | "pending" | "confirmed"

// Agent 运行消息映射关系。
export type CuratorRunMessageMapping = {
  // 会话标识。
  sessionId: string
  // AI 消息标识。
  messageId: string
  // 用户发送后先写入的乐观标题。
  optimisticTitle?: string
  // 主流程生命周期。
  runState: CuratorRunState
  // 标题生成生命周期。
  titleState: CuratorRunTitleState
}

// 打字机定时器类型。
export type CuratorTypewriterTimer = ReturnType<typeof setTimeout>

// AI 事件适配器依赖。
type CuratorEventAdapterInput = {
  // Agent 运行与消息的映射关系。
  runMessageMapRef: MutableRefObject<Map<string, CuratorRunMessageMapping>>
  // 流式文本缓冲区。
  textBufferRef: MutableRefObject<Map<string, string>>
  // 打字机刷新定时器集合。
  typewriterTimerRef: MutableRefObject<Map<string, CuratorTypewriterTimer>>
  // 更新指定 AI 消息。
  updateAiMessage: (sessionId: string, messageId: string, updater: CuratorMessageUpdater) => void
  // 更新指定 AI 会话状态。
  updateChatSessionStatus: (sessionId: string, status: CuratorSessionStatus) => void
  // 确认服务端生成的真实标题。
  confirmOptimisticTitle: (sessionId: string, optimisticTitle: string, title: string) => void
}

// AI 对话消息类型。
type CuratorMessage = CuratorSession["messages"][number]

/**
 * clearCuratorTypewriterTimers - 清理全部打字机定时器。
 */
export const clearCuratorTypewriterTimers = (
  typewriterTimerRef: MutableRefObject<Map<string, CuratorTypewriterTimer>>,
): void => {
  for (const timer of typewriterTimerRef.current.values()) {
    clearTimeout(timer)
  }
  typewriterTimerRef.current.clear()
}

/**
 * createCuratorEventHandler - 将主进程流式事件翻译成会话与消息更新。
 */
export const createCuratorEventHandler = ({
  runMessageMapRef,
  textBufferRef,
  typewriterTimerRef,
  updateAiMessage,
  updateChatSessionStatus,
  confirmOptimisticTitle,
}: CuratorEventAdapterInput): ((event: CuratorEvent) => void) => {
  /**
   * flushBufferedTextImmediately - 工具事件到达前落盘文本缓冲，保留事件顺序。
   */
  const flushBufferedTextImmediately = (runId: string): void => {
    const mapping = runMessageMapRef.current.get(runId)
    const bufferedText = textBufferRef.current.get(runId) ?? ""
    const timer = typewriterTimerRef.current.get(runId)

    if (timer) {
      clearTimeout(timer)
      typewriterTimerRef.current.delete(runId)
    }

    if (!mapping || !bufferedText) {
      return
    }

    textBufferRef.current.set(runId, "")
    updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
      appendAiMessageTextPart(message, bufferedText),
    )
  }

  /**
   * 刷新指定运行的文本缓冲。
   */
  const flushTypewriterBuffer = (runId: string): void => {
    const mapping = runMessageMapRef.current.get(runId)
    const bufferedText = textBufferRef.current.get(runId) ?? ""

    if (!mapping || !bufferedText) {
      typewriterTimerRef.current.delete(runId)
      return
    }

    const chunk = bufferedText.slice(0, 8)
    const rest = bufferedText.slice(8)
    textBufferRef.current.set(runId, rest)
    updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
      appendAiMessageTextPart(message, chunk),
    )

    if (rest) {
      const timer = setTimeout(() => flushTypewriterBuffer(runId), 28)
      typewriterTimerRef.current.set(runId, timer)
      return
    }

    typewriterTimerRef.current.delete(runId)
  }

  /**
   * 计划指定运行的打字机刷新。
   */
  const scheduleTypewriterFlush = (runId: string): void => {
    if (typewriterTimerRef.current.has(runId)) {
      return
    }

    const timer = setTimeout(() => flushTypewriterBuffer(runId), 28)
    typewriterTimerRef.current.set(runId, timer)
  }

  /**
   * 清理指定 run 的临时映射，避免后续会话切换误操作。
   */
  const clearRunState = (runId: string): void => {
    const timer = typewriterTimerRef.current.get(runId)

    if (timer) {
      clearTimeout(timer)
      typewriterTimerRef.current.delete(runId)
    }

    textBufferRef.current.delete(runId)
    runMessageMapRef.current.delete(runId)
  }

  /**
   * 判断 run 的异步尾巴是否全部收束，可以安全删除映射。
   */
  const canClearRunState = (mapping: CuratorRunMessageMapping): boolean =>
    mapping.runState === "finished" && mapping.titleState !== "pending"

  /**
   * 合并工具开始事件。
   */
  const applyToolStarted = (
    message: CuratorMessage,
    event: Extract<CuratorEvent, { type: "tool_started" }>,
  ): CuratorMessage => ({
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
  })

  /**
   * 合并工具成功事件。
   */
  const applyToolFinished = (
    message: CuratorMessage,
    event: Extract<CuratorEvent, { type: "tool_finished" }>,
  ): CuratorMessage => ({
    ...appendAiMessageToolPart(message, event.id),
    toolSteps: (message.toolSteps ?? []).some((step) => step.id === event.id)
      ? (message.toolSteps ?? []).map((step) =>
          step.id === event.id
            ? {
                ...step,
                status: isToolStillRunning(event.data) ? "running" : "done",
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
            status: isToolStillRunning(event.data) ? "running" : "done",
            tool: event.name,
            input: {},
            observation: event.observation,
            data: event.data,
          },
        ],
  })

  /**
   * 合并工具失败事件。
   */
  const applyToolFailed = (
    message: CuratorMessage,
    event: Extract<CuratorEvent, { type: "tool_failed" }>,
  ): CuratorMessage => {
    const isAskCancelled = event.name === "common_tool_ask" && event.error === ASK_CANCELLED_MESSAGE
    const isToolConfirmationCancelled = event.error === TOOL_CONFIRMATION_CANCELLED_MESSAGE
    const isCancelled = isAskCancelled || isToolConfirmationCancelled
    const status = isCancelled ? "cancelled" : "failed"
    const observation = isCancelled
      ? isAskCancelled
        ? "Ask was cancelled."
        : "Tool confirmation was cancelled."
      : `Tool execution failed: ${event.error}`
    const title = isCancelled ? `Tool cancelled: ${event.name}` : `Tool failed: ${event.name}`

    return {
      ...appendAiMessageToolPart(message, event.id),
      toolSteps: (message.toolSteps ?? []).some((step) => step.id === event.id)
        ? (message.toolSteps ?? []).map((step) =>
            step.id === event.id
              ? {
                  ...step,
                  status,
                  input: event.input,
                  observation,
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
              title,
              status,
              tool: event.name,
              input: event.input,
              observation,
              data: {
                error: event.error,
              },
            },
          ],
    }
  }

  return (event: CuratorEvent): void => {
    const mapping = runMessageMapRef.current.get(event.runId)
    if (!mapping) {
      return
    }

    if (event.type === "text_delta") {
      const currentBuffer = textBufferRef.current.get(event.runId) ?? ""
      textBufferRef.current.set(event.runId, `${currentBuffer}${event.delta}`)
      scheduleTypewriterFlush(event.runId)
      return
    }

    if (event.type === "reasoning_delta") {
      flushBufferedTextImmediately(event.runId)
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
        appendAiMessageReasoningPart(message, event.id, event.delta),
      )
      return
    }

    if (event.type === "done") {
      flushBufferedTextImmediately(event.runId)
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
        completeAiMessageReasoningParts(message),
      )
      updateChatSessionStatus(mapping.sessionId, "completed")
      mapping.runState = "finished"
      if (!canClearRunState(mapping)) {
        const timer = typewriterTimerRef.current.get(event.runId)
        if (timer) {
          clearTimeout(timer)
          typewriterTimerRef.current.delete(event.runId)
        }
        textBufferRef.current.delete(event.runId)
        return
      }
      clearRunState(event.runId)
      return
    }

    if (event.type === "session_title_updated") {
      if (mapping.optimisticTitle) {
        confirmOptimisticTitle(event.sessionId, mapping.optimisticTitle, event.title)
      }
      mapping.titleState = "confirmed"
      if (canClearRunState(mapping)) {
        clearRunState(event.runId)
      }
      return
    }

    if (event.type === "tool_started") {
      flushBufferedTextImmediately(event.runId)
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
        applyToolStarted(message, event),
      )
      return
    }

    if (event.type === "tool_finished") {
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
        applyToolFinished(message, event),
      )
      return
    }

    if (event.type === "tool_failed") {
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
        applyToolFailed(message, event),
      )
      return
    }

    if (event.type === "error") {
      flushBufferedTextImmediately(event.runId)
      updateChatSessionStatus(mapping.sessionId, "failed")
      if (event.message === CURATOR_CANCELLED_MESSAGE) {
        clearRunState(event.runId)
        return
      }

      updateAiMessage(mapping.sessionId, mapping.messageId, (message) => ({
        ...message,
        content: "AI chat execution failed",
        answer: event.message,
      }))
      clearRunState(event.runId)
    }
  }
}
