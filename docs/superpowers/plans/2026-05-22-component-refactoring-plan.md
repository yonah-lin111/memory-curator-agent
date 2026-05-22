# Component Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deconstruct the bloated `App.tsx` into modular React components (`Sidebar`, `MemoryList`, `MemoryDetail`) located in `src/renderer/src/components/`, while encapsulating types and mock data inside their respective components.

**Architecture:** Maintain unidirectional data flow where the root `App.tsx` acts as the thin layout shell coordinating global state (`activeTab`, `activeCategory`, `isSidebarCollapsed`, `selectedMemory`).

**Tech Stack:** React 19, TypeScript, Tailwind v4, Lucide-React.

---

### Task 1: Create Sidebar Component

**Files:**
- Create: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/components/Sidebar.tsx`

- [ ] **Step 1: Write Sidebar component implementation**
Create the component under `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/components/Sidebar.tsx` containing all Lucide icons, types, mock data (`MAIN_NAV_ITEMS`, `CURATION_CATEGORIES`), and the complete collapsible layout with the Notion-style hover transition and border-line button wrapper.

```typescript
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
```

---

### Task 2: Create MemoryList Component

**Files:**
- Create: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/components/MemoryList.tsx`

- [ ] **Step 1: Write MemoryList component implementation**
Create the component under `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/components/MemoryList.tsx` hosting its own types, full mock records data (`MOCK_MEMORIES`), first list search bar, filters and card mapping with selective state border rendering.

