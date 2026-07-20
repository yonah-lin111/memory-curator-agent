import type React from "react";
import { Select } from "@/components/ui/Select";
import type { AiSettingsConfig, AiSettingsModelSelection } from "../types";

export interface ModelsSectionProps {
  settings: AiSettingsConfig;
  updateModelSelection: (
    key: "defaultModel" | "titleSummary" | "weeklySummary" | "suggestedQuestions",
    field: keyof AiSettingsModelSelection,
    value: string
  ) => void;
  updateSuggestedQuestionsEnabled: (enabled: boolean) => void;
}

export const ModelsSection = ({
  settings,
  updateModelSelection,
  updateSuggestedQuestionsEnabled,
}: ModelsSectionProps): React.JSX.Element => {
  const providerEntries = Object.entries(settings.providers);
  const providerOptions = providerEntries.map(([providerKey, provider]) => ({
    value: providerKey,
    label: provider.name || provider.id,
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {(["defaultModel", "titleSummary", "weeklySummary", "suggestedQuestions"] as const).map((selectionKey) => {
        const selection = settings[selectionKey];
        const models = Object.values(settings.providers[selection.provider]?.models ?? {});
        let title = "默认模型";
        if (selectionKey === "defaultModel") {
          title = "默认对话模型";
        } else if (selectionKey === "titleSummary") {
          title = "标题总结模型";
        } else if (selectionKey === "weeklySummary") {
          title = "周度总结模型";
        } else if (selectionKey === "suggestedQuestions") {
          title = "推荐问题模型";
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
            {selectionKey === "suggestedQuestions" ? (
              <label className="mt-3 flex items-center gap-2 text-xs text-white/60">
                <input type="checkbox" checked={settings.suggestedQuestionsEnabled} onChange={(event) => updateSuggestedQuestionsEnabled(event.target.checked)} className="h-4 w-4 accent-white" />
                在 AI 回复后显示推荐问题
              </label>
            ) : null}
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-xs text-white/45">
                Provider
                <Select
                  value={selection.provider}
                  onChange={(val) => updateModelSelection(selectionKey, "provider", val)}
                  options={providerOptions}
                />
              </label>
              <label className="grid gap-1.5 text-xs text-white/45">
                Model
                <Select
                  value={selection.model}
                  onChange={(val) => updateModelSelection(selectionKey, "model", val)}
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
