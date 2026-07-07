import type { ProviderType, SettingsSection } from "./types";

export const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
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
  {
    id: "skills",
    label: "Agent 技能",
    description: "自定义指令与高级挂载规则",
  },
];

export const PROVIDER_TYPE_OPTIONS: ProviderType[] = [
  "openai-compatible",
  "openai",
  "anthropic",
  "google",
];

export const DEFAULT_CONFIG_PATH = "/Users/yonah/.mc/config.json";
