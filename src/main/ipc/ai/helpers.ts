import { type WebContents } from "electron"
import { loadProviderConfig } from "@/agent/providers/providerConfig"
import { createModelProvider } from "@/agent/providers/providerFactory"
import { type AgentMessage } from "@/agent/types"
import { type AiChatMessagePart } from "@/db/schema"
import { loadCuratorAgentPrompt } from "@/services/agentPromptService"
import { type createAiChatPersistenceService } from "@/services/aiChatPersistenceService"
import {
  type AiChatSessionTitleUpdatedEvent,
  type AiModelOptionsResponse,
  DEFAULT_CHAT_SESSION_TITLE,
} from "./types"

/**
 * 创建 Agent 系统提示词。
 */
export const createSystemPrompt = (): AgentMessage => ({
  role: "system",
  content: loadCuratorAgentPrompt(),
})

/**
 * 创建不含密钥的 AI 模型选项。
 */
export const createModelOptionsResponse = (): AiModelOptionsResponse => {
  const config = loadProviderConfig()

  return {
    defaultProvider: config.defaultProvider,
    defaultModel: config.defaultModel,
    agent: config.agent,
    providers: Object.values(config.providers).map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: Object.entries(provider.models).map(([id, model]) => ({
        id,
        name: model.name,
        limit: model.limit,
        modalities: model.modalities,
      })),
    })),
  }
}

/**
 * 创建时间戳。
 */
export const createTimestamp = (): string => {
  return new Date().toISOString()
}

/**
 * 提取展示时间 (HH:mm)
 */
export const createDisplayTime = (timestamp: string): string => {
  if (!timestamp) return ""
  if (timestamp.includes("T")) {
    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }
  return timestamp.slice(11, 16) || timestamp
}

/**
 * 从用户消息生成兜底会话标题。
 */
export const createFallbackSessionTitle = (message: string): string =>
  message.slice(0, 15) + (message.length > 15 ? "..." : "")

/**
 * 清理标题总结模型输出，避免把解释或换行写入列表标题。
 */
export const normalizeGeneratedSessionTitle = (title: string): string => {
  const normalizedTitle = title
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#\d.、\s]+/, "").trim())
    .find(Boolean)
    ?.replace(/^["'“”‘’《》]+|["'“”‘’《》]+$/g, "")
    .trim()

  return normalizedTitle ? normalizedTitle.slice(0, 18) : ""
}

/**
 * 使用配置中的标题总结模型，为首条用户消息生成极短标题。
 */
export const createSessionTitle = async (
  config: ReturnType<typeof loadProviderConfig>,
  message: string,
  purpose: "chat" | "prompt-design" = "chat",
): Promise<string> => {
  const titleProviderConfig = config.providers[config.titleSummary.provider]
  const fallbackTitle = createFallbackSessionTitle(message)

  if (!titleProviderConfig || !titleProviderConfig.models[config.titleSummary.model]) {
    return fallbackTitle
  }

  try {
    const provider = await createModelProvider(titleProviderConfig)
    let title = ""

    for await (const event of provider.streamTurn({
      model: config.titleSummary.model,
      messages: [
        {
          role: "system",
          content:
            purpose === "prompt-design"
              ? "你只负责把提示词设计内容总结成中文短标题。要求：4到12个汉字，优先使用优化、修复、添加等动宾短语；不得出现用户、我、你等主语；不要标点、引号、解释或换行；只输出标题。"
              : "你只负责把用户第一条聊天内容总结成中文短标题。要求：4到12个汉字，动宾短语，不要标点、引号、解释或换行。示例：用户输入“你是谁”，输出“用户询问AI身份”。",
        },
        {
          role: "user",
          content: message,
        },
      ],
      tools: [],
    })) {
      if (event.type === "text_delta") {
        title += event.delta
      }
    }

    return normalizeGeneratedSessionTitle(title) || fallbackTitle
  } catch {
    return fallbackTitle
  }
}

/**
 * 判断当前会话是否需要生成首个标题。
 */
export const shouldCreateInitialSessionTitle = (
  session: ReturnType<ReturnType<typeof createAiChatPersistenceService>["getSession"]>,
): boolean =>
  !session || (session.title === DEFAULT_CHAT_SESSION_TITLE && session.messages.length === 0)

/**
 * 后台生成首个会话标题并回填持久化与渲染层。
 */
export const scheduleInitialSessionTitle = (
  input: {
    config: ReturnType<typeof loadProviderConfig>
    message: string
    runId: string
    sessionId: string
    sender: WebContents
  },
  aiChatService: ReturnType<typeof createAiChatPersistenceService>,
): void => {
  void (async () => {
    const title = await createSessionTitle(input.config, input.message)
    const currentSession = aiChatService.getSession(input.sessionId)

    if (currentSession?.title !== createFallbackSessionTitle(input.message)) {
      return
    }

    aiChatService.updateSessionTitle(input.sessionId, title, createTimestamp())
    if (input.sender.isDestroyed?.()) {
      return
    }

    input.sender.send("ai:chat:event", {
      type: "session_title_updated",
      runId: input.runId,
      sessionId: input.sessionId,
      title,
    } satisfies AiChatSessionTitleUpdatedEvent)
  })()
}

/**
 * 追加助手文本片段并合并连续文本。
 */
export const appendTextPart = (
  parts: AiChatMessagePart[],
  messageId: string,
  chunk: string,
): AiChatMessagePart[] => {
  const lastPart = parts[parts.length - 1]

  if (lastPart?.kind === "text") {
    return parts.map((part) =>
      part.id === lastPart.id && part.kind === "text"
        ? {
            ...part,
            content: `${part.content}${chunk}`,
          }
        : part,
    )
  }

  return [
    ...parts,
    {
      id: `${messageId}-text-${parts.length}`,
      kind: "text",
      content: chunk,
    },
  ]
}

/**
 * 追加助手思考片段并合并同一 reasoning ID 的连续增量。
 * 若同 ID 的 reasoning 片段已存在（可能被非 reasoning 片段隔开），
 * 则合入已有片段而非新建，防止创建 id 重复的 part。
 */
export const appendReasoningPart = (
  parts: AiChatMessagePart[],
  reasoningId: string,
  chunk: string,
): AiChatMessagePart[] => {
  const lastPart = parts[parts.length - 1]

  if (lastPart?.kind === "reasoning" && lastPart.id === reasoningId) {
    return parts.map((part) =>
      part.id === reasoningId && part.kind === "reasoning"
        ? {
            ...part,
            content: `${part.content}${chunk}`,
          }
        : part,
    )
  }

  const existingIndex = parts.findIndex(
    (part) => part.kind === "reasoning" && part.id === reasoningId,
  )

  if (existingIndex >= 0) {
    return parts.map((part, idx) =>
      idx === existingIndex && part.kind === "reasoning"
        ? {
            ...part,
            content: `${part.content}${chunk}`,
          }
        : part,
    )
  }

  return [
    ...parts,
    {
      id: reasoningId,
      kind: "reasoning",
      content: chunk,
    },
  ]
}

/**
 * 追加工具片段，保持工具与文本出现顺序。
 */
export const appendToolPart = (
  parts: AiChatMessagePart[],
  messageId: string,
  stepId: string,
): AiChatMessagePart[] => {
  if (parts.some((part) => part.kind === "tool" && part.stepId === stepId)) {
    return parts
  }

  return [
    ...parts,
    {
      id: `${messageId}-tool-${stepId}`,
      kind: "tool",
      stepId,
    },
  ]
}
