import type React from "react";
import { ReactFlowProvider } from "reactflow";
import { PromptSidebar } from "./PromptSidebar";
import { PromptProjectManager } from "./PromptProjectManager";
// import { PromptCanvas } from "./PromptCanvas";
import { PromptDesignAIPanel } from "./PromptDesignAIPanel";

export const PromptDesignWorkspace = (): React.JSX.Element => {
  return (
    <div className="flex h-full w-full bg-[#111111] overflow-hidden rounded-lg">
      <ReactFlowProvider>
        {/* 左侧资源管理器栏 */}
        <div className="w-[280px] h-full flex-shrink-0 border-r border-white/5 bg-[#0a0a0a]">
          <PromptSidebar />
        </div>

        {/* 中间画布区域 */}
        <div className="flex-1 h-full min-w-0 bg-[#111111] relative">
          <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
            {/* Phase 1/2 实现的 Canvas，这里先占位 */}
            Prompt Canvas Placeholder
          </div>
          {/* <PromptCanvas /> */}
        </div>

        {/* 右侧 AI 设计助手面板 */}
        <PromptDesignAIPanel />
      </ReactFlowProvider>

      {/* 弹窗管理器 */}
      <PromptProjectManager />
    </div>
  );
};
