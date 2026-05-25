import type React from 'react'
import { FileText, Tag, Plus, Clock, Sparkles, Brain, CheckCircle2, HelpCircle } from 'lucide-react'

/* ==========================================
 * TS 类型定义
 * ========================================== */

// 自由笔记素材项类型。
type NoteMaterialItem = {
  // 笔记唯一标识。
  id: string
  // 笔记标题。
  title: string
  // 笔记正文。
  content: string
  // 笔记来源渠道。
  source: '随手速记' | '聊天粘贴' | '截图文字' | '会议摘要'
  // 关联标签列表。
  tags: string[]
  // 记录日期与时间。
  time: string
  // 是否已经被周度策展或长期主题吸纳。
  isCurated: boolean
  // Agent 提取的可能进入的主题或线索提示。
  clue?: string
}

// 统计指标项类型。
type StatsSummaryItem = {
  // 指标标识。
  id: string
  // 指标名称。
  label: string
  // 指标数值。
  value: number
  // 显示图标。
  icon: React.ComponentType<{ className?: string }>
  // 是否突出显示。
  highlight: boolean
}

/* ==========================================
 * 静态模拟数据
 * ========================================== */

// 顶部卡片自由笔记素材统计。
const STATS_ITEMS: StatsSummaryItem[] = [
  { id: 'total', label: '素材池总数', value: 14, icon: FileText, highlight: false },
  { id: 'pending', label: '待整理素材', value: 8, icon: HelpCircle, highlight: true },
  { id: 'curated', label: '已策展归档', value: 6, icon: CheckCircle2, highlight: false },
  { id: 'clues', label: '发现主题线索', value: 5, icon: Brain, highlight: false }
]

// 自由笔记素材静态列表。
const INITIAL_NOTES: NoteMaterialItem[] = [
  {
    id: 'n-1',
    title: '分布式节点状态同步算法重试机制',
    content: '在弱网环境下，AEON 核心协议层的节点状态同步容易丢失。可以设计一个基于指数退避时间的重试算法，同时引入主观连接信任度，当信任度低于 0.3 时直接进入离线暂存模式。明天和 Yonah 讨论一下。',
    source: '随手速记',
    tags: ['架构', '协议层'],
    time: '2026-05-25 10:15',
    isCurated: false,
    clue: '可能关联主题「本地优先架构」'
  },
  {
    id: 'n-2',
    title: '微信聊天记录粘贴：遗忘曲线机制探讨',
    content: '[14:22] A: 数字海马体不能做成纯粹的记事本。人脑能正常运转是因为大脑会自动遗忘 90% 的垃圾信息。B: 同意。所以我们的 Agent 在周整理时，应该鼓励用户“丢弃”或“归档”那些时效性已过的随记。遗忘机制才是核心。',
    source: '聊天粘贴',
    tags: ['机制探讨', '数字海马体'],
    time: '2026-05-24 16:45',
    isCurated: false,
    clue: '可能关联主题「数字海马体」'
  },
  {
    id: 'n-3',
    title: '截屏 OCR：极简黑白客户端设计准则',
    content: '界面背景：#000000（纯黑）。次级卡片：#212121（暗灰）。圆角：6px。严格禁止使用多色渐变。一切界面的交互通过留白、层级、微弱的白边框以及极其克制的微交互来传达。设计需要新颖，同时体现绝对的冷静。',
    source: '截图文字',
    tags: ['UI-UX', '规范'],
    time: '2026-05-24 11:30',
    isCurated: true,
    clue: '已关联主题「数字海马体」的设计系统'
  },
  {
    id: 'n-4',
    title: '海马体主动策展交互层构想',
    content: 'Agent 的角色绝对不能是诊断式的。如果 Agent 直接对用户说“你今天很焦虑”，这不仅生硬，而且可能引起抵触。相反，它应该作为一根绳索，把“计划延后”和“工作时间过长”这两个事实摆在用户面前。让用户自己去连线。',
    source: '随手速记',
    tags: ['AI-Agent', 'UX'],
    time: '2026-05-23 15:20',
    isCurated: false,
    clue: '可能关联主题「数字海马体」'
  },
  {
    id: 'n-5',
    title: '关于本地加密存储的讨论摘要',
    content: '在本地优先架构下，密钥直接托管于硬件级的 Keychain。数据的解密与神经元关联计算完全是在本地沙盒内完成。任何外部云同步都必须在数据完全碎块化加密后进行，保证即使云端被攻破，攻击者也只能拿到无意义的碎块。',
    source: '会议摘要',
    tags: ['本地存储', '安全'],
    time: '2026-05-22 09:10',
    isCurated: true,
    clue: '已关联主题「本地优先架构」'
  },
  {
    id: 'n-6',
    title: '拖延症的本质与应对设计',
    content: '今天再次把“Today 工作台 visual 审核”这个任务延后了。这其实是个信号，代表我对目前的渲染层 Lint 规则感到烦躁。如果能将延后任务与当时记录的主观日记进行关联，或许能帮我找出“抗拒某项工作”的底层心理根源。',
    source: '随手速记',
    tags: ['心理学', '行为记录'],
    time: '2026-05-21 18:40',
    isCurated: false,
    clue: '可能关联主题「计划延后模式」'
  },
  {
    id: 'n-7',
    title: '微信群摘录：AI 协同与个人边界',
    content: '“现在的 AI 都在教你如何快速输出，但没有人在教你如何保护你的注意力。我们每天写下的随记，是极为珍贵的个人脑电波映射。如果直接打包发给公共大模型，就是在慢性让渡思维主权。必须建立本地的策展边界。”',
    source: '聊天粘贴',
    tags: ['思想', 'AI-Agent'],
    time: '2026-05-20 22:15',
    isCurated: false,
    clue: '可能关联主题「数字海马体」'
  },
  {
    id: 'n-8',
    title: '客户端冷启动性能指标',
    content: '本地优先客户端最核心的体验就是“快”。目前冷启动耗时在 120ms 左右。需要对多维关联图谱的首次加载进行预加载分片。在 App 启动时，只初始化基础 UI 树和 Today 页面，其他页面的关联网格在后台线程中懒加载。',
    source: '随手速记',
    tags: ['架构', '性能'],
    time: '2026-05-19 14:00',
    isCurated: true,
    clue: '已关联主题「本地优先架构」'
  }
]

