import type React from "react";
import { CommandPanel } from "@/features/ai-chat/components/CommandPanel";
import type { AiChatInputCommand } from "@/features/ai-chat/components/AiChatInput/types";
import type { AiChatAgentMentionOption } from "@/features/ai-chat/aiChatAgentMentions";
import type { AiChatSession } from "@/features/ai-chat/types";

// 联合面板群属性定义。
export interface MentionCommandPanelsProps {
  // Slash 命令面板显示状态。
  isCommandPanelOpen: boolean;
  // 当前匹配到的 Slash 命令列表。
  matchedCommands: AiChatInputCommand[];
  // 当前 Slash 命令面板活动焦点索引。
  activeCommandIndex: number;
  // 修改 Slash 命令活动焦点索引回调。
  onActiveCommandIndexChange: (idx: number) => void;
  // 确认选择 Slash 命令回调。
  onCommandSelect: (command: AiChatInputCommand) => void;
  // Slash 命令面板专有的键盘事件拦截器。
  onCommandPanelKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;

  // AI 模型模式面板显示状态。
  isModelMode: boolean;
  // 当前快速匹配过滤出的 AI 模型列表。
  matchedModels: Array<{
    id: string;
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
  }>;
  // 当前快速模型面板活动焦点索引。
  activeModelIndex: number;
  // 修改快速模型面板活动焦点索引回调。
  onActiveModelIndexChange: (idx: number) => void;
  // 确认选择快速模型回调。
  onModelSelect: (model: {
    id: string;
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
  }) => void;
  // 快速模型面板专有的键盘事件拦截器。
  onModelPanelKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;

  // AI 会话模式面板显示状态。
  isSessionMode: boolean;
  // 当前快速匹配过滤出的 AI 会话列表。
  matchedSessions: AiChatSession[];
  // 当前快速会话面板活动焦点索引。
  activeSessionIndex: number;
  // 修改快速会话面板活动焦点索引回调。
  onActiveSessionIndexChange: (idx: number) => void;
  // 确认选择快速会话回调。
  onSessionSelect: (session: AiChatSession) => void;
  // 快速会话面板专有的键盘事件拦截器。
  onSessionPanelKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  // 快速会话面板触底滚动加载的回调。
  onSessionScroll: (e: React.UIEvent<HTMLDivElement>) => void;

  // Agent 提到面板显示状态。
  isAgentPanelOpen: boolean;
  // 当前匹配到的 Agent 列表。
  matchedAgentMentions: AiChatAgentMentionOption[];
  // 当前 Agent 面板活动焦点索引。
  activeAgentIndex: number;
  // 修改 Agent 面板活动焦点索引回调。
  onActiveAgentIndexChange: (idx: number) => void;
  // 确认选择 Agent 回调。
  onAgentSelect: (agent: AiChatAgentMentionOption) => void;
}

/**
 * MentionCommandPanels - 整合管理 AI 各种快捷面板（命令、模型、Agent 提到）。
 */
export const MentionCommandPanels = ({
  isCommandPanelOpen,
  matchedCommands,
  activeCommandIndex,
  onActiveCommandIndexChange,
  onCommandSelect,
  onCommandPanelKeyDown,

  isModelMode,
  matchedModels,
  activeModelIndex,
  onActiveModelIndexChange,
  onModelSelect,
  onModelPanelKeyDown,

  isSessionMode,
  matchedSessions,
  activeSessionIndex,
  onActiveSessionIndexChange,
  onSessionSelect,
  onSessionPanelKeyDown,
  onSessionScroll,

  isAgentPanelOpen,
  matchedAgentMentions,
  activeAgentIndex,
  onActiveAgentIndexChange,
  onAgentSelect,
}: MentionCommandPanelsProps): React.JSX.Element => {
  return (
    <>
      <CommandPanel
        isOpen={isCommandPanelOpen && matchedCommands.length > 0}
        ariaLabel="AI Command Input Panel"
        items={matchedCommands}
        activeIndex={activeCommandIndex}
        onActiveIndexChange={onActiveCommandIndexChange}
        onItemSelect={onCommandSelect}
        onKeyDown={onCommandPanelKeyDown}
        idPrefix="ai-chat-command"
        renderItem={(command) => (
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-white">
              {command.name}
            </span>
            <span className="text-xs text-white/30">-</span>
            <span className="truncate text-xs text-white/45">
              {command.description}
            </span>
          </span>
        )}
      />

      <CommandPanel
        isOpen={isModelMode && matchedModels.length > 0}
        ariaLabel="AI Model Selection Panel"
        items={matchedModels}
        activeIndex={activeModelIndex}
        onActiveIndexChange={onActiveModelIndexChange}
        onItemSelect={onModelSelect}
        onKeyDown={onModelPanelKeyDown}
        idPrefix="ai-chat-model"
        renderItem={(model) => (
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-white">
              {model.modelName}
            </span>
            <span className="text-xs text-white/30">-</span>
            <span className="truncate text-xs text-white/45">
              {model.providerName}
            </span>
          </span>
        )}
      />

      <CommandPanel
        isOpen={isSessionMode && matchedSessions.length > 0}
        ariaLabel="AI Session Selection Panel"
        items={matchedSessions}
        activeIndex={activeSessionIndex}
        onActiveIndexChange={onActiveSessionIndexChange}
        onItemSelect={onSessionSelect}
        onKeyDown={onSessionPanelKeyDown}
        onScroll={onSessionScroll}
        idPrefix="ai-chat-session"
        renderItem={(session) => (
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-white truncate max-w-[200px]">
              {session.title || "新建对话"}
            </span>
            <span className="text-xs text-white/30">-</span>
            <span className="truncate text-xs text-white/45">
              {session.time.includes("T") 
                ? new Date(session.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
                : session.time}
            </span>
          </span>
        )}
      />

      <CommandPanel
        isOpen={isAgentPanelOpen}
        ariaLabel="AI Agent Mention Panel"
        items={matchedAgentMentions}
        activeIndex={activeAgentIndex}
        onActiveIndexChange={onActiveAgentIndexChange}
        onItemSelect={onAgentSelect}
        idPrefix="ai-chat-agent"
        renderItem={(agent) => (
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-white">
              {agent.token}
            </span>
            <span className="text-xs text-white/30">-</span>
            <span className="truncate text-xs text-white/45">
              {agent.description}
            </span>
          </span>
        )}
      />
    </>
  );
};
