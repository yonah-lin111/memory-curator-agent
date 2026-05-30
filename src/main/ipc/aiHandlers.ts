import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import { createPeopleService, type DatabaseConnection } from '../services/peopleService'
import { loadProviderConfig } from '../agent/providerConfig'
import { createModelProvider } from '../agent/providerFactory'
import { runReactAgent } from '../agent/reactAgent'
import { createAgentToolRegistry } from '../agent/toolRegistry'
import { buildContextAgentMessages, type AgentContextPayloadItem } from '../agent/contextMessages'
import type { AgentMessage, AgentStreamEvent } from '../agent/types'

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
 * 注册 AI IPC 处理器。
 */
export const registerAiHandlers = (): void => {
  const database = getDatabase()
  const peopleService = createPeopleService(database as unknown as DatabaseConnection)
  const toolRegistry = createAgentToolRegistry({
    peopleService
  })

  ipcMain.handle('ai:model-options:get', async () => createModelOptionsResponse())

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

    const provider = await createModelProvider(providerConfig)
    const tools = toolRegistry.all()
    const modelConfig = providerConfig.models[modelId]

    const sendEvent = (agentEvent: AgentStreamEvent): void => {
      event.sender.send('ai:chat:event', {
        ...agentEvent,
        runId,
        sessionId: payload.sessionId
      } satisfies AiChatIpcEvent)
    }

    void (async () => {
      try {
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
          sendEvent(agentEvent)
        }
      } catch (error) {
        sendEvent({
          type: 'error',
          message: error instanceof Error ? error.message : 'AI 对话执行失败'
        })
      }
    })()

    return {
      runId
    }
  })
}
