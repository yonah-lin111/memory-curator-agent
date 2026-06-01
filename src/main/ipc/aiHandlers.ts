import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import { createPeopleService, type DatabaseConnection as PeopleDatabaseConnection } from '../services/peopleService'
import {
  createAiChatPersistenceService,
  type DatabaseConnection as AiChatDatabaseConnection
} from '../services/aiChatPersistenceService'
import { loadProviderConfig } from '../agent/providers/providerConfig'
import { createModelProvider } from '../agent/providers/providerFactory'
import { runReactAgent } from '../agent/core/reactAgent'
import { createAgentToolRegistry } from '../agent/tools/toolRegistry'
import { buildContextAgentMessages, type AgentContextPayloadItem } from '../agent/core/contextMessages'
import type { AgentMessage, AgentStreamEvent } from '../agent/types'
import type { AiChatMessagePart, AiToolStep } from '../db/schema'

// AI 对话启动载荷。
type AiChatStartPayload = {
  // Agent 运行 ID。
  runId?: string
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

/**
 * 创建 Agent 系统提示词。
 */
export const createSystemPrompt = (): AgentMessage => ({
  role: 'system',
  content:
    '你是 Memory Curator Agent。你可以日常聊天，也可以在需要读取本地记忆或人物档案时使用本轮已授权工具。不要手写、伪造或展示任何工具调用标记；只有工具调用通道可用时才调用工具。禁止编造本地数据中不存在的信息；工具结果不足时直接说明不足。'
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
 * 从用户消息生成会话标题。
 */
const createSessionTitle = (message: string): string =>
  message.slice(0, 15) + (message.length > 15 ? '...' : '')

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

  ipcMain.handle('ai:model-options:get', async () => createModelOptionsResponse())
  ipcMain.handle('ai:sessions:list', async () => aiChatService.listSessions())
  ipcMain.handle('ai:session:get', async (_, sessionId: string) => aiChatService.getSession(sessionId))

  ipcMain.handle('ai:chat:start', async (event, payload: AiChatStartPayload) => {
    const runId = payload.runId ?? randomUUID()
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
    const userMessageId = `${runId}-user`
    const assistantMessageId = `${runId}-assistant`
    const sessionTitle = createSessionTitle(payload.message)

    aiChatService.createRunWithMessages({
      session: {
        id: payload.sessionId,
        title: sessionTitle,
        summary: payload.message,
        status: '运行中',
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
      event.sender.send('ai:chat:event', {
        ...agentEvent,
        runId,
        sessionId: payload.sessionId
      } satisfies AiChatIpcEvent)
    }

    void (async () => {
      const assistantParts: AiChatMessagePart[] = []
      const assistantToolSteps: AiToolStep[] = []
      let assistantAnswer = ''

      const updateAssistantSnapshot = (): void => {
        aiChatService.updateAssistantMessage({
          messageId: assistantMessageId,
          content: assistantAnswer ? 'AI 已生成回答' : `正在处理：“${payload.message}”`,
          answer: assistantAnswer,
          parts: assistantParts,
          toolSteps: assistantToolSteps,
          timestamp: createTimestamp()
        })
      }

      try {
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
          tools
        })) {
          if (agentEvent.type === 'text_delta') {
            assistantAnswer += agentEvent.delta
            assistantParts.splice(
              0,
              assistantParts.length,
              ...appendTextPart(assistantParts, assistantMessageId, agentEvent.delta)
            )
            updateAssistantSnapshot()
          }

          if (agentEvent.type === 'tool_started') {
            assistantParts.splice(
              0,
              assistantParts.length,
              ...appendToolPart(assistantParts, assistantMessageId, agentEvent.id)
            )
            assistantToolSteps.push({
              id: agentEvent.id,
              title: `工具结果：${agentEvent.name}`,
              status: 'running',
              tool: agentEvent.name,
              input: agentEvent.input,
              observation: '工具执行中。'
            })
            aiChatService.upsertToolCall({
              id: `${runId}-${agentEvent.id}`,
              runId,
              messageId: assistantMessageId,
              toolCallId: agentEvent.id,
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
            const toolStepIndex = assistantToolSteps.findIndex((step) => step.id === agentEvent.id)
            const nextToolStep: AiToolStep = {
              id: agentEvent.id,
              title: `工具结果：${agentEvent.name}`,
              status: 'done',
              tool: agentEvent.name,
              input: assistantToolSteps[toolStepIndex]?.input,
              observation: agentEvent.observation,
              data: agentEvent.data
            }

            if (toolStepIndex >= 0) {
              assistantToolSteps[toolStepIndex] = nextToolStep
            } else {
              assistantParts.splice(
                0,
                assistantParts.length,
                ...appendToolPart(assistantParts, assistantMessageId, agentEvent.id)
              )
              assistantToolSteps.push(nextToolStep)
            }

            aiChatService.upsertToolCall({
              id: `${runId}-${agentEvent.id}`,
              runId,
              messageId: assistantMessageId,
              toolCallId: agentEvent.id,
              name: agentEvent.name,
              status: 'done',
              input: nextToolStep.input ?? {},
              observation: agentEvent.observation,
              data: agentEvent.data,
              timestamp: createTimestamp()
            })
            updateAssistantSnapshot()
          }

          if (agentEvent.type === 'tool_failed') {
            const toolStepIndex = assistantToolSteps.findIndex((step) => step.id === agentEvent.id)
            const nextToolStep: AiToolStep = {
              id: agentEvent.id,
              title: `工具失败：${agentEvent.name}`,
              status: 'failed',
              tool: agentEvent.name,
              input: agentEvent.input,
              observation: `工具执行失败：${agentEvent.error}`,
              data: {
                error: agentEvent.error
              }
            }

            if (toolStepIndex >= 0) {
              assistantToolSteps[toolStepIndex] = nextToolStep
            } else {
              assistantParts.splice(
                0,
                assistantParts.length,
                ...appendToolPart(assistantParts, assistantMessageId, agentEvent.id)
              )
              assistantToolSteps.push(nextToolStep)
            }

            aiChatService.upsertToolCall({
              id: `${runId}-${agentEvent.id}`,
              runId,
              messageId: assistantMessageId,
              toolCallId: agentEvent.id,
              name: agentEvent.name,
              status: 'failed',
              input: agentEvent.input,
              observation: `工具执行失败：${agentEvent.error}`,
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
                summary: payload.message,
                status: '执行失败',
                timestamp: failedTimestamp
              },
              assistantMessage: {
                messageId: assistantMessageId,
                content: 'AI 对话执行失败',
                answer: agentEvent.message,
                parts: assistantParts,
                toolSteps: assistantToolSteps,
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
              summary: assistantAnswer || payload.message,
              status: '运行完成',
              timestamp: createTimestamp()
            })
          }

          sendEvent(agentEvent)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI 对话执行失败'
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
            summary: payload.message,
            status: '执行失败',
            timestamp: failedTimestamp
          },
          assistantMessage: {
            messageId: assistantMessageId,
            content: 'AI 对话执行失败',
            answer: message,
            parts: assistantParts,
            toolSteps: assistantToolSteps,
            timestamp: failedTimestamp
          }
        })
        sendEvent({
          type: 'error',
          message
        })
      }
    })()

    return {
      runId
    }
  })
}
