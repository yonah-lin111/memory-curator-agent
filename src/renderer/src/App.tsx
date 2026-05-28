import type React from "react";
import { useState, useEffect } from "react";
import { Brain } from "lucide-react";
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
import { Header } from "@renderer/components/layout/Header";
import { TodayPage } from "@renderer/pages/TodayPage";
import { ToastProvider } from "@renderer/components/ui/Toast";

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

  // 页面切换及路由变动时的 loading 过渡状态。
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  // 控制是否激活视觉过渡动画。过渡动画结束后清除样式，以防止持续存在的 Stacking Context 导致页面内 fixed 弹窗定位失效（无法覆盖侧边栏与顶栏）。
  const [isVisualEffectActive, setIsVisualEffectActive] = useState<boolean>(false);

  // 监听 activePage 变化，自动触发克制且优雅的 250ms loading 过渡。
  useEffect(() => {
    setIsPageLoading(true);
    setIsVisualEffectActive(true);

    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 250);

    // 550ms（250ms 加载 + 300ms 渐变动画）后彻底清除过渡样式，恢复标准文档流与视口定位
    const cleanupTimer = setTimeout(() => {
      setIsVisualEffectActive(false);
    }, 550);

    return () => {
      clearTimeout(timer);
      clearTimeout(cleanupTimer);
    };
  }, [activePage]);

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
          <Header
            category={getPageCategory(activePage)}
            activePage={activePage}
          />

          <div className="flex-1 min-h-0 relative">
            {/* 页面内容容器：过渡 loading 时微弱淡出与轻微收缩、模糊 */}
            <div
              className={`w-full h-full ${
                isVisualEffectActive
                  ? "transition-all duration-300 ease-in-out"
                  : ""
              } ${
                isVisualEffectActive && isPageLoading
                  ? "opacity-40 scale-[0.99] filter blur-[0.5px]"
                  : isVisualEffectActive
                  ? "opacity-100 scale-100 filter blur-0"
                  : ""
              }`}
            >
              {renderActivePage()}
            </div>

            {/* 精致的极简 loading 遮罩层，保持纯黑主题与 6px 圆角 */}
            {isPageLoading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/15 backdrop-blur-[0.5px]">
                <div className="flex flex-col items-center gap-2.5 px-5 py-4 rounded-[6px] border border-white/5 bg-[#212121] shadow-2xl animate-modal-backdrop-in">
                  <div className="relative flex items-center justify-center">
                    <Brain className="h-5 w-5 text-white animate-pulse" />
                    {/* 微动环形加载条 */}
                    <div className="absolute -inset-2.5 rounded-full border border-white/10 border-t-white/80 animate-spin" />
                  </div>
                  <span className="text-[10px] text-white/40 font-bold tracking-[0.18em]">
                    CURATING...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </ToastProvider>
  );
};
