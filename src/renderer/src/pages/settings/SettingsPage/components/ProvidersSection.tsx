import type React from "react";
import { KeyRound, Trash2, SlidersHorizontal, X, Copy } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { PROVIDER_TYPE_OPTIONS } from "../constants";
import { parseList } from "../utils";
import type { AiSettingsConfig, AiSettingsProvider, AiSettingsModel, ProviderType } from "../types";

export interface ProvidersSectionProps {
  settings: AiSettingsConfig;
  selectedProviderKey: string;
  setSelectedProviderKey: (key: string) => void;
  expandedModelKeys: Record<string, boolean>;
  toggleModelExpanded: (modelKey: string) => void;
  addProvider: () => void;
  updateProvider: (key: string, updater: (provider: AiSettingsProvider) => AiSettingsProvider) => void;
  deleteProvider: (key: string) => void;
  copyProvider: (key: string) => void;
  toggleProviderEnabled: (key: string, enabled: boolean) => void;
  addModel: (providerKey: string) => void;
  copyModel: (providerKey: string, modelKey: string) => void;
  updateModel: (providerKey: string, modelKey: string, updater: (model: AiSettingsModel) => AiSettingsModel) => void;
  deleteModel: (providerKey: string, modelKey: string) => void;
}

export const ProvidersSection = ({
  settings,
  selectedProviderKey,
  setSelectedProviderKey,
  expandedModelKeys,
  toggleModelExpanded,
  addProvider,
  updateProvider,
  deleteProvider,
  copyProvider,
  toggleProviderEnabled,
  addModel,
  copyModel,
  updateModel,
  deleteModel,
}: ProvidersSectionProps): React.JSX.Element => {
  const providerEntries = Object.entries(settings.providers);
  const selectedProvider = settings.providers[selectedProviderKey] ?? providerEntries[0]?.[1];
  const selectedProviderEntryKey = settings.providers[selectedProviderKey]
    ? selectedProviderKey
    : (providerEntries[0]?.[0] ?? "");

  return (
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
                  ({Object.keys(provider.models).length} · {isEnabled ? "已启用" : "已禁用"})
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
              <p className="mt-1 text-xs text-white/35">Provider 详情与模型列表</p>
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
                checked={settings.enabledProviders.includes(selectedProviderEntryKey)}
                onChange={(event) =>
                  toggleProviderEnabled(selectedProviderEntryKey, event.target.checked)
                }
                className="h-4 w-4 accent-white"
              />
              启用此 Provider
            </label>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div>
              <h4 className="text-sm font-bold text-white">Models</h4>
              <p className="mt-1 text-xs text-white/35">编辑模型名称、限制与模态</p>
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
            {Object.entries(selectedProvider.models).map(([modelKey, model]) => {
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
                          updateModel(selectedProviderEntryKey, modelKey, (current) => ({
                            ...current,
                            id: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1 lg:block">
                      <span className="text-[10px] text-white/35 lg:hidden">显示名称</span>
                      <Input
                        aria-label={`Model name ${modelKey}`}
                        value={model.name}
                        placeholder="显示名称 (如 GPT-4o)"
                        onChange={(event) =>
                          updateModel(selectedProviderEntryKey, modelKey, (current) => ({
                            ...current,
                            name: event.target.value,
                          }))
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
                          updateModel(selectedProviderEntryKey, modelKey, (current) => ({
                            ...current,
                            limit: {
                              ...current.limit,
                              context: numVal,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 lg:block lg:text-center">
                      <span className="text-[10px] text-white/35 lg:hidden">高级设置：</span>
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
                      <span className="text-[10px] text-white/35 lg:hidden">操作：</span>
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
                        onClick={() => deleteModel(selectedProviderEntryKey, modelKey)}
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
                              updateModel(selectedProviderEntryKey, modelKey, (current) => ({
                                ...current,
                                limit: {
                                  ...current.limit,
                                  output: numVal,
                                },
                              }))
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
                              updateModel(selectedProviderEntryKey, modelKey, (current) => ({
                                ...current,
                                modalities: {
                                  ...current.modalities,
                                  input: parseList(event.target.value),
                                },
                              }))
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
                              updateModel(selectedProviderEntryKey, modelKey, (current) => ({
                                ...current,
                                modalities: {
                                  ...current.modalities,
                                  output: parseList(event.target.value),
                                },
                              }))
                            }
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="flex min-h-64 flex-1 items-center justify-center rounded-[6px] border border-white/8 bg-[#212121] text-sm text-white/45">
          尚未配置 Provider
        </section>
      )}
    </div>
  );
};
