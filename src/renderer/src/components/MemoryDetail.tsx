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