/**
 * NotesPage 组件 - 展示自由笔记素材池。
 * 采用响应式 columns 瀑布流布局，静态展示多来源素材与待策展线索。
 */
export const NotesPage = (): React.JSX.Element => {
  return (
    <section
      aria-label="自由笔记素材池页面"
      className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto lg:overflow-hidden px-1 lg:px-2"
    >
      {/* 顶部标题栏 */}
      <header className="flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
          <span>LIBRARY</span>
          <span>/</span>
          <span>NOTES</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-white">自由笔记素材池</h1>
      </header>

      {/* 笔记页面主体滚动区域 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3">
        {/* 顶部指标卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
          {STATS_ITEMS.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.id}
                className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex items-center justify-between transition-all duration-150"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-white/40">{stat.label}</span>
                  <span className="text-lg font-bold font-mono text-white">{stat.value}</span>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-white/5 text-white/60">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            )
          })}
        </div>

        {/* 静态分类视图与工具栏 */}
        <div className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[#000000] p-1 rounded-[6px] border border-white/5 self-start">
            <span className="px-3 py-1 text-xs rounded-[6px] bg-white text-black font-semibold">
              全部素材
            </span>
            <span className="px-3 py-1 text-xs rounded-[6px] text-white/40">
              待整理 ({STATS_ITEMS[1].value})
            </span>
            <span className="px-3 py-1 text-xs rounded-[6px] text-white/40">
              已整理 ({STATS_ITEMS[2].value})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/30 font-mono">
              本地剪贴板监听自动捕获已启用
            </span>
            <button
              disabled
              aria-disabled="true"
              className="flex items-center gap-1 rounded-[6px] border border-white/5 bg-white/5 px-2.5 py-1 text-[11px] text-white/35 font-medium cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
              新建素材
            </button>
          </div>
        </div>

        {/* 自由随记卡片网格布局 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-1">
          {INITIAL_NOTES.map((note) => (
            <div
              key={note.id}
              className={`h-[258px] overflow-hidden rounded-[6px] border p-3.5 flex flex-col gap-3 transition-all duration-150 ${
                note.isCurated
                  ? 'border-white/5 bg-[#212121]/40'
                  : 'border-white/10 bg-[#212121]'
              }`}
            >
              {/* 卡片头部：来源与时间 */}
              <div className="flex items-center justify-between">
                <span className="rounded-[6px] bg-white/5 px-1.5 py-0.5 text-[9px] text-white/45 font-medium">
                  {note.source}
                </span>
                <div className="flex items-center gap-1 text-[9px] font-mono text-white/30">
                  <Clock className="h-2.5 w-2.5" />
                  <span>{note.time.split(' ')[1]}</span>
                </div>
              </div>

              {/* 卡片标题 */}
              <h3 className="text-xs font-bold text-white/85 leading-tight">{note.title}</h3>

              {/* 卡片正文 */}
              <p className="text-xs text-white/50 leading-relaxed font-sans line-clamp-6">
                {note.content}
              </p>

              {/* 关联标签 */}
              <div className="flex flex-wrap gap-1">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-0.5 rounded-[6px] bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40"
                  >
                    <Tag className="h-2 w-2" />
                    {tag}
                  </span>
                ))}
              </div>

              {/* 智能线索分析提示 */}
              {note.clue && (
                <div className="mt-1 pt-2 border-t border-white/5 flex items-start gap-1.5">
                  <Sparkles
                    className={`h-3 w-3 mt-0.5 flex-shrink-0 ${
                      note.isCurated ? 'text-white/20' : 'text-white/70'
                    }`}
                  />
                  <span
                    className={`text-[10px] leading-relaxed ${
                      note.isCurated ? 'text-white/25 line-through' : 'text-white/65 font-medium'
                    }`}
                  >
                    {note.clue}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
