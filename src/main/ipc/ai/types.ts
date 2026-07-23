import { type WebContents } from "electron"
import { type AiChatAgentHint } from "@/agent/core/agentHints"
import { type AgentContextPayloadItem } from "@/agent/core/contextMessages"
import { type ToolConfirmationAction } from "@/agent/tools/toolConfirmation"
import type { AgentStreamEvent } from "@/agent/types"
import type { AiChatMessagePart, AiToolStep } from "@/db/schema"

/**
 * AI 对话启动载荷。
 */
export type AiChatStartPayload = {
  // Agent 运行 ID。
  runId?: string
  // 用户消息 ID。
  userMessageId?: string
  // 助手消息 ID。
  assistantMessageId?: string
  // 会话 ID。
  sessionId: string
  // 用户消息。
  message: string
  // 用户消息片段。
  parts?: AiChatMessagePart[]
  // 用户选择的 provider 标识。
  provider?: string
  // 用户选择的模型标识。
  model?: string
  // 本轮请求可用上下文。
  context?: AgentContextPayloadItem[]
  // 本轮优先使用的 agent hints。
  agents?: AiChatAgentHint[]
}

/**
 * AI 会话列表查询载荷。
 */
export type AiChatSessionListPayload = {
  // 搜索标题或摘要的关键词。
  query?: string
  // 最大返回数量。
  limit?: number
  // 跳过数量。
  offset?: number
}

/**
 * AI Ask 回答载荷。
 */
export type AiAskAnswerPayload = {
  // Ask 请求唯一标识。
  requestId: string
  // 每个问题对应的回答列表。
  answers: string[][]
}

/**
 * AI 工具确认回答载荷。
 */
export type AiToolConfirmationAnswerPayload = {
  // 工具确认请求唯一标识。
  requestId: string
  // 用户确认动作。
  action: ToolConfirmationAction
}

/**
 * AI 模型选项。
 */
export type AiModelOption = {
  // 模型唯一标识。
  id: string
  // 模型显示名。
  name: string
  // 模型限制。
  limit?: {
    // 上下文窗口 token 上限。
    context: number
    // 输出 token 上限。
    output: number
  }
  // 模型输入输出模态。
  modalities?: {
    // 支持的输入模态。
    input: string[]
    // 支持的输出模态。
    output: string[]
  }
}

/**
 * AI Provider 选项。
 */
export type AiModelProviderOption = {
  // Provider 唯一标识。
  id: string
  // Provider 显示名。
  name: string
  // Provider 下属模型列表。
  models: AiModelOption[]
}

/**
 * AI 模型配置响应。
 */
export type AiModelOptionsResponse = {
  // 默认 provider 标识。
  defaultProvider: string
  // 默认模型标识。
  defaultModel: string
  // 已启用 provider 与模型。
  providers: AiModelProviderOption[]
  // Agent 非密钥行为配置。
  agent: {
    // 上下文治理配置。
    context: {
      // 单条工具 observation 最大字符数。
      toolOutputMaxChars: number
      // 最近保留完整工具结果的数量。
      recentToolResultLimit: number
    }
  }
}

/**
 * AI 对话事件载荷。
 */
export type AiChatIpcEvent = AgentStreamEvent & {
  // Agent 运行 ID。
  runId: string
  // 会话 ID。
  sessionId: string
}

/**
 * AI 会话标题更新事件。
 */
export type AiChatSessionTitleUpdatedEvent = {
  // 事件类型。
  type: "session_title_updated"
  // Agent 运行 ID。
  runId: string
  // 会话 ID。
  sessionId: string
  // AI 总结后的会话标题。
  title: string
}

// 新会话默认标题。
export const DEFAULT_CHAT_SESSION_TITLE = "新建对话"

/**
 * 等待用户回答的 Ask 请求。
 */
export type PendingAskAnswer = {
  // Agent 运行 ID。
  runId: string
  /**
   * 完成 Ask 回答。
   */
  resolve: (answers: string[][]) => void
  /**
   * 拒绝 Ask 回答。
   */
  reject: (error: Error) => void
}

/**
 * 等待用户确认的工具请求。
 */
export type PendingToolConfirmation = {
  // Agent 运行 ID。
  runId: string
  /**
   * 完成工具确认。
   */
  resolve: (action: ToolConfirmationAction) => void
  /**
   * 拒绝工具确认。
   */
  reject: (error: Error) => void
}

/**
 * 运行中的 AI 对话请求。
 */
export type ActiveAiChatRun = {
  // 会话 ID。
  sessionId: string
  // 会话标题。
  sessionTitle: string
  // 本轮用户问题。
  prompt: string
  // 用户消息 ID。
  userMessageId: string
  // 助手消息 ID。
  assistantMessageId: string
  // 取消控制器。
  controller: AbortController
  // 事件接收端。
  sender: WebContents
  // 已生成的助手文本。
  assistantAnswer: string
  // 已生成的顺序片段。
  assistantParts: AiChatMessagePart[]
  // 已完成持久化的工具步骤。
  assistantToolSteps: AiToolStep[]
}

// 取消 AI 请求的统一文案。
export const AI_CHAT_CANCELLED_MESSAGE = "AI chat request was cancelled"

// 取消 Ask 请求的统一文案。
export const ASK_CANCELLED_MESSAGE = "Ask request was cancelled."

// 取消工具确认请求的统一文案。
export const TOOL_CONFIRMATION_CANCELLED_MESSAGE = "Tool confirmation request was cancelled."
