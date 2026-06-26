import type React from "react";
import { useEffect } from "react";
import { usePromptDesignStore } from "../promptDesignStore";
import { PromptCanvas } from "./PromptCanvas";

interface PromptDesignWorkspaceProps {
  isOpen: boolean;
}

export const PromptDesignWorkspace = ({ isOpen }: PromptDesignWorkspaceProps): React.JSX.Element | null => {
  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-[#000000] text-white">
      <div className="flex-1 flex overflow-hidden">
        {/* 中间无限画布区 */}
        <div className="flex-1 relative flex flex-col min-w-0 bg-[#212121]/50">
          <PromptCanvas />
          
          {/* 画布底部工具栏 (占位) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#212121] border border-white/10 rounded-full px-4 py-2 flex items-center gap-3 shadow-lg z-10">
            <span className="text-xs text-white/50">画布工具栏</span>
          </div>
        </div>

        {/* 右侧 AI 面板 (占位) */}
        <div className="w-[360px] flex-shrink-0 border-l border-white/10 bg-[#1e1e1e] flex flex-col transition-all duration-300 transform translate-x-0">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-medium">AI 助手</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center text-white/30 text-sm">
            暂无会话内容
          </div>
          <div className="p-4 border-t border-white/10">
            <div className="bg-[#2a2a2a] rounded-[6px] border border-white/10 p-3 text-xs text-white/50 text-center">
              AI 输入框
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
