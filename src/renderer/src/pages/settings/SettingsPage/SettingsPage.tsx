import type React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { SETTINGS_SECTIONS } from "./constants";
import { useSettings } from "./hooks/useSettings";
import { ModelsSection } from "./components/ModelsSection";
import { ProvidersSection } from "./components/ProvidersSection";
import { AgentSection } from "./components/AgentSection";

/**
 * Settings 页面 - 结构化编辑本地 AI 配置。
 */
export const SettingsPage = (): React.JSX.Element => {
  const {
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
    addProvider,
    updateProvider,
    deleteProvider,
    copyProvider,
    toggleProviderEnabled,
    addModel,
    copyModel,
    updateModel,
    deleteModel,
  } = useSettings();

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
            <p className="mt-2 text-sm text-white/45">{loadError || "配置为空"}</p>
          </div>
          <IconButton onClick={loadSettings} title="重试" aria-label="重试">
            <RotateCcw className="h-4 w-4" />
          </IconButton>
        </div>
      </section>
    );
  }

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
                  <span className="block text-sm font-bold">{section.label}</span>
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
          {activeSection === "models" && (
            <ModelsSection settings={settings} updateModelSelection={updateModelSelection} />
          )}
          {activeSection === "providers" && (
            <ProvidersSection
              settings={settings}
              selectedProviderKey={selectedProviderKey}
              setSelectedProviderKey={setSelectedProviderKey}
              expandedModelKeys={expandedModelKeys}
              toggleModelExpanded={toggleModelExpanded}
              addProvider={addProvider}
              updateProvider={updateProvider}
              deleteProvider={deleteProvider}
              copyProvider={copyProvider}
              toggleProviderEnabled={toggleProviderEnabled}
              addModel={addModel}
              copyModel={copyModel}
              updateModel={updateModel}
              deleteModel={deleteModel}
            />
          )}
          {activeSection === "agent" && (
            <AgentSection settings={settings} updateSettings={updateSettings} />
          )}
        </div>
      </div>
    </section>
  );
};
