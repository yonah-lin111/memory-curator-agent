// 提取自 @/features/curator/curatorContextBuilder，供 curator 和 prompt-design 共同使用。

import type {
  CuratorModelOption,
  CuratorModelProviderOption,
  CuratorModelSelection,
} from "@/features/curator/types"

/**
 * 估算 AI 对话上下文 token 数。
 */
export const estimateCuratorContextTokens = (content: string): number => {
  const trimmed = content.trim()
  if (!trimmed) {
    return 0
  }

  return Math.ceil(trimmed.length / 4)
}

/**
 * 查找当前选中模型的完整配置。
 */
export const resolveCuratorSelectedModelOption = (
  modelOptions: CuratorModelProviderOption[],
  selectedModel: CuratorModelSelection | null,
): CuratorModelOption | undefined => {
  if (!selectedModel) {
    return undefined
  }

  return modelOptions
    .find((provider) => provider.id === selectedModel.provider)
    ?.models.find((model) => model.id === selectedModel.model)
}
