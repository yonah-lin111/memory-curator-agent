import type React from "react";
import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  // 图片地址。
  src: string;
  // 图片描述占位。
  alt?: string;
  // 是否支持点击全屏预览。
  preview?: boolean;
}

/**
 * Image - 精美、支持加载骨架、加载失败捕获、悬浮过渡与高级全屏 Lightbox 预览的图片组件。
 */
export const Image = ({
  src,
  alt = "",
  preview = true,
  className = "",
  onClick,
  ...props
}: ImageProps): React.JSX.Element => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showLightbox) {
        setShowLightbox(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showLightbox]);

  // 重置放大和旋转参数。
  useEffect(() => {
    if (!showLightbox) {
      setScale(1);
      setRotate(0);
    }
  }, [showLightbox]);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((s) => Math.min(s + 0.25, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((s) => Math.max(s - 0.25, 0.5));
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotate((r) => (r + 90) % 360);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (onClick) {
      onClick(e);
    }
    if (!error && preview) {
      setShowLightbox(true);
    }
  };

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-[6px] bg-white/[0.02] border border-white/5 group/img-box ${className}`}
      >
        {loading && (
          <div
            data-testid="image-skeleton"
            className="absolute inset-0 bg-white/[0.05] animate-pulse rounded-[6px]"
          />
        )}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          onClick={handleImageClick}
          className={`h-full w-full object-cover transition-all duration-300 ${
            loading ? "opacity-0" : "opacity-100"
          } ${error ? "hidden" : ""} ${
            preview && !error ? "cursor-zoom-in hover:scale-105" : ""
          }`}
          {...props}
        />
        {error && (
          <div
            data-testid="image-error"
            className="flex h-full w-full items-center justify-center p-4 text-xs text-white/40"
          >
            图片加载失败
          </div>
        )}
      </div>

      {showLightbox && (
        <div
          data-testid="image-lightbox"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm select-none"
          onClick={() => setShowLightbox(false)}
        >
          {/* 悬浮控制面板 */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-[10000]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Zoom in"
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/5"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              aria-label="Zoom out"
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/5"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              aria-label="Rotate"
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/5"
              onClick={handleRotate}
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              aria-label="Close preview"
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/5"
              onClick={() => setShowLightbox(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className="max-h-[85vh] max-w-[85vw] overflow-hidden flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              data-testid="lightbox-img"
              src={src}
              alt={alt}
              style={{
                transform: `scale(${scale}) rotate(${rotate}deg)`,
                transition: "transform 0.2s cubic-bezier(0.2, 0.85, 0.2, 1)",
              }}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};
