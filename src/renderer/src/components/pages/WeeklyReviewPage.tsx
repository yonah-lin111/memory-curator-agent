import type React from 'react'
import { CalendarDays, CheckCircle2, AlertTriangle, TrendingUp, Sparkles, Clock, ArrowRight, Activity } from 'lucide-react'

/* ==========================================
 * TS 类型定义
 * ========================================== */

// 周指标统计数据项类型。
type WeeklyMetricItem = {
  // 唯一标识。
  id: string
  // 指标名称。
  label: string
  // 显示数值或百分比。
  value: string
  // 辅助说明或同比变化。
  changeText: string
  // 显示图标。
  icon: React.ComponentType<{ className?: string }>
}

// 时间线里程碑节点类型。
type TimelineMilestoneItem = {
  // 日期文本。
  date: string
  // 星期名称。
  dayOfWeek: string
  // 里程碑标题。
  title: string
  // 发生的时间。
  time: string
  // 关键事件描述。
  description: string
  // 事件类别，如: '技术突破' | '认知觉醒' | '情绪波动' | '日常开发'。
  category: '技术突破' | '认知觉醒' | '情绪波动' | '日常开发'
}

// 被沉淀的本周关键记忆条目类型。
type CuratedMemoryItem = {
  // 唯一标识。
  id: string
  // 记忆名称。
  name: string
  // 记忆产生日期。
  date: string
  // 保留并命名该记忆的理由。
  reason: string
}

/* ==========================================
 * 静态模拟数据
 * ========================================== */

// 本周周度回顾概览核心指标。
const WEEKLY_METRICS: WeeklyMetricItem[] = [
  { id: 'completion', label: '计划完成度', value: '84%', changeText: '本周完成 21 项 / 延后 4 项', icon: CheckCircle2 },
  { id: 'captured', label: '笔记随手捕获', value: '37 篇', changeText: '较上周活跃度 +18%', icon: TrendingUp },
  { id: 'delay_ratio', label: '任务延后频次', value: '4 次', changeText: '主要集中于 UI 重构大项', icon: AlertTriangle },
  { id: 'emerged_themes', label: '浮现长期主题', value: '3 个', changeText: '数字海马体、本地优先等', icon: Sparkles }
]

// 一周关键事件时间线静态数据。
const TIMELINE_MILESTONES: TimelineMilestoneItem[] = [
  {
    date: '05-25',
    dayOfWeek: 'Mon',
    time: '21:45',
    title: '完成 Today 工作台精细布局并归档随记',
    description: 'Today 界面采用极纯粹的黑色与白灰色系完成，完成了对今天所有零散随记的清理，并在晚间完成了第一次本周周度回顾，整体效率进入良性循环。',
    category: '日常开发'
  },
  {
    date: '05-24',
    dayOfWeek: 'Sun',
    time: '16:30',
    title: '安福路午后产生“记忆主权让渡”自省',
    description: '反思社交平台算法对个人记忆完整性的侵蚀，确立了「Memory Curator」作为一个完全归个人所有的数字化“海马体”的底层哲学目标。',
    category: '认知觉醒'
  },
  {
    date: '05-22',
    dayOfWeek: 'Fri',
    time: '23:10',
    title: '用 Rust 彻底突破多维关联图谱解密瓶颈',
    description: '拒绝平庸退回 SQL 方案，在连续报错数小时后，成功用二进制碎块在本地沙盒实现神经关联衰减算法，将首屏图谱解密耗时降至 15ms。',
    category: '技术突破'
  },
  {
    date: '05-21',
    dayOfWeek: 'Thu',
    time: '18:40',
    title: '反思自己在 UI 审核任务中的“创造性拖延”',
    description: '发现自己利用修整无关紧要的 Lint 规则来逃避更核心但有些无从下手的多维关联架构。此自省作为重要样本，推动建立「计划延后模式」主题。',
    category: '情绪波动'
  },
  {
    date: '05-19',
    dayOfWeek: 'Tue',
    time: '10:15',
    title: '确定多维关联图谱的本地冷启动预加载逻辑',
    description: '在与 Yonah 进行技术研讨后，决定在主应用冷启动时只初始化 Today 精简数据，大体量的多维记忆链条采用异步分片式后台懒加载。',
    category: '日常开发'
  }
]

// 值得永久保留的本周关键记忆。
const CURATED_MEMORIES: CuratedMemoryItem[] = [
  {
    id: 'm-1',
    name: '「15ms 神经关联本地解密首通」',
    date: '2026-05-22',
    reason: '这是一项硬核的技术突破，验证了我们“本地优先、计算完全局限于沙盒”的核心安全原则。它决定了整个产品在工程上的最高可行性上限。'
  },
  {
    id: 'm-2',
    name: '「安福路关于算法投喂的思考」',
    date: '2026-05-24',
    reason: '这次思考超越了纯粹的代码编写，给产品构建注入了深沉的灵魂。它回答了“我们为什么要大费周折地做一个本地优先、主观归属的脑区”这一哲学本源。'
  }
]

/**
 * WeeklyReviewPage 组件 - 展示周度策展复盘仪表板。
 * 包含复盘核心指标卡片、一周关键事件时间线、心境趋势与重复主题分析、以及关键记忆沉淀。
 */
