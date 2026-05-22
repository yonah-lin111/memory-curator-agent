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
