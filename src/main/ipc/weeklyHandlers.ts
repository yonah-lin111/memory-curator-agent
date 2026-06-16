import { ipcMain } from 'electron'
import { getDatabase } from '@/db'
import {
  createWeeklySummaryService,
  type DatabaseConnection
} from '@/services/weeklySummaryService'
import { createDailyService } from '@/services/dailyService'
import { loadProviderConfig } from '@/agent/providers/providerConfig'
import { createModelProvider } from '@/agent/providers/providerFactory'
import type { WeeklySummarySaveInput } from '@/db/schema'
import type { AgentMessage, ModelStreamEvent } from '@/agent/types'

// 周度总结生成载荷。
type WeeklySummaryGeneratePayload = {
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  weekStartDate: string
  // 可选模型标识，不传则使用默认模型。
  model?: string
  // 可选 provider 标识，不传则使用默认 provider。
  provider?: string
}

/**
 * 计算从周一起的 7 天日期列表。
 */
const getWeekDates = (weekStartDate: string): string[] => {
  const start = new Date(weekStartDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

/**
 * 格式化当前时间为 'YYYY-MM-DD HH:mm'。
 */
const formatNow = (): string => {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/**
 * 注册周度总结相关 IPC handlers。
 */
export const registerWeeklyHandlers = (): void => {
  const database = getDatabase()
  const weeklySummaryService = createWeeklySummaryService(database as unknown as DatabaseConnection)
  const dailyService = createDailyService(database as unknown as import('@/services/dailyService').DatabaseConnection)

  // 获取某周总结。
  ipcMain.handle('weekly:summary:get', (_, weekStartDate: string) =>
    weeklySummaryService.getByWeekStart(weekStartDate)
  )

  // 手动保存总结。
  ipcMain.handle('weekly:summary:save', (_, input: WeeklySummarySaveInput) =>
    weeklySummaryService.save(input)
  )

  // 删除总结。
  ipcMain.handle('weekly:summary:delete', (_, weekStartDate: string) =>
    weeklySummaryService.delete(weekStartDate)
  )

  // AI 流式生成总结（核心）。
  ipcMain.handle('weekly:summary:generate', async (event, payload: WeeklySummaryGeneratePayload) => {
    const { weekStartDate, model: requestedModel, provider: requestedProvider } = payload

    // 并发拉取 7 天数据。
    const dates = getWeekDates(weekStartDate)
    const dayDataList = await Promise.all(dates.map((d) => dailyService.listDay(d)))

    // 构造数据摘要（限制 token 消耗，每天各 500 字以内）。
    const weekDataSummary = dates.map((date, i) => {
      const day = dayDataList[i]
      const todos = day.todos.map((t) => `[${t.completed ? 'x' : ' '}] ${t.text}`).join('\n')
      const snippets = day.snippets
        .map((s) => `${s.title}: ${s.content.slice(0, 200)}`)
        .join('\n')
      const journal = day.journal ? day.journal.content.slice(0, 500) : '（无日记）'
      return `## ${date}\n### 待办\n${todos || '无'}\n### 片段\n${snippets || '无'}\n### 日记\n${journal}`
    }).join('\n\n')

    // 加载 provider 配置并创建 provider。
    const config = loadProviderConfig()
    const providerId = requestedProvider ?? config.defaultProvider
    const modelId = requestedModel ?? config.defaultModel
    const providerConfig = config.providers[providerId]
    if (!providerConfig) {
      throw new Error(`Provider not found: ${providerId}`)
    }
    const provider = await createModelProvider(providerConfig)

    // 构造 prompt。
    const systemMessage: AgentMessage = {
      role: 'system',
      content: `你是一位专注于个人成长的记忆策展人。请根据用户提供的一周数据，生成一份深刻的周度总结。

总结要求：
- 第一行为简洁标题（15 字以内），格式：# 标题
- 正文使用 Markdown 格式
- 涵盖：本周完成情况（完成率）、关键事件与片段、情绪与思维模式、重复出现的主题
- 末尾提出 1-2 个值得深入思考的问题
- 语言真诚直接，避免空话套话
- 控制在 600 字以内`
    }

    const userMessage: AgentMessage = {
      role: 'user',
      content: `以下是我本周（${weekStartDate} 起）的记录数据，请生成周度总结：\n\n${weekDataSummary}`
    }

    // 流式生成，收集完整文本并发送 delta 事件。
    let fullText = ''
    const stream: AsyncIterable<ModelStreamEvent> = provider.streamTurn({
      model: modelId,
      messages: [systemMessage, userMessage],
      tools: []
    })

    for await (const streamEvent of stream) {
      if (streamEvent.type === 'text_delta') {
        fullText += streamEvent.delta
        event.sender.send('weekly:summary:delta', { text: streamEvent.delta })
      }
    }

    // 提取标题（首行 # 后内容）并保存。
    const firstLine = fullText.split('\n')[0] ?? ''
    const title = firstLine.replace(/^#+\s*/, '').trim() || `${weekStartDate} 周度总结`
    const saveInput: WeeklySummarySaveInput = {
      weekStartDate,
      title,
      content: fullText,
      modelUsed: modelId,
      generatedAt: formatNow()
    }
    const savedItem = weeklySummaryService.save(saveInput)

    // 通知前端生成完成。
    event.sender.send('weekly:summary:done', savedItem)

    return savedItem
  })
}
