import type { AiSettingsConfig, AiSettingsModel, AiSettingsProvider } from "./types";

/**
 * 深拷贝 Settings 配置，避免局部编辑污染保存基准。
 */
export const cloneSettings = (settings: AiSettingsConfig): AiSettingsConfig => {
  return JSON.parse(JSON.stringify(settings)) as AiSettingsConfig;
};

/**
 * 创建新的模型配置。
 */
export const createModel = (id: string): AiSettingsModel => ({
  id,
  name: id,
  limit: {
    context: 8192,
    output: 4096,
  },
  modalities: {
    input: ["text"],
    output: ["text"],
  },
});

/**
 * 创建新的 Provider 配置。
 */
export const createProvider = (id: string): AiSettingsProvider => ({
  id,
  type: "openai-compatible",
  name: id,
  options: {
    apiKey: "",
    baseURL: "",
  },
  models: {
    default: createModel("default"),
  },
});

/**
 * 将逗号分隔字符串解析为模态列表。
 */
export const parseList = (value: string): string[] => {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

/**
 * 规范化保存载荷，使用 provider/model 自身 id 作为记录键。
 */
export const normalizeSettingsForSave = (
  settings: AiSettingsConfig,
): AiSettingsConfig => {
  const providerIdByKey = new Map(
    Object.entries(settings.providers).map(([key, provider]) => [
      key,
      provider.id.trim() || key,
    ]),
  );
  const providers: Record<string, AiSettingsProvider> = Object.fromEntries(
    Object.entries(settings.providers).map(([providerKey, provider]) => {
      const providerId = provider.id.trim() || providerKey;
      return [
        providerId,
        {
          ...provider,
          id: providerId,
          models: Object.fromEntries(
            Object.entries(provider.models).map(([modelKey, model]) => {
              const modelId = model.id.trim() || modelKey;
              return [
                modelId,
                {
                  ...model,
                  id: modelId,
                },
              ];
            }),
          ),
        },
      ];
    }),
  );

  return {
    ...settings,
    enabledProviders: settings.enabledProviders.map(
      (providerId) => providerIdByKey.get(providerId) ?? providerId,
    ),
    providers,
  };
};
