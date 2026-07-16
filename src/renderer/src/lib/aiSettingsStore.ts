import { create } from "zustand";

// AI 显示设置状态。
type AiSettingsState = {
  // 是否显示 Agent 思考内容。
  showAgentThinking: boolean;
  // 更新思考内容显示状态。
  setShowAgentThinking: (showAgentThinking: boolean) => void;
};

// 全局 AI 显示设置，供消息气泡共享。
export const useAiSettingsStore = create<AiSettingsState>((set) => ({
  showAgentThinking: false,
  setShowAgentThinking: (showAgentThinking) => set({ showAgentThinking }),
}));
