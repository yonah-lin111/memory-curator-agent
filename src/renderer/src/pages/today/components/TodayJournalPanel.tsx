import { BookOpen } from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { MarkdownEditor } from "@/components/ui/MarkdownEditor"

// TodayJournalPanel 组件的 Props 接口定义。
interface TodayJournalPanelProps {
  // 今日日记的正文。
  journalContent: string
  // 当前正文是否已成功保存。
  isSaved: boolean
  // 是否正在保存。
  isSaving: boolean
  // 保存失败提示。
  errorMessage: string | null
  // 日记内容改变时的回调函数。
  onJournalContentChange: (value: string) => void
  // 编辑器失焦时的回调函数。
  onJournalBlur: () => void
  // 页面是否正在加载。
  isLoading?: boolean
}

/**
 * TodayJournalPanel - 日记与主观表达面板组件
 */
export const TodayJournalPanel = ({
  journalContent,
  isSaved,
  onJournalContentChange,
  onJournalBlur,
  isLoading,
}: TodayJournalPanelProps): React.JSX.Element => {
  const [editorMode, setEditorMode] = useState<"preview" | "split">("split")
  const prevLoadingRef = useRef<boolean | undefined>(undefined)

  useEffect(() => {
    // 初次挂载，或者刚刚完成加载 (isLoading 从 true 变 false)
    const isInitialMount = prevLoadingRef.current === undefined
    const justFinishedLoading = prevLoadingRef.current === true && isLoading === false

    if (isInitialMount || justFinishedLoading) {
      setEditorMode("split")
    }

    prevLoadingRef.current = isLoading
  }, [isLoading])

  return (
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 flex-shrink-0 mb-1">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">日记与主观表达</span>
        </div>
      </div>
      <div className="p-1">
        <MarkdownEditor
          className="notes-markdown-editor"
          height={"77vh"}
          id="today-journal-editor"
          placeholder="写下今天的日记与主观感受..."
          value={journalContent}
          showSaveStatus
          isSaved={isSaved}
          defaultMode={editorMode}
          onBlur={onJournalBlur}
          onChange={onJournalContentChange}
        />
      </div>
    </div>
  )
}
