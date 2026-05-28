import type React from "react";
import { useState, useEffect } from "react";
import { JournalPage } from "@renderer/pages/JournalPage";
import { MemoriesPage } from "@renderer/pages/MemoriesPage";
import { NotesPage } from "@renderer/pages/NotesPage";
import { ThemesPage } from "@renderer/pages/ThemesPage";
import { WeeklyReviewPage } from "@renderer/pages/WeeklyReviewPage";
import { TodoPage } from "@renderer/pages/TodoPage";
import { SnippetsPage } from "@renderer/pages/SnippetsPage";
import { PeoplePage } from "@renderer/pages/PeoplePage";
import {
  Sidebar,
  type SidebarPageId,
} from "@renderer/components/layout/Sidebar";
import { TodayPage } from "@renderer/pages/TodayPage";
import { ToastProvider } from "@renderer/components/ui/Toast";
import { IconButton } from "@renderer/components/ui/IconButton";
import { MessageSquare } from "lucide-react";

/**
 * 记忆策展 Agent 的主应用布局。
 * 通过左侧导航与中间页面区域组织日输入、策展回顾和 Agent 编写页面。
 */
export const App = (): React.JSX.Element => {
  // 左侧导航栏折叠状态。
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // 根据当前 URL pathname 获取初始页面标识，默认为 'today'。
  const getPageFromPathname = (): SidebarPageId => {
    const path = window.location.pathname.replace(/^\/|\/$/g, "");
    const validPages: SidebarPageId[] = [
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
    if (validPages.includes(path as SidebarPageId)) {
      return path as SidebarPageId;
    }
    return "today";
  };

  // 当前中间主内容页面。
  const [activePage, setActivePage] =
    useState<SidebarPageId>(getPageFromPathname);

  // 获取当前日期的 YYYY-MM-DD 字符串。
  const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 获取页面的分类名称。
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

  // 获取页面的中文标题。
  const getPageTitle = (pageId: SidebarPageId): string => {
    switch (pageId) {
      case "today":
        return getTodayDateString();
      case "notes":
        return "自由笔记素材池";
      case "journal":
        return "日记条目回看";
      case "todo":
        return "待办清单";
      case "snippets":
        return "随手闪念随记";
      case "people":
        return "人物关系档案";
      case "weekly":
        return "周度策展";
      case "themes":
        return "长期主题追踪";
      case "memories":
        return "记忆片段关联";
      default:
        return "";
    }
  };

  // 监听 URL 路由 pathname 变化，确保与页面状态双向同步。
  useEffect(() => {
    const handlePopState = () => {
      const page = getPageFromPathname();
      setActivePage(page);
    };

    // 初始化如果 pathname 为根路径，则默认写入 /today 路由
    const initialPath = window.location.pathname;
    if (initialPath === "/" || initialPath === "") {
      window.history.replaceState({}, "", "/today");
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);
  /**
   * 根据当前侧栏页面渲染中间主内容。
   */
  const renderActivePage = (): React.JSX.Element => {
    switch (activePage) {
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

  return (
    <ToastProvider>
      <main className="flex flex-col lg:flex-row h-screen w-screen bg-[#000000] p-3 gap-3 text-white antialiased overflow-y-auto lg:overflow-hidden">
        {/* 左侧多维导航栏 */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          activePage={activePage}
          onCollapsedChange={setIsSidebarCollapsed}
          onPageChange={(pageId) => {
            window.history.pushState({}, "", `/${pageId}`);
            setActivePage(pageId);
          }}
        />

        {/* 中间主工作区 */}
        <div className="flex-1 flex flex-col h-auto lg:h-full overflow-hidden min-w-0">
          {/* 固定的顶部栏 */}
          <header className="flex-shrink-0 mb-3 rounded-[6px] border border-white/5 bg-[#212121] px-4 py-2 flex items-center justify-between select-none h-10">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-white/30">//</span>
              <span className="text-white/40 font-bold uppercase tracking-wider">
                {getPageCategory(activePage)}
              </span>
              <span className="text-white/20">/</span>
              <span className="text-white/60 font-medium">{activePage}</span>
              <span className="text-white/20">·</span>
              <h1 className="text-white/80 font-normal">
                {getPageTitle(activePage)}
              </h1>
            </div>
            <IconButton
              aria-label="打开聊天"
              className="text-white/45 hover:bg-white/5 hover:text-white"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </IconButton>
          </header>

          <div className="flex-1 min-h-0">{renderActivePage()}</div>
        </div>
      </main>
    </ToastProvider>
  );
};
