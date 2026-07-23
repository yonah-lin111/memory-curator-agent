import { type AskRequestData, createAskAnswerData } from "@/agent/tools/askTool"
import {
  createToolConfirmationAnswerData,
  type ToolConfirmationRequestData,
} from "@/agent/tools/toolConfirmation"
import { type createAiChatPersistenceService } from "@/services/aiChatPersistenceService"
import { createTimestamp } from "./helpers"
import {
  type ActiveAiChatRun,
  AI_CHAT_CANCELLED_MESSAGE,
  type AiChatIpcEvent,
  ASK_CANCELLED_MESSAGE,
  type PendingAskAnswer,
  type PendingToolConfirmation,
  TOOL_CONFIRMATION_CANCELLED_MESSAGE,
} from "./types"

// 等待中的 Ask 回答表。
export const pendingAskAnswers = new Map<string, PendingAskAnswer>()

// 等待中的工具确认表。
export const pendingToolConfirmations = new Map<string, PendingToolConfirmation>()

// 当前进程内仍有效的 AI run。
export const activeAiChatRuns = new Map<string, ActiveAiChatRun>()

/**
 * 判断值是否为二维字符串数组。
 */
export const isStringMatrix = (value: unknown): value is string[][] =>
  Array.isArray(value) &&
  value.every((items) => Array.isArray(items) && items.every((item) => typeof item === "string"))

/**
 * 等待渲染进程提交 Ask 回答。
 */
export const waitForAskAnswer = (
  runId: string,
  request: AskRequestData,
): Promise<ReturnType<typeof createAskAnswerData>> =>
  new Promise((resolve, reject) => {
    pendingAskAnswers.set(request.id, {
      runId,
      resolve: (answers) => resolve(createAskAnswerData(request, answers)),
      reject,
    })
  })

/**
 * 等待渲染进程提交工具确认。
 */
export const waitForToolConfirmation = (
  runId: string,
  request: ToolConfirmationRequestData,
): Promise<ReturnType<typeof createToolConfirmationAnswerData>> =>
  new Promise((resolve, reject) => {
    pendingToolConfirmations.set(request.id, {
      runId,
      resolve: (action) => resolve(createToolConfirmationAnswerData(request, action)),
      reject,
    })
  })

/**
 * 取消指定 run 下等待用户回答的 Ask 请求。
 */
export const cancelPendingAskAnswersByRun = (
  runId: string,
  error = new Error(ASK_CANCELLED_MESSAGE),
): boolean => {
  let hasCancelled = false

  for (const [requestId, entry] of pendingAskAnswers.entries()) {
    if (entry.runId === runId) {
      pendingAskAnswers.delete(requestId)
      entry.reject(error)
      hasCancelled = true
    }
  }

  return hasCancelled
}

/**
 * 取消指定 run 下等待用户确认的工具请求。
 */
export const cancelPendingToolConfirmationsByRun = (
  runId: string,
  error = new Error(TOOL_CONFIRMATION_CANCELLED_MESSAGE),
): boolean => {
  let hasCancelled = false

  for (const [requestId, entry] of pendingToolConfirmations.entries()) {
    if (entry.runId === runId) {
      pendingToolConfirmations.delete(requestId)
      entry.reject(error)
      hasCancelled = true
    }
  }

  return hasCancelled
}

/**
 * 取消指定 AI run，并同步清理等待中的 ask。
 */
export const cancelAiChatRun = (
  runId: string,
  aiChatService: ReturnType<typeof createAiChatPersistenceService>,
  message = AI_CHAT_CANCELLED_MESSAGE,
): boolean => {
  const activeRun = activeAiChatRuns.get(runId)

  if (!activeRun) {
    cancelPendingAskAnswersByRun(runId, new Error(message))
    cancelPendingToolConfirmationsByRun(runId, new Error(message))
    return false
  }

  activeAiChatRuns.delete(runId)
  cancelPendingAskAnswersByRun(runId, new Error(message))
  cancelPendingToolConfirmationsByRun(runId, new Error(message))
  activeRun.controller.abort(new Error(message))

  // 将本轮 QA 的用户消息和助手消息持久化为已取消。
  aiChatService.cancelMessages([activeRun.userMessageId, activeRun.assistantMessageId])

  const failedTimestamp = createTimestamp()
  aiChatService.failRunWithAssistantMessage({
    run: {
      id: runId,
      status: "failed",
      error: message,
      timestamp: failedTimestamp,
    },
    session: {
      id: activeRun.sessionId,
      title: activeRun.sessionTitle,
      status: "failed",
      timestamp: failedTimestamp,
    },
    assistantMessage: {
      messageId: activeRun.assistantMessageId,
      content: activeRun.assistantAnswer ? "AI 已生成回答" : `正在处理：“${activeRun.prompt}”`,
      answer: activeRun.assistantAnswer,
      parts: activeRun.assistantParts,
      toolSteps: activeRun.assistantToolSteps,
      timestamp: failedTimestamp,
    },
  })
  if (!activeRun.sender.isDestroyed?.()) {
    activeRun.sender.send("ai:chat:event", {
      type: "error",
      runId,
      sessionId: activeRun.sessionId,
      message,
    } satisfies AiChatIpcEvent)
  }

  return true
}

/**
 * 只取消等待用户输入的请求，不中断 AI run 的流式输出和落库。
 */
export const cancelAiChatAsk = (runId: string): boolean => {
  const hasCancelledAsk = cancelPendingAskAnswersByRun(runId)
  const hasCancelledToolConfirmation = cancelPendingToolConfirmationsByRun(runId)

  return hasCancelledAsk || hasCancelledToolConfirmation
}