```typescript
import type React from 'react'
import { Plus, Search, Filter, Clock } from 'lucide-react'

/* ==========================================
 * TS 类型定义 (Interfaces & Types)
 * ========================================== */

/**
 * 记忆条目接口，存储记忆的属性与关联信息
 */
export interface MemoryItem {
  // 记忆唯一标识
  id: string
  // 记忆标题
  title: string
  // 记忆文本概要
  summary: string
  // 格式化的时间
  timestamp: string
  // 记忆来源渠道
  source: string
  // 标签列表
  tags: string[]
  // 记忆重要度权重
  weight: number
}

/**
 * MemoryList 组件属性接口
 */
export interface MemoryListProps {
  // 当前被选中的记忆 ID
  selectedMemoryId: string
  // 点击记忆卡片的回调，将整条记忆对象回传给外层 App 容器
  onMemorySelect: (memory: MemoryItem) => void
}

/* ==========================================
 * Static Mock Data
 * ========================================== */

const MOCK_MEMORIES: MemoryItem[] = [
  {
    id: 'mem-001',
    title: 'Electron 跨进程异步通信死锁排查',
    summary: '在开发高性能 Electron 桌面端应用时，发现 IPC 通信在进行大量大体积 JSON 传输时，会由于 V8 垃圾回收机制与 IPC 缓冲队列阻塞引发渲染进程暂时性死锁。最终解决方案是改用 SharedArrayBuffer 与本地双向 WebSocket 服务传递裸字节流，避免了 IPC 主线程的序列化负荷。',
    timestamp: '2026-05-22 14:32:01',
    source: 'GitHub Commit / Core',
    tags: ['Electron', 'IPC', 'Deadlock', 'Performance'],
    weight: 5
  },
  {
    id: 'mem-002',
    title: '第一性原理（First Principles）思维模型总结',
    summary: '物理学家埃隆·马斯克崇尚的思考模型：剥离事物的表象与既定常识，将事物拆解至最基础、最无法证伪的物理学定理或底层基本真理，然后以此为基石重新向上推导。对于软件架构设计，这意味着不盲信任何所谓的行业最佳实践，而是从 I/O 吞吐、硬件限制和具体算法复杂度重新核算最精妙的极简实现。',
    timestamp: '2026-05-21 09:15:30',
    source: 'Thought Log',
    tags: ['Mindset', 'FirstPrinciples', 'Architecture'],
    weight: 4
  },
  {
    id: 'mem-003',
    title: 'TypeScript 5.x 协变与逆变最佳实践',
    summary: '在严格逆变（strictFunctionTypes）模式下，探讨了泛型方法在多态接口设计中的深层表现。参数位置具有逆变性，返回值位置具有协变性。通过自定义 `type ReadonlyDeep<T>` 类型确保深层次属性完全只读，从而防止了在子类型多态赋值时引发的静默运行时类型崩溃。',
    timestamp: '2026-05-20 18:44:12',
    source: 'Dev Notes',
    tags: ['TypeScript', 'TypeSystem', 'BestPractice'],
    weight: 4
  },
  {
    id: 'mem-004',
    title: '本地 SQLite 数据库 WAL 模式高并发吞吐基准',
    summary: '通过配置 PRAGMA journal_mode = WAL 以及 PRAGMA synchronous = NORMAL，极大地释放了本地 SQLite 的高并发写操作性能。即使在 50 个多线程 Agent 并发进行日志与上下文持久化时，也能确保 0ms 的读阻塞与小于 2ms 的写延迟，是本地优先（Local-First）桌面应用的绝佳数据存储基底。',
    timestamp: '2026-05-19 11:20:55',
    source: 'Benchmark Spec',
    tags: ['SQLite', 'Database', 'WAL-Mode', 'Concurrency'],
    weight: 5
  },
  {
    id: 'mem-005',
    title: '基于 Rust 的本地大模型（LLM）推理吞吐调优',
    summary: '在使用 Llama.cpp 绑定进行本地 7B 模型 4-bit 量化推理时，针对 macOS M3 Max 芯片的统一内存进行了 Metal 编程接口优化。通过调整 batch_size 到 512 并将 KV Cache完全分配 in GPU VRAM 中，实现了每秒超过 65 个 Token 的闪电般极速生成体验。',
    timestamp: '2026-05-18 22:05:19',
    source: 'AI Lab',
    tags: ['Rust', 'LocalLLM', 'Metal', 'VRAM'],
    weight: 5
  },
  {
    id: 'mem-006',
    title: 'UI 设计准则：极简黑白灰设计的节奏与留白',
    summary: '高档的 UI/UX 不需要花哨的渐变或炫目的动效。通过精细的字重对比（例如 400 搭配 600）、精确到 4px/8px 倍数的间距节奏，以及绝对的主黑（#000000）与次黑（#212121）层级划分，利用微弱的白边（opacity 5%-10%）来切割空间，能让界面产生极强的现代高级感、秩序感与空间深邃感。',
    timestamp: '2026-05-17 16:10:00',
    source: 'UI Design Guideline',
    tags: ['DesignSystem', 'Minimalism', 'Typography'],
    weight: 3
  }
]

// 暴露第一条作为默认兜底项，保持 App 初始化极简化
export const DEFAULT_MEMORY = MOCK_MEMORIES[0]

/**
 * 记忆检索卡片列表组件
 */
export const MemoryList = ({
  selectedMemoryId,
  onMemorySelect
}: MemoryListProps): React.JSX.Element => {
  return (
    <div className="flex w-[400px] flex-col rounded-[6px] border border-white/5 bg-[#212121] overflow-hidden flex-shrink-0">
      <div className="flex flex-col gap-3 p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wider text-white">记忆流检索</h3>
          <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-white/10 hover:bg-white/5 cursor-pointer text-white/60 hover:text-white transition-all">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-white/40" />
          <input
            type="text"
            placeholder="搜索关键词、代码或关联实体..."
            className="w-full rounded-[6px] border border-white/5 bg-[#000000] py-2 pl-9 pr-4 text-sm text-white placeholder-white/30 focus:border-white/20 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-white/50">
          <Filter className="h-3.5 w-3.5" />
          <span className="hover:text-white cursor-pointer transition-all">近期优先</span>
          <span>•</span>
          <span className="hover:text-white cursor-pointer transition-all">高可信度</span>
          <span>•</span>
          <span className="hover:text-white cursor-pointer transition-all">按来源</span>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-[#000000]/20">
        {MOCK_MEMORIES.map((item) => {
          const isSelected = item.id === selectedMemoryId
          return (
            <div
              key={item.id}
              onClick={() => onMemorySelect(item)}
              className={`group relative flex flex-col gap-2.5 rounded-[6px] border p-3.5 cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-[#212121] border-white/20 shadow-md shadow-black/40'
                  : 'bg-[#212121]/40 border-white/5 hover:border-white/10 hover:bg-[#212121]/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-medium px-1.5 py-0.5 rounded-[4px] ${
                    isSelected ? 'bg-white/10 text-white' : 'bg-white/5 text-white/40 group-hover:text-white/60'
                  }`}
                >
                  {item.source}
                </span>
                <span className="text-white/30 font-mono flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.timestamp.slice(5, 16)}
                </span>
              </div>

              <h4
                className={`text-sm font-semibold tracking-wide transition-colors ${
                  isSelected ? 'text-white' : 'text-white/80 group-hover:text-white'
                }`}
              >
                {item.title}
              </h4>

              <p className="line-clamp-2 text-xs leading-relaxed text-white/50 group-hover:text-white/65 transition-colors">
                {item.summary}
              </p>

              <div className="flex flex-wrap gap-1 mt-0.5">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[4px] border border-white/5 bg-white/2 px-1.5 py-0.5 text-xs text-white/40 font-mono group-hover:text-white/50"
                  >
                    #{tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="text-xs text-white/30 flex items-center px-1">+{item.tags.length - 3}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

---

### Task 3: Create MemoryDetail Component

**Files:**
- Create: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/components/MemoryDetail.tsx`

