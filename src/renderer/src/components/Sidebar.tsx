import type React from 'react'
import {
  BookOpen,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  Home,
  Layers,
  Settings,
  Sparkles
} from 'lucide-react'

/* ==========================================
 * TS 类型定义 (Interfaces & Types)
 * ========================================== */

// 主导航项类型，描述左侧应用级入口。
type NavigationItem = {
  // 导航项唯一标识。
  id: string
  // 导航项显示名称。
  label: string
  // 导航项辅助说明。
  description: string
  // 导航项图标组件。
  icon: React.ComponentType<{ className?: string }>
}

// 导航分组类型，描述产品使用节奏下的入口集合。
type NavigationGroup = {
  // 分组唯一标识。
  id: string
  // 分组显示名称。
  label: string
  // 分组下的导航项。
  items: NavigationItem[]
}

// 周日期项类型，描述 Today 页面中的日期定位入口。
type WeekDateItem = {
  // 星期短名称。
  weekday: string
  // 日期数字。
  day: string
  // 是否为当前选中日期。
  active: boolean
}

// Sidebar 组件属性类型，描述左侧栏折叠状态与切换入口。
type SidebarProps = {
  // 当前左侧栏是否处于折叠状态。
  isCollapsed: boolean
  // 左侧栏折叠状态改变回调。
  onCollapsedChange: (collapsed: boolean) => void
}

/* ==========================================
 * 静态 Mock 数据 (Static Mock Data)
 * ========================================== */

// 左侧主导航分组静态数据。
const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    id: 'daily',
    label: 'DAILY',
    items: [{ id: 'today', label: 'Today', description: '计划 / 随记 / 日记', icon: Home }]
  },
  {
    id: 'library',
    label: 'LIBRARY',
    items: [
      { id: 'notes', label: 'Notes', description: '自由笔记列表', icon: FileText },
      { id: 'journal', label: 'Journal', description: '日记条目回看', icon: BookOpen }
    ]
  },
  {
    id: 'curation',
    label: 'CURATION',
    items: [
      { id: 'weekly', label: 'Weekly Review', description: '周度策展', icon: CalendarDays },
      { id: 'themes', label: 'Themes', description: '长期主题追踪', icon: Layers },
      { id: 'memories', label: 'Memories', description: '记忆片段关联', icon: Sparkles }
    ]
  }
]

// 当前周日期静态数据（当前聚焦在 2026-05-25 周一）。
const WEEK_DATES: WeekDateItem[] = [
  { weekday: 'Tue', day: '19', active: false },
  { weekday: 'Wed', day: '20', active: false },
  { weekday: 'Thu', day: '21', active: false },
  { weekday: 'Fri', day: '22', active: false },
  { weekday: 'Sat', day: '23', active: false },
  { weekday: 'Sun', day: '24', active: false },
  { weekday: 'Mon', day: '25', active: true }
]

/**
 * Sidebar 组件 - 负责左侧多维导航栏与周日期选择定位。
 * 仅提供侧栏折叠交互，其余导航信息保持静态展示。
 */
export const Sidebar = ({ isCollapsed, onCollapsedChange }: SidebarProps): React.JSX.Element => {
  return (
    <div className="relative flex h-auto lg:h-full flex-shrink-0">
      <aside
        className={`w-full h-auto lg:h-full flex flex-col justify-between rounded-[6px] border border-white/5 bg-[#212121] select-none flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:w-16 p-3 items-center' : 'lg:w-64 p-4'
        }`}
      >
        <div className="flex flex-col gap-5 w-full">
          {/* 产品标识头 */}
          <div className={`flex items-center gap-3 px-1 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] bg-white text-black">
              <Brain className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <h2 className="text-xs font-semibold tracking-wider text-white whitespace-nowrap">
                  MEMORY CURATOR
                </h2>
                <span className="text-[9px] tracking-widest text-white/40 uppercase font-mono whitespace-nowrap">
                  LOCAL FIRST DESKTOP
                </span>
              </div>
            )}
          </div>

          {/* 应用级主导航按使用节奏分组，避免入口平铺成普通工具列表。 */}
          <nav className="flex flex-col gap-3 w-full" aria-label="侧边栏主导航">
            {NAVIGATION_GROUPS.map((group) => (
              <section key={group.id} className="flex flex-col gap-1.5">
                {!isCollapsed && (
                  <h3 className="px-1 text-[9px] font-bold tracking-[0.18em] text-white/30">
                    {group.label}
                  </h3>
                )}
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = item.id === 'today'

                    return (
                      <div
                        key={item.id}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex w-full items-center rounded-[6px] transition-all duration-150 ${
                          isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                        } ${isActive ? 'bg-white text-black font-semibold' : 'text-white/60'}`}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-black' : 'text-white/50'}`} />
                        {!isCollapsed && (
                          <div className="flex min-w-0 flex-col items-start text-left">
                            <span className="text-xs font-bold leading-none">{item.label}</span>
                            <span className={`mt-1 text-[9px] leading-none ${isActive ? 'text-black/60 font-medium' : 'text-white/30'}`}>
                              {item.description}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </nav>

          {!isCollapsed && (
            <>
              {/* 分割线 */}
              <div className="h-[1px] bg-white/5" />

              {/* 周定位卡片保持静态，服务 Today 页面上下文。 */}
              <div className="flex flex-col gap-2 rounded-[6px] border border-white/5 bg-white/[0.02] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">
                    2026 MAY
                  </span>
                  <span className="text-[9px] font-mono text-white/25">WEEK 22</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {WEEK_DATES.map((d) => (
                    <div
                      key={d.day}
                      className={`flex flex-col items-center justify-center py-1.5 rounded-[6px] transition-all duration-150 ${
                        d.active ? 'bg-white text-black font-bold' : 'text-white/40'
                      }`}
                    >
                      <span className={`text-[8px] uppercase font-bold ${d.active ? 'text-black/50' : 'text-white/20'}`}>
                        {d.weekday[0]}
                      </span>
                      <span className="mt-1 text-xs font-mono font-bold leading-none">
                        {d.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {isCollapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-white/5 bg-white text-xs font-bold text-black">
              25
            </div>
          )}
        </div>

        {/* 底部本地优先隐私引擎状态 */}
        <div className="mt-auto flex flex-col gap-2.5 pt-4 border-t border-white/5 w-full">
          {isCollapsed ? (
            <div className="flex flex-col gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-white/[0.02] border border-white/5">
                <Database className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-white/[0.02] border border-white/5 text-white/45">
                <Settings className="h-3.5 w-3.5" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 rounded-[6px] bg-white/[0.02] border border-white/5 p-2.5">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-white/80">Local Vault</span>
                </div>
                <div className="flex flex-col gap-1 pl-5 text-[10px] text-white/40 font-mono">
                  <div className="flex items-center gap-1.5">
                    <Clock3 className="h-3 w-3 text-white/30" />
                    <span>Last saved: Today 21:45</span>
                  </div>
                  <span>Storage: Local-first</span>
                  <span>Agent: Curation standby</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-[10px] text-white/35">
                <Settings className="h-3.5 w-3.5" />
                <span>Settings</span>
              </div>
            </>
          )}
        </div>
      </aside>

      <button
        type="button"
        aria-label={isCollapsed ? '展开左侧导航栏' : '折叠左侧导航栏'}
        onClick={() => onCollapsedChange(!isCollapsed)}
        className="absolute top-1/2 right-0 z-20 flex h-6 w-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#212121] text-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
      >
        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </div>
  )
}
