import type React from 'react'
import { useState, useEffect } from 'react'
import { JournalPage } from '@renderer/pages/JournalPage'
import { MemoriesPage } from '@renderer/pages/MemoriesPage'
import { NotesPage } from '@renderer/pages/NotesPage'
import { ThemesPage } from '@renderer/pages/ThemesPage'
import { WeeklyReviewPage } from '@renderer/pages/WeeklyReviewPage'
import { Sidebar, type SidebarPageId } from '@renderer/components/layout/Sidebar'
import { TodayWorkspace } from '@renderer/pages/TodayWorkspace'
import { ToastProvider } from '@renderer/components/ui/Toast'

/**
 * 记忆策展 Agent 的主应用布局。
 * 通过左侧导航与中间页面区域组织日输入、策展回顾和 Agent 编写页面。
 */
export const App = (): React.JSX.Element => {
  // 左侧导航栏折叠状态。
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false)

  // 根据当前 URL pathname 获取初始页面标识，默认为 'today'。
  const getPageFromPathname = (): SidebarPageId => {
    const path = window.location.pathname.replace(/^\/|\/$/g, '')
    const validPages: SidebarPageId[] = ['today', 'notes', 'journal', 'weekly', 'themes', 'memories']
    if (validPages.includes(path as SidebarPageId)) {
      return path as SidebarPageId
    }
    return 'today'
  }

  // 当前中间主内容页面。
  const [activePage, setActivePage] = useState<SidebarPageId>(getPageFromPathname)

  // 监听 URL 路由 pathname 变化，确保与页面状态双向同步。
  useEffect(() => {
    const handlePopState = () => {
      const page = getPageFromPathname()
      setActivePage(page)
    }

    // 初始化如果 pathname 为根路径，则默认写入 /today 路由
    const initialPath = window.location.pathname
    if (initialPath === '/' || initialPath === '') {
      window.history.replaceState({}, '', '/today')
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])
  /**
   * 根据当前侧栏页面渲染中间主内容。
   */
  const renderActivePage = (): React.JSX.Element => {
    switch (activePage) {
      case 'today':
        return <TodayWorkspace />
      case 'notes':
        return <NotesPage />
      case 'journal':
        return <JournalPage />
      case 'weekly':
        return <WeeklyReviewPage />
      case 'themes':
        return <ThemesPage />
      case 'memories':
        return <MemoriesPage />
    }
  }

  return (
    <ToastProvider>
      <main className="flex flex-col lg:flex-row h-screen w-screen bg-[#000000] p-3 gap-3 text-white antialiased overflow-y-auto lg:overflow-hidden">
        {/* 左侧多维导航栏 */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          activePage={activePage}
          onCollapsedChange={setIsSidebarCollapsed}
          onPageChange={(pageId) => {
            window.history.pushState({}, '', `/${pageId}`)
            setActivePage(pageId)
          }}
        />

        {/* 中间主工作区 */}
        {renderActivePage()}
      </main>
    </ToastProvider>
  )
}
