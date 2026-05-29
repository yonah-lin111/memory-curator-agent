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
import { Header } from "@renderer/components/layout/Header";
import { TodayPage } from "@renderer/pages/TodayPage";
import { ToastProvider } from "@renderer/components/ui/Toast";
import { AiChatWorkspace } from "@renderer/components/layout/AiChatWorkspace";
import { AI_CHAT_SESSIONS, type AiChatSession } from "@renderer/components/layout/aiChatMock";

/**
 * 记忆策展 Agent 的主应用布局。
 * 通过左侧导航与中间页面区域组织日输入、策展回顾和 Agent 编写页面。
 */
export const App = (): React.JSX.Element => {
  // 左侧导航栏折叠状态。
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // AI 对话模式打开状态。
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  // AI 对话会话列表。
  const [chatSessions, setChatSessions] = useState<AiChatSession[]>(AI_CHAT_SESSIONS);

  // 当前激活的 AI 对话会话标识。
  const [activeChatId, setActiveChatId] = useState<string>(AI_CHAT_SESSIONS[0].id);

  // 当前激活的 AI 对话会话。
  const activeChatSession =
    chatSessions.find((session) => session.id === activeChatId) ??
    chatSessions[0];

  /**
   * 切换 AI 对话模式。
   */
  const handleChatToggle = (): void => {
    setIsChatOpen((current) => !current);
  };

  /**
   * 新建 AI 对话会话并自动切换激活。
   * 保证新创建的空白对话仅存在一个，若已存在空白对话则直接激活该对话，避免重复创建。
   */
  const handleNewChat = (): void => {
    const existingEmptySession = chatSessions.find((session) => session.messages.length === 0);
    if (existingEmptySession) {
      setActiveChatId(existingEmptySession.id);
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const newSession: AiChatSession = {
      id: `session-${Date.now()}`,
      title: "新建对话",
      summary: "暂无对话内容",
      time: timeStr,
      status: "等待输入",
      messages: [],
    };
    // 将新会话插到最前面，保证最新创建的对话排在最上方。
    setChatSessions((prev) => [newSession, ...prev]);
    setActiveChatId(newSession.id);
  };

  /**
   * 发送用户消息并触发 AI 模拟回答。
   */
  const handleSendMessage = (text: string): void => {
    const userTime = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user" as const,
      content: text,
      time: userTime,
    };

    // 1. 更新当前会话，添加用户消息。如果当前会话处于初始状态，自动更新标题与摘要。
    setChatSessions((prevSessions) => {
      return prevSessions.map((session) => {
        if (session.id === activeChatId) {
          const isNewSession = session.title === "新建对话" && session.messages.length === 0;
          return {
            ...session,
            title: isNewSession
              ? text.slice(0, 15) + (text.length > 15 ? "..." : "")
              : session.title,
            summary: isNewSession ? text : session.summary,
            messages: [...session.messages, userMessage],
          };
        }
        return session;
      });
    });

    // 2. 延迟 1 秒触发 AI 模拟回复。
    setTimeout(() => {
      const aiTime = new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // 根据用户 query 的关键词选择最切合的模拟回复
      const textLower = text.toLowerCase();
      let steps: any[] = [];
      let answerText = "";

      if (textLower.includes("todo") || textLower.includes("待办") || textLower.includes("任务")) {
        steps = [
          {
            id: `step-${Date.now()}-1`,
            title: "任务筛选与规划",
            status: "done" as const,
            tool: "Plan",
            observation: "解析待办列表相关的条目类型。",
          },
          {
            id: `step-${Date.now()}-2`,
            title: "查询本地待办",
            status: "done" as const,
            tool: "local_database.query_todos",
            observation: "在本地 Drizzle SQLite 数据库中检索到 5 条未完成的待办任务。",
          },
          {
            id: `step-${Date.now()}-3`,
            title: "分析任务优先级",
            status: "done" as const,
            tool: "curator.analyze",
            observation: "提炼出其中属于今日视图（Today）的核心事项并做好标记。",
          },
        ];
        answerText = "帮您查询并整理了当前的待办任务。目前有几条未完成的任务，建议您优先处理今日视图下的核心事项，并及时在侧边栏的 Todo 页面中打勾归档。";
      } else if (textLower.includes("笔记") || textLower.includes("notes") || textLower.includes("随记")) {
        steps = [
          {
            id: `step-${Date.now()}-1`,
            title: "笔记检索定位",
            status: "done" as const,
            tool: "Plan",
            observation: "定位与该主题相关的自由笔记和随手闪念随记。",
          },
          {
            id: `step-${Date.now()}-2`,
            title: "检索本地笔记",
            status: "done" as const,
            tool: "notes.search",
            observation: "检索到 2 篇与当前话题相关的深度笔记条目。",
          },
          {
            id: `step-${Date.now()}-3`,
            title: "关联记忆片段",
            status: "done" as const,
            tool: "notes.link",
            observation: "构建该笔记与今日主题的多维关联双向线索。",
          },
        ];
        answerText = "已为您检索并关联了相关笔记。本地优先的记忆已保存在本地数据库中，您可以随时在 Notes 或 Snippets 页面进行详细的查看、编辑与沉淀。";
      } else {
        steps = [
          {
            id: `step-${Date.now()}-1`,
            title: "定位本地数据源和策略",
            status: "done" as const,
            tool: "Plan",
            observation: "分析用户的对话意图，准备检索相关数据库。",
          },
          {
            id: `step-${Date.now()}-2`,
            title: "搜索记忆片段",
            status: "done" as const,
            tool: "local_memory.search",
            observation: "检索到 3 个相关的上下文，包含本地随记和历史记录。",
          },
          {
            id: `step-${Date.now()}-3`,
            title: "整合并提炼结果",
            status: "done" as const,
            tool: "curator.compose",
            observation: "根据检索到的数据进行内容归纳，撰写高质量总结。",
          },
        ];
        answerText = "我已经通过本地 ReAct 流程帮您分析了该请求。作为本地优先的记忆策展 Agent，我会持续追踪和整理您的信息线索。如有具体需要执行的操作，随时告诉我！";
      }

      const aiMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant" as const,
        content: `正在为您调用工具处理："${text}"...`,
        time: aiTime,
        toolSteps: steps,
        answer: answerText,
      };

      setChatSessions((prevSessions) => {
        return prevSessions.map((session) => {
          if (session.id === activeChatId) {
            return {
              ...session,
              messages: [...session.messages, aiMessage],
            };
          }
          return session;
        });
      });
    }, 1000);
  };

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
          />

          <div className="flex-1 min-h-0 relative overflow-hidden">
            <div
              className={`absolute inset-0 transition-all duration-300 ease-out ${
                isChatOpen
                  ? "pointer-events-none opacity-0 scale-[0.98] -translate-y-8"
                  : "pointer-events-auto opacity-100 scale-100 translate-y-0"
              }`}
              aria-hidden={isChatOpen}
            >
              <div className="w-full h-full">{renderActivePage()}</div>
            </div>

            <div
              className={`absolute inset-0 transition-all duration-300 ease-out ${
                isChatOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-12 opacity-0"
              }`}
              aria-hidden={!isChatOpen}
            >
              <AiChatWorkspace session={activeChatSession} onSendMessage={handleSendMessage} />
            </div>
          </div>
        </div>
      </main>
    </ToastProvider>
  );
};
