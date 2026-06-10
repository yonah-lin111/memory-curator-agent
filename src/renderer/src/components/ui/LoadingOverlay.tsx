import type React from "react";

// LoadingOverlayProps - LoadingOverlay 组件属性接口。
interface LoadingOverlayProps {
  // 当前是否处于 loading 状态。
  isLoading: boolean;
  // loading 时显示的提示文本，默认为 "整理数据中..."。
  text?: string;
  // 容器的圆角大小，默认为 "rounded-[6px]"。
  rounded?: string;
}

/**
 * LoadingOverlay - 全局/局部通用遮罩加载组件。
 * 遵循极简主义黑白设计，并实现“进入瞬间显示，退出平滑渐隐”的动态加载。
 */
export const LoadingOverlay = ({
  isLoading,
  text = "整理数据中...",
  rounded = "rounded-[6px]",
}: LoadingOverlayProps): React.JSX.Element => {
  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#212121] select-none ${rounded} ${
        isLoading
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none transition-opacity duration-300 ease-out"
      }`}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes custom-loading-dots {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(-4px); opacity: 0.95; }
        }
      `}} />
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-1.5 h-6">
          <span className="w-1 bg-white rounded-full" style={{ height: '6px', animation: 'custom-loading-dots 1.2s ease-in-out infinite', animationDelay: '0ms' }} />
          <span className="w-1 bg-white rounded-full" style={{ height: '6px', animation: 'custom-loading-dots 1.2s ease-in-out infinite', animationDelay: '200ms' }} />
          <span className="w-1 bg-white rounded-full" style={{ height: '6px', animation: 'custom-loading-dots 1.2s ease-in-out infinite', animationDelay: '400ms' }} />
        </div>
        <div className="text-xs text-white/40 font-medium tracking-wide">
          {text}
        </div>
      </div>
    </div>
  );
};