export const WeeklyReviewPage = (): React.JSX.Element => {
  return (
    <section
      aria-label="周度策展复盘页面"
      className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto lg:overflow-hidden px-1 lg:px-2"
    >
      {/* 顶部标题栏 */}
      <header className="flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
          <span>CURATION</span>
          <span>/</span>
          <span>WEEKLY REVIEW</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-white">周度策展复盘</h1>
      </header>

      {/* 滚动大容器 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3">
        {/* 1. 复盘核心指标 Dashboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
          {WEEKLY_METRICS.map((metric) => {
            const Icon = metric.icon
            return (
              <div
                key={metric.id}
                className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex items-center justify-between"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-white/40">{metric.label}</span>
                  <span className="text-lg font-bold font-mono text-white leading-none">{metric.value}</span>
                  <span className="text-xs text-white/30 truncate mt-0.5">{metric.changeText}</span>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-white/5 text-white/60">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            )
          })}
        </div>

        {/* 2. 核心分析：感受变化与高频重复主题 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-shrink-0">
          {/* 左侧：情绪感受变动分析 */}
          <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Activity className="h-4 w-4 text-white/65" />
              <span className="text-xs font-bold text-white/80">心境与感受变化曲线</span>
            </div>
            <div className="bg-[#000000] border border-white/5 rounded-[6px] p-3 flex flex-col gap-3">
              <p className="text-xs text-white/70 leading-relaxed">
                本周的前半段（05-19 至 05-21）处于比较明显的<span className="text-white font-bold">“焦虑 / 自省”</span>状态，高频的随记中出现多次对自己拖延的批判，思维呈现一定的内耗与无意义重构偏向。
              </p>
              <div className="flex items-center justify-center gap-2 py-1 bg-white/[0.01] rounded-[6px] border border-white/5">
                <span className="text-xs text-white/40">前半周：焦虑与自省</span>
                <ArrowRight className="h-3 w-3 text-white/20" />
                <span className="text-xs text-white/75 font-semibold">后半周：突破与充实</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                随着 05-22 深夜用 Rust 硬核攻克多维图谱本地解密的性能难关，心境在周末显著好转，转入<span className="text-white font-bold">“精疲力竭 / 充实”</span>与周一落成工作台后的<span className="text-white font-bold">“平静 / 专注”</span>。
              </p>
            </div>
          </div>

          {/* 右侧：高频重复主题观察 */}
          <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <CalendarDays className="h-4 w-4 text-white/60" />
              <span className="text-xs font-bold text-white/80">高频浮现的主题观察</span>
            </div>
            <div className="flex-1 flex flex-col gap-2.5">
              <div className="flex flex-col gap-1.5 p-2.5 bg-white/[0.01] border border-white/5 rounded-[6px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/80">1. 本地优先安全架构</span>
                  <span className="font-mono text-xs text-white/70">频次: 8次</span>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">
                  多发生在开发讨论和技术随记中，核心内容围绕本地密钥安全存储、数据完全离线碎块化。已完全结晶为长期主题。
                </p>
              </div>

              <div className="flex flex-col gap-1.5 p-2.5 bg-white/[0.01] border border-white/5 rounded-[6px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/80">2. 记忆的主动遗忘与策展机制</span>
                  <span className="font-mono text-xs text-white/70">频次: 6次</span>
                </div>
                <p className="text-xs text-white/45 leading-relaxed">
                  灵感来自聊天记录中关于遗忘机制的讨论，它是打破数字化信息堆积、构建纯净数字脑区的必经道路。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 一周关键事件时间线 (Timeline) */}
        <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-4 flex-shrink-0">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Clock className="h-4 w-4 text-white/60" />
            <span className="text-xs font-bold text-white/80">一周关键里程碑时间线</span>
          </div>

          <div className="relative pl-4 border-l border-white/10 flex flex-col gap-5 my-1.5">
            {TIMELINE_MILESTONES.map((milestone) => {
              // 根据分类赋予颜色
              const isBreakthrough = milestone.category === '技术突破'
              const isAwakening = milestone.category === '认知觉醒'
              const isRoutine = milestone.category === '日常开发'

              return (
                <div key={milestone.title} className="relative group">
                  {/* 时间轴上的小圆点 */}
                  <div
                    className={`absolute -left-[20.5px] top-1 h-3 w-3 rounded-full border border-[#212121] transition-colors duration-150 ${
                      isBreakthrough
                        ? 'bg-white'
                        : isAwakening
                          ? 'bg-white/70'
                          : isRoutine
                            ? 'bg-white'
                            : 'bg-white/40'
                    }`}
                  />

                  {/* 节点内容 */}
                  <div className="flex flex-col gap-1 pl-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white/40">
                          {milestone.date} ({milestone.dayOfWeek})
                        </span>
                        <span className="text-xs font-mono text-white/20">{milestone.time}</span>
                        <span
                          className={`rounded-[6px] px-1.5 py-0.5 text-xs font-medium ${
                            isBreakthrough
                              ? 'bg-white/10 text-white/80 border border-white/10'
                              : isAwakening
                                ? 'bg-white/10 text-white/70 border border-white/10'
                                : 'bg-white/5 text-white/50 border border-white/5'
                          }`}
                        >
                          {milestone.category}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-white/85 mt-0.5">{milestone.title}</h4>
                    <p className="text-xs text-white/45 leading-relaxed mt-1 font-sans pr-1 sm:pr-4">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. 永久保留的关键记忆沉淀 (Curated Memories) */}
        <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 flex-shrink-0 mb-1">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Sparkles className="h-4 w-4 text-white/65" />
            <span className="text-xs font-bold text-white/80">本周永久沉淀至“海马体”的关键记忆</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            {CURATED_MEMORIES.map((curated) => (
              <div key={curated.id} className="rounded-[6px] bg-[#000000] border border-white/5 p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white leading-tight">{curated.name}</h4>
                  <span className="text-xs font-mono text-white/30">{curated.date}</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed font-sans mt-0.5">
                  <span className="text-white/30 font-medium">沉淀理由：</span>
                  {curated.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
