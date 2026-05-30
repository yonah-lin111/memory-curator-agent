import type React from "react";
import { useState } from "react";
import { Layers3 } from "lucide-react";
import type { AiAgentOption } from "@renderer/features/ai-chat/aiChatMock";
import type {
  AiChatContextBudget,
  AiChatContextItem,
} from "@renderer/features/ai-chat/aiChatContextBuilder";
import { IconButton } from "@renderer/components/ui/IconButton";

// AI 对话上下文栏组件属性类型。
type AiChatContextBarProps = {
  // 当前会话上下文条目。
  items: AiChatContextItem[];
  // 当前上下文预算。
  budget: AiChatContextBudget;
  // Agent 非密钥行为配置。
  agent: AiAgentOption | null;
};

/**
 * AiChatContextBar - 以 Header 按钮展示当前 AI 会话上下文概览与调试详情。
 */
export const AiChatContextBar = ({
  items,
  budget,
  agent,
}: AiChatContextBarProps): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const limitLabel = budget.contextLimit ? String(budget.contextLimit) : "未知上限";
  const usageLabel = budget.usagePercent === null ? "未知占比" : `${budget.usagePercent}%`;
  const toolOutputMaxCharsLabel = agent?.context.toolOutputMaxChars.toLocaleString("zh-CN") ?? "未知";
  const recentToolResultLimitLabel = agent?.context.recentToolResultLimit.toLocaleString("zh-CN") ?? "未知";
  const displayItems = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const recentToolResultLimitDetail =
    agent === null
      ? "Agent 配置尚未加载。"
      : `保留最近 ${recentToolResultLimitLabel} 条工具 observation 全文，超过该范围的旧工具结果在上下文中只保留占位摘要。`;

  return (
    <div className="relative" aria-label="AI 对话上下文">
      <IconButton
        aria-label="查看 AI 上下文记录"
        title="查看 AI 上下文记录"
        highlighted={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="ai-chat-context-detail"
        className={isOpen ? "" : "text-white/45 hover:bg-white/5 hover:text-white"}
      >
        <Layers3 className="h-3.5 w-3.5" />
      </IconButton>

      {isOpen && (
        <div
          id="ai-chat-context-detail"
          role="dialog"
          aria-label="AI 上下文记录详情"
          className="absolute right-0 top-8 z-40 w-[min(420px,calc(100vw-32px))] rounded-[6px] border border-white/10 bg-[#161616] p-3 text-xs text-white/55 shadow-2xl"
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="font-medium text-white/80">上下文记录</div>
            <div className="text-white/35">·</div>
            <div>{items.length} 条</div>
            <div className="text-white/35">·</div>
            <div>
              约 {budget.totalTokens} tokens / {limitLabel}
            </div>
            <div className="ml-auto rounded-[6px] border border-white/5 px-1.5 py-0.5 font-mono text-[12px] text-white/45">
              {usageLabel}
            </div>
          </div>

          <div className="mb-2 grid gap-1.5 sm:grid-cols-2">
            <div className="rounded-[6px] border border-white/5 bg-white/[0.02] px-2 py-1.5">
              <div className="text-white/35">单条工具输出上限</div>
              <div className="mt-0.5 font-mono text-white/70">{toolOutputMaxCharsLabel} chars</div>
            </div>
            <div className="rounded-[6px] border border-white/5 bg-white/[0.02] px-2 py-1.5">
              <div className="text-white/35">最近完整工具结果</div>
              <div className="mt-0.5 font-mono text-white/70">{recentToolResultLimitLabel} 条</div>
            </div>
          </div>

          <div className="mb-2 rounded-[6px] border border-white/5 bg-white/[0.02] px-2 py-1.5 text-white/45">
            {recentToolResultLimitDetail}
          </div>

          {items.length === 0 ? (
            <div className="text-white/35">暂无上下文</div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
              {displayItems.map((item) => (
                <div key={item.key} className="min-w-0 rounded-[6px] bg-white/[0.03] px-2 py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-[6px] border border-white/5 px-1.5 py-0.5 text-[12px] text-white/45">
                      {item.kind}
                    </span>
                    <span className="truncate text-white/75">{item.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-white/35">
                      {item.tokens.toLocaleString("zh-CN")} tokens
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[12px] text-white/30">{item.key}</div>
                  <div className="mt-1 truncate text-white/40">{item.summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
