import type React from 'react'
import { useState } from 'react'
import {
  Brain,
  Layers,
  GitBranch,
  Settings,
  FolderOpen,
  Plus,
  Clock,
  Compass,
  Link,
  Cpu,
  Trash2,
  Calendar,
  Sparkles,
  Search,
  Filter
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
 * 记忆条目接口，存储记忆的属性与关联信息
 */
interface MemoryItem {
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

/* ==========================================
 * Mock 静态数据 (Mock Data)
 * ========================================== */

// 左侧主导航菜单项列表
const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'workbench', label: '记忆策展工作台', icon: Brain },
  { id: 'matrix', label: '多维记忆矩阵', icon: Layers },
  { id: 'relations', label: '神经关联图谱', icon: GitBranch },
  { id: 'settings', label: '系统引擎配置', icon: Settings }
]

// 记忆分类层级
const CURATION_CATEGORIES: CurationCategory[] = [
  { id: 'all', name: '全部存储记忆', count: 189 },
  { id: 'core', name: '高亮核心记忆', count: 12 },
  { id: 'tech', name: '专业技术沉淀', count: 48 },
  { id: 'emotion', name: '情绪与感知锚点', count: 9 },
  { id: 'projects', name: '工程项目规约', count: 65 },
  { id: 'fleeting', name: '闪念与灵感碎屑', count: 55 },
  { id: 'archives', name: '陈旧冷归档记忆', count: 210 }
]

// 精美记忆卡片列表（充沛的数据展示滚动条滚动）
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
    summary: '在使用 Llama.cpp 绑定进行本地 7B 模型 4-bit 量化推理时，针对 macOS M3 Max 芯片的统一内存进行了 Metal 编程接口优化。通过调整 batch_size 到 512 并将 KV Cache 完全分配在 GPU VRAM 中，实现了每秒超过 65 个 Token 的闪电般极速生成体验。',
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

/* ==========================================
 * 主组件 (Main App Component)
 * ========================================== */

/**
 * 记忆策展 Agent 的主应用页面布局组件。
 * 包含左侧精致导航面板，中间记忆选择容器，右侧记忆深度交互查看器。
 * 每一个独立面板均配置了符合 #000000 与 #212121 纯黑质感的 6px 圆角精致滚动条。
 */
