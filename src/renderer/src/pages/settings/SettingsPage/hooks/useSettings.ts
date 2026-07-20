import { useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { useHeaderStore } from "@/lib/headerStore";
import { useAiSettingsStore } from "@/lib/aiSettingsStore";
import { DEFAULT_CONFIG_PATH } from "../constants";
import {
  cloneSettings,
  createModel,
  createProvider,
  normalizeSettingsForSave,
} from "../utils";
import type {
  AiSettingsConfig,
  AiSettingsProvider,
  AiSettingsModel,
  AiSettingsModelSelection,
  SettingsSection,
} from "../types";

export const useSettings = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>("models");
  const [baseline, setBaseline] = useState<AiSettingsConfig | null>(null);
  const [settings, setSettings] = useState<AiSettingsConfig | null>(null);
  const [selectedProviderKey, setSelectedProviderKey] = useState<string>("");
  const [loadError, setLoadError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [expandedModelKeys, setExpandedModelKeys] = useState<Record<string, boolean>>({});

  const toast = useToast();
  const setShowAgentThinking = useAiSettingsStore((state) => state.setShowAgentThinking);

  const toggleModelExpanded = useCallback((modelKey: string): void => {
    setExpandedModelKeys((prev) => ({
      ...prev,
      [modelKey]: !prev[modelKey],
    }));
  }, []);

  const isDirty = useMemo(() => {
    if (!settings || !baseline) return false;
    return (
      JSON.stringify(normalizeSettingsForSave(settings)) !==
      JSON.stringify(normalizeSettingsForSave(baseline))
    );
  }, [baseline, settings]);

  const loadSettings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError("");
    try {
      const api = window.api?.config?.ai;
      if (!api) throw new Error("配置 API 不可用");
      const nextSettings = await api.get();
      setBaseline(cloneSettings(nextSettings));
      setSettings(cloneSettings(nextSettings));
      setShowAgentThinking(nextSettings.showAgentThinking);
      setSelectedProviderKey(Object.keys(nextSettings.providers)[0] ?? "");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "加载配置失败");
    } finally {
      setIsLoading(false);
    }
  }, [setShowAgentThinking]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(
    (updater: (current: AiSettingsConfig) => AiSettingsConfig): void => {
      setSettings((current) => {
        if (!current) return current;
        return updater(cloneSettings(current));
      });
    },
    []
  );

  const handleSave = useCallback(async (): Promise<void> => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const api = window.api?.config?.ai;
      if (!api) throw new Error("配置 API 不可用");
      const payload = normalizeSettingsForSave(settings);
      const saved = await api.save(payload);
      setBaseline(cloneSettings(saved));
      setSettings(cloneSettings(saved));
      setShowAgentThinking(saved.showAgentThinking);
      setSelectedProviderKey(Object.keys(saved.providers)[0] ?? "");
      toast.success("设置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存配置失败");
    } finally {
      setIsSaving(false);
    }
  }, [settings, setShowAgentThinking, toast]);

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

  const updateModelSelection = useCallback(
    (
      key: "defaultModel" | "titleSummary" | "weeklySummary" | "suggestedQuestions",
      field: keyof AiSettingsModelSelection,
      value: string
    ): void => {
      updateSettings((current) => {
        const nextSelection = { ...current[key], [field]: value };
        if (field === "provider") {
          nextSelection.model =
            Object.keys(current.providers[value]?.models ?? {})[0] ?? "";
        }
        return { ...current, [key]: nextSelection };
      });
    },
    [updateSettings]
  );

  const updateSuggestedQuestionsEnabled = useCallback((enabled: boolean): void => {
    updateSettings((current) => ({ ...current, suggestedQuestionsEnabled: enabled }));
  }, [updateSettings]);

  const addProvider = useCallback((): void => {
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
  }, [updateSettings]);

  const updateProvider = useCallback(
    (
      providerKey: string,
      updater: (provider: AiSettingsProvider) => AiSettingsProvider
    ): void => {
      updateSettings((current) => ({
        ...current,
        providers: {
          ...current.providers,
          [providerKey]: updater(current.providers[providerKey]),
        },
      }));
    },
    [updateSettings]
  );

  const deleteProvider = useCallback(
    (providerKey: string): void => {
      updateSettings((current) => {
        const providers = { ...current.providers };
        delete providers[providerKey];
        const fallbackProvider = Object.keys(providers)[0] ?? "";
        setSelectedProviderKey(fallbackProvider);

        return {
          ...current,
          providers,
          enabledProviders: current.enabledProviders.filter(
            (providerId) => providerId !== providerKey
          ),
          defaultModel:
            current.defaultModel.provider === providerKey
              ? {
                  provider: fallbackProvider,
                  model: Object.keys(providers[fallbackProvider]?.models ?? {})[0] ?? "",
                }
              : current.defaultModel,
          titleSummary:
            current.titleSummary.provider === providerKey
              ? {
                  provider: fallbackProvider,
                  model: Object.keys(providers[fallbackProvider]?.models ?? {})[0] ?? "",
                }
              : current.titleSummary,
          weeklySummary:
            current.weeklySummary.provider === providerKey
              ? {
                  provider: fallbackProvider,
                  model: Object.keys(providers[fallbackProvider]?.models ?? {})[0] ?? "",
                }
              : current.weeklySummary,
        };
      });
    },
    [updateSettings]
  );

  const copyProvider = useCallback(
    (providerKey: string): void => {
      updateSettings((current) => {
        const originalProvider = current.providers[providerKey];
        if (!originalProvider) return current;

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
    },
    [updateSettings]
  );

  const toggleProviderEnabled = useCallback(
    (providerKey: string, enabled: boolean): void => {
      updateSettings((current) => ({
        ...current,
        enabledProviders: enabled
          ? Array.from(new Set([...current.enabledProviders, providerKey]))
          : current.enabledProviders.filter((providerId) => providerId !== providerKey),
      }));
    },
    [updateSettings]
  );

  const addModel = useCallback(
    (providerKey: string): void => {
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
    },
    [updateProvider]
  );

  const copyModel = useCallback(
    (providerKey: string, modelKey: string): void => {
      updateProvider(providerKey, (provider) => {
        const originalModel = provider.models[modelKey];
        if (!originalModel) return provider;

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
    },
    [updateProvider]
  );

  const updateModel = useCallback(
    (
      providerKey: string,
      modelKey: string,
      updater: (model: AiSettingsModel) => AiSettingsModel
    ): void => {
      updateProvider(providerKey, (provider) => ({
        ...provider,
        models: {
          ...provider.models,
          [modelKey]: updater(provider.models[modelKey]),
        },
      }));
    },
    [updateProvider]
  );

  const deleteModel = useCallback(
    (providerKey: string, modelKey: string): void => {
      updateProvider(providerKey, (provider) => {
        const models = { ...provider.models };
        delete models[modelKey];
        return {
          ...provider,
          models,
        };
      });
    },
    [updateProvider]
  );

  return {
    activeSection,
    setActiveSection,
    settings,
    updateSettings,
    selectedProviderKey,
    setSelectedProviderKey,
    loadError,
    isLoading,
    expandedModelKeys,
    toggleModelExpanded,
    loadSettings,
    updateModelSelection,
    updateSuggestedQuestionsEnabled,
    addProvider,
    updateProvider,
    deleteProvider,
    copyProvider,
    toggleProviderEnabled,
    addModel,
    copyModel,
    updateModel,
    deleteModel,
  };
};
