import type React from "react";
import { useState } from "react";
import { PromptAiSidebar } from "@/features/prompt-design/components/PromptAiSidebar";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";

interface PromptDesignWorkspaceProps {
  isOpen: boolean;
  isPromptAiSidebarOpen?: boolean;
  onClosePromptAiSidebar?: () => void;
}

/**
 * 提示词设计工作区。
 * 主区域包含 Markdown 编辑器编辑提示词内容，右侧提示词 AI 侧边栏提供辅助能力。
 */
export const PromptDesignWorkspace = ({
  isOpen,
  isPromptAiSidebarOpen = false,
  onClosePromptAiSidebar,
}: PromptDesignWorkspaceProps): React.JSX.Element | null => {
  if (!isOpen) return null;

  const [content, setContent] = useState("");

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#000000]">
      <div className="min-w-0 flex-1 rounded-[6px] border border-white/5 bg-[#212121] shadow-inner overflow-hidden">
        <MarkdownEditor
          id="prompt-design-editor"
          value={content}
          onChange={setContent}
          placeholder="在此编辑提示词内容..."
          height="100%"
          defaultMode="edit"
        />
      </div>
      <PromptAiSidebar isOpen={isPromptAiSidebarOpen} onClose={onClosePromptAiSidebar} />
    </div>
  );
};
