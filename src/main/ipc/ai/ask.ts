import { isStringMatrix, pendingAskAnswers } from "@/ipc/ai/state"

// Ask 回答 IPC 载荷。
export type AskAnswerPayload = {
  // Ask 请求唯一标识。
  requestId: string
  // 每个问题对应的答案列表。
  answers: string[][]
}

/**
 * 校验并转发 Ask 回答，使对应 Agent run 在原工具调用处继续执行。
 */
export const submitAskAnswer = (payload: AskAnswerPayload): void => {
  if (!payload || typeof payload.requestId !== "string" || !isStringMatrix(payload.answers)) {
    throw new Error("Invalid Ask answer payload")
  }

  const pending = pendingAskAnswers.get(payload.requestId)
  if (!pending) {
    throw new Error(`Ask request is not pending: ${payload.requestId}`)
  }

  pendingAskAnswers.delete(payload.requestId)
  pending.resolve(payload.answers)
}
