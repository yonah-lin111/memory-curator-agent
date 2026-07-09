import type React from "react";
import { useEffect, useState } from "react";
import { JournalPage } from "@/pages/journal/JournalPage";
import { MemoriesPage } from "@/pages/memories/MemoriesPage";
import { NotesPage } from "@/pages/notes/NotesPage";
import { ThemesPage } from "@/pages/themes/ThemesPage";
import { WeeklyReviewPage } from "@/pages/weekly-review/WeeklyReviewPage";
import { TodoPage } from "@/pages/todo/TodoPage";
import { SnippetsPage } from "@/pages/snippets/SnippetsPage";
import { BillsPage } from "@/pages/bills/BillsPage";
import { PeoplePage } from "@/pages/people/PeoplePage";
import { ShowcasePage } from "@/pages/showcase/ShowcasePage";
import { StyleTestPage } from "@/pages/style-test/StyleTestPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { PersonalInfoPage } from "@/pages/personal-info/PersonalInfoPage";
import {
  Sidebar,
  type SidebarPageId,
} from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TodayPage } from "@/pages/today/TodayPage";
import { ToastProvider } from "@/components/ui/Toast";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { CuratorWorkspace } from "@/features/curator/components/CuratorWorkspace";
import { OverlayWorkspace } from "@/components/layout/OverlayWorkspace";
import { PromptDesignWorkspace } from "@/features/prompt-design/components/PromptDesignWorkspace";
import { useCuratorController } from "@/features/curator/useCuratorController";
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import { IconButton } from "@/components/ui/IconButton";
import { Layers3 } from "lucide-react";
import type { CuratorInputCommandId } from "@/features/curator/components/CuratorInput/types";

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
  "bills",
  "people",
  "personal-info",
  "showcase",
  "style-test",
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
    case "bills":
    case "people":
      return "LIBRARY";
    case "weekly":
    case "themes":
    case "memories":
      return "CURATION";
    case "showcase":
    case "style-test":
      return "DEVELOPER";
    case "settings":
      return "SYSTEM";
    case "personal-info":
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
    case "bills":
      return <BillsPage />;
    case "people":
      return <PeoplePage />;
    case "showcase":
      return <ShowcasePage />;
    case "style-test":
      return <StyleTestPage />;
    case "settings":
      return <SettingsPage />;
    case "personal-info":
      return <PersonalInfoPage />;
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

  // 提示词 AI 助手边栏展开状态。
  const [isPromptAiSidebarOpen, setIsPromptAiSidebarOpen] = useState<boolean>(false);

  // 当前激活的 Overlay (chat, prompts, null)
  const [activeOverlay, setActiveOverlay] = useState<"chat" | "prompts" | null>(null);

  // 当前中间主内容页面。
  const [activePage, setActivePage] =
    useState<SidebarPageId>(getPageFromPathname);

  const { requestExport, projectName, itemName } = usePromptDesignStore();

  // 主内容页面切换时的 Loading 状态。
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);

  const {
    isChatOpen,
    chatSessions,
    activeChatId,
    completionNoticeSessionIds,
    activeChatSession,
    aiModelOptions,
    selectedCuratorModel,
    hasMoreChatSessions,
    isLoadingMoreChatSessions,
    handleChatToggle,
    setActiveChatId,
    clearCompletionNoticeSession,
    setSelectedCuratorModel,
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
    handleCuratorCommand,
    handleCancelGeneration,
  } = useCuratorController();

  // 监听 chat 打开状态
  useEffect(() => {
    if (isChatOpen && activeOverlay !== "chat") {
      setActiveOverlay("chat");
    } else if (!isChatOpen && activeOverlay === "chat") {
      setActiveOverlay(null);
    }
  }, [isChatOpen, activeOverlay]);

  // 执行 AI 对话斜杠命令。
  const handleCommandExecute = (
    command: CuratorInputCommandId,
  ): string | void | Promise<string | void> => {
    return handleCuratorCommand(command);
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

  const handlePromptAiToggle = () => {
    setIsPromptAiSidebarOpen(!isPromptAiSidebarOpen);
  };

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
        mode={activeOverlay === "chat" ? "chat" : activeOverlay === "prompts" ? "prompts" : "navigation"}
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
          category={activeOverlay ? "AGENT" : getPageCategory(activePage)}
          activePage={activeOverlay ? activeOverlay : activePage}
          isChatOpen={isChatOpen}
          onChatToggle={() => {
            if (activeOverlay === "prompts") {
              setActiveOverlay("chat");
              if (!isChatOpen) handleChatToggle();
            } else {
              handleChatToggle();
            }
          }}
          isPromptsOpen={activeOverlay === "prompts"}
          onPromptsToggle={() => setActiveOverlay(prev => prev === "prompts" ? null : "prompts")}
          isPromptAiOpen={isPromptAiSidebarOpen}
          onPromptAiToggle={handlePromptAiToggle}
          onPromptExport={requestExport}
          chatTitle={activeChatSession.title}
          promptsProjectName={projectName}
          promptsItemName={itemName}
          chatLeadingAction={
            activeOverlay === "chat" ? (
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
              activeOverlay
                ? "pointer-events-none opacity-0"
                : "pointer-events-auto opacity-100"
            }`}
            aria-hidden={activeOverlay !== null}
          >
            <div className="w-full h-full relative">
              {renderPageById(activePage)}
              <LoadingOverlay isLoading={isPageLoading} text="Loading..." />
            </div>
          </div>

          <OverlayWorkspace 
            activeOverlay={activeOverlay}
            chatContent={
              <CuratorWorkspace
                isChatOpen={activeOverlay === "chat"}
                session={activeChatSession}
                modelOptions={aiModelOptions}
                selectedModel={selectedCuratorModel}
                isContextTimelineOpen={isContextTimelineOpen}
                onSendMessage={handleSendMessage}
                onSubmitAskAnswer={handleSubmitAskAnswer}
                onSubmitToolConfirmationAnswer={handleSubmitToolConfirmationAnswer}
                onRegenerateLatestAnswer={handleRegenerateLatestAnswer}
                onEditAndResendUserMessage={handleEditAndResendUserMessage}
                onDeleteChatTurn={handleDeleteChatTurn}
                onCommandExecute={handleCommandExecute}
                onModelChange={setSelectedCuratorModel}
                onCancelGeneration={handleCancelGeneration}
                chatSessions={chatSessions}
                onActiveSessionChange={setActiveChatId}
                hasMoreChatSessions={hasMoreChatSessions}
                isLoadingMoreChatSessions={isLoadingMoreChatSessions}
                onLoadMoreChatSessions={handleLoadMoreChatSessions}
              />
            }
            promptsContent={
              <PromptDesignWorkspace isOpen={activeOverlay === "prompts"} isPromptAiSidebarOpen={isPromptAiSidebarOpen} onClosePromptAiSidebar={() => {
                setIsPromptAiSidebarOpen(false);
              }} />
            }
          />
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
