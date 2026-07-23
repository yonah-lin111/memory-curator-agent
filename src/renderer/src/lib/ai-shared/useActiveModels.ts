import { useEffect, useMemo, useState } from "react"
import type { CuratorModelProviderOption } from "@/features/curator/types"

/**
 * useActiveCuratorModels - 专门用于管理当前激活 AI 模型选项加载与持久化同步的自定义 Hook。
 *
 * 实现了跨页面（如主聊天面板、Prompt 实验室）的模型选择自动同步与 localStorage 缓存读取。
 */
export const useActiveCuratorModels = () => {
  const [modelOptions, setModelOptions] = useState<CuratorModelProviderOption[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")

  useEffect(() => {
    let isMounted = true

    window.api?.ai
      ?.getModelOptions?.()
      .then((options) => {
        if (!isMounted) return
        const providers = options.providers
        setModelOptions(providers)

        // 尝试从 localStorage 中读取上次保存的模型
        let savedModel: { provider: string; model: string } | null = null
        try {
          const saved = localStorage.getItem("curator-selected-model")
          if (saved) {
            savedModel = JSON.parse(saved)
          }
        } catch {
          // 忽略解析可能出现的异常
        }

        const isValidModel =
          savedModel &&
          providers.some(
            (p) =>
              p.id === savedModel!.provider && p.models.some((m) => m.id === savedModel!.model),
          )

        if (isValidModel && savedModel) {
          setSelectedModel(`${savedModel.provider}::${savedModel.model}`)
        } else {
          // 降级使用系统配置的默认模型
          const provider =
            providers.find((item) => item.id === options.defaultProvider) ??
            providers.find((item) => item.models.length > 0)
          const model =
            provider?.models.find((item) => item.id === options.defaultModel) ?? provider?.models[0]

          if (provider && model) {
            setSelectedModel(`${provider.id}::${model.id}`)
          }
        }
      })
      .catch(() => {
        if (!isMounted) return
        setModelOptions([])
        setSelectedModel("")
      })

    return () => {
      isMounted = false
    }
  }, [])

  const hasModelOptions = modelOptions.some((provider) => provider.models.length > 0)

  const selectOptions = useMemo(() => {
    return hasModelOptions
      ? modelOptions.map((provider) => ({
          label: provider.name,
          options: provider.models.map((model) => ({
            value: `${provider.id}::${model.id}`,
            label: model.name,
          })),
        }))
      : [{ value: "", label: "无可用模型" }]
  }, [hasModelOptions, modelOptions])

  const handleModelChange = (value: string) => {
    setSelectedModel(value)
    const [provider, model] = value.split("::")
    if (provider && model) {
      try {
        localStorage.setItem("curator-selected-model", JSON.stringify({ provider, model }))
      } catch {
        // 忽略可能存在的 Storage 写入异常
      }
    }
  }

  return {
    modelOptions,
    selectedModel,
    setSelectedModel,
    hasModelOptions,
    selectOptions,
    handleModelChange,
  }
}