export const App = (): React.JSX.Element => {
  // 选中的主导航项 ID
  const [activeTab, setActiveTab] = useState<string>('workbench')
  // 选中的记忆分类 ID
  const [activeCategory, setActiveCategory] = useState<string>('all')
  // 选中的记忆 ID（默认选中第一个）
  const [selectedMemoryId, setSelectedMemoryId] = useState<string>('mem-001')

  // 获取当前选中的完整记忆详情
  const selectedMemory = MOCK_MEMORIES.find((m) => m.id === selectedMemoryId) || MOCK_MEMORIES[0]

  /**
   * 处理主导航切换
   * @param tabId 导航项 ID
   */
  const handleTabChange = (tabId: string): void => {
    setActiveTab(tabId)
  }

  /**
   * 处理记忆分类切换
   * @param categoryId 分类 ID
   */
  const handleCategoryChange = (categoryId: string): void => {
    setActiveCategory(categoryId)
  }

  /**
   * 处理记忆条目选择
   * @param memoryId 记忆 ID
   */
  const handleMemorySelect = (memoryId: string): void => {
    setSelectedMemoryId(memoryId)
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#000000] p-3 text-white antialiased">
      {/* 1. 左侧导航面板 (Sidebar Navigation Panel) */}
      <aside className="flex w-64 flex-col justify-between rounded-[6px] border border-white/5 bg-[#212121] p-4 transition-all duration-300">
        {/* 顶部 Brand / Logo 区域 */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-white text-black">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wider text-white">MEMORY CURATOR</h2>
              <span className="text-[10px] tracking-widest text-white/40 uppercase">A E O N 0.1.0</span>
            </div>
          </div>

          {/* 核心功能导航菜单 */}
          <nav className="flex flex-col gap-1">
            {MAIN_NAV_ITEMS.map((item) => {
              const IconComponent = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-xs font-medium tracking-wide transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-black font-semibold'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <IconComponent className={`h-4 w-4 ${isActive ? 'text-black' : 'text-white/60'}`} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* 装饰用分割线 */}
          <div className="h-[1px] bg-white/5" />

          {/* 记忆库多级分类（带精致滚动条的独立滚动区域） */}
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 px-3 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
              <FolderOpen className="h-3.5 w-3.5" />
              策展多维分类
            </span>

            {/* 可滚动分类容器 */}
            <div className="custom-scrollbar max-h-[30vh] overflow-y-auto pr-1 flex flex-col gap-1">
              {CURATION_CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`group flex items-center justify-between rounded-[6px] px-3 py-2 text-left text-xs transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-white/50 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span
                      className={`rounded-[4px] px-1.5 py-0.5 text-[9px] font-mono transition-all ${
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
        </div>

        {/* 底部引擎运行状态及信息 */}
        <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2.5 rounded-[6px] bg-white/5 p-2.5">
            <div className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white/80">本地推理节点就绪</span>
              <span className="text-[8px] text-white/40 font-mono">SQLite (WAL) • Llama-7B</span>
            </div>
          </div>
          <div className="flex items-center justify-between px-1 text-[10px] text-white/30">
            <span>存储占用: 4.8 GB</span>
            <span>已策展: 82.5%</span>
          </div>
        </div>
      </aside>

      {/* 右侧整体内容区（通过 gap 分割，保证完美的现代设计感） */}
      <section className="flex flex-1 gap-3 overflow-hidden pl-1">
        
        {/* 2. 中间记忆卡片流容器 (Memory List Panel) */}
        <div className="flex w-[400px] flex-col rounded-[6px] border border-white/5 bg-[#212121] overflow-hidden">
          {/* 中间栏顶部：搜索与过滤器 */}
          <div className="flex flex-col gap-3 p-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wider text-white">记忆流检索</h3>
              <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-white/10 hover:bg-white/5 cursor-pointer text-white/60 hover:text-white transition-all">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            
            {/* 极简搜索框 */}
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-3.5 w-3.5 text-white/40" />
              <input
                type="text"
                placeholder="搜索关键词、代码或关联实体..."
                className="w-full rounded-[6px] border border-white/5 bg-[#000000] py-2 pl-9 pr-4 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none transition-all"
              />
            </div>

            {/* 过滤微调标签 */}
            <div className="flex items-center gap-2 text-[10px] text-white/50">
              <Filter className="h-3 w-3" />
              <span className="hover:text-white cursor-pointer transition-all">近期优先</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer transition-all">高可信度</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer transition-all">按来源</span>
            </div>
          </div>

          {/* 独立精致滚动条的卡片列表区域 */}
          <div className="custom-scrollbar flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-[#000000]/20">
            {MOCK_MEMORIES.map((item) => {
              const isSelected = item.id === selectedMemoryId
              return (
                <div
                  key={item.id}
                  onClick={() => handleMemorySelect(item.id)}
                  className={`group relative flex flex-col gap-2.5 rounded-[6px] border p-3.5 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#212121] border-white/20 shadow-md shadow-black/40'
                      : 'bg-[#212121]/40 border-white/5 hover:border-white/10 hover:bg-[#212121]/80'
                  }`}
                >
                  {/* 卡片头部：来源与时间 */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`font-medium px-1.5 py-0.5 rounded-[4px] ${
                      isSelected ? 'bg-white/10 text-white' : 'bg-white/5 text-white/40 group-hover:text-white/60'
                    }`}>
                      {item.source}
                    </span>
                    <span className="text-white/30 font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.timestamp.slice(5, 16)}
                    </span>
                  </div>

                  {/* 卡片标题 */}
                  <h4 className={`text-xs font-semibold tracking-wide transition-colors ${
                    isSelected ? 'text-white' : 'text-white/80 group-hover:text-white'
                  }`}>
                    {item.title}
                  </h4>

                  {/* 卡片简短摘要 */}
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-white/50 group-hover:text-white/65 transition-colors">
                    {item.summary}
                  </p>

                  {/* 卡片底部标签 */}
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[4px] border border-white/5 bg-white/2 px-1.5 py-0.5 text-[9px] text-white/40 font-mono group-hover:text-white/50"
                      >
                        #{tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-[9px] text-white/30 flex items-center px-1">
                        +{item.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. 右侧记忆深度查看面板 (Memory Detail Viewer Panel) */}
        <div className="flex flex-1 flex-col rounded-[6px] border border-white/5 bg-[#212121] overflow-hidden">
          {/* 面板头部操作区 */}
          <div className="flex h-14 items-center justify-between px-6 border-b border-white/5 bg-[#212121]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/50" />
              <span className="text-xs font-semibold tracking-widest text-white/60 uppercase">
                记忆策展全貌引擎 (Aeon Viewer)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 rounded-[6px] border border-white/5 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white cursor-pointer transition-all">
                <Link className="h-3.5 w-3.5" />
                重新关联
              </button>
              <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-white/10 text-white/40 hover:bg-red-500/10 hover:text-red-400 cursor-pointer transition-all">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 深度阅读展示区（独立精致滚动条的独立滚动区域） */}
          <div className="custom-scrollbar flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            
            {/* 顶标题与元数据 */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1 rounded-[4px] bg-white/5 px-2 py-0.5 text-[10px] text-white/60 font-mono border border-white/5">
                  <Calendar className="h-3.5 w-3.5 text-white/40" />
                  {selectedMemory.timestamp}
                </span>
                <span className="rounded-[4px] bg-white/5 px-2 py-0.5 text-[10px] text-white/60 font-mono border border-white/5">
                  信度权重: {'★'.repeat(selectedMemory.weight)}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-wide leading-snug text-white">
                {selectedMemory.title}
              </h1>
            </div>

            <div className="h-[1px] bg-white/5" />

            {/* 核心段落：记忆概述 */}
            <div className="flex flex-col gap-3">
              <h5 className="text-[10px] font-bold tracking-widest text-white/40 uppercase flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-white/30" />
                策展核心摘要
              </h5>
              <div className="rounded-[6px] bg-[#000000]/40 border border-white/5 p-4.5">
                <p className="text-[12px] leading-relaxed text-white/80 whitespace-pre-line font-light">
                  {selectedMemory.summary}
                </p>
              </div>
            </div>

            {/* 关联神经网络标签 */}
            <div className="flex flex-col gap-3">
              <h5 className="text-[10px] font-bold tracking-widest text-white/40 uppercase flex items-center gap-2">
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
                <button className="flex items-center justify-center rounded-[6px] border border-dashed border-white/15 hover:border-white/35 h-8 w-8 text-white/40 hover:text-white cursor-pointer transition-all">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 提示与系统行动指示 (Decorative System block) */}
            <div className="rounded-[6px] border border-white/5 bg-white/2 p-4.5 flex flex-col gap-2.5">
              <h6 className="text-[10px] font-semibold text-white/50 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-white/40" />
                AEON AI 策展行动建议
              </h6>
              <p className="text-[11px] leading-relaxed text-white/40 font-light">
                该本地记忆实体在 “{selectedMemory.tags[0]}” 节点链中权重较高。系统建议将其作为上下文快照在下一次 LLM 提示词合成中自动关联，以增强 Agent 在相关软件架构及系统调优上的精准度和召回深度。
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
