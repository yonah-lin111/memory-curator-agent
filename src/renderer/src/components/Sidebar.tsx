import type React from 'react'
import {
  Brain,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  GitBranch,
  Settings
} from 'lucide-react'

/* ==========================================
 * TS 类型定义 (Interfaces & Types)
 * ========================================== */

/**
 * 导航项接口，用于左侧核心功能切换
 */
interface NavItem {
  // 唯一标识
  id: string
  // 导航项名称
  label: string
  // 图标组件
  icon: React.ComponentType<{ className?: string }>
}

/**
 * 记忆策展分类接口
 */
interface CurationCategory {
  // 分类唯一标识
  id: string
  // 分类名称
  name: string
  // 记忆数量
  count: number
}

/**
 * Sidebar 组件属性接口
 */
export interface SidebarProps {
  // 当前选中的核心导航项 ID
  activeTab: string
  // 主导航项切换回调
  onTabChange: (tabId: string) => void
  // 当前选中的记忆分类 ID
  activeCategory: string
  // 记忆分类切换回调
  onCategoryChange: (categoryId: string) => void
  // 侧边栏是否折叠
  isSidebarCollapsed: boolean
  // 侧边栏折叠/展开状态改变回调
  onSidebarCollapseChange: (collapsed: boolean) => void
}

/* ==========================================
 * Static Data
 * ========================================== */

const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'workbench', label: '记忆策展工作台', icon: Brain },
  { id: 'matrix', label: '多维记忆矩阵', icon: Layers },
  { id: 'relations', label: '神经关联图谱', icon: GitBranch },
  { id: 'settings', label: '系统引擎配置', icon: Settings }
]

const CURATION_CATEGORIES: CurationCategory[] = [
  { id: 'all', name: '全部存储记忆', count: 189 },
  { id: 'core', name: '高亮核心记忆', count: 12 },
  { id: 'tech', name: '专业技术沉淀', count: 48 },
  { id: 'emotion', name: '情绪与感知锚点', count: 9 },
  { id: 'projects', name: '工程项目规约', count: 65 },
  { id: 'fleeting', name: '闪念与灵感碎屑', count: 55 },
  { id: 'archives', name: '陈旧冷归档记忆', count: 210 }
]

/**
 * 精美多维侧边栏导航组件（支持 Notion 风格极简折叠过渡）
 */
export const Sidebar = ({
  activeTab,
  onTabChange,
  activeCategory,
  onCategoryChange,
  isSidebarCollapsed,
  onSidebarCollapseChange
}: SidebarProps): React.JSX.Element => {
  return (
    <div className="relative flex h-full flex-shrink-0">
      <aside
        className={`flex flex-col justify-between rounded-[6px] border border-white/5 bg-[#212121] transition-all duration-300 ease-in-out overflow-hidden select-none ${
          isSidebarCollapsed ? 'w-16 p-3 items-center' : 'w-64 p-4'
        }`}
      >
        <div className="flex flex-col gap-6 w-full">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] bg-white text-black">
                <Brain className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold tracking-wider text-white whitespace-nowrap">MEMORY CURATOR</h2>
                <span className="text-xs tracking-widest text-white/40 uppercase font-mono whitespace-nowrap">A E O N 0.1.0</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] bg-white text-black">
                <Brain className="h-5 w-5" />
              </div>
            </div>
          )}

          <nav className="flex flex-col gap-1 w-full items-center">
            {MAIN_NAV_ITEMS.map((item) => {
              const IconComponent = item.icon
              const isActive = activeTab === item.id
              return !isSidebarCollapsed ? (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm font-medium tracking-wide transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-black font-semibold'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <IconComponent className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-black' : 'text-white/60'}`} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              ) : (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex h-10 w-10 items-center justify-center rounded-[6px] transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-black'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <IconComponent className={`h-5 w-5 ${isActive ? 'text-black' : 'text-white/60'}`} />
                </button>
              )
            })}
          </nav>

          {!isSidebarCollapsed && (
            <>
              <div className="h-[1px] bg-white/5" />
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 px-3 text-xs font-semibold tracking-widest text-white/40 uppercase whitespace-nowrap">
                  <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                  策展多维分类
                </span>

                <div className="custom-scrollbar max-h-[45vh] overflow-y-auto pr-1 flex flex-col gap-1">
                  {CURATION_CATEGORIES.map((cat) => {
                    const isActive = activeCategory === cat.id
                    return (
                      <button
                        key={cat.id}
                        onClick={() => onCategoryChange(cat.id)}
                        className={`group flex items-center justify-between rounded-[6px] px-3 py-2 text-left text-sm transition-all duration-150 cursor-pointer ${
                          isActive
                            ? 'bg-white/10 text-white font-medium'
                            : 'text-white/50 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate whitespace-nowrap">{cat.name}</span>
                        <span
                          className={`rounded-[4px] px-1.5 py-0.5 text-xs font-mono transition-all ${
                            isActive
                              ? 'bg-white text-black font-bold'
                              : 'bg-white/5 text-white/30 group-hover:bg-white/10 group-hover:text-white/50'
                          }`}
                        >
                          {cat.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-white/5 w-full">
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 rounded-[6px] bg-white/5 p-2.5">
                <div className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </div>
                <span className="text-xs text-white/40 font-mono truncate whitespace-nowrap">SQLite (WAL) • Llama-7B</span>
              </div>
              <div className="flex items-center justify-between px-1 text-xs text-white/30 whitespace-nowrap">
                <span className="whitespace-nowrap">存储占用: 4.8 GB</span>
                <span className="whitespace-nowrap">已策展: 82.5%</span>
              </div>
            </>
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-white/5 cursor-help"
              title="引擎正常运行 • SQLite (WAL) • Llama-7B • 存储占用 4.8 GB • 已策展 82.5%"
            >
              <div className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </div>
            </div>
          )}
        </div>
      </aside>

      <button
        onClick={() => onSidebarCollapseChange(!isSidebarCollapsed)}
        className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#212121] hover:bg-[#333333] cursor-pointer text-white/80 hover:text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200"
        title={isSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {isSidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
