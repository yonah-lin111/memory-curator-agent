import { ipcMain, type WebContents } from 'electron'
import { getDatabase } from '../db'
import { createCompactUuid } from '../id'
import { createPeopleService, type DatabaseConnection as PeopleDatabaseConnection } from '../services/peopleService'
import {
  createAiChatPersistenceService,
  type DatabaseConnection as AiChatDatabaseConnection
} from '../services/aiChatPersistenceService'
import { loadProviderConfig } from '../agent/providers/providerConfig'
import { createModelProvider } from '../agent/providers/providerFactory'
import { runReactAgent } from '../agent/core/reactAgent'
import { createAgentToolRegistry } from '../agent/tools/toolRegistry'
import { createAskAnswerData, isAskRequestData, type AskRequestData } from '../agent/tools/askTool'
import { buildContextAgentMessages, type AgentContextPayloadItem } from '../agent/core/contextMessages'
import type { AgentMessage, AgentStreamEvent } from '../agent/types'
import type { AiChatMessagePart, AiToolStep } from '../db/schema'

// AI 对话启动载荷。
type AiChatStartPayload = {
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
  // 用户选择的 provider 标识。
  provider?: string
  // 用户选择的模型标识。
  model?: string
  // 本轮请求可用上下文。
  context?: AgentContextPayloadItem[]
}

// AI 会话列表查询载荷。
type AiChatSessionListPayload = {
  // 搜索标题或摘要的关键词。
  query?: string
  // 最大返回数量。
  limit?: number
  // 跳过数量。
  offset?: number
}

// AI Ask 回答载荷。
type AiAskAnswerPayload = {
  // Ask 请求唯一标识。
  requestId: string
  // 每个问题对应的回答列表。
  answers: string[][]
}

// AI 模型选项。
type AiModelOption = {
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

// AI Provider 选项。
type AiModelProviderOption = {
  // Provider 唯一标识。
  id: string
  // Provider 显示名。
  name: string
  // Provider 下属模型列表。
  models: AiModelOption[]
}

// AI 模型配置响应。
type AiModelOptionsResponse = {
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

// AI 对话事件载荷。
export type AiChatIpcEvent = AgentStreamEvent & {
  // Agent 运行 ID。
  runId: string
  // 会话 ID。
  sessionId: string
}

// AI 会话标题更新事件。
type AiChatSessionTitleUpdatedEvent = {
  // 事件类型。
  type: 'session_title_updated'
  // Agent 运行 ID。
  runId: string
  // 会话 ID。
  sessionId: string
  // AI 总结后的会话标题。
  title: string
}

// 新会话默认标题。
const DEFAULT_CHAT_SESSION_TITLE = '新建对话'

// 等待用户回答的 Ask 请求。
type PendingAskAnswer = {
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

// 等待中的 Ask 回答表。
const pendingAskAnswers = new Map<string, PendingAskAnswer>()

// 运行中的 AI 对话请求。
type ActiveAiChatRun = {
  // 会话 ID。
  sessionId: string
  // 会话标题。
  sessionTitle: string
  // 本轮用户问题。
  prompt: string
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

// 当前进程内仍有效的 AI run。
const activeAiChatRuns = new Map<string, ActiveAiChatRun>()

// 取消 AI 请求的统一文案。
const AI_CHAT_CANCELLED_MESSAGE = 'AI chat request was cancelled'

// 取消 Ask 请求的统一文案。
const ASK_CANCELLED_MESSAGE = 'Ask request was cancelled.'

// Agent 系统提示词段落。
const SYSTEM_PROMPT_SECTIONS = [
  '身份：你是 Memory Curator Agent，可以日常聊天，也可以在需要读取本地记忆或人物档案时使用本轮已授权工具。',
  '工具边界：不要手写、伪造或展示任何工具调用标记；只有工具调用通道可用时才调用工具。',
  '提问边界：当缺少关键范围、偏好或选择且猜测会导致返工时，使用 ask_user 向用户提出一到三个结构化问题；能基于现有上下文保守推进时不要提问。',
  '事实边界：禁止编造本地数据中不存在的信息；工具结果不足时直接说明不足。',
  '图片输出：输出数据库中的图片时，直接使用 Markdown 图片语法 ![](...)，不要改写为链接、代码块或描述性占位文本。'
] as const

/**
 * 创建 Agent 系统提示词。
 */
export const createSystemPrompt = (): AgentMessage => ({
  role: 'system',
  content: SYSTEM_PROMPT_SECTIONS.join('\n')
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
        modalities: model.modalities
      }))
    }))
  }
}

