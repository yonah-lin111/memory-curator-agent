import type React from "react";
import { useState } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

// 可预览图片组件属性。
export type PreviewableImageProps = {
  // 图片地址。
  src: string;
  // 图片替代文本。
  alt: string;
  // 图片显示变体。
  variant?: "thumbnail" | "message";
  // 移除图片回调。
  onRemove?: () => void;
  // 附加类名。
  className?: string;
};

/**
 * PreviewableImage - 渲染可点击预览的本地图片。
 */
export const PreviewableImage = ({
  src,
  alt,
  variant = "thumbnail",
  onRemove,
  className = "",
}: PreviewableImageProps): React.JSX.Element => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const sizeClass =
    variant === "thumbnail" ? "h-16 w-16" : "max-h-[320px] max-w-[420px]";

  return (
    <>
      <div className={`group/image relative ${sizeClass} ${className}`}>
        <button
          type="button"
          aria-label={`预览图片 ${alt}`}
          className="h-full w-full overflow-hidden rounded-[6px] border border-white/10 bg-[#212121] text-left block"
          onClick={() => setIsPreviewOpen(true)}
        >
          {hasError ? (
            <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-rose-300">
              图片加载失败
            </span>
          ) : (
            <img
              src={src}
              alt={alt}
              className="h-full w-full object-cover transition-transform duration-200 group-hover/image:scale-[1.03]"
              onError={() => setHasError(true)}
            />
          )}
        </button>
        {onRemove ? (
          <button
            type="button"
            aria-label={`移除图片 ${alt}`}
            className="absolute top-0 right-0 -translate-y-[25%] translate-x-[25%] rounded-full border border-white/10 bg-black p-1 text-white/80 opacity-0 transition-opacity hover:text-rose-500 hover:bg-rose-500/20 group-hover/image:opacity-100 z-10"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {isPreviewOpen ? (
        <div
          role="dialog"
          aria-label="图片预览"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div className="relative max-h-full max-w-full">
            <IconButton
              size="small"
              title="关闭预览"
              className="absolute -right-3 -top-3 bg-[#212121]"
              onClick={() => setIsPreviewOpen(false)}
            >
              <X className="h-4 w-4" />
            </IconButton>
            <img
              src={src}
              alt={alt}
              className="max-h-[82vh] max-w-[82vw] rounded-[6px] border border-white/10 object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
    </>
  );
};
