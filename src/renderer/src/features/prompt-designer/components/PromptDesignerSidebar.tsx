import type React from "react";
import { useState } from "react";
import { Folder, FolderOpen, FileText, Plus, ChevronDown, ChevronRight, MoreVertical } from "lucide-react";
import { usePromptDesignerStore } from "../usePromptDesignerStore";
import { IconButton } from "@/components/ui/IconButton";

export const PromptDesignerSidebar = (): React.JSX.Element => {
  const { 
    projects, 
    prompts, 
    activeProjectId, 
    activePromptId, 
    setActiveProject, 
    setActivePrompt,
    createProject,
    createPrompt
  } = usePromptDesignerStore();

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>(
    projects.reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
  );

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const handleAddProject = () => {
    const name = window.prompt("请输入项目名称");
    if (name) {
      createProject(name);
    }
  };

  const handleAddPrompt = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const name = window.prompt("请输入提示词名称");
    if (name) {
      createPrompt(projectId, name);
      setExpandedProjects(prev => ({ ...prev, [projectId]: true }));
    }
  };

  return (
    <div className="w-[260px] h-full bg-[#1A1A1A] border-r border-white/5 flex flex-col">
      <div className="p-3 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-xs font-bold text-white/60 tracking-wider">PROJECTS</h2>
        <IconButton size="small" onClick={handleAddProject} title="新建项目">
          <Plus className="w-3.5 h-3.5" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {projects.map(project => {
          const isExpanded = expandedProjects[project.id];
          const projectPrompts = prompts.filter(p => p.projectId === project.id);
          
          return (
            <div key={project.id} className="mb-1">
              <div 
                className={`flex items-center group px-2 py-1.5 rounded-[6px] cursor-pointer hover:bg-white/5 ${
                  activeProjectId === project.id && !activePromptId ? "bg-white/10" : ""
                }`}
                onClick={() => {
                  setActiveProject(project.id);
                  setActivePrompt(null);
                  toggleProject(project.id);
                }}
              >
                <span className="text-white/40 mr-1.5 transition-transform duration-200">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </span>
                <span className="text-white/50 mr-2">
                  {isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                </span>
                <span className="flex-1 text-sm text-white/80 truncate select-none">
                  {project.name}
                </span>
                <IconButton 
                  size="small" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleAddPrompt(project.id, e)}
                  title="新建提示词"
                >
                  <Plus className="w-3.5 h-3.5" />
                </IconButton>
              </div>

              {/* Sub-list of Prompts */}
              <div 
                className={`overflow-hidden transition-all duration-200 ease-in-out`}
                style={{ maxHeight: isExpanded ? `${projectPrompts.length * 32}px` : "0px", opacity: isExpanded ? 1 : 0 }}
              >
                {projectPrompts.map(prompt => {
                  const isActive = activePromptId === prompt.id;
                  return (
                    <div 
                      key={prompt.id}
                      className={`flex items-center pl-8 pr-2 py-1.5 mt-0.5 rounded-[6px] cursor-pointer hover:bg-white/5 ${
                        isActive ? "bg-white/10 text-white" : "text-white/60"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveProject(project.id);
                        setActivePrompt(prompt.id);
                      }}
                    >
                      <FileText className={`w-3.5 h-3.5 mr-2 ${isActive ? "text-amber-400" : "text-white/40"}`} />
                      <span className="text-sm truncate select-none">{prompt.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
