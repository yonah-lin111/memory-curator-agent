import { useState } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import type { PromptAiMcpServer } from "@/features/prompt-design/components/usePromptAiChatController";

type PromptAiMcpOverviewProps = {
  servers: PromptAiMcpServer[];
};

/**
 * 展示当前可连接 MCP 服务及其工具，工具列表默认折叠以控制消息高度。
 */
export const PromptAiMcpOverview = ({ servers }: PromptAiMcpOverviewProps) => {
  const [expandedServerIds, setExpandedServerIds] = useState<Set<string>>(() => new Set());

  /**
   * 切换单个服务的工具列表展开状态。
   */
  const toggleServer = (serverId: string): void => {
    setExpandedServerIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(serverId)) {
        nextIds.delete(serverId);
      } else {
        nextIds.add(serverId);
      }
      return nextIds;
    });
  };

  if (servers.length === 0) {
    return <p className="text-xs text-white/45">No available MCP servers.</p>;
  }

  return (
    <section className="w-full overflow-hidden rounded-[6px] border border-white/10 bg-[#212121]">
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Wrench className="h-3.5 w-3.5 text-white/55" />
        <span className="text-xs font-medium text-white/80">Available MCP Servers</span>
      </header>
      <div className="divide-y divide-white/10">
        {servers.map((server) => {
          const isExpanded = expandedServerIds.has(server.id);
          return (
            <div key={server.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                aria-expanded={isExpanded}
                onClick={() => toggleServer(server.id)}
              >
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">{server.name}</span>
                <span className="shrink-0 text-xs text-white/40">{server.tools.length} {server.tools.length === 1 ? "tool" : "tools"}</span>
              </button>
              {isExpanded ? (
                <ul className="space-y-2 border-t border-white/5 bg-black px-3 py-2.5">
                  {server.tools.map((tool) => (
                    <li key={tool.name} className="min-w-0">
                      <div className="truncate text-xs font-mono text-white/80">{tool.name}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-white/45">{tool.description}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};
