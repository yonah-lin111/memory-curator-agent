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
 * 注册 AI IPC 处理器。
 */
export const registerAiHandlers = (): void => {
  const database = getDatabase()
  const peopleService = createPeopleService(database as unknown as DatabaseConnection)

  ipcMain.handle('ai:chat:start', async (event, payload: AiChatStartPayload) => {
    const runId = payload.runId ?? randomUUID()
    const config = loadProviderConfig()
    const providerConfig = config.providers[config.defaultProvider]
    const provider = createModelProvider(providerConfig)
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
          model: config.defaultModel,
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
