import type React from "react";
import { useEffect, useState } from "react";
import { JournalPage } from "@/pages/journal/JournalPage";
import { MemoriesPage } from "@/pages/memories/MemoriesPage";
import { NotesPage } from "@/pages/notes/NotesPage";
import { ThemesPage } from "@/pages/themes/ThemesPage";
import { WeeklyReviewPage } from "@/pages/weekly-review/WeeklyReviewPage";
import { TodoPage } from "@/pages/todo/TodoPage";
import { SnippetsPage } from "@/pages/snippets/SnippetsPage";
import { PeoplePage } from "@/pages/people/PeoplePage";
import { ShowcasePage } from "@/pages/showcase/ShowcasePage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import {
  Sidebar,
  type SidebarPageId,
} from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TodayPage } from "@/pages/today/TodayPage";
import { ToastProvider } from "@/components/ui/Toast";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { AiChatWorkspace } from "@/features/ai-chat/components/AiChatWorkspace";
import { useAiChatController } from "@/features/ai-chat/useAiChatController";
import { IconButton } from "@/components/ui/IconButton";
import { Layers3 } from "lucide-react";
import type { AiChatInputCommandId } from "@/features/ai-chat/components/AiChatInput/types";

// 侧边栏支持的页面标识列表。
const VALID_PAGES: SidebarPageId[] = [
  "today",
  "notes",
  "journal",
  "weekly",
  "themes",
  "memories",
  "todo",
  "snippets",
  "people",
  "showcase",
  "settings",
];

/**
 * 根据当前 URL pathname 获取初始页面标识，默认为 today。
 */
const getPageFromPathname = (): SidebarPageId => {
  const path = window.location.pathname.replace(/^\/|\/$/g, "");
  if (VALID_PAGES.includes(path as SidebarPageId)) {
    return path as SidebarPageId;
  }

  return "today";
};

/**
 * 获取页面的分类名称。
 */
const getPageCategory = (pageId: SidebarPageId): string => {
  switch (pageId) {
    case "today":
      return "DAILY";
    case "notes":
    case "journal":
    case "todo":
    case "snippets":
    case "people":
      return "LIBRARY";
    case "weekly":
    case "themes":
    case "memories":
      return "CURATION";
    case "showcase":
      return "DEVELOPER";
    case "settings":
      return "SYSTEM";
    default:
      return "DAILY";
  }
};

/**
 * 渲染当前侧栏页面。
 */
const renderPageById = (pageId: SidebarPageId): React.JSX.Element => {
  switch (pageId) {
    case "today":
      return <TodayPage />;
    case "notes":
      return <NotesPage />;
    case "journal":
      return <JournalPage />;
    case "weekly":
      return <WeeklyReviewPage />;
    case "themes":
      return <ThemesPage />;
    case "memories":
      return <MemoriesPage />;
    case "todo":
      return <TodoPage />;
    case "snippets":
      return <SnippetsPage />;
    case "people":
      return <PeoplePage />;
    case "showcase":
      return <ShowcasePage />;
    case "settings":
      return <SettingsPage />;
  }
};

/**
 * 记忆策展 Agent 的主应用布局。
 * 通过左侧导航与中间页面区域组织日输入、策展回顾和 Agent 编写页面。
 */
