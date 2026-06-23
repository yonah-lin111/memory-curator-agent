import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  KeyRound,
  Trash2,
  SlidersHorizontal,
  RotateCcw,
  X,
  Copy,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useHeaderStore } from "@/lib/headerStore";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";

// Settings 页面完整 AI 配置。
type AiSettingsConfig = Awaited<
  ReturnType<NonNullable<Window["api"]["config"]>["ai"]["get"]>
>;

// Settings 页面 provider 配置。
type AiSettingsProvider = AiSettingsConfig["providers"][string];

// Settings 页面模型配置。
type AiSettingsModel = AiSettingsProvider["models"][string];

// Settings 页面模型选择配置。
type AiSettingsModelSelection = AiSettingsConfig["defaultModel"];

// Settings 页面分区标识。
type SettingsSection = "models" | "providers" | "agent";

// Provider 传输格式。
type ProviderType = AiSettingsProvider["type"];

// 页面分区配置。
const SETTINGS_SECTIONS: Array<{
  // 分区唯一标识。
  id: SettingsSection;
  // 分区显示名称。
  label: string;
  // 分区说明。
  description: string;
}> = [
  {
    id: "models",
    label: "AI 模型",
    description: "默认模型与标题总结",
  },
  {
    id: "providers",
    label: "Providers",
    description: "供应商、密钥与模型",
  },
  {
    id: "agent",
    label: "Agent",
    description: "上下文治理参数",
  },
];

// Provider 类型选项。
const PROVIDER_TYPE_OPTIONS: ProviderType[] = [
  "openai-compatible",
  "openai",
  "anthropic",
  "google",
];

// 默认配置文件路径。
const DEFAULT_CONFIG_PATH = "/Users/yonah/.mc/config.json";

/**
 * 深拷贝 Settings 配置，避免局部编辑污染保存基准。
 */
const cloneSettings = (settings: AiSettingsConfig): AiSettingsConfig => {
  return JSON.parse(JSON.stringify(settings)) as AiSettingsConfig;
};

/**
 * 创建新的模型配置。
 */
