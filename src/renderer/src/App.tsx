import type React from 'react'
import { useState } from 'react'
import { AgentPanel } from './components/AgentPanel'
import { JournalPage } from './components/pages/JournalPage'
import { MemoriesPage } from './components/pages/MemoriesPage'
import { NotesPage } from './components/pages/NotesPage'
import { ThemesPage } from './components/pages/ThemesPage'
import { WeeklyReviewPage } from './components/pages/WeeklyReviewPage'
import { Sidebar, type SidebarPageId } from './components/Sidebar'
import { TodayWorkspace } from './components/TodayWorkspace'

/**
 * 记忆策展 Agent 的 Today 三栏工作台页面主布局。
 * 通过响应式 Flex 布局，在移动端垂直堆叠并开启自适应滚动，在桌面端（lg 及以上）平铺为经典三栏并限制整屏滚动。
 */
export const App = (): React.JSX.Element => {
  // 左侧导航栏折叠状态。
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false)
  // 当前中间主内容页面。
  const [activePage, setActivePage] = useState<SidebarPageId>('today')
  // 右侧 Agent 策展栏折叠状态。
  const [isAgentPanelCollapsed, setIsAgentPanelCollapsed] = useState<boolean>(true)

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
    <main className="flex flex-col lg:flex-row h-screen w-screen bg-[#000000] p-3 gap-3 text-white antialiased overflow-y-auto lg:overflow-hidden">
      {/* 左侧多维导航栏 */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        activePage={activePage}
        onCollapsedChange={setIsSidebarCollapsed}
        onPageChange={setActivePage}
      />

      {/* 中间 Today 主工作区 */}
      {renderActivePage()}

      {/* 右侧 Agent 智能策展栏 */}
      <AgentPanel isCollapsed={isAgentPanelCollapsed} onCollapsedChange={setIsAgentPanelCollapsed} />
    </main>
  )
}
