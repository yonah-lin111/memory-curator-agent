import type React from "react";
import { CuratorHistoryList } from "./components/CuratorHistoryList";
import { PromptSidebarList } from "./components/PromptSidebarList";
import type { CuratorSession } from "@/features/curator/types";
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
  | "personal-info"
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
  chatSessions: CuratorSession[];
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
  // 选择 Prompt Design 的回调
  onPromptDesignSelected?: () => void;
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
  onPromptDesignSelected,
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
          className={`absolute ${shouldUseCollapsedLayout ? "inset-y-4 inset-x-3" : "inset-4"} transition-transform duration-300 ease-out transform flex flex-col ${
            mode === "navigation"
              ? "translate-x-0 pointer-events-auto z-10"
              : "-translate-x-[150%] pointer-events-none -z-10"
          }`}
        >
          <SidebarNavigationList
            isCollapsed={isCollapsed}
            onCollapsedChange={onCollapsedChange}
            activePage={activePage}
            onPageChange={onPageChange}
          />
        </div>

        {/* 聊天历史栏（带从左到右滑出的覆盖过渡动画） */}
        <div
          aria-hidden={mode !== "chat"}
          className={`absolute ${shouldUseCollapsedLayout ? "inset-y-4 inset-x-3" : "inset-4"} transition-transform duration-300 ease-out transform flex flex-col ${
            mode === "chat"
              ? "translate-x-0 pointer-events-auto z-10"
              : "translate-x-[150%] pointer-events-none -z-10"
          }`}
        >
          <CuratorHistoryList
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

        {/* 提示词设计侧边栏（包含节点组件列表） */}
        <div
          aria-hidden={mode !== "prompts"}
          className={`absolute ${shouldUseCollapsedLayout ? "inset-y-4 inset-x-3" : "inset-4"} transition-transform duration-300 ease-out transform flex flex-col ${
            mode === "prompts"
              ? "translate-x-0 pointer-events-auto z-10"
              : "translate-x-[150%] pointer-events-none -z-10"
          }`}
        >
          <PromptSidebarList
            isCollapsed={isCollapsed}
            onCollapsedChange={onCollapsedChange}
            aria-hidden={mode !== "prompts"}
            onDesignSelected={onPromptDesignSelected}
          />
        </div>
      </aside>

    </div>
  );
};
