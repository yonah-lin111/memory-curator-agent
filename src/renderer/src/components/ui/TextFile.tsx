import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { FileText, X } from "lucide-react";

export interface TextFileProps {
  // 文本文件协议 URL。
  url: string;
  // 原始文件名。
  fileName: string;
  // 文件大小（字节）。
  sizeBytes: number;
  // 是否支持点击预览。
  preview?: boolean;
  // 附加容器类名。
  className?: string;
}

/**
 * 格式化文件大小。
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
};

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
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const iconColor = TEXT_EXTENSION_COLORS[extension] ?? "text-white/50";

  // 关闭预览时重置状态。
  useEffect(() => {
    if (!showPreview) {
      setPreviewContent(null);
      setPreviewLoading(false);
      setPreviewError(false);
    }
  }, [showPreview]);

  // Escape 键关闭。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showPreview) {
        setShowPreview(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPreview]);

  /**
   * 点击打开预览，拉取文本内容。
   */
  const handleClick = useCallback((): void => {
    if (!preview) {
      return;
    }

    setShowPreview(true);
    setPreviewLoading(true);
    setPreviewError(false);

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch");
        }

        return response.text();
      })
      .then((text) => {
        setPreviewContent(text);
        setPreviewLoading(false);
      })
      .catch(() => {
        setPreviewError(true);
        setPreviewLoading(false);
      });
  }, [url, preview]);

  return (
    <>
      <div
        data-testid="text-file-card"
        onClick={handleClick}
        className={`relative flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.02] px-2.5 py-1.5 select-none ${preview ? "cursor-pointer hover:bg-white/[0.04]" : ""} ${className}`}
        title={fileName}
      >
        <FileText className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="text-xs text-white/70 truncate max-w-[120px]">
          {fileName}
        </span>
        <span className="text-[10px] text-white/30 shrink-0">
          {formatFileSize(sizeBytes)}
        </span>
      </div>

      {showPreview && (
        <div
          data-testid="text-file-preview"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
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
              <pre className="p-4 text-xs text-white/80 font-mono whitespace-pre-wrap break-all overflow-auto max-h-[85vh] custom-scrollbar leading-relaxed select-text">
                {previewContent}
              </pre>
            )}
          </div>
        </div>
      )}
    </>
  );
};
