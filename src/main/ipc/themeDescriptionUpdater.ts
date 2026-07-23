import { loadProviderConfig } from "@/agent/providers/providerConfig"
import { createModelProvider } from "@/agent/providers/providerFactory"
import type { AgentMessage } from "@/agent/types"
import type { ThemesService } from "@/services/themesService"

/**
 * 用 AI 更新主题描述，供主题与周总结 IPC 复用。
 */
export const updateThemeDescription = async (
  themesService: ThemesService,
  themeExternalId: string,
): Promise<void> => {
  try {
    const theme = themesService.getByExternalId(themeExternalId)
    if (!theme) return

    const items = themesService.listItems(themeExternalId)
    if (!items.length) return

    const itemsText = items
      .map((item) => `- ${item.sourceTitle ?? "未知素材"}: ${item.relevanceNote || "无备注"}`)
      .join("\n")
    if (!itemsText.trim()) return

    const config = loadProviderConfig()
    const providerId = config.weeklySummary.provider
    const modelId = config.weeklySummary.model
    const providerConfig = config.providers[providerId]
    if (!providerConfig) {
      console.error("[themes] AI 描述更新失败: provider 未找到", providerId)
      return
    }

    const provider = await createModelProvider(providerConfig)
    const systemMessage: AgentMessage = {
      role: "system",
      content: `你是一位专注于个人成长的主题策展助手。请为主题生成一段简洁的概述。
要求：
- 2-3句中文，不超过100字
- 说明该主题的核心关注点和已积累的相关内容
- 不要使用 Markdown 格式，直接输出纯文本
- 语言平实真诚，杜绝 AI 腔和陈词滥调`,
    }
    const userMessage: AgentMessage = {
      role: "user",
      content: `主题名称：${theme.name}\n\n关联素材列表：\n${itemsText}\n\n请生成主题概述：`,
    }

    let description = ""
    for await (const event of provider.streamTurn({
      model: modelId,
      messages: [systemMessage, userMessage],
      tools: [],
    })) {
      if (event.type === "text_delta") {
        description += event.delta
      }
    }

    const trimmed = description.trim()
    if (trimmed) {
      themesService.update(themeExternalId, { description: trimmed })
    }
  } catch (err) {
    console.error("[themes] 自动更新主题描述失败:", err)
  }
}
