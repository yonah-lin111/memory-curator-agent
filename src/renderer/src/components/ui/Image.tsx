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
  // 预设纵横比，支持 "square" (1:1) | "video" (16:9) | "auto" | 自定义数字比例。
  aspectRatio?: "square" | "video" | "auto" | number;
}

/**
 * Image - 精美、支持加载骨架、加载失败捕获、悬浮过渡与高级全屏 Lightbox 预览的图片组件。
 */
export const Image = ({
  src,
  alt = "",
  preview = true,
  className = "",
  aspectRatio = "auto",
  onClick,
  ...props
}: ImageProps): React.JSX.Element => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  // 拖拽时的位移坐标。
  const [position, setPosition] = useState({ x: 0, y: 0 });
  // 是否正在拖拽。
  const [isDragging, setIsDragging] = useState(false);
  // 拖拽起始点指针坐标。
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  /**
   * 根据传入的 aspectRatio 属性计算外层包裹容器的 CSS 纵横比样式。
   */
  const getAspectRatioStyle = (): React.CSSProperties => {
    if (!aspectRatio || aspectRatio === "auto") {
      return {};
    }
    if (aspectRatio === "square") {
      return { aspectRatio: 1 };
    }
    if (aspectRatio === "video") {
      return { aspectRatio: 16 / 9 };
    }
    return { aspectRatio };
  };

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

  // 重置放大、旋转和偏移参数。
  useEffect(() => {
    if (!showLightbox) {
      setScale(1);
      setRotate(0);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
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

  /**
   * 处理图片拖拽开始事件（Pointer Down）。
   * 记录起始指针坐标，并捕获指针以确保事件连续性。
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    e.preventDefault(); // 阻止浏览器默认拖拽行为，避免产生幽灵图
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  /**
   * 处理图片拖拽移动事件（Pointer Move）。
   * 根据当前指针位置计算图片偏移量。
   */
  const handlePointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
  };

  /**
   * 处理图片拖拽结束事件（Pointer Up）。
   * 结束拖拽状态，释放指针捕获。
   */
  const handlePointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  /**
   * 处理鼠标滚轮缩放事件（Wheel）。
   * 向上滚动放大图片，向下滚动缩小图片，限制范围在 0.5 到 3 之间。
   */
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const zoomFactor = 0.1;
    setScale((s) => {
      const nextScale = e.deltaY < 0 ? s + zoomFactor : s - zoomFactor;
      return Math.max(0.5, Math.min(nextScale, 3));
    });
  };

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-[6px] bg-white/[0.02] border border-white/5 group/img-box ${className}`}
        style={getAspectRatioStyle()}
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
            className="max-h-[85vh] max-w-[85vw] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheel}
          >
            <img
              data-testid="lightbox-img"
              src={src}
              alt={alt}
              draggable="false"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                transform:
                  position.x === 0 && position.y === 0
                    ? `scale(${scale}) rotate(${rotate}deg)`
                    : `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotate}deg)`,
                transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.2, 0.85, 0.2, 1)",
                cursor: isDragging ? "grabbing" : scale > 1 ? "grab" : "default",
              }}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};
