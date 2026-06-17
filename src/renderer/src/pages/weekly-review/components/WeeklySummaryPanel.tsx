import { useCallback, useEffect, useRef, useState } from 'react'
import { createTodayEntryDate, shiftEntryDate } from '@/lib/dailyShared'
import { MdEditor, MdPreview } from 'md-editor-rt'
import 'md-editor-rt/lib/preview.css'
import 'md-editor-rt/lib/style.css'
import { RefreshCw, Edit2, FileText } from 'lucide-react'

// 组件 Props。
interface WeeklySummaryPanelProps {
  // 当前周的起始日期，格式 'YYYY-MM-DD'。
  weekStartDate: string
  // 本周全部内容是否为空。
  isEmpty?: boolean
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

// 切换页签类型。
type TabType = 'summary' | 'curator'

/**
 * 周度总结面板。
 * 状态机：idle -> loading -> streaming -> done，支持重新生成与编辑。
 */
export const WeeklySummaryPanel = ({ weekStartDate, isEmpty = false }: WeeklySummaryPanelProps) => {
  // 当前 Tab
  const [activeTab, setActiveTab] = useState<TabType>('summary')

  // 各 Tab 的状态
  const [summaryState, setSummaryState] = useState<PanelState>('loading')
  const [curatorState, setCuratorState] = useState<PanelState>('loading')

  // 各 Tab 存储的数据
  const [summary, setSummary] = useState<WeeklySummaryItem | null>(null)
  const [curator, setCurator] = useState<WeeklySummaryItem | null>(null)

  // 流式文本缓存
  const summaryStreamTextRef = useRef('')
  const curatorStreamTextRef = useRef('')

  // 触发渲染计数器
  const [summaryStreamTick, setSummaryStreamTick] = useState(0)
  const [curatorStreamTick, setCuratorStreamTick] = useState(0)

  // 各 Tab 的编辑状态与内容
  const [isEditingSummary, setIsEditingSummary] = useState(false)
  const [isEditingCurator, setIsEditingCurator] = useState(false)

  const [editSummaryContent, setEditSummaryContent] = useState('')
  const [editCuratorContent, setEditCuratorContent] = useState('')

  const rafSummaryRef = useRef<number | null>(null)
  const rafCuratorRef = useRef<number | null>(null)

  // 判断当前选中周是否已经是历史周（即该周的周日已在今天之前）。
  const isHistoricWeek = shiftEntryDate(weekStartDate, 6) < createTodayEntryDate()

  // 初始化时加载已有数据
  useEffect(() => {
    if (!weekStartDate) return

    setSummaryState('loading')
    setCuratorState('loading')
    setSummary(null)
    setCurator(null)
    setIsEditingSummary(false)
    setIsEditingCurator(false)

    // 获取总结
    window.api.weekly!.summary.get(weekStartDate).then((item) => {
      if (item) {
        setSummary(item)
        setSummaryState('done')
      } else {
        setSummaryState('idle')
      }
    })

    // 获取人际策展
    window.api.weekly!.curator.get(weekStartDate).then((item) => {
      if (item) {
        setCurator(item)
        setCuratorState('done')
      } else {
        setCuratorState('idle')
      }
    })
  }, [weekStartDate])

  /**
   * 触发周度总结 AI 生成。
   */
  const handleGenerateSummary = useCallback(async () => {
    setSummaryState('loading')
    summaryStreamTextRef.current = ''
    setSummaryStreamTick(0)

    const unsubDelta = window.api.weekly!.summary.onDelta(({ text }) => {
      summaryStreamTextRef.current += text
      setSummaryState('streaming')
      if (rafSummaryRef.current === null) {
        rafSummaryRef.current = requestAnimationFrame(() => {
          rafSummaryRef.current = null
          setSummaryStreamTick((t) => t + 1)
        })
      }
    })

    const unsubDone = window.api.weekly!.summary.onDone((item) => {
      unsubDelta()
      unsubDone()
      setSummary(item)
      setSummaryState('done')
    })

    try {
      await window.api.weekly!.summary.generate({ weekStartDate })
    } catch (err) {
      unsubDelta()
      unsubDone()
      setSummaryState(summary ? 'done' : 'idle')
      console.error('周度总结生成失败', err)
    }
  }, [weekStartDate, summary])

  /**
   * 触发人际策展 AI 生成。
   */
  const handleGenerateCurator = useCallback(async () => {
    setCuratorState('loading')
    curatorStreamTextRef.current = ''
    setCuratorStreamTick(0)

    const unsubDelta = window.api.weekly!.curator.onDelta(({ text }) => {
      curatorStreamTextRef.current += text
      setCuratorState('streaming')
      if (rafCuratorRef.current === null) {
        rafCuratorRef.current = requestAnimationFrame(() => {
          rafCuratorRef.current = null
          setCuratorStreamTick((t) => t + 1)
        })
      }
    })

    const unsubDone = window.api.weekly!.curator.onDone((item) => {
      unsubDelta()
      unsubDone()
      setCurator(item)
      setCuratorState('done')
    })

    try {
      await window.api.weekly!.curator.generate({ weekStartDate })
    } catch (err) {
      unsubDelta()
      unsubDone()
      setCuratorState(curator ? 'done' : 'idle')
      console.error('人际策展生成失败', err)
    }
  }, [weekStartDate, curator])

  // 历史周无总结且数据非空时，自动静默触发生成。
  useEffect(() => {
    if (summaryState === 'idle' && isHistoricWeek && !isEmpty && !summary) {
      void handleGenerateSummary()
    }
  }, [summaryState, isHistoricWeek, isEmpty, summary, handleGenerateSummary])

  // 历史周无策展且数据非空时，自动静默触发生成。
  useEffect(() => {
    if (curatorState === 'idle' && isHistoricWeek && !isEmpty && !curator) {
      void handleGenerateCurator()
    }
  }, [curatorState, isHistoricWeek, isEmpty, curator, handleGenerateCurator])

  /**
   * 保存周度总结编辑。
   */
  const handleSaveSummaryEdit = async () => {
    if (!summary) return

    const firstLine = editSummaryContent.split('\n')[0] ?? ''
    const title = firstLine.replace(/^#+\s*/, '').trim() || summary.title
    const updated = await window.api.weekly!.summary.save({
      weekStartDate,
      title,
      content: editSummaryContent,
      modelUsed: summary.modelUsed,
      generatedAt: summary.generatedAt
    })
    setSummary(updated)
    setIsEditingSummary(false)
  }

  /**
   * 保存人际策展编辑。
   */
  const handleSaveCuratorEdit = async () => {
    if (!curator) return

    const firstLine = editCuratorContent.split('\n')[0] ?? ''
    const title = firstLine.replace(/^#+\s*/, '').trim() || curator.title
    const updated = await window.api.weekly!.curator.save({
      weekStartDate,
      title,
      content: editCuratorContent,
      modelUsed: curator.modelUsed,
      generatedAt: curator.generatedAt
    })
    setCurator(updated)
    setIsEditingCurator(false)
  }

  // 计算当前 Tab 使用的映射状态
  const currentTabState = activeTab === 'summary' ? summaryState : curatorState
  const currentTabSummary = activeTab === 'summary' ? summary : curator
  const currentTabIsEditing = activeTab === 'summary' ? isEditingSummary : isEditingCurator
  const currentTabEditContent = activeTab === 'summary' ? editSummaryContent : editCuratorContent
  const currentTabSetEditContent = activeTab === 'summary' ? setEditSummaryContent : setEditCuratorContent
  const currentTabStreamRenderTick = activeTab === 'summary' ? summaryStreamTick : curatorStreamTick
  const currentTabDisplayText =
    activeTab === 'summary'
      ? (summaryState === 'streaming' ? summaryStreamTextRef.current : summary?.content ?? '')
      : (curatorState === 'streaming' ? curatorStreamTextRef.current : curator?.content ?? '')

  const currentTabHandleSaveEdit = activeTab === 'summary' ? handleSaveSummaryEdit : handleSaveCuratorEdit
  const currentTabHandleCancelEdit = () => activeTab === 'summary' ? setIsEditingSummary(false) : setIsEditingCurator(false)
  const currentTabHandleGenerate = activeTab === 'summary' ? handleGenerateSummary : handleGenerateCurator
  const currentTabHandleStartEdit = () => {
    if (activeTab === 'summary') {
      setEditSummaryContent(summary?.content ?? '')
      setIsEditingSummary(true)
    } else {
      setEditCuratorContent(curator?.content ?? '')
      setIsEditingCurator(true)
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 标题栏 */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-white/60" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
              周度总结
            </h3>
          </div>
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-[6px]">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] transition-all ${
                activeTab === 'summary'
                  ? 'bg-[#212121] text-white font-medium shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              总结报告
            </button>
            <button
              onClick={() => setActiveTab('curator')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] transition-all ${
                activeTab === 'curator'
                  ? 'bg-[#212121] text-white font-medium shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              人际策展
            </button>
          </div>
        </div>

        {currentTabState === 'done' && !currentTabIsEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={currentTabHandleStartEdit}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <Edit2 className="h-3 w-3" />
              编辑
            </button>
            <button
              onClick={currentTabHandleGenerate}
              disabled={isEmpty}
              className={`flex items-center gap-1 text-xs transition-colors ${
                isEmpty
                  ? 'text-white/10 cursor-not-allowed'
                  : 'text-white/30 hover:text-white/60'
              }`}
              title={isEmpty ? '本周无任何记录，无法重新生成' : undefined}
            >
              <RefreshCw className="h-3 w-3" />
              重新生成
            </button>
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col min-h-[300px] flex-grow overflow-hidden">
        {(currentTabState === 'idle') && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-xs text-white/25">
              {isEmpty ? '本周无任何行动、片段或日记记录' : (activeTab === 'summary' ? '本周尚无总结' : '本周尚无人际策展')}
            </p>
            <button
              onClick={currentTabHandleGenerate}
              disabled={isEmpty}
              className={`px-4 py-2 text-xs rounded-[6px] border transition-colors ${
                isEmpty
                  ? 'bg-white/0 text-white/10 border-white/5 cursor-not-allowed'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 border-white/10'
              }`}
              title={isEmpty ? '本周无任何记录，无法生成' : undefined}
            >
              {activeTab === 'summary' ? '生成周度总结' : '分析人际策展'}
            </button>
          </div>
        )}

        {(currentTabState === 'loading') && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {(currentTabState === 'streaming' || currentTabState === 'done') && !currentTabIsEditing && (
          <div className="flex-1 overflow-y-auto markdown-preview-container ai-chat-markdown-preview select-text max-w-full" data-render-tick={currentTabStreamRenderTick}>
            <MdPreview
              theme="dark"
              modelValue={currentTabDisplayText}
              previewTheme="default"
              codeTheme="atom"
              style={{ backgroundColor: "transparent" }}
              autoFoldThreshold={currentTabState === 'streaming' ? Infinity : 0}
              showCodeRowNumber={false}
            />
            {currentTabState === 'streaming' && (
              <span className="inline-block w-2 h-3 bg-white/40 animate-pulse ml-0.5" />
            )}
          </div>
        )}

        {currentTabIsEditing && (
          <div className="flex flex-col gap-2 flex-1">
            <MdEditor
              codeTheme="atom"
              language="zh-CN"
              preview
              previewTheme="default"
              showCodeRowNumber
              theme="dark"
              value={currentTabEditContent}
              onChange={currentTabSetEditContent}
              style={{ height: '100%' }}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={currentTabHandleCancelEdit}
                className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                取消
              </button>
              <button
                onClick={currentTabHandleSaveEdit}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/70 rounded-[6px] border border-white/10 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>

      {currentTabState === 'done' && currentTabSummary && (
        <p className="text-xs text-white/20 text-right">
          {currentTabSummary.generatedAt} · {currentTabSummary.modelUsed ?? '未知模型'}
        </p>
      )}
    </div>
  )
}
