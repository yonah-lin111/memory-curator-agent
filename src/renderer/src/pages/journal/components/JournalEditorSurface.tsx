import { BookOpen, Smile } from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { MarkdownEditor } from "@/components/ui/MarkdownEditor"

// 日记编辑器区域属性。
interface JournalEditorSurfaceProps {
  // 当前正文内容。
  value: string
  // 当前字数。
  wordCount: number
  // 情绪线索文案。
  moodLabel: string
  // 当前正文是否已成功保存。
  isSaved: boolean
  // 内容变化回调。
  onChange: (value: string) => void
  // 失焦回调。
  onBlur: () => void
  // 页面是否正在加载。
  isLoading?: boolean
}

/**
 * JournalEditorSurface - 日记页沉浸编辑器与状态栏。
 */
export const JournalEditorSurface = ({
  value,
  wordCount,
  moodLabel,
  isSaved,
  onChange,
  onBlur,
  isLoading,
}: JournalEditorSurfaceProps): React.JSX.Element => {
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
    <section className="flex min-h-0 flex-1 flex-col rounded-[6px] border border-white/6 bg-[#212121] p-4 gap-3">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white/80">今日日记</span>
        </div>
        <div className="flex items-center gap-4 text-white/50 text-xs">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3" />
            <span>{wordCount} 字</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smile className="h-3 w-3" />
            <span>{moodLabel}</span>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-1">
        <MarkdownEditor
          className="notes-markdown-editor"
          height="100%"
          id="journal-page-editor"
          placeholder="写下今天的日记与主观感受..."
          value={value}
          showSaveStatus
          isSaved={isSaved}
          defaultMode={editorMode}
          onBlur={onBlur}
          onChange={(nextValue) => onChange(nextValue ?? "")}
        />
      </div>
    </section>
  )
}
