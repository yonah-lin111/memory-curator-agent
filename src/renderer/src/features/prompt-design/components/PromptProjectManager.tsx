import type React from "react";
// import { useState } from "react";
// import { usePromptDesignController } from "../usePromptDesignController";

/**
 * 提示词项目管理弹窗。
 * 负责创建新项目、重命名和删除项目。
 */
export const PromptProjectManager = (): React.JSX.Element | null => {
  // const { isProjectManagerOpen, closeProjectManager } = usePromptDesignController();
  const isProjectManagerOpen = false; // Placeholder

  if (!isProjectManagerOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-[6px] w-[400px] shadow-2xl p-4">
        <h2 className="text-sm font-medium text-white mb-4">Create New Project</h2>
        
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-white/60">Project Name</label>
            <input 
              type="text" 
              className="w-full bg-black/40 border border-white/10 rounded-[6px] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
              placeholder="e.g. Chatbot Prompts"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs text-white/60">Project Type</label>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 bg-white/10 border border-white/20 rounded-[6px] text-xs text-white">
                Virtual (DB)
              </button>
              <button className="flex-1 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 rounded-[6px] text-xs text-white/50">
                File System
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button 
            className="px-3 py-1.5 rounded-[6px] text-xs text-white/70 hover:text-white hover:bg-white/5"
            // onClick={closeProjectManager}
          >
            Cancel
          </button>
          <button className="px-3 py-1.5 rounded-[6px] text-xs bg-white text-black font-medium hover:bg-white/90">
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
