import type React from "react";
import { PromptAiSidebar } from "@/features/prompt-design/components/PromptAiSidebar";

interface PromptDesignWorkspaceProps {
  isOpen: boolean;
  isPromptAiSidebarOpen?: boolean;
  onClosePromptAiSidebar?: () => void;
}

/**
 * 提示词设计工作区。
 * 主区域保持空白，提示词 AI 侧边栏独立提供辅助能力。
 */
export const PromptDesignWorkspace = ({
  isOpen,
  isPromptAiSidebarOpen = false,
  onClosePromptAiSidebar,
}: PromptDesignWorkspaceProps): React.JSX.Element | null => {
  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#000000]">
      <div className="min-w-0 flex-1 rounded-[6px] border border-white/5 bg-[#212121] shadow-inner" />
      <PromptAiSidebar isOpen={isPromptAiSidebarOpen} onClose={onClosePromptAiSidebar} />
    </div>
  );
};
