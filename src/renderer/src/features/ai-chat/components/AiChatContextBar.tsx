import type React from "react";
import { useState } from "react";
import { ChevronDown, Layers3 } from "lucide-react";
import type {
  AiChatContextBudget,
  AiChatContextItem,
} from "@renderer/features/ai-chat/aiChatContextBuilder";

// AI 对话上下文栏组件属性类型。
type AiChatContextBarProps = {
  // 当前会话上下文条目。
  items: AiChatContextItem[];
  // 当前上下文预算。
  budget: AiChatContextBudget;
};

/**
 * AiChatContextBar - 展示当前 AI 会话的全局上下文概览。
 */
export const AiChatContextBar = ({
  items,
  budget,
}: AiChatContextBarProps): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const limitLabel = budget.contextLimit ? String(budget.contextLimit) : "未知上限";
  const usageLabel = budget.usagePercent === null ? "未知占比" : `${budget.usagePercent}%`;

  return (
    <div
      aria-label="AI 对话上下文"
      className="rounded-[6px] border border-white/5 bg-black/20 text-xs text-white/55"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <Layers3 className="h-3.5 w-3.5 text-white/45" />
        <span className="font-medium text-white/75">上下文</span>
        <span className="text-white/35">·</span>
        <span>{items.length} 条</span>
        <span className="text-white/35">·</span>
        <span>
          约 {budget.totalTokens} tokens / {limitLabel}
        </span>
        <span className="ml-auto rounded-[6px] border border-white/5 px-1.5 py-0.5 text-[12px] text-white/45">
          {usageLabel}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-white/35 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-white/5 px-3 py-2">
          {items.length === 0 ? (
            <div className="text-white/35">暂无上下文</div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div key={item.key} className="min-w-0 rounded-[6px] bg-white/[0.03] px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-[6px] border border-white/5 px-1.5 py-0.5 text-[12px] text-white/45">
                      {item.kind}
                    </span>
                    <span className="truncate text-white/75">{item.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-white/35">
                      {item.tokens.toLocaleString("zh-CN")} tokens
                    </span>
                  </div>
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
