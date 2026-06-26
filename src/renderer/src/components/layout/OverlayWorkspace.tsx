import type React from "react";

/**
 * 带有淡入淡出动画的重叠工作区容器组件。
 * 支持在主页面内容与不同 Overlay（如 AI 对话、提示词设计）之间切换。
 */
export interface OverlayWorkspaceProps {
  /** 页面底层内容节点 */
  children: React.ReactNode;
  /**
   * 当前激活的 Overlay 名称。
   * 为 "none" 时显示 children，否则根据名称选择渲染 overlays 里的某一个。
   */
  activeOverlay: "none" | "chat" | "prompts" | string;
  /**
   * 不同 Overlay 名称对应的渲染节点字典。
   */
  overlays: Record<string, React.ReactNode>;
}

export const OverlayWorkspace: React.FC<OverlayWorkspaceProps> = ({
  children,
  activeOverlay,
  overlays,
}) => {
  return (
    <div className="flex-1 min-h-0 relative overflow-hidden w-full h-full">
      {/* 底层页面内容 */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ease-out ${
          activeOverlay !== "none"
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100"
        }`}
        aria-hidden={activeOverlay !== "none"}
      >
        {children}
      </div>

      {/* 各个 Overlay */}
      {Object.entries(overlays).map(([overlayName, overlayNode]) => {
        const isActive = activeOverlay === overlayName;
        return (
          <div
            key={overlayName}
            className={`absolute inset-0 transition-opacity duration-300 ease-out ${
              isActive
                ? "pointer-events-auto opacity-100 z-10"
                : "pointer-events-none opacity-0 -z-10"
            }`}
            aria-hidden={!isActive}
          >
            {overlayNode}
          </div>
        );
      })}
    </div>
  );
};
