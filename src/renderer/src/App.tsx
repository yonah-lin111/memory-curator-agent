import type React from "react";
import { useEffect, useState } from "react";
import { JournalPage } from "@renderer/pages/journal/JournalPage";
import { MemoriesPage } from "@renderer/pages/memories/MemoriesPage";
import { NotesPage } from "@renderer/pages/notes/NotesPage";
import { ThemesPage } from "@renderer/pages/themes/ThemesPage";
import { WeeklyReviewPage } from "@renderer/pages/weekly-review/WeeklyReviewPage";
import { TodoPage } from "@renderer/pages/todo/TodoPage";
import { SnippetsPage } from "@renderer/pages/snippets/SnippetsPage";
import { PeoplePage } from "@renderer/pages/people/PeoplePage";
import {
  Sidebar,
  type SidebarPageId,
} from "@renderer/components/layout/Sidebar";
import { Header } from "@renderer/components/layout/Header";
import { TodayPage } from "@renderer/pages/today/TodayPage";
import { ToastProvider } from "@renderer/components/ui/Toast";
import { AiChatWorkspace } from "@renderer/features/ai-chat/components/AiChatWorkspace";
import { AiChatContextBar } from "@renderer/features/ai-chat/components/AiChatContextBar";
import { useAiChatController } from "@renderer/features/ai-chat/useAiChatController";

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
  }
};

/**
 * 记忆策展 Agent 的主应用布局。
 * 通过左侧导航与中间页面区域组织日输入、策展回顾和 Agent 编写页面。
 */
const AppContent = (): React.JSX.Element => {
  // 左侧导航栏折叠状态。
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // 当前中间主内容页面。
  const [activePage, setActivePage] =
    useState<SidebarPageId>(getPageFromPathname);

  const {
    isChatOpen,
    chatSessions,
    activeChatId,
    activeChatSession,
    activeChatContextItems,
    activeChatContextBudget,
    aiModelOptions,
    aiAgentOption,
    selectedAiModel,
    handleChatToggle,
    setActiveChatId,
    setSelectedAiModel,
    handleNewChat,
    handleRenameChat,
    handleDeleteChat,
    handleSendMessage,
    handleRegenerateLatestAnswer,
    handleDeleteChatTurn,
    handleAiChatCommand,
  } = useAiChatController();

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

  return (
    <main className="flex flex-col lg:flex-row h-screen w-screen bg-[#000000] p-3 gap-3 text-white antialiased overflow-y-auto lg:overflow-hidden">
      {/* 左侧多维导航栏 */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        activePage={activePage}
        mode={isChatOpen ? "chat" : "navigation"}
        chatSessions={chatSessions}
        activeChatId={activeChatId}
        onCollapsedChange={setIsSidebarCollapsed}
        onPageChange={(pageId) => {
          window.history.pushState({}, "", `/${pageId}`);
          setActivePage(pageId);
        }}
        onChatSessionChange={setActiveChatId}
        onNewChat={handleNewChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
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
              <AiChatContextBar
                items={activeChatContextItems}
                budget={activeChatContextBudget}
                agent={aiAgentOption}
              />
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
            <div className="w-full h-full">{renderPageById(activePage)}</div>
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
              session={activeChatSession}
              modelOptions={aiModelOptions}
              selectedModel={selectedAiModel}
              onSendMessage={handleSendMessage}
              onRegenerateLatestAnswer={handleRegenerateLatestAnswer}
              onDeleteChatTurn={handleDeleteChatTurn}
              onCommandExecute={handleAiChatCommand}
              onModelChange={setSelectedAiModel}
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