/**
 * 创建当前分钟时间戳。
 */
const createTimestamp = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${date} ${hours}:${minutes}`
}

/**
 * 创建聊天展示时间。
 */
const createDisplayTime = (timestamp: string): string => timestamp.slice(11, 16) || timestamp

/**
 * 判断值是否为二维字符串数组。
 */
const isStringMatrix = (value: unknown): value is string[][] =>
  Array.isArray(value) &&
  value.every((items) => Array.isArray(items) && items.every((item) => typeof item === 'string'))

/**
 * 等待渲染进程提交 Ask 回答。
 */
const waitForAskAnswer = (runId: string, request: AskRequestData): Promise<ReturnType<typeof createAskAnswerData>> =>
  new Promise((resolve, reject) => {
    pendingAskAnswers.set(request.id, {
      runId,
      resolve: (answers) => resolve(createAskAnswerData(request, answers)),
      reject
    })
  })

/**
 * 取消指定 run 下等待用户回答的 Ask 请求。
 */
const cancelPendingAskAnswersByRun = (
  runId: string,
  error = new Error(ASK_CANCELLED_MESSAGE)
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
 * 从用户消息生成兜底会话标题。
 */
const createFallbackSessionTitle = (message: string): string =>
  message.slice(0, 15) + (message.length > 15 ? '...' : '')

/**
 * 清理标题总结模型输出，避免把解释或换行写入列表标题。
 */
const normalizeGeneratedSessionTitle = (title: string): string => {
  const normalizedTitle = title
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#\d.、\s]+/, '').trim())
    .find(Boolean)
    ?.replace(/^["'“”‘’《》]+|["'“”‘’《》]+$/g, '')
    .trim()

  return normalizedTitle ? normalizedTitle.slice(0, 18) : ''
}

/**
 * 使用配置中的标题总结模型，为首条用户消息生成极短标题。
 */
const createSessionTitle = async (
  config: ReturnType<typeof loadProviderConfig>,
  message: string
): Promise<string> => {
  const titleProviderConfig = config.providers[config.titleSummary.provider]
  const fallbackTitle = createFallbackSessionTitle(message)

  if (!titleProviderConfig || !titleProviderConfig.models[config.titleSummary.model]) {
    return fallbackTitle
  }

  try {
    const provider = await createModelProvider(titleProviderConfig)
    let title = ''

    for await (const event of provider.streamTurn({
      model: config.titleSummary.model,
      messages: [
        {
          role: 'system',
          content:
            '你只负责把用户第一条聊天内容总结成中文短标题。要求：4到12个汉字，动宾短语，不要标点、引号、解释或换行。示例：用户输入“你是谁”，输出“用户询问AI身份”。'
        },
        {
          role: 'user',
          content: message
        }
      ],
      tools: []
    })) {
      if (event.type === 'text_delta') {
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
const shouldCreateInitialSessionTitle = (
  session: ReturnType<ReturnType<typeof createAiChatPersistenceService>['getSession']>
): boolean => !session || (session.title === DEFAULT_CHAT_SESSION_TITLE && session.messages.length === 0)

/**
 * 后台生成首个会话标题并回填持久化与渲染层。
 */
const scheduleInitialSessionTitle = (
  input: {
    config: ReturnType<typeof loadProviderConfig>
    message: string
    runId: string
    sessionId: string
    sender: WebContents
  },
  aiChatService: ReturnType<typeof createAiChatPersistenceService>
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

    input.sender.send('ai:chat:event', {
      type: 'session_title_updated',
      runId: input.runId,
      sessionId: input.sessionId,
      title
    } satisfies AiChatSessionTitleUpdatedEvent)
  })()
}

/**
 * 追加助手文本片段并合并连续文本。
 */
const appendTextPart = (parts: AiChatMessagePart[], messageId: string, chunk: string): AiChatMessagePart[] => {
  const lastPart = parts[parts.length - 1]

  if (lastPart?.kind === 'text') {
    return parts.map((part) =>
      part.id === lastPart.id && part.kind === 'text'
        ? {
            ...part,
            content: `${part.content}${chunk}`
          }
        : part
    )
  }

  return [
    ...parts,
    {
      id: `${messageId}-text-${parts.length}`,
      kind: 'text',
      content: chunk
    }
  ]
}

/**
 * 追加助手思考片段并合并同一 reasoning ID 的连续增量。
 */
const appendReasoningPart = (parts: AiChatMessagePart[], reasoningId: string, chunk: string): AiChatMessagePart[] => {
  const lastPart = parts[parts.length - 1]

  if (lastPart?.kind === 'reasoning' && lastPart.id === reasoningId) {
    return parts.map((part) =>
      part.id === reasoningId && part.kind === 'reasoning'
        ? {
            ...part,
            content: `${part.content}${chunk}`
          }
        : part
    )
  }

  return [
    ...parts,
    {
      id: reasoningId,
      kind: 'reasoning',
      content: chunk
    }
  ]
}

/**
 * 追加工具片段，保持工具与文本出现顺序。
 */
const appendToolPart = (parts: AiChatMessagePart[], messageId: string, stepId: string): AiChatMessagePart[] => {
  if (parts.some((part) => part.kind === 'tool' && part.stepId === stepId)) {
    return parts
  }

  return [
    ...parts,
    {
      id: `${messageId}-tool-${stepId}`,
      kind: 'tool',
      stepId
    }
  ]
}

/**
 * 注册 AI IPC 处理器。
 */
export const registerAiHandlers = (): void => {
  const database = getDatabase()
  const peopleService = createPeopleService(database as unknown as PeopleDatabaseConnection)
  const aiChatService = createAiChatPersistenceService(database as unknown as AiChatDatabaseConnection)
  const toolRegistry = createAgentToolRegistry({
    peopleService
  })

  /**
   * 取消指定 AI run，并同步清理等待中的 ask。
   */
  const cancelAiChatRun = (runId: string, message = AI_CHAT_CANCELLED_MESSAGE): boolean => {
    const activeRun = activeAiChatRuns.get(runId)

    if (!activeRun) {
      cancelPendingAskAnswersByRun(runId, new Error(message))
      return false
    }

    activeAiChatRuns.delete(runId)
    cancelPendingAskAnswersByRun(runId, new Error(message))
    activeRun.controller.abort(new Error(message))

    const failedTimestamp = createTimestamp()
    aiChatService.failRunWithAssistantMessage({
      run: {
        id: runId,
        status: 'failed',
        error: message,
        timestamp: failedTimestamp
      },
      session: {
        id: activeRun.sessionId,
        title: activeRun.sessionTitle,
        status: 'failed',
        timestamp: failedTimestamp
      },
      assistantMessage: {
        messageId: activeRun.assistantMessageId,
        content: activeRun.assistantAnswer ? 'AI 已生成回答' : `正在处理：“${activeRun.prompt}”`,
        answer: activeRun.assistantAnswer,
        parts: activeRun.assistantParts,
        toolSteps: activeRun.assistantToolSteps,
        timestamp: failedTimestamp
      }
    })
    if (!activeRun.sender.isDestroyed?.()) {
      activeRun.sender.send('ai:chat:event', {
        type: 'error',
        runId,
        sessionId: activeRun.sessionId,
        message
      } satisfies AiChatIpcEvent)
    }

    return true
  }

  /**
   * 只取消等待中的 ask，不中断 AI run 的流式输出和落库。
   */
  const cancelAiChatAsk = (runId: string): boolean => cancelPendingAskAnswersByRun(runId)

  ipcMain.handle('ai:model-options:get', async () => createModelOptionsResponse())
  ipcMain.handle('ai:sessions:list', async (_, payload?: AiChatSessionListPayload) =>
    aiChatService.listSessions(payload)
  )
  ipcMain.handle('ai:session:get', async (_, sessionId: string) => aiChatService.getSession(sessionId))
  ipcMain.handle('ai:session:title:update', async (_, sessionId: string, title: string) => {
    aiChatService.updateSessionTitle(sessionId, title, new Date().toISOString())
  })
  ipcMain.handle('ai:session:delete', async (_, sessionId: string) => {
    aiChatService.deleteSession(sessionId)
  })
  ipcMain.handle('ai:session:turn:undo', async (_, sessionId: string) =>
    aiChatService.undoLastTurn(sessionId, createTimestamp())
  )
  ipcMain.handle('ai:session:turn:delete', async (_, sessionId: string, messageId: string) =>
    aiChatService.deleteTurnByMessageId(sessionId, messageId, createTimestamp())
  )
  ipcMain.handle('ai:chat:ask-answer', async (_, payload: AiAskAnswerPayload) => {
    if (!payload || typeof payload.requestId !== 'string' || !isStringMatrix(payload.answers)) {
      throw new Error('Invalid Ask answer payload')
    }

    const pending = pendingAskAnswers.get(payload.requestId)
    if (!pending) {
      throw new Error(`Ask request is not pending: ${payload.requestId}`)
    }

    pendingAskAnswers.delete(payload.requestId)
    pending.resolve(payload.answers)
  })
  ipcMain.handle('ai:chat:cancel', async (_, runId: string) => {
    if (typeof runId !== 'string' || !runId.trim()) {
      throw new Error('Invalid AI run id')
    }

    cancelAiChatRun(runId)
  })
  ipcMain.handle('ai:chat:ask-cancel', async (_, runId: string) => {
    if (typeof runId !== 'string' || !runId.trim()) {
      throw new Error('Invalid AI run id')
    }

    cancelAiChatAsk(runId)
  })

  ipcMain.handle('ai:chat:start', async (event, payload: AiChatStartPayload) => {
    const runId = payload.runId ?? createCompactUuid()
    const config = loadProviderConfig()
    const providerId = payload.provider ?? config.defaultProvider
    const providerConfig = config.providers[providerId]

    if (!providerConfig) {
      throw new Error(`Provider 未启用或不存在：${providerId}`)
    }

    const requestedModel =
      payload.model ?? (providerId === config.defaultProvider ? config.defaultModel : undefined)

    if (requestedModel && !providerConfig.models[requestedModel]) {
      throw new Error(`模型未启用或不存在：${providerId}/${requestedModel}`)
    }

    const modelId = requestedModel ?? Object.keys(providerConfig.models)[0]

    if (!modelId) {
      throw new Error(`Provider ${providerId} 未配置模型`)
    }

    const tools = toolRegistry.all()
    const modelConfig = providerConfig.models[modelId]
    const timestamp = createTimestamp()
    const userTime = createDisplayTime(timestamp)
    const userMessageId = payload.userMessageId ?? createCompactUuid()
    const assistantMessageId = payload.assistantMessageId ?? createCompactUuid()
    const toolCallIds = new Map<string, string>()
    const existingSession = aiChatService.getSession(payload.sessionId)
    const shouldCreateTitle = shouldCreateInitialSessionTitle(existingSession)
    const sessionTitle = shouldCreateTitle
      ? createFallbackSessionTitle(payload.message)
      : (existingSession?.title ?? createFallbackSessionTitle(payload.message))

    aiChatService.createRunWithMessages({
      session: {
        id: payload.sessionId,
        title: sessionTitle,
        status: 'running',
        timestamp
      },
      userMessage: {
        id: userMessageId,
        sessionId: payload.sessionId,
        role: 'user',
        content: payload.message,
        time: userTime,
        timestamp
      },
      assistantMessage: {
        id: assistantMessageId,
        sessionId: payload.sessionId,
        role: 'assistant',
        content: `正在处理：“${payload.message}”`,
        answer: '',
        parts: [],
        toolSteps: [],
        time: userTime,
        timestamp
      },
      run: {
        id: runId,
        sessionId: payload.sessionId,
        assistantMessageId,
        provider: providerId,
        model: modelId,
        context: payload.context ?? [],
        timestamp
      }
    })

    const sendEvent = (agentEvent: AgentStreamEvent): void => {
      if (event.sender.isDestroyed?.()) {
        return
      }

      event.sender.send('ai:chat:event', {
        ...agentEvent,
        runId,
        sessionId: payload.sessionId
      } satisfies AiChatIpcEvent)
    }
    const controller = new AbortController()
    const activeRun: ActiveAiChatRun = {
      sessionId: payload.sessionId,
      sessionTitle,
      prompt: payload.message,
      assistantMessageId,
      controller,
      sender: event.sender,
      assistantAnswer: '',
      assistantParts: [],
      assistantToolSteps: []
    }
    const handleSenderDestroyed = (): void => {
      cancelAiChatAsk(runId)
    }

    activeAiChatRuns.set(runId, activeRun)
    event.sender.once?.('destroyed', handleSenderDestroyed)

    if (shouldCreateTitle) {
      scheduleInitialSessionTitle(
        {
          config,
          message: payload.message,
          runId,
          sessionId: payload.sessionId,
          sender: event.sender
        },
        aiChatService
      )
    }

    void (async () => {
      const updateAssistantSnapshot = (): void => {
        aiChatService.updateAssistantMessage({
          messageId: assistantMessageId,
          content: activeRun.assistantAnswer ? 'AI 已生成回答' : `正在处理：“${payload.message}”`,
          answer: activeRun.assistantAnswer,
          parts: activeRun.assistantParts,
          toolSteps: activeRun.assistantToolSteps,
          timestamp: createTimestamp()
        })
      }

      try {
        const resolveToolCallId = (providerToolCallId: string): string => {
          const existingToolCallId = toolCallIds.get(providerToolCallId)

          if (existingToolCallId) {
            return existingToolCallId
          }

          const toolCallId = createCompactUuid()
          toolCallIds.set(providerToolCallId, toolCallId)
          return toolCallId
        }

        const provider = await createModelProvider(providerConfig)

        for await (const agentEvent of runReactAgent({
          provider,
          model: modelId,
          messages: buildContextAgentMessages({
            systemMessage: createSystemPrompt(),
            userMessage: payload.message,
            contextItems: payload.context,
            contextLimit: modelConfig.limit?.context,
            outputLimit: modelConfig.limit?.output,
            toolOutputMaxChars: config.agent.context.toolOutputMaxChars,
            recentToolResultLimit: config.agent.context.recentToolResultLimit
          }),
          tools,
          signal: controller.signal,
          askAnswerProvider: (request) => waitForAskAnswer(runId, request)
        })) {
          if (agentEvent.type === 'text_delta') {
            activeRun.assistantAnswer += agentEvent.delta
            activeRun.assistantParts.splice(
              0,
              activeRun.assistantParts.length,
              ...appendTextPart(activeRun.assistantParts, assistantMessageId, agentEvent.delta)
            )
            updateAssistantSnapshot()
          }

          if (agentEvent.type === 'reasoning_delta') {
            activeRun.assistantParts.splice(
              0,
              activeRun.assistantParts.length,
              ...appendReasoningPart(activeRun.assistantParts, agentEvent.id, agentEvent.delta)
            )
            updateAssistantSnapshot()
          }

          if (agentEvent.type === 'tool_started') {
            const persistedToolCallId = resolveToolCallId(agentEvent.id)
            activeRun.assistantParts.splice(
              0,
              activeRun.assistantParts.length,
              ...appendToolPart(activeRun.assistantParts, assistantMessageId, agentEvent.id)
            )
            activeRun.assistantToolSteps.push({
              id: agentEvent.id,
              title: `Tool result: ${agentEvent.name}`,
              status: 'running',
              tool: agentEvent.name,
              input: agentEvent.input,
              observation: 'Tool is running.'
            })
            aiChatService.upsertToolCall({
              id: createCompactUuid(),
              runId,
              messageId: assistantMessageId,
              toolCallId: persistedToolCallId,
              name: agentEvent.name,
              status: 'running',
              input: agentEvent.input,
              observation: '',
              data: null,
              timestamp: createTimestamp()
            })
            updateAssistantSnapshot()
          }

          if (agentEvent.type === 'tool_finished') {
            const persistedToolCallId = resolveToolCallId(agentEvent.id)
            const toolStepIndex = activeRun.assistantToolSteps.findIndex((step) => step.id === agentEvent.id)
            const isAskRequest = isAskRequestData(agentEvent.data)
            const nextToolStep: AiToolStep = {
              id: agentEvent.id,
              title: `Tool result: ${agentEvent.name}`,
              status: isAskRequest ? 'running' : 'done',
              tool: agentEvent.name,
              input: activeRun.assistantToolSteps[toolStepIndex]?.input,
              observation: agentEvent.observation,
              data: agentEvent.data
            }

            if (toolStepIndex >= 0) {
              activeRun.assistantToolSteps[toolStepIndex] = nextToolStep
            } else {
              activeRun.assistantParts.splice(
                0,
                activeRun.assistantParts.length,
                ...appendToolPart(activeRun.assistantParts, assistantMessageId, agentEvent.id)
              )
              activeRun.assistantToolSteps.push(nextToolStep)
            }

            aiChatService.upsertToolCall({
              id: createCompactUuid(),
              runId,
              messageId: assistantMessageId,
              toolCallId: persistedToolCallId,
              name: agentEvent.name,
              status: isAskRequest ? 'running' : 'done',
              input: nextToolStep.input ?? {},
              observation: agentEvent.observation,
              data: agentEvent.data,
              timestamp: createTimestamp()
            })
            updateAssistantSnapshot()
          }

          if (agentEvent.type === 'tool_failed') {
            const persistedToolCallId = resolveToolCallId(agentEvent.id)
            const toolStepIndex = activeRun.assistantToolSteps.findIndex((step) => step.id === agentEvent.id)
            const isAskCancelled = agentEvent.name === 'ask_user' && agentEvent.error === ASK_CANCELLED_MESSAGE
            const nextToolStep: AiToolStep = {
              id: agentEvent.id,
              title: isAskCancelled ? `Tool cancelled: ${agentEvent.name}` : `Tool failed: ${agentEvent.name}`,
              status: isAskCancelled ? 'cancelled' : 'failed',
              tool: agentEvent.name,
              input: agentEvent.input,
              observation: isAskCancelled ? 'Ask was cancelled.' : `Tool execution failed: ${agentEvent.error}`,
              data: {
                error: agentEvent.error
              }
            }

            if (toolStepIndex >= 0) {
              activeRun.assistantToolSteps[toolStepIndex] = nextToolStep
            } else {
              activeRun.assistantParts.splice(
                0,
                activeRun.assistantParts.length,
                ...appendToolPart(activeRun.assistantParts, assistantMessageId, agentEvent.id)
              )
              activeRun.assistantToolSteps.push(nextToolStep)
            }

            aiChatService.upsertToolCall({
              id: createCompactUuid(),
              runId,
              messageId: assistantMessageId,
              toolCallId: persistedToolCallId,
              name: agentEvent.name,
              status: 'failed',
              input: agentEvent.input,
              observation: isAskCancelled ? 'Ask was cancelled.' : `Tool execution failed: ${agentEvent.error}`,
              data: {
                error: agentEvent.error
              },
              error: agentEvent.error,
              timestamp: createTimestamp()
            })
            updateAssistantSnapshot()
          }

          if (agentEvent.type === 'error') {
            const failedTimestamp = createTimestamp()
            aiChatService.failRunWithAssistantMessage({
              run: {
                id: runId,
                status: 'failed',
                error: agentEvent.message,
                timestamp: failedTimestamp
              },
              session: {
                id: payload.sessionId,
                title: sessionTitle,
                status: 'failed',
                timestamp: failedTimestamp
              },
              assistantMessage: {
                messageId: assistantMessageId,
                content: 'AI chat execution failed',
                answer: agentEvent.message,
                parts: activeRun.assistantParts,
                toolSteps: activeRun.assistantToolSteps,
                timestamp: failedTimestamp
              }
            })
          }

          if (agentEvent.type === 'done') {
            aiChatService.finishRun({
              id: runId,
              status: 'completed',
              timestamp: createTimestamp()
            })
            aiChatService.ensureSession({
              id: payload.sessionId,
              title: sessionTitle,
              status: 'completed',
              timestamp: createTimestamp()
            })
          }

          sendEvent(agentEvent)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI chat execution failed'

        if (controller.signal.aborted && !activeAiChatRuns.has(runId)) {
          return
        }

        cancelPendingAskAnswersByRun(runId, new Error(message))
        const failedTimestamp = createTimestamp()
        aiChatService.failRunWithAssistantMessage({
          run: {
            id: runId,
            status: 'failed',
            error: message,
            timestamp: failedTimestamp
          },
          session: {
            id: payload.sessionId,
            title: sessionTitle,
            status: 'failed',
            timestamp: failedTimestamp
          },
          assistantMessage: {
            messageId: assistantMessageId,
            content: 'AI chat execution failed',
            answer: message,
            parts: activeRun.assistantParts,
            toolSteps: activeRun.assistantToolSteps,
            timestamp: failedTimestamp
          }
        })
        sendEvent({
          type: 'error',
          message
        })
      } finally {
        activeAiChatRuns.delete(runId)
        event.sender.removeListener?.('destroyed', handleSenderDestroyed)
      }
    })()

    return {
      runId
    }
  })
}
