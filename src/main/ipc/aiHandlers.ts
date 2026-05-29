import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { getDatabase } from '../db'
import { createPeopleService, type DatabaseConnection } from '../services/peopleService'
import { createPeopleListTool } from '../agent/peopleTool'
import { loadProviderConfig } from '../agent/providerConfig'
import { createModelProvider } from '../agent/providerFactory'
import { runReactAgent } from '../agent/reactAgent'
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
}

// AI 模型选项。
type AiModelOption = {
  // 模型唯一标识。
  id: string
  // 模型显示名。
  name: string
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
const createSystemPrompt = (): AgentMessage => ({
  role: 'system',
  content:
    '你是 Memory Curator Agent。你可以日常聊天，也可以在需要了解人物关系时调用 people_list 查询本地 People 表。禁止编造 People 表中不存在的人物信息；工具结果不足时直接说明不足。'
})

/**
 * 创建不含密钥的 AI 模型选项。
 */
const createModelOptionsResponse = (): AiModelOptionsResponse => {
  const config = loadProviderConfig()

  return {
    defaultProvider: config.defaultProvider,
    defaultModel: config.defaultModel,
    providers: Object.values(config.providers).map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: Object.entries(provider.models).map(([id, model]) => ({
        id,
        name: model.name
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
    const tools = [createPeopleListTool(peopleService)]

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
          messages: [
            createSystemPrompt(),
            {
              role: 'user',
              content: payload.message
            }
          ],
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
