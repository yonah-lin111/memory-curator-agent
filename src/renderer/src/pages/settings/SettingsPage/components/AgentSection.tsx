import type React from "react";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import type { AiSettingsConfig } from "../types";

export interface AgentSectionProps {
  settings: AiSettingsConfig;
  updateSettings: (updater: (current: AiSettingsConfig) => AiSettingsConfig) => void;
}

export const AgentSection = ({
  settings,
  updateSettings,
}: AgentSectionProps): React.JSX.Element => (
  <section className="rounded-[6px] border border-white/8 bg-[#212121] p-4">
    <h3 className="text-sm font-bold text-white">Agent 上下文治理</h3>
    <p className="mt-1 text-xs text-white/35">控制工具结果进入模型上下文的体积与保留策略</p>
    <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-[6px] border border-white/10 bg-white/[0.03] px-3 py-3 transition-colors hover:border-white/15 hover:bg-white/[0.05]">
      <span className="min-w-0 pr-2">
        <span className="block text-sm font-medium text-white/85">显示 Agent 思考</span>
        <span className="mt-1 block text-xs leading-4 text-white/35">在主智能体与提示词设计对话中显示模型思考内容</span>
      </span>
      <Switch
        aria-label="显示 Agent 思考"
        checked={settings.showAgentThinking}
        onChange={(checked) => {
          updateSettings((current) => ({
            ...current,
            showAgentThinking: checked,
          }));
        }}
      />
    </label>
    <div className="mt-4 border-t border-white/8 pt-4">
      <h4 className="text-sm font-bold text-white">联网搜索</h4>
      <p className="mt-1 text-xs text-white/35">留空时将尝试使用服务提供的匿名访问</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <label className="grid gap-1.5 text-xs text-white/45">
          Exa API Key
          <Input
            aria-label="Exa API Key"
            type="password"
            value={settings.webSearch.exaApiKey}
            onChange={(event) =>
              updateSettings((current) => ({
                ...current,
                webSearch: {
                  ...current.webSearch,
                  exaApiKey: event.target.value,
                },
              }))
            }
          />
        </label>
        <label className="grid gap-1.5 text-xs text-white/45">
          Tavily API Key
          <Input
            aria-label="Tavily API Key"
            type="password"
            value={settings.webSearch.tavilyApiKey}
            onChange={(event) =>
              updateSettings((current) => ({
                ...current,
                webSearch: {
                  ...current.webSearch,
                  tavilyApiKey: event.target.value,
                },
              }))
            }
          />
        </label>
      </div>
    </div>
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
        <span className="text-[10px] text-white/25">单条工具结果超过此长度将被截断</span>
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
                  maxTurns: numVal > 0 ? numVal : undefined,
                },
              },
            }))
          }
        />
        <span className="text-[10px] text-white/25">0 或留空表示不限制工具调用轮数</span>
      </label>
    </div>
  </section>
);