const createModel = (id: string): AiSettingsModel => ({
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
const createProvider = (id: string): AiSettingsProvider => ({
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
const parseList = (value: string): string[] => {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

/**
 * 规范化保存载荷，使用 provider/model 自身 id 作为记录键。
 */
const normalizeSettingsForSave = (
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

/**
 * Settings 页面 - 结构化编辑本地 AI 配置。
 */
export const SettingsPage = (): React.JSX.Element => {
  // 当前展示的设置分区。
  const [activeSection, setActiveSection] = useState<SettingsSection>("models");
  // 已保存的配置基准。
  const [baseline, setBaseline] = useState<AiSettingsConfig | null>(null);
  // 当前编辑中的配置。
  const [settings, setSettings] = useState<AiSettingsConfig | null>(null);
  // 当前选中的 provider key。
  const [selectedProviderKey, setSelectedProviderKey] = useState<string>("");
  // 加载错误。
  const [loadError, setLoadError] = useState<string>("");
  // 是否正在加载。
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 是否正在保存。
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // 已展开高级设置的模型 key 列表。
  const [expandedModelKeys, setExpandedModelKeys] = useState<
    Record<string, boolean>
  >({});

  /**
   * 切换模型的高级设置展开状态。
   */
  const toggleModelExpanded = (modelKey: string): void => {
    setExpandedModelKeys((prev) => ({
      ...prev,
      [modelKey]: !prev[modelKey],
    }));
  };

  const toast = useToast();

  // 当前是否存在未保存变更。
  const isDirty = useMemo(() => {
    if (!settings || !baseline) {
      return false;
    }

    return (
      JSON.stringify(normalizeSettingsForSave(settings)) !==
      JSON.stringify(normalizeSettingsForSave(baseline))
    );
  }, [baseline, settings]);

  /**
   * 加载配置。
   */
  const loadSettings = async (): Promise<void> => {
    setIsLoading(true);
    setLoadError("");

    try {
      const api = window.api?.config?.ai;
      if (!api) {
        throw new Error("配置 API 不可用");
      }

      const nextSettings = await api.get();
      setBaseline(cloneSettings(nextSettings));
      setSettings(cloneSettings(nextSettings));
      setSelectedProviderKey(Object.keys(nextSettings.providers)[0] ?? "");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "加载配置失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  /**
   * 更新 Settings 配置。
   */
  const updateSettings = (
    updater: (current: AiSettingsConfig) => AiSettingsConfig,
  ): void => {
    setSettings((current) => {
      if (!current) {
        return current;
      }

      return updater(cloneSettings(current));
    });
  };

  /**
   * 保存当前配置。
   */
  const handleSave = async (): Promise<void> => {
    if (!settings) {
      return;
    }

    setIsSaving(true);
    try {
      const api = window.api?.config?.ai;
      if (!api) {
        throw new Error("配置 API 不可用");
      }

      const payload = normalizeSettingsForSave(settings);
      const saved = await api.save(payload);
      setBaseline(cloneSettings(saved));
      setSettings(cloneSettings(saved));
      setSelectedProviderKey(Object.keys(saved.providers)[0] ?? "");
      toast.success("设置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存配置失败");
    } finally {
      setIsSaving(false);
    }
  };

  const setSettingsState = useHeaderStore((state) => state.setSettingsState);
  const setCustomTitle = useHeaderStore((state) => state.setCustomTitle);

  useEffect(() => {
    if (settings) {
      setCustomTitle(settings.configPath || DEFAULT_CONFIG_PATH);
      setSettingsState({
        isDirty,
        isSaving,
        onSave: handleSave,
        onReload: loadSettings,
      });
    } else {
      setCustomTitle(null);
      setSettingsState(null);
    }
    return () => {
      setCustomTitle(null);
      setSettingsState(null);
    };
  }, [
    settings,
    isDirty,
    isSaving,
    handleSave,
    loadSettings,
    setSettingsState,
    setCustomTitle,
  ]);

  /**
   * 更新模型选择。
   */
  const updateModelSelection = (
    key: "defaultModel" | "titleSummary" | "weeklySummary",
    field: keyof AiSettingsModelSelection,
    value: string,
  ): void => {
    updateSettings((current) => {
      const nextSelection = {
        ...current[key],
        [field]: value,
      };

      if (field === "provider") {
        nextSelection.model =
          Object.keys(current.providers[value]?.models ?? {})[0] ?? "";
      }

      return {
        ...current,
        [key]: nextSelection,
      };
    });
  };

  /**
   * 新增 Provider。
   */
  const addProvider = (): void => {
    updateSettings((current) => {
      const nextKey = `provider-${Object.keys(current.providers).length + 1}`;
      setSelectedProviderKey(nextKey);
      return {
        ...current,
        enabledProviders: [...current.enabledProviders, nextKey],
        providers: {
          ...current.providers,
          [nextKey]: createProvider(nextKey),
        },
      };
    });
  };

  /**
   * 更新 Provider 字段。
   */
  const updateProvider = (
    providerKey: string,
    updater: (provider: AiSettingsProvider) => AiSettingsProvider,
  ): void => {
    updateSettings((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [providerKey]: updater(current.providers[providerKey]),
      },
    }));
  };

  /**
   * 删除 Provider。
   */
  const deleteProvider = (providerKey: string): void => {
    updateSettings((current) => {
      const providers = { ...current.providers };
      delete providers[providerKey];
      const fallbackProvider = Object.keys(providers)[0] ?? "";
      setSelectedProviderKey(fallbackProvider);

      return {
        ...current,
        providers,
        enabledProviders: current.enabledProviders.filter(
          (providerId) => providerId !== providerKey,
        ),
        defaultModel:
          current.defaultModel.provider === providerKey
            ? {
                provider: fallbackProvider,
                model:
                  Object.keys(providers[fallbackProvider]?.models ?? {})[0] ??
                  "",
              }
            : current.defaultModel,
        titleSummary:
          current.titleSummary.provider === providerKey
            ? {
                provider: fallbackProvider,
                model:
                  Object.keys(providers[fallbackProvider]?.models ?? {})[0] ??
                  "",
              }
            : current.titleSummary,
        weeklySummary:
          current.weeklySummary.provider === providerKey
            ? {
                provider: fallbackProvider,
                model:
                  Object.keys(providers[fallbackProvider]?.models ?? {})[0] ??
                  "",
              }
            : current.weeklySummary,
      };
    });
  };

  /**
   * 复制现有 Provider，生成新主键，并将其添加到 Provider 列表的末尾。
   */
  const copyProvider = (providerKey: string): void => {
    updateSettings((current) => {
      const originalProvider = current.providers[providerKey];
      if (!originalProvider) {
        return current;
      }

      // 生成唯一的 providerId，避免主键冲突
      let baseId = `${originalProvider.id}-copy`;
      let nextKey = baseId;
      let counter = 1;
      while (current.providers[nextKey]) {
        nextKey = `${baseId}-${counter}`;
        counter++;
      }

      const clonedProvider: AiSettingsProvider = {
        ...JSON.parse(JSON.stringify(originalProvider)),
        id: nextKey,
        name: originalProvider.name ? `${originalProvider.name} (Copy)` : nextKey,
      };

      setSelectedProviderKey(nextKey);
      return {
        ...current,
        enabledProviders: [...current.enabledProviders, nextKey],
        providers: {
          ...current.providers,
          [nextKey]: clonedProvider,
        },
      };
    });
  };

  /**
   * 切换 Provider 启用状态。
   */
  const toggleProviderEnabled = (
    providerKey: string,
    enabled: boolean,
  ): void => {
    updateSettings((current) => ({
      ...current,
      enabledProviders: enabled
        ? Array.from(new Set([...current.enabledProviders, providerKey]))
        : current.enabledProviders.filter(
            (providerId) => providerId !== providerKey,
          ),
    }));
  };

  /**
   * 新增模型，并在模型列表的最顶部展示。
   */
  const addModel = (providerKey: string): void => {
    updateProvider(providerKey, (provider) => {
      const modelId = `model-${Object.keys(provider.models).length + 1}`;
      return {
        ...provider,
        models: {
          [modelId]: createModel(modelId),
          ...provider.models,
        },
      };
    });
  };

  /**
   * 复制现有模型，生成新主键，并将复制的模型放置于原模型紧邻的下一行。
   */
  const copyModel = (providerKey: string, modelKey: string): void => {
    updateProvider(providerKey, (provider) => {
      const originalModel = provider.models[modelKey];
      if (!originalModel) {
        return provider;
      }

      // 生成唯一的 modelId，避免主键冲突
      let baseId = `${originalModel.id}-copy`;
      let modelId = baseId;
      let counter = 1;
      while (provider.models[modelId]) {
        modelId = `${baseId}-${counter}`;
        counter++;
      }

      const clonedModel: AiSettingsModel = {
        ...JSON.parse(JSON.stringify(originalModel)),
        id: modelId,
        name: originalModel.name ? `${originalModel.name} (Copy)` : modelId,
      };

      // 保证克隆的模型在遍历顺序中直接处于被复制模型的后面，以在渲染时呈现为“下一行”
      const nextModels: Record<string, AiSettingsModel> = {};
      for (const [key, value] of Object.entries(provider.models)) {
        nextModels[key] = value;
        if (key === modelKey) {
          nextModels[modelId] = clonedModel;
        }
      }

      return {
        ...provider,
        models: nextModels,
      };
    });
  };

  /**
   * 更新模型字段。
   */
  const updateModel = (
    providerKey: string,
    modelKey: string,
    updater: (model: AiSettingsModel) => AiSettingsModel,
  ): void => {
    updateProvider(providerKey, (provider) => ({
      ...provider,
      models: {
        ...provider.models,
        [modelKey]: updater(provider.models[modelKey]),
      },
    }));
  };

  /**
   * 删除模型。
   */
  const deleteModel = (providerKey: string, modelKey: string): void => {
    updateProvider(providerKey, (provider) => {
      const models = { ...provider.models };
      delete models[modelKey];
      return {
        ...provider,
        models,
      };
    });
  };

  if (isLoading) {
    return (
      <section className="flex h-full items-center justify-center rounded-[6px] bg-[#212121] text-sm text-white/45">
        正在加载设置...
      </section>
    );
  }

  if (loadError || !settings) {
    return (
      <section className="flex h-full items-center justify-center rounded-[6px] bg-[#212121]">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <AlertCircle className="h-8 w-8 text-rose-300" />
          <div>
            <h2 className="text-base font-bold text-white">设置加载失败</h2>
            <p className="mt-2 text-sm text-white/45">
              {loadError || "配置为空"}
            </p>
          </div>
          <IconButton onClick={loadSettings} title="重试" aria-label="重试">
            <RotateCcw className="h-4 w-4" />
          </IconButton>
        </div>
      </section>
    );
  }

  const providerEntries = Object.entries(settings.providers);
  const selectedProvider =
    settings.providers[selectedProviderKey] ?? providerEntries[0]?.[1];
  const selectedProviderEntryKey = settings.providers[selectedProviderKey]
    ? selectedProviderKey
    : (providerEntries[0]?.[0] ?? "");

  /**
   * 渲染模型选择区。
   */
  const renderModelSection = (): React.JSX.Element => {
    const providerOptions = providerEntries.map(([providerKey, provider]) => ({
      value: providerKey,
      label: provider.name || provider.id,
    }));

    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {(["defaultModel", "titleSummary", "weeklySummary"] as const).map((selectionKey) => {
          const selection = settings[selectionKey];
          const models = Object.values(
            settings.providers[selection.provider]?.models ?? {},
          );
          let title = "默认模型";
          if (selectionKey === "defaultModel") {
            title = "默认对话模型";
          } else if (selectionKey === "titleSummary") {
            title = "标题总结模型";
          } else if (selectionKey === "weeklySummary") {
            title = "周度总结模型";
          }

          const modelOptions = models.map((model) => ({
            value: model.id,
            label: model.name || model.id,
          }));

          return (
            <section
              key={selectionKey}
              className="rounded-[6px] border border-white/8 bg-[#212121] p-4"
            >
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1.5 text-xs text-white/45">
                  Provider
                  <Select
                    value={selection.provider}
                    onChange={(val) =>
                      updateModelSelection(selectionKey, "provider", val)
                    }
                    options={providerOptions}
                  />
                </label>
                <label className="grid gap-1.5 text-xs text-white/45">
                  Model
                  <Select
                    value={selection.model}
                    onChange={(val) =>
                      updateModelSelection(selectionKey, "model", val)
                    }
                    options={modelOptions}
                  />
                </label>
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染 Provider 配置区。
   */
  const renderProvidersSection = (): React.JSX.Element => (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Provider 切换与添加头部栏 */}
      <section className="relative flex min-h-[48px] items-center rounded-[6px] border border-white/8 bg-[#212121] p-3 pr-12">
        <div className="flex flex-wrap items-center gap-1.5">
          {providerEntries.map(([providerKey, provider]) => {
            const isActive = providerKey === selectedProviderEntryKey;
            const isEnabled = settings.enabledProviders.includes(providerKey);

            return (
              <Tag
                key={providerKey}
                size="default"
                highlighted={isActive}
                onClick={() => setSelectedProviderKey(providerKey)}
                className="font-medium cursor-pointer"
              >
                {provider.name || provider.id}
                <span
                  className={`ml-1.5 text-[10px] ${
                    isActive ? "text-white/60" : "text-white/30"
                  }`}
                >
                  ({Object.keys(provider.models).length} ·{" "}
                  {isEnabled ? "已启用" : "已禁用"})
                </span>
                <span className="ml-2 inline-flex items-center justify-center gap-1">
                  <span
                    role="button"
                    aria-label="复制 Provider"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyProvider(providerKey);
                    }}
                    className="opacity-60 hover:opacity-100 cursor-pointer text-current hover:text-white transition-all flex items-center justify-center p-0.5"
                  >
                    <Copy className="h-2.5 w-2.5" />
                  </span>
                  <Tooltip
                    title="确定要删除该 Provider 吗？"
                    onConfirm={() => deleteProvider(providerKey)}
                    variant="danger"
                    placement="top"
                  >
                    <span
                      role="button"
                      aria-label="删除 Provider"
                      className="opacity-60 hover:opacity-100 cursor-pointer text-current hover:text-rose-400 transition-all flex items-center justify-center p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </span>
                  </Tooltip>
                </span>
              </Tag>
            );
          })}
        </div>

        <div className="absolute right-3 top-3">
          <IconButton
            preset="add"
            onClick={addProvider}
            aria-label="新增 Provider"
            title="新增 Provider"
          />
        </div>
      </section>

      {selectedProvider ? (
        <section className="min-h-0 flex-1 overflow-y-auto scrollbar-hidden rounded-[6px] border border-white/8 bg-[#212121] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                {selectedProvider.name || selectedProvider.id}
              </h3>
              <p className="mt-1 text-xs text-white/35">
                Provider 详情与模型列表
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1.5 text-xs text-white/45">
              Provider ID
              <Input
                aria-label="Provider ID"
                value={selectedProvider.id}
                onChange={(event) =>
                  updateProvider(selectedProviderEntryKey, (provider) => ({
                    ...provider,
                    id: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1.5 text-xs text-white/45">
              Provider name
              <Input
                aria-label="Provider name"
                value={selectedProvider.name}
                onChange={(event) =>
                  updateProvider(selectedProviderEntryKey, (provider) => ({
                    ...provider,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1.5 text-xs text-white/45">
              Type
              <Select
                value={selectedProvider.type}
                onChange={(val) =>
                  updateProvider(selectedProviderEntryKey, (provider) => ({
                    ...provider,
                    type: val as ProviderType,
                  }))
                }
                options={PROVIDER_TYPE_OPTIONS.map((type) => ({
                  value: type,
                  label: type,
                }))}
              />
            </label>
            <label className="grid gap-1.5 text-xs text-white/45 lg:col-span-2">
              Base URL
              <Input
                aria-label="Base URL"
                value={selectedProvider.options.baseURL}
                onChange={(event) =>
                  updateProvider(selectedProviderEntryKey, (provider) => ({
                    ...provider,
                    options: {
                      ...provider.options,
                      baseURL: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label className="grid gap-1.5 text-xs text-white/45 lg:col-span-2">
              API Key
              <Input
                aria-label="API Key"
                type="password"
                prefix={<KeyRound className="h-3.5 w-3.5 text-white/35" />}
                value={selectedProvider.options.apiKey}
                onChange={(event) =>
                  updateProvider(selectedProviderEntryKey, (provider) => ({
                    ...provider,
                    options: {
                      ...provider.options,
                      apiKey: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-white/60 lg:col-span-2">
              <input
                type="checkbox"
                checked={settings.enabledProviders.includes(
                  selectedProviderEntryKey,
                )}
                onChange={(event) =>
                  toggleProviderEnabled(
                    selectedProviderEntryKey,
                    event.target.checked,
                  )
                }
                className="h-4 w-4 accent-white"
              />
              启用此 Provider
            </label>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div>
              <h4 className="text-sm font-bold text-white">Models</h4>
              <p className="mt-1 text-xs text-white/35">
                编辑模型名称、限制与模态
              </p>
            </div>
            <IconButton
              preset="add"
              onClick={() => addModel(selectedProviderEntryKey)}
              aria-label="新增 Model"
              title="新增模型"
            />
          </div>

          {Object.keys(selectedProvider.models).length > 0 && (
            <div className="mt-3 hidden grid-cols-[1fr_1fr_120px_36px_72px] gap-3 px-3 text-xs font-bold text-white/35 lg:grid">
              <div>Model ID (API 标识)</div>
              <div>显示名称</div>
              <div>Context</div>
              <div className="text-center">高级</div>
              <div className="text-center">操作</div>
            </div>
          )}

          <div className="mt-2 flex flex-col gap-2">
            {Object.entries(selectedProvider.models).map(
              ([modelKey, model]) => {
                const isExpanded = expandedModelKeys[modelKey] ?? false;
                return (
                  <div
                    key={modelKey}
                    className="rounded-[6px] border border-white/8 bg-black/20 p-2.5 transition-all"
                  >
                    <div className="grid items-center gap-3 lg:grid-cols-[1fr_1fr_120px_36px_72px]">
                      <div className="flex flex-col gap-1 lg:block">
                        <span className="text-[10px] text-white/35 lg:hidden">
                          Model ID (API 标识)
                        </span>
                        <Input
                          aria-label={`Model ID ${modelKey}`}
                          value={model.id}
                          placeholder="Model ID (如 gpt-4o)"
                          onChange={(event) =>
                            updateModel(
                              selectedProviderEntryKey,
                              modelKey,
                              (current) => ({
                                ...current,
                                id: event.target.value,
                              }),
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1 lg:block">
                        <span className="text-[10px] text-white/35 lg:hidden">
                          显示名称
                        </span>
                        <Input
                          aria-label={`Model name ${modelKey}`}
                          value={model.name}
                          placeholder="显示名称 (如 GPT-4o)"
                          onChange={(event) =>
                            updateModel(
                              selectedProviderEntryKey,
                              modelKey,
                              (current) => ({
                                ...current,
                                name: event.target.value,
                              }),
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1 lg:block">
                        <span className="text-[10px] text-white/35 lg:hidden">
                          上下文限制 (Tokens)
                        </span>
                        <Input
                          aria-label={`Context ${modelKey}`}
                          as="number"
                          value={model.limit.context}
                          placeholder="上下文长度"
                          onChangeValue={(numVal) =>
                            updateModel(
                              selectedProviderEntryKey,
                              modelKey,
                              (current) => ({
                                ...current,
                                limit: {
                                  ...current.limit,
                                  context: numVal,
                                },
                              }),
                            )
                          }
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 lg:block lg:text-center">
                        <span className="text-[10px] text-white/35 lg:hidden">
                          高级设置：
                        </span>
                        <IconButton
                          preset="default"
                          size="medium"
                          className={`h-8 w-8 ${isExpanded ? "bg-white/10 text-white" : ""}`}
                          onClick={() => toggleModelExpanded(modelKey)}
                          aria-label="高级设置"
                          title="高级设置"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 lg:flex lg:justify-center">
                        <span className="text-[10px] text-white/35 lg:hidden">
                          操作：
                        </span>
                        <IconButton
                          preset="default"
                          size="medium"
                          className="h-8 w-8"
                          onClick={() => copyModel(selectedProviderEntryKey, modelKey)}
                          aria-label={`复制 Model ${modelKey}`}
                          title="复制模型"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          preset="delete"
                          size="medium"
                          className="h-8 w-8"
                          onClick={() =>
                            deleteModel(selectedProviderEntryKey, modelKey)
                          }
                          aria-label={`删除 Model ${modelKey}`}
                          title="删除模型"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3.5 border-t border-white/5 pt-3.5">
                        <div className="grid gap-3 md:grid-cols-3">
                          <label className="grid gap-1.5 text-xs text-white/45">
                            最大输出限制 (Output Limit)
                            <Input
                              aria-label={`Output ${modelKey}`}
                              as="number"
                              value={model.limit.output}
                              placeholder="如 4096"
                              onChangeValue={(numVal) =>
                                updateModel(
                                  selectedProviderEntryKey,
                                  modelKey,
                                  (current) => ({
                                    ...current,
                                    limit: {
                                      ...current.limit,
                                      output: numVal,
                                    },
                                  }),
                                )
                              }
                            />
                          </label>
                          <label className="grid gap-1.5 text-xs text-white/45">
                            输入模态 (Input Modalities)
                            <Input
                              aria-label={`Input modalities ${modelKey}`}
                              value={model.modalities.input.join(", ")}
                              placeholder="如 text"
                              onChange={(event) =>
                                updateModel(
                                  selectedProviderEntryKey,
                                  modelKey,
                                  (current) => ({
                                    ...current,
                                    modalities: {
                                      ...current.modalities,
                                      input: parseList(event.target.value),
                                    },
                                  }),
                                )
                              }
                            />
                          </label>
                          <label className="grid gap-1.5 text-xs text-white/45">
                            输出模态 (Output Modalities)
                            <Input
                              aria-label={`Output modalities ${modelKey}`}
                              value={model.modalities.output.join(", ")}
                              placeholder="如 text"
                              onChange={(event) =>
                                updateModel(
                                  selectedProviderEntryKey,
                                  modelKey,
                                  (current) => ({
                                    ...current,
                                    modalities: {
                                      ...current.modalities,
                                      output: parseList(event.target.value),
                                    },
                                  }),
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </section>
      ) : (
        <section className="flex min-h-64 flex-1 items-center justify-center rounded-[6px] border border-white/8 bg-[#212121] text-sm text-white/45">
          尚未配置 Provider
        </section>
      )}
    </div>
  );

  /**
   * 渲染 Agent 配置区。
   */
  const renderAgentSection = (): React.JSX.Element => (
    <section className="rounded-[6px] border border-white/8 bg-[#212121] p-4">
      <h3 className="text-sm font-bold text-white">Agent 上下文治理</h3>
      <p className="mt-1 text-xs text-white/35">
        控制工具结果进入模型上下文的体积与保留策略
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="grid gap-1.5 text-xs text-white/45">
          Tool output max chars
          <Input
            aria-label="Tool output max chars"
            as="number"
            value={settings.agent.context.toolOutputMaxChars}
            onChangeValue={(numVal) =>
              updateSettings((current) => ({
                ...current,
                agent: {
                  ...current.agent,
                  context: {
                    ...current.agent.context,
                    toolOutputMaxChars: numVal,
                  },
                },
              }))
            }
          />
          <span className="text-[10px] text-white/25">
            单条工具结果超过此长度将被截断
          </span>
        </label>
        <label className="grid gap-1.5 text-xs text-white/45">
          Recent tool result limit
          <Input
            aria-label="Recent tool result limit"
            as="number"
            value={settings.agent.context.recentToolResultLimit || 0}
            placeholder="无限制"
            onChangeValue={(numVal) =>
              updateSettings((current) => ({
                ...current,
                agent: {
                  ...current.agent,
                  context: {
                    ...current.agent.context,
                    // 0 表示保留全部工具结果不压缩。
                    recentToolResultLimit: numVal,
                  },
                },
              }))
            }
          />
          <span className="text-[10px] text-white/25">
            0 或留空表示不限制，保留全部工具结果
          </span>
        </label>
        <label className="grid gap-1.5 text-xs text-white/45">
          Max tool turns
          <Input
            aria-label="Max tool turns"
            as="number"
            value={settings.agent.context.maxTurns ?? 0}
            placeholder="无限制"
            onChangeValue={(numVal) =>
              updateSettings((current) => ({
                ...current,
                agent: {
                  ...current.agent,
                  context: {
                    ...current.agent.context,
                    // 0 或非正整数视为无限制（undefined）。
                    maxTurns: numVal > 0 ? numVal : undefined,
                  },
                },
              }))
            }
          />
          <span className="text-[10px] text-white/25">
            0 或留空表示不限制工具调用轮数
          </span>
        </label>
      </div>
    </section>
  );

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-[6px] bg-[#212121] text-white"
      aria-label="Settings Page"
    >
      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="rounded-[6px] border border-white/8 bg-black/20 p-2">
          <nav className="flex flex-col gap-1" aria-label="Settings sections">
            {SETTINGS_SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  aria-label={section.label}
                  onClick={() => setActiveSection(section.id)}
                  className={`rounded-[6px] px-3 py-2 text-left ${
                    isActive
                      ? "bg-white text-black"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="block text-sm font-bold">
                    {section.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs ${isActive ? "text-black/55" : "text-white/30"}`}
                  >
                    {section.description}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div
          className={`min-h-0 overflow-y-auto ${activeSection === "providers" ? "scrollbar-hidden" : ""}`}
        >
          {activeSection === "models" && renderModelSection()}
          {activeSection === "providers" && renderProvidersSection()}
          {activeSection === "agent" && renderAgentSection()}
        </div>
      </div>
    </section>
  );
};
