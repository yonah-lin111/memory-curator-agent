import { FileText, X } from "lucide-react"
import { MdPreview } from "md-editor-rt"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import "md-editor-rt/lib/preview.css"

export interface TextFileProps {
  // 文本文件协议 URL。
  url: string
  // 原始文件名。
  fileName: string
  // 文件大小（字节）。
  sizeBytes: number
  // 是否支持点击预览。
  preview?: boolean
  // 附加容器类名。
  className?: string
}

/**
 * 格式化文件大小。
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 根据文件名和文件内容，生成用于预览的 Markdown 字符串。
 * 如果是 Markdown 文件，则直接返回内容；
 * 如果是其他代码或文本文件，则自动包裹在 Markdown 代码块中。
 *
 * @param content 原始文本内容
 * @param fileName 文件名称
 * @returns 包装后的 Markdown 文本
 */
const getMarkdownContent = (content: string, fileName: string): string => {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase()

  if (ext === ".md" || ext === ".markdown") {
    return content
  }

  // 映射常见文件后缀到 markdown 语言标识。
  let lang = ""
  switch (ext) {
    case ".json":
      lang = "json"
      break
    case ".csv":
      lang = "csv"
      break
    case ".xml":
      lang = "xml"
      break
    case ".yaml":
    case ".yml":
      lang = "yaml"
      break
    case ".toml":
      lang = "toml"
      break
    case ".py":
      lang = "python"
      break
    case ".js":
      lang = "javascript"
      break
    case ".ts":
      lang = "typescript"
      break
    case ".jsx":
      lang = "jsx"
      break
    case ".tsx":
      lang = "tsx"
      break
    case ".html":
      lang = "html"
      break
    case ".css":
      lang = "css"
      break
    case ".sh":
    case ".bash":
    case ".zsh":
      lang = "bash"
      break
    case ".sql":
      lang = "sql"
      break
    case ".java":
      lang = "java"
      break
    case ".c":
      lang = "c"
      break
    case ".cpp":
      lang = "cpp"
      break
    case ".rs":
      lang = "rust"
      break
    case ".go":
      lang = "go"
      break
    case ".rb":
      lang = "ruby"
      break
    case ".env":
    case ".ini":
      lang = "ini"
      break
    case ".log":
      lang = "text"
      break
    case ".txt":
    default:
      lang = "text"
      break
  }

  // 为防止内容中包含 ``` 导致 markdown 渲染错误，动态选择 ``` 或 ````
  const fence = content.includes("```") ? "````" : "```"
  return `${fence}${lang}\n${content}\n${fence}`
}

// 文本文件图标色映射。
const TEXT_EXTENSION_COLORS: Record<string, string> = {
  ".md": "text-blue-400",
  ".json": "text-yellow-400",
  ".csv": "text-green-400",
  ".xml": "text-orange-400",
  ".yaml": "text-red-400",
  ".yml": "text-red-400",
  ".toml": "text-purple-400",
  ".py": "text-cyan-400",
  ".js": "text-yellow-300",
  ".ts": "text-blue-300",
  ".jsx": "text-cyan-300",
  ".tsx": "text-blue-300",
  ".html": "text-orange-300",
  ".css": "text-blue-300",
  ".sh": "text-green-300",
  ".bash": "text-green-300",
  ".zsh": "text-green-300",
  ".sql": "text-purple-300",
  ".java": "text-red-300",
  ".c": "text-gray-300",
  ".cpp": "text-gray-300",
  ".rs": "text-orange-300",
  ".go": "text-cyan-300",
  ".rb": "text-red-300",
  ".env": "text-gray-400",
  ".log": "text-gray-400",
  ".txt": "text-white/60",
}

/**
 * TextFile - 文本文件卡片组件，支持悬浮信息展示与内容预览弹窗。
 */
export const TextFile = ({
  url,
  fileName,
  sizeBytes,
  preview = true,
  className = "",
}: TextFileProps): React.JSX.Element => {
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(false)

  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
  const iconColor = TEXT_EXTENSION_COLORS[extension] ?? "text-white/50"

  const isBackdropMouseDownRef = useRef(false)

  /**
   * 监听遮罩层按下，判断是否是背景本身。
   */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      isBackdropMouseDownRef.current = true
    } else {
      isBackdropMouseDownRef.current = false
    }
  }, [])

  /**
   * 监听遮罩层松开，若按下与松开均在背景本身，则关闭预览。
   */
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (isBackdropMouseDownRef.current && e.target === e.currentTarget) {
      setShowPreview(false)
    }
    isBackdropMouseDownRef.current = false
  }, [])

  // 关闭预览时重置状态。
  useEffect(() => {
    if (!showPreview) {
      setPreviewContent(null)
      setPreviewLoading(false)
      setPreviewError(false)
    }
  }, [showPreview])

  // Escape 键关闭。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showPreview) {
        setShowPreview(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [showPreview])

  /**
   * 点击打开预览，拉取文本内容。
   */
  const handleClick = useCallback((): void => {
    if (!preview) {
      return
    }

    setShowPreview(true)
    setPreviewLoading(true)
    setPreviewError(false)

    const loadContent = window.api?.files?.readCuratorTextFile
      ? window.api.files.readCuratorTextFile(url)
      : fetch(url).then((response) => {
          if (!response.ok) {
            throw new Error("Failed to fetch")
          }

          return response.text()
        })

    loadContent
      .then((text) => {
        setPreviewContent(text)
        setPreviewLoading(false)
      })
      .catch(() => {
        setPreviewError(true)
        setPreviewLoading(false)
      })
  }, [url, preview])

  return (
    <>
      <div
        data-testid="text-file-card"
        onClick={handleClick}
        className={`relative flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.02] px-2.5 py-1.5 select-none ${preview ? "cursor-pointer hover:bg-white/[0.04]" : ""} ${className}`}
        title={fileName}
      >
        <FileText className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="text-xs text-white/70 truncate max-w-[120px]">{fileName}</span>
        <span className="text-[10px] text-white/30 shrink-0">{formatFileSize(sizeBytes)}</span>
      </div>

      {showPreview && (
        <div
          data-testid="text-file-preview"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm whitespace-normal"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          {/* 标题栏 */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-[10000]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-white/50 mr-2">{fileName}</span>
            <button
              aria-label="Close preview"
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/5"
              onClick={() => setShowPreview(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 内容区 */}
          <div
            className="max-h-[85vh] max-w-[85vw] w-[700px] rounded-[6px] border border-white/10 bg-[#1a1a1a] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {previewLoading && (
              <div className="flex items-center justify-center h-40 text-xs text-white/40 animate-pulse">
                加载中...
              </div>
            )}
            {previewError && (
              <div className="flex items-center justify-center h-40 text-xs text-white/40">
                文件加载失败
              </div>
            )}
            {previewContent !== null && !previewLoading && !previewError && (
              <div className="p-4 overflow-auto max-h-[75vh] custom-scrollbar markdown-preview-container select-text text-white/80">
                <MdPreview
                  theme="dark"
                  modelValue={getMarkdownContent(previewContent, fileName)}
                  previewTheme="default"
                  codeTheme="atom"
                  codeFoldable={false}
                  autoFoldThreshold={Infinity}
                  style={{ backgroundColor: "transparent" }}
                  showCodeRowNumber={false}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
