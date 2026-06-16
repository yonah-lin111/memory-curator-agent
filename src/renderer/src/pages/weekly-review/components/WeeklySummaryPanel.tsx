import { useEffect, useRef, useState } from 'react'
import { MdEditor, MdPreview } from 'md-editor-rt'
import 'md-editor-rt/lib/preview.css'
import 'md-editor-rt/lib/style.css'
import { RefreshCw, Edit2, FileText } from 'lucide-react'

// 组件 Props。
interface WeeklySummaryPanelProps {
  // 当前周的起始日期，格式 'YYYY-MM-DD'。
  weekStartDate: string
}

// 周度总结项类型（与 preload 对齐）。
type WeeklySummaryItem = {
  id: number
  weekStartDate: string
  title: string
  content: string
  modelUsed: string | null
  generatedAt: string
}

// 面板状态类型。
type PanelState = 'idle' | 'loading' | 'streaming' | 'done'

/**
 * 周度总结面板。
 * 状态机：idle -> loading -> streaming -> done，支持重新生成与编辑。
 */
export const WeeklySummaryPanel = ({ weekStartDate }: WeeklySummaryPanelProps) => {
  // 当前面板状态。
  const [state, setState] = useState<PanelState>('idle')
  // 已保存的总结数据。
  const [summary, setSummary] = useState<WeeklySummaryItem | null>(null)
  // 流式累积文本（使用 ref 避免频繁 state 更新）。
  const streamTextRef = useRef('')
  // 触发 RAF 渲染用的计数器。
  const [streamRenderTick, setStreamRenderTick] = useState(0)
  // RAF handle，用于清理。
  const rafRef = useRef<number | null>(null)
  // 是否在编辑模式。
  const [isEditing, setIsEditing] = useState(false)
  // 编辑中的内容。
  const [editContent, setEditContent] = useState('')

  // 初始化时加载已有总结。
  useEffect(() => {
    if (!weekStartDate) return

    window.api.weekly!.summary.get(weekStartDate).then((item) => {
      if (item) {
        setSummary(item)
        setState('done')
      } else {
        setState('idle')
        setSummary(null)
      }
    })
  }, [weekStartDate])

  /**
   * 触发 AI 生成。
   */
  const handleGenerate = async () => {
    setState('loading')
    streamTextRef.current = ''
    setStreamRenderTick(0)

    // 订阅 delta 事件，用 RAF 批量更新渲染。
    const unsubDelta = window.api.weekly!.summary.onDelta(({ text }) => {
      streamTextRef.current += text
      setState('streaming')
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          setStreamRenderTick((t) => t + 1)
        })
      }
    })

    // 订阅 done 事件。
    const unsubDone = window.api.weekly!.summary.onDone((item) => {
      unsubDelta()
      unsubDone()
      setSummary(item)
      setState('done')
    })

    try {
      await window.api.weekly!.summary.generate({ weekStartDate })
    } catch (err) {
      unsubDelta()
      unsubDone()
      setState(summary ? 'done' : 'idle')
      console.error('周度总结生成失败', err)
    }
  }

  /**
   * 保存编辑内容。
   */
  const handleSaveEdit = async () => {
    if (!summary) return

    const firstLine = editContent.split('\n')[0] ?? ''
    const title = firstLine.replace(/^#+\s*/, '').trim() || summary.title
    const updated = await window.api.weekly!.summary.save({
      weekStartDate,
      title,
      content: editContent,
      modelUsed: summary.modelUsed,
      generatedAt: summary.generatedAt
    })
    setSummary(updated)
    setIsEditing(false)
  }

  // 当前展示的 Markdown 文本。
  const displayText = state === 'streaming' ? streamTextRef.current : summary?.content ?? ''

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 标题栏 */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-white/60" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
            周度总结
          </h3>
        </div>

        {state === 'done' && !isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditContent(summary?.content ?? ''); setIsEditing(true) }}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <Edit2 className="h-3 w-3" />
              编辑
            </button>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              重新生成
            </button>
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col min-h-[300px] flex-grow overflow-hidden">
        {(state === 'idle') && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-xs text-white/25">本周尚无总结</p>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 rounded-[6px] border border-white/10 transition-colors"
            >
              生成周度总结
            </button>
          </div>
        )}

        {(state === 'loading') && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {(state === 'streaming' || state === 'done') && !isEditing && (
          <div className="flex-1 overflow-y-auto prose prose-invert prose-sm max-w-none text-white/80 text-xs leading-relaxed" data-render-tick={streamRenderTick}>
            <MdPreview
              modelValue={displayText}
              theme="dark"
            />
            {state === 'streaming' && (
              <span className="inline-block w-2 h-3 bg-white/40 animate-pulse ml-0.5" />
            )}
          </div>
        )}

        {isEditing && (
          <div className="flex flex-col gap-2 flex-1">
            <MdEditor
              codeTheme="atom"
              language="zh-CN"
              preview
              previewTheme="default"
              showCodeRowNumber
              theme="dark"
              value={editContent}
              onChange={setEditContent}
              style={{ height: '100%' }}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/70 rounded-[6px] border border-white/10 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>

      {state === 'done' && summary && (
        <p className="text-xs text-white/20 text-right">
          {summary.generatedAt} · {summary.modelUsed ?? '未知模型'}
        </p>
      )}
    </div>
  )
}
