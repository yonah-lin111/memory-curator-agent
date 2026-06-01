import type React from "react";
import { Bot, Plus, Search } from "lucide-react";
import type { AiChatSession } from "@renderer/features/ai-chat/aiChatMock";
import { IconButton } from "@renderer/components/ui/IconButton";

// AI 对话历史列表组件属性类型。
type AiChatHistoryListProps = {
  // AI 会话列表。
  sessions: AiChatSession[];
  // 当前激活的 AI 会话标识。
  activeSessionId: string;
  // 切换 AI 会话回调。
  onSessionChange: (sessionId: string) => void;
  // 新建 AI 会话回调。
  onNewChat: () => void;
  // 是否隐藏
  "aria-hidden"?: boolean;
};

/**
 * AiChatHistoryList - 负责左侧对话历史列表的渲染与交互
 */
export const AiChatHistoryList = ({
  sessions,
  activeSessionId,
  onSessionChange,
  onNewChat,
  "aria-hidden": ariaHidden,
}: AiChatHistoryListProps): React.JSX.Element => {
  return (
    <div
      className="flex h-full w-full flex-col gap-4"
      aria-label="对话历史列表"
      aria-hidden={ariaHidden}
    >
      {/* 顶部标题与新建按钮 */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold tracking-wider text-white/40 uppercase">
          AI DIALOGS
        </h2>
        <IconButton
          aria-label="新建对话"
          onClick={onNewChat}
          className="text-white/45 hover:bg-white/5 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {/* 搜索框 (仅用于静态 Mock 展示) */}
      <div className="relative px-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          placeholder="搜索对话历史"
          disabled
          className="w-full rounded-[6px] border border-white/5 bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/20 outline-none cursor-not-allowed"
        />
      </div>

      {/* 历史对话列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              type="button"
              aria-current={isActive ? "true" : undefined}
              onClick={() => onSessionChange(session.id)}
              className={`flex flex-col gap-1 rounded-[6px] px-2.5 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${
                isActive
                  ? "bg-white text-black font-semibold"
                  : "bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="truncate text-xs font-bold leading-none">
                  {session.title}
                </span>
                <span
                  className={`text-[10px] font-mono leading-none flex-shrink-0 ${
                    isActive ? "text-black/55" : "text-white/30"
                  }`}
                >
                  {session.time}
                </span>
              </div>
              <p
                className={`text-[11px] leading-relaxed truncate w-full ${
                  isActive ? "text-black/75" : "text-white/40"
                }`}
              >
                {session.summary}
              </p>
            </button>
          );
        })}
      </div>

      {/* 底部 Mock 状态卡片 */}
      <div className="mt-auto rounded-[6px] border border-white/5 bg-white/[0.02] p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-white/60" />
          <span className="text-xs font-bold text-white/60 font-mono">
            ReAct Mock Mode
          </span>
        </div>
        <p className="text-xs leading-relaxed text-white/35">
          Plan &rarr; Tool &rarr; Observation &rarr; Answer
        </p>
      </div>
    </div>
  );
};
