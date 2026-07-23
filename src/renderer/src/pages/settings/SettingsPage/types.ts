export type AiSettingsConfig = Awaited<
  ReturnType<NonNullable<Window["api"]["config"]>["ai"]["get"]>
>

export type AiSettingsProvider = AiSettingsConfig["providers"][string]

export type AiSettingsModel = AiSettingsProvider["models"][string]

export type AiSettingsModelSelection = AiSettingsConfig["defaultModel"]

export type SettingsSection = "models" | "providers" | "agent" | "skills"

export type ProviderType = AiSettingsProvider["type"]
