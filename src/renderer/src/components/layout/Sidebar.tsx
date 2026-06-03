import type React from "react";
import {
  BookOpen,
  Brain,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Layers,
  Settings,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
import { AiChatHistoryList } from "@renderer/features/ai-chat/components/AiChatHistoryList";
import type { AiChatSession } from "@renderer/features/ai-chat/types";

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
  | "people";

// 主导航项类型，描述左侧应用级入口。
type NavigationItem = {
  // 导航项唯一标识。
  id: SidebarPageId;
  // 导航项显示名称。
  label: string;
  // 导航项辅助说明。
  description: string;
  // 导航项图标组件。
  icon: React.ComponentType<{ className?: string }>;
};

// 导航分组类型，描述产品使用节奏下的入口集合。
type NavigationGroup = {
  // 分组唯一标识。
  id: string;
  // 分组显示名称。
  label: string;
  // 分组下的导航项。
  items: NavigationItem[];
};

// Sidebar 内容模式类型，描述左侧栏当前渲染主导航还是 AI 对话历史。
type SidebarMode = "navigation" | "chat";

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
  // 左侧栏折叠状态改变回调。
  onCollapsedChange: (collapsed: boolean) => void;
  // 侧栏页面切换回调。
  onPageChange: (pageId: SidebarPageId) => void;
  // AI 对话会话切换回调。
  onChatSessionChange: (sessionId: string) => void;
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

/* ==========================================
 * 静态 Mock 数据 (Static Mock Data)
 * ========================================== */

// 左侧主导航分组静态数据。
const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    id: "daily",
    label: "DAILY",
    items: [
      {
        id: "today",
        label: "Today",
        description: "计划 / 随记 / 日记",
        icon: Home,
      },
    ],
  },
  {
    id: "library",
    label: "LIBRARY",
    items: [
      {
        id: "notes",
        label: "Notes",
        description: "自由笔记列表",
        icon: FileText,
      },
      {
        id: "journal",
        label: "Journal",
        description: "日记条目回看",
        icon: BookOpen,
      },
      {
        id: "todo",
        label: "Todo",
        description: "待办清单",
        icon: CheckSquare,
      },
      {
        id: "snippets",
        label: "Snippets",
        description: "随手闪念随记",
        icon: StickyNote,
      },
      {
        id: "people",
        label: "People",
        description: "人物关系档案",
        icon: Users,
      },
    ],
  },
  {
    id: "curation",
    label: "CURATION",
    items: [
      {
        id: "weekly",
        label: "Weekly Review",
        description: "周度策展",
        icon: CalendarDays,
      },
      {
        id: "themes",
        label: "Themes",
        description: "长期主题追踪",
        icon: Layers,
      },
      {
        id: "memories",
        label: "Memories",
        description: "记忆片段关联",
        icon: Sparkles,
      },
    ],
  },
];

/**
 * Sidebar 组件 - 负责左侧多维导航栏。
 */
