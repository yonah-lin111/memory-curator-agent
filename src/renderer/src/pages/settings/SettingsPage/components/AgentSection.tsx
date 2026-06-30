import type React from "react";
import { Input } from "@/components/ui/Input";
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
