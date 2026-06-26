import type React from "react";
import { FolderGit2, Plus } from "lucide-react";

export interface PromptProjectListProps {
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

/**
 * Sidebar 中专门为 prompts mode 渲染的列表内容。
 * 展示提示词项目概览，点击具体项目会在主区的 PromptDesignWorkspace 打开对应画布。
 */
export const PromptProjectList: React.FC<PromptProjectListProps> = ({
  isCollapsed,
  // onCollapsedChange,
}) => {
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 w-[60px] h-full bg-[#111111]">
        <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" title="New Project">
          <Plus className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-[6px] bg-white/5 flex items-center justify-center text-white/50 cursor-pointer" title="Default Project">
          <FolderGit2 className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-[240px] bg-[#111111] overflow-hidden transition-all duration-300">
      <div className="p-3">
        <button className="w-full flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/15 rounded-[6px] text-sm text-white transition-colors">
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2 px-2 pt-2">
          Recent Projects
        </div>
        
        <div className="flex flex-col gap-1">
          {/* Mock Project Item */}
          <div className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-white/5 text-sm flex items-center gap-2 group cursor-pointer transition-colors bg-white/10">
            <FolderGit2 className="w-4 h-4 text-white/60" />
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-white/90 leading-tight">Default Project</span>
              <span className="text-[10px] text-white/40 truncate">2 cards • Local</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