export const Sidebar = ({
  isCollapsed,
  activePage,
  mode,
  chatSessions,
  activeChatId,
  onCollapsedChange,
  onPageChange,
  onChatSessionChange,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onBatchDeleteChats,
  onLoadMoreChatSessions,
  hasMoreChatSessions,
  isLoadingMoreChatSessions,
}: SidebarProps): React.JSX.Element => {
  // AI 对话模式下强制使用展开宽度，避免历史列表被折叠成不可读图标。
  const shouldUseCollapsedLayout = mode === "navigation" && isCollapsed;

  return (
    <div className="relative flex h-auto lg:h-full flex-shrink-0">
      <aside
        className={`relative w-full h-auto lg:h-full flex flex-col justify-between rounded-[6px] border border-white/5 bg-[#212121] select-none flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          shouldUseCollapsedLayout ? "lg:w-16 p-3 items-center" : "lg:w-56 p-4"
        }`}
      >
        {/* 导航与设置面板主体（带覆盖式滑出过渡） */}
        <div
          aria-hidden={mode !== "navigation"}
          className={`w-full flex-1 flex flex-col justify-between transition-opacity duration-300 ease-out ${
            mode === "navigation"
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <div
            className={`flex flex-col gap-5 w-full ${
              shouldUseCollapsedLayout ? "" : "lg:w-[190px] lg:flex-shrink-0"
            }`}
          >
            {/* 产品标识头 */}
            <div
              className={`flex items-center gap-3 px-1 ${
                shouldUseCollapsedLayout ? "justify-center" : ""
              }`}
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] bg-white text-black">
                <Brain className="h-5 w-5" />
              </div>
              {!shouldUseCollapsedLayout && (
                <div className="flex flex-col">
                  <h2 className="text-xs font-semibold tracking-wider text-white whitespace-nowrap">
                    MEMORY CURATOR
                  </h2>
                </div>
              )}
            </div>

            {/* 应用级主导航按使用节奏分组，避免入口平铺成普通工具列表。 */}
            <nav className="flex flex-col gap-3 w-full" aria-label="Sidebar main navigation">
              {NAVIGATION_GROUPS.map((group) => (
                <section key={group.id} className="flex flex-col gap-1.5">
                  {!shouldUseCollapsedLayout && (
                    <h3 className="px-1 text-xs font-bold tracking-[0.18em] text-white/30 whitespace-nowrap">
                      {group.label}
                    </h3>
                  )}
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.id === activePage;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-current={isActive ? "page" : undefined}
                          aria-label={shouldUseCollapsedLayout ? item.label : undefined}
                          onClick={() => onPageChange(item.id)}
                           className={`flex w-full items-center rounded-[6px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${
                            shouldUseCollapsedLayout
                              ? "justify-center px-0 py-2.5"
                              : "gap-3 px-3 py-2.5"
                          } ${
                            isActive
                              ? "bg-white text-black font-semibold"
                              : "text-white/60 hover:bg-white/5 hover:text-white/85"
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 flex-shrink-0 ${
                              isActive ? "text-black" : "text-white/50"
                            }`}
                          />
                          {!shouldUseCollapsedLayout && (
                            <div className="flex min-w-0 flex-col items-start text-left whitespace-nowrap">
                              <span className="text-sm font-bold leading-none whitespace-nowrap">
                                {item.label}
                              </span>
                              <span
                                className={`mt-1 text-xs leading-none whitespace-nowrap ${
                                  isActive ? "text-black/60 font-medium" : "text-white/30"
                                  }`}
                              >
                                {item.description}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </nav>
          </div>

          {/* 底部设置 */}
          <div
            className={`mt-auto flex flex-col gap-2.5 pt-4 border-t border-white/5 w-full ${
              shouldUseCollapsedLayout ? "" : "lg:w-[190px] lg:flex-shrink-0"
            }`}
          >
            {shouldUseCollapsedLayout ? (
              <div className="flex flex-col gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-white/[0.02] border border-white/5 text-white/45">
                  <Settings className="h-3.5 w-3.5" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm text-white/35 whitespace-nowrap">
                <Settings className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">Settings</span>
              </div>
            )}
          </div>
        </div>

        {/* 聊天历史栏（带从左到右滑出的覆盖过渡动画） */}
        <div
          aria-hidden={mode !== "chat"}
          className={`absolute inset-4 transition-opacity duration-300 ease-out flex flex-col ${
            mode === "chat"
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <AiChatHistoryList
            sessions={chatSessions}
            activeSessionId={activeChatId}
            onSessionChange={onChatSessionChange}
            onNewChat={onNewChat}
            onRenameChat={onRenameChat}
            onDeleteChat={onDeleteChat}
            onBatchDeleteChats={onBatchDeleteChats}
            onLoadMore={onLoadMoreChatSessions}
            hasMore={hasMoreChatSessions}
            isLoadingMore={isLoadingMoreChatSessions}
            aria-hidden={mode !== "chat"}
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
