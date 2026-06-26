import type React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AiChatHistoryList } from "./components/AiChatHistoryList";
import type { AiChatSession } from "@/features/ai-chat/types";
import { SidebarNavigationList } from "./components/SidebarNavigationList";

/* ==========================================
 * TS 类型定义 (Interfaces & Types)
 * ========================================== */

// 主导航项类型，描述左侧应用级入口。
export type SidebarPageId =
  | "today"
  | "notes"
  | "journal"
  | "weekly"
  | "themes"
  | "memories"
  | "todo"
  | "snippets"
  | "bills"
  | "people"
  | "showcase"
  | "style-test"
  | "settings";

// Sidebar 内容模式类型，描述左侧栏当前渲染主导航还是 AI 对话历史。
type SidebarMode = "navigation" | "chat" | "prompts";

// Sidebar 组件属性类型，描述左侧栏折叠、当前页面与切换入口。
type SidebarProps = {
  // 当前左侧栏是否处于折叠状态。
  isCollapsed: boolean;
  // 当前选中的侧栏页面。
  activePage: SidebarPageId;
  // 左侧栏内容模式。
  mode: SidebarMode;
  // AI 对话会话列表。
  chatSessions: AiChatSession[];
  // 当前激活的 AI 对话会话标识。
  activeChatId: string;
  // 已完成但尚未查看的 AI 会话 ID。
  completionNoticeSessionIds: Set<string>;
  // 左侧栏折叠状态改变回调。
  onCollapsedChange: (collapsed: boolean) => void;
  // 侧栏页面切换回调。
  onPageChange: (pageId: SidebarPageId) => void;
  // AI 对话会话切换回调。
  onChatSessionChange: (sessionId: string) => void;
  // 清理指定 AI 对话完成提醒回调。
  onCompletionNoticeClear: (sessionId: string) => void;
  // 新建 AI 对话回调。
  onNewChat: () => void;
  // 重命名 AI 对话回调。
  onRenameChat: (sessionId: string, title: string) => Promise<boolean>;
  // 删除 AI 对话回调。
  onDeleteChat: (sessionId: string) => Promise<boolean>;
  // 批量删除 AI 对话回调。
  onBatchDeleteChats: (sessionIds: string[]) => Promise<boolean>;
  // 加载更多 AI 历史回调。
  onLoadMoreChatSessions: () => Promise<void>;
  // AI 历史是否还有下一页。
  hasMoreChatSessions: boolean;
  // AI 历史是否正在加载下一页。
  isLoadingMoreChatSessions: boolean;
};

/**
 * Sidebar 组件 - 负责左侧多维导航栏。
 */
export const Sidebar = ({
  isCollapsed,
  activePage,
  mode,
  chatSessions,
  activeChatId,
  completionNoticeSessionIds,
  onCollapsedChange,
  onPageChange,
  onChatSessionChange,
  onCompletionNoticeClear,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onBatchDeleteChats,
  onLoadMoreChatSessions,
  hasMoreChatSessions,
  isLoadingMoreChatSessions,
}: SidebarProps): React.JSX.Element => {
  // 统一的折叠布局判定，主导航与 AI 历史均支持折叠。
  const shouldUseCollapsedLayout = isCollapsed;

  return (
    <div className="relative flex h-auto min-h-0 lg:h-full flex-shrink-0 lg:mr-1">
      <aside
        className={`relative w-full h-auto min-h-0 lg:h-full flex flex-col justify-between rounded-[6px] border border-white/5 bg-[#212121] select-none flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          shouldUseCollapsedLayout ? "lg:w-16 p-3 items-center" : "lg:w-56 p-4"
        }`}
      >
        {/* 导航与设置面板主体（带覆盖式滑出过渡） */}
        <div
          aria-hidden={mode !== "navigation"}
          className={`w-full min-h-0 flex-1 flex flex-col justify-between transition-opacity duration-300 ease-out ${
            mode === "navigation"
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <SidebarNavigationList
            isCollapsed={isCollapsed}
            activePage={activePage}
            onPageChange={onPageChange}
          />
        </div>

        {/* 聊天历史栏（带从左到右滑出的覆盖过渡动画） */}
        <div
          aria-hidden={mode !== "chat"}
          className={`absolute ${shouldUseCollapsedLayout ? "inset-y-4 inset-x-3" : "inset-4"} transition-opacity duration-300 ease-out flex flex-col ${
            mode === "chat"
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <AiChatHistoryList
            sessions={chatSessions}
            activeSessionId={activeChatId}
            completionNoticeSessionIds={completionNoticeSessionIds}
            onCompletionNoticeClear={onCompletionNoticeClear}
            onSessionChange={onChatSessionChange}
            onNewChat={onNewChat}
            onRenameChat={onRenameChat}
            onDeleteChat={onDeleteChat}
            onBatchDeleteChats={onBatchDeleteChats}
            onLoadMore={onLoadMoreChatSessions}
            hasMore={hasMoreChatSessions}
            isLoadingMore={isLoadingMoreChatSessions}
            aria-hidden={mode !== "chat"}
            isCollapsed={isCollapsed}
            onCollapsedChange={onCollapsedChange}
          />
        </div>
      </aside>

      {mode === "navigation" && (
        <button
          type="button"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          onClick={() => onCollapsedChange(!isCollapsed)}
          className="absolute top-1/2 right-0 z-20 flex h-6 w-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#212121] text-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
};
