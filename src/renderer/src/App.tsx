import type React from 'react'
import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { MemoryList, DEFAULT_MEMORY } from './components/MemoryList'
import { MemoryDetail } from './components/MemoryDetail'
import type { MemoryItem } from './components/MemoryList'

/**
 * 记忆策展 Agent 的主应用页面布局组件。
 * 已彻底重构并拆分为高内聚的 Sidebar, MemoryList, 与 MemoryDetail 子组件。
 */
export const App = (): React.JSX.Element => {
  // 选中的主导航项 ID
  const [activeTab, setActiveTab] = useState<string>('workbench')
  // 选中的记忆分类 ID
  const [activeCategory, setActiveCategory] = useState<string>('all')
  // 控制左侧边栏是否折叠
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false)
  // 当前选中的记忆详情实体对象
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem>(DEFAULT_MEMORY)

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#000000] p-3 gap-3 text-white antialiased">
      {/* 左侧极致多维导航栏 */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        isSidebarCollapsed={isSidebarCollapsed}
        onSidebarCollapseChange={setIsSidebarCollapsed}
      />

      {/* 右侧核心内容：记忆卡片流 + 记忆深度检索查看面板 */}
      <section className="flex flex-1 gap-3 overflow-hidden">
        {/* 中间检索卡片列表 */}
        <MemoryList selectedMemoryId={selectedMemory.id} onMemorySelect={setSelectedMemory} />

        {/* 右侧详情全貌展现 */}
        <MemoryDetail selectedMemory={selectedMemory} />
      </section>
    </main>
  )
}
