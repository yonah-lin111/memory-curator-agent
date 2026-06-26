import type React from "react";
import { FolderPlus, Search, Settings, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

/**
 * 提示词设计功能 - 左侧边栏。
 * 负责展示和管理提示词项目及卡片列表。
 */
export const PromptSidebar = (): React.JSX.Element => {
  return (
    <div className="flex flex-col h-full text-white">
      {/* 顶部搜索与操作栏 */}
      <div className="flex-shrink-0 p-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-[6px] text-xs text-white/50 w-full mr-2">
          <Search className="w-3.5 h-3.5" />
          <input 
            type="text" 
            placeholder="Search projects..." 
            className="bg-transparent border-none outline-none w-full placeholder:text-white/30 text-white"
          />
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            title="Create Project"
            aria-label="Create new prompt project"
            className="text-white/50 hover:text-white hover:bg-white/10"
            // onClick={() => openProjectManager()}
          >
            <FolderPlus className="w-4 h-4" />
          </IconButton>
          <IconButton
            title="Settings"
            aria-label="Prompt design settings"
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            <Settings className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      {/* 项目列表容器 */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 px-2 pt-2">
          Projects
        </div>
        
        {/* Placeholder: 空状态或列表 */}
        <div className="flex flex-col gap-1">
          <div className="w-full text-left px-2 py-1.5 rounded-[6px] hover:bg-white/5 text-sm flex items-center group cursor-pointer transition-colors bg-white/10">
            <span className="truncate flex-1 text-white/90">Default Project</span>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              <IconButton className="w-5 h-5 bg-transparent p-0 hover:bg-white/10" title="Add Card">
                <Plus className="w-3 h-3 text-white/70" />
              </IconButton>
            </div>
          </div>
          
          {/* Mock 卡片列表 */}
          <div className="pl-6 flex flex-col gap-0.5 mt-1">
            <div className="px-2 py-1.5 rounded-[6px] hover:bg-white/5 text-[13px] text-white/70 cursor-pointer">
              System Prompt
            </div>
            <div className="px-2 py-1.5 rounded-[6px] hover:bg-white/5 text-[13px] text-white/70 cursor-pointer">
              User Input Handler
            </div>
          </div>
        </div>
      </div>

      {/* 底部操作区 */}
      <div className="flex-shrink-0 p-3 border-t border-white/5">
        <button className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-[6px] text-sm text-white/80 transition-colors">
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>
    </div>
  );
};