const AppContent = (): React.JSX.Element => {
  // 左侧导航栏折叠状态。
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // 上下文时间线展开状态。
  const [isContextTimelineOpen, setIsContextTimelineOpen] = useState<boolean>(false);

  // 当前中间主内容页面。
  const [activePage, setActivePage] =
    useState<SidebarPageId>(getPageFromPathname);

  // 主内容页面切换时的 Loading 状态。
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);

  const {
    isChatOpen,
    chatSessions,
    activeChatId,
    completionNoticeSessionIds,
    activeChatSession,
    aiModelOptions,
    selectedAiModel,
    hasMoreChatSessions,
    isLoadingMoreChatSessions,
    handleChatToggle,
    setActiveChatId,
    clearCompletionNoticeSession,
    setSelectedAiModel,
    handleNewChat,
    handleRenameChat,
    handleDeleteChat,
    handleBatchDeleteChats,
    handleLoadMoreChatSessions,
    handleSendMessage,
    handleSubmitAskAnswer,
    handleSubmitToolConfirmationAnswer,
    handleRegenerateLatestAnswer,
    handleEditAndResendUserMessage,
    handleDeleteChatTurn,
    handleAiChatCommand,
    handleCancelGeneration,
  } = useAiChatController();

  // 执行 AI 对话斜杠命令。
  const handleCommandExecute = (
    command: AiChatInputCommandId,
  ): string | void | Promise<string | void> => {
    if (command === "showContextTimeline") {
      setIsContextTimelineOpen((prev) => !prev);
      return;
    }
    if (command === "showFullScreen") {
      setIsSidebarCollapsed(true);
      setIsContextTimelineOpen(false);
      return;
    }
    return handleAiChatCommand(command);
  };

  // 监听 URL 路由 pathname 变化，确保与页面状态双向同步。
  useEffect(() => {
    const handlePopState = (): void => {
      const page = getPageFromPathname();
      setActivePage(page);
    };

    const initialPath = window.location.pathname;
    if (initialPath === "/" || initialPath === "") {
      window.history.replaceState({}, "", "/today");
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // 首次进入页面时触发 500ms Loading 效果。
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="flex flex-col lg:flex-row h-screen w-screen bg-[#000000] p-3 gap-3 text-white antialiased overflow-y-auto lg:overflow-hidden">
      {/* 左侧多维导航栏 */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        activePage={activePage}
        mode={isChatOpen ? "chat" : "navigation"}
        chatSessions={chatSessions}
        activeChatId={activeChatId}
        completionNoticeSessionIds={completionNoticeSessionIds}
        onCollapsedChange={setIsSidebarCollapsed}
        onPageChange={(pageId) => {
          if (pageId === activePage) {
            return;
          }
          window.history.pushState({}, "", `/${pageId}`);
          setIsPageLoading(true);
          setActivePage(pageId);
          setTimeout(() => {
            setIsPageLoading(false);
          }, 500);
        }}
        onChatSessionChange={setActiveChatId}
        onCompletionNoticeClear={clearCompletionNoticeSession}
        onNewChat={handleNewChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onBatchDeleteChats={handleBatchDeleteChats}
        onLoadMoreChatSessions={handleLoadMoreChatSessions}
        hasMoreChatSessions={hasMoreChatSessions}
        isLoadingMoreChatSessions={isLoadingMoreChatSessions}
      />

      {/* 中间主工作区 */}
      <div className="flex-1 flex flex-col h-auto lg:h-full overflow-hidden min-w-0">
        {/* 固定的顶部栏 */}
        <Header
          category={isChatOpen ? "AGENT" : getPageCategory(activePage)}
          activePage={isChatOpen ? "chat" : activePage}
          isChatOpen={isChatOpen}
          onChatToggle={handleChatToggle}
          chatTitle={activeChatSession.title}
          chatLeadingAction={
            isChatOpen ? (
              <IconButton
                aria-label="Toggle AI context timeline"
                title="查看 AI 上下文记录"
                highlighted={isContextTimelineOpen}
                onClick={() => setIsContextTimelineOpen((prev) => !prev)}
                className={isContextTimelineOpen ? "" : "text-white/45 hover:bg-white/5 hover:text-white"}
              >
                <Layers3 className="h-3.5 w-3.5" />
              </IconButton>
            ) : null
          }
        />

        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div
            className={`absolute inset-0 transition-opacity duration-300 ease-out ${
              isChatOpen
                ? "pointer-events-none opacity-0"
                : "pointer-events-auto opacity-100"
            }`}
            aria-hidden={isChatOpen}
          >
            <div className="w-full h-full relative">
              {renderPageById(activePage)}
              <LoadingOverlay isLoading={isPageLoading} text="Loading..." />
            </div>
          </div>

          <div
            className={`absolute inset-0 transition-opacity duration-300 ease-out ${
              isChatOpen
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!isChatOpen}
          >
             <AiChatWorkspace
               isChatOpen={isChatOpen}
               session={activeChatSession}
               modelOptions={aiModelOptions}
               selectedModel={selectedAiModel}
               isContextTimelineOpen={isContextTimelineOpen}
               onSendMessage={handleSendMessage}
               onSubmitAskAnswer={handleSubmitAskAnswer}
               onSubmitToolConfirmationAnswer={handleSubmitToolConfirmationAnswer}
               onRegenerateLatestAnswer={handleRegenerateLatestAnswer}
               onEditAndResendUserMessage={handleEditAndResendUserMessage}
               onDeleteChatTurn={handleDeleteChatTurn}
               onCommandExecute={handleCommandExecute}
               onModelChange={setSelectedAiModel}
               onCancelGeneration={handleCancelGeneration}
               chatSessions={chatSessions}
               onActiveSessionChange={setActiveChatId}
               hasMoreChatSessions={hasMoreChatSessions}
               isLoadingMoreChatSessions={isLoadingMoreChatSessions}
               onLoadMoreChatSessions={handleLoadMoreChatSessions}
             />
          </div>
        </div>
      </div>
    </main>
  );
};

export const App = (): React.JSX.Element => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);