- [ ] **Step 1: Write MemoryDetail component implementation**
Create the component under `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/components/MemoryDetail.tsx` which imports `MemoryItem` from `./MemoryList` and maps all detail nodes with bullet-proof style metrics.

```typescript
import type React from 'react'
import { Sparkles, Link, Trash2, Calendar, Cpu, Compass, Plus } from 'lucide-react'
import type { MemoryItem } from './MemoryList'

/**
 * MemoryDetail 组件属性接口
 */
export interface MemoryDetailProps {
  // 当前被选中的记忆详细实体数据
  selectedMemory: MemoryItem
}

/**
 * 记忆深度交互查看面板组件
 */
export const MemoryDetail = ({ selectedMemory }: MemoryDetailProps): React.JSX.Element => {
  return (
    <div className="flex flex-1 flex-col rounded-[6px] border border-white/5 bg-[#212121] overflow-hidden">
      <div className="flex h-14 items-center justify-between px-6 border-b border-white/5 bg-[#212121]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-white/50" />
          <span className="text-sm font-semibold tracking-widest text-white/60 uppercase">
            记忆策展全貌引擎 (Aeon Viewer)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-[6px] border border-white/5 bg-white/5 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white cursor-pointer transition-all">
            <Link className="h-3.5 w-3.5" />
            重新关联
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-white/10 text-white/40 hover:bg-red-500/10 hover:text-red-400 cursor-pointer transition-all">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1 rounded-[4px] bg-white/5 px-2 py-0.5 text-xs text-white/60 font-mono border border-white/5">
              <Calendar className="h-3.5 w-3.5 text-white/40" />
              {selectedMemory.timestamp}
            </span>
            <span className="rounded-[4px] bg-white/5 px-2 py-0.5 text-xs text-white/60 font-mono border border-white/5">
              信度权重: {'★'.repeat(selectedMemory.weight)}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-wide leading-snug text-white">
            {selectedMemory.title}
          </h1>
        </div>

        <div className="h-[1px] bg-white/5" />

        <div className="flex flex-col gap-3">
          <h5 className="text-xs font-bold tracking-widest text-white/40 uppercase flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-white/30" />
            策展核心摘要
          </h5>
          <div className="rounded-[6px] bg-[#000000]/40 border border-white/5 p-4.5">
            <p className="text-sm leading-relaxed text-white/80 whitespace-pre-line font-light">
              {selectedMemory.summary}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h5 className="text-xs font-bold tracking-widest text-white/40 uppercase flex items-center gap-2">
            <Compass className="h-3.5 w-3.5 text-white/30" />
            星图关联节点 (Entities)
          </h5>
          <div className="flex flex-wrap gap-2">
            {selectedMemory.tags.map((tag) => (
              <button
                key={tag}
                className="rounded-[6px] border border-white/5 bg-white/2 hover:bg-white/5 px-2.5 py-1.5 text-xs text-white/60 hover:text-white cursor-pointer transition-all duration-150 font-mono"
              >
                #{tag}
              </button>
            ))}
            <button className="flex items-center justify-center rounded-[6px] border border-dashed border-white/15 hover:border-white/35 px-2.5 py-1.5 text-xs text-white/40 hover:text-white cursor-pointer transition-all">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4.5 flex flex-col gap-2.5">
          <h6 className="text-xs font-semibold text-white/50 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-white/40" />
            AEON AI 策展行动建议
          </h6>
          <p className="text-xs leading-relaxed text-white/40 font-light">
            该本地记忆实体在 “{selectedMemory.tags[0]}” 节点链中权重较高。系统建议将其作为上下文快照在下一次 LLM 提示词合成中自动关联，以增强 Agent 在相关软件架构及系统调优上的精准度和召回深度。
          </p>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 4: Refactor App.tsx Component

**Files:**
- Modify: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/App.tsx`

- [ ] **Step 1: Replace App.tsx logic with clean child modular wrappers**
Rewrite `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/App.tsx` entirely to replace the single massive render structure with the modern assembled format.

```typescript
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
```

---

### Task 5: Compilation and Verification check

- [ ] **Step 1: Execute compiler type validation check**
Run `pnpm typecheck` locally to confirm TS compilation passes.

Run: `pnpm typecheck`
Expected: Done, 0 warnings, 0 errors.
