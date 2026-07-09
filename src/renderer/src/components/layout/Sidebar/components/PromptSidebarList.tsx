import type React from "react";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Import,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import { PromptSidebarContextMenu } from "./PromptSidebarContextMenu";

type PromptSidebarProps = {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  "aria-hidden"?: boolean;
  onDesignSelected?: () => void;
};

export const PromptSidebarList = ({
  isCollapsed = false,
  onCollapsedChange,
  "aria-hidden": ariaHidden,
  onDesignSelected,
}: PromptSidebarProps): React.JSX.Element => {
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  const [projects, setProjects] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);

  const [collapsedProjects, setCollapsedProjects] = useState<
    Record<string, boolean>
  >({});
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [newProjectPath, setNewProjectPath] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [contextMenu, setContextMenu] = useState<{
    type: "project" | "prompt";
    id: string;
    title: string;
    projectId?: string;
    x: number;
    y: number;
  } | null>(null);

  const activeProjectId = usePromptDesignStore((state) => state.activeProjectId);
  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);
  const setActiveProjectId = usePromptDesignStore((state) => state.setActiveProjectId);
  const setActiveDesignId = usePromptDesignStore((state) => state.setActiveDesignId);
  const setProjectName = usePromptDesignStore((state) => state.setProjectName);
  const setItemName = usePromptDesignStore((state) => state.setItemName);

  const fetchData = async () => {
    try {
      if (!window.api || !(window.api as any).promptDesign) {
        return;
      }
      const p = await (window.api as any).promptDesign.projects.list();
      const d = await (window.api as any).promptDesign.designs.list();
      setProjects(p);
      setDesigns(d);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleContextMenu = (
    e: React.MouseEvent,
    type: "project" | "prompt",
    item: { id: string; name: string },
    projectId?: string,
  ) => {
    e.preventDefault();
    setContextMenu({
      type,
      id: item.id,
      title: item.name,
      projectId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const handleRenameCommit = async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const isProject = projects.some(p => p.id === editingId);
      if (isProject) {
        await (window.api as any).promptDesign.projects.rename(editingId, editingName.trim());
      } else {
        await (window.api as any).promptDesign.designs.rename(editingId, editingName.trim());
      }
      await fetchData();
    } catch (error) {
      console.error("Rename failed", error);
    }
    setEditingId(null);
  };

  if (isCollapsed) {
    return (
      <div
        className="flex h-full w-full flex-col items-center gap-4 py-1"
        aria-label="Prompt design list"
        aria-hidden={ariaHidden}
      >
        <Tooltip content="展开" placement="right">
          <IconButton
            aria-label="Expand sidebar"
            onClick={() => onCollapsedChange?.(false)}
          >
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>
    );
  }

  // 按搜索关键字过滤显示
  const keyword = searchKeyword.trim().toLowerCase();

  const mergedProjects = projects.map(proj => ({
    ...proj,
    prompts: designs.filter(d => d.projectId === proj.id)
  }));

  const filteredProjects = mergedProjects
    .map((proj) => {
      if (proj.name.toLowerCase().includes(keyword)) {
        return proj;
      }
      const filteredPrompts = proj.prompts.filter((p: any) =>
        p.name.toLowerCase().includes(keyword),
      );
      if (filteredPrompts.length > 0) {
        return { ...proj, prompts: filteredPrompts };
      }
      return null;
    })
    .filter(Boolean) as any[];

  const handleAddProjectConfirm = async () => {
    if (!newProjectName.trim()) return;
    try {
      await (window.api as any).promptDesign.projects.create({
        name: newProjectName.trim(),
        type: newProjectPath ? "filesystem" : "virtual",
        path: newProjectPath || undefined,
      });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
    setNewProjectName("");
    setNewProjectPath("");
  };

  const handleAddProjectCancel = () => {
    setNewProjectName("");
    setNewProjectPath("");
  };

  const handleImportProject = async () => {
    try {
      const result = await (window.api as any).dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "选择项目文件夹",
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        const folderName = selectedPath.split(/[/\\]/).pop() || "未命名项目";
        await (window.api as any).promptDesign.projects.create({
          name: folderName,
          type: "filesystem",
          path: selectedPath,
        });
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to import project:", error);
    }
  };

  const renderAddProjectForm = () => (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1 text-left">
        <span className="text-[11px] font-semibold text-white/40">
          项目名称
        </span>
        <Input
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder="请输入项目名称"
          size="xs"
          className="!h-[28px]"
        />
      </div>
      <div className="flex flex-col gap-1 text-left">
        <span className="text-[11px] font-semibold text-white/40">
          项目地址 (可选)
        </span>
        <Input
          type="text"
          value={newProjectPath}
          onChange={(e) => setNewProjectPath(e.target.value)}
          placeholder="例如: /Users/xxx/project"
          size="xs"
          className="!h-[28px]"
        />
      </div>
    </div>
  );

  return (
    <div
      className="flex h-full w-full flex-col gap-4"
      aria-label="Prompt design projects list"
      aria-hidden={ariaHidden}
    >
      {/* 顶部标题与折叠按钮 */}
      <div className="flex items-center justify-between px-1 shrink-0 h-7">
        <Tooltip content="收起" placement="right">
          <IconButton
            aria-label="Collapse sidebar"
            onClick={() => onCollapsedChange?.(true)}
          >
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
        </Tooltip>

        <div className="flex items-center gap-0.5">
          <Tooltip content="导入项目" placement="bottom">
            <IconButton aria-label="Import project" onClick={handleImportProject}>
              <Import className="h-4 w-4" />
            </IconButton>
          </Tooltip>
          <Tooltip content="新建项目" placement="bottom">
            <Tooltip
              contentClassName="!w-[240px] !p-3 !whitespace-normal flex flex-col"
              placement="bottom"
              trigger="click"
              form={renderAddProjectForm()}
              onConfirm={handleAddProjectConfirm}
              onCancel={handleAddProjectCancel}
            >
              <IconButton aria-label="New project">
                <Plus className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          </Tooltip>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative px-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          placeholder="搜索项目..."
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          className="w-full rounded-[6px] border border-white/5 bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-white/15"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4 flex flex-col gap-6 px-1">
        <div className="flex flex-col gap-4">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((proj) => {
              const isCollapsed = collapsedProjects[proj.id];
              return (
                <div key={proj.id} className="flex flex-col gap-1.5">
                  <div
                    className={`flex items-center justify-between px-1 py-1 cursor-pointer rounded-[6px] transition-colors group ${activeProjectId === proj.id ? 'bg-white/10' : 'hover:bg-white/[0.02]'}`}
                    onClick={() => {
                      if (editingId !== proj.id) {
                        toggleProject(proj.id);
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, "project", proj)}
                  >
                    <Tooltip
                      content={proj.path || ""}
                      placement="right"
                      contentClassName="whitespace-pre-wrap"
                    >
                      <div className={`flex-1 min-w-0 text-xs font-semibold uppercase tracking-wider transition-colors truncate pr-2 ${activeProjectId === proj.id ? 'text-white/90' : 'text-white/40 group-hover:text-white/60'}`}>
                        {editingId === proj.id ? (
                          <input
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={handleRenameCommit}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleRenameCommit()
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent border-b border-white/20 outline-none text-white/80 w-full"
                          />
                        ) : (
                          proj.name
                        )}
                      </div>
                    </Tooltip>
                    <ChevronRight
                      className={`w-3.5 h-3.5 text-white/30 group-hover:text-white/50 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    />
                  </div>
                  {!isCollapsed && (
                    <div className="flex flex-col gap-0.5">
                      {proj.prompts.length > 0 ? (
                        proj.prompts.map((prompt) => (
                          <div
                            key={prompt.id}
                            className={`w-full text-left flex items-center gap-2.5 p-2 rounded-[6px] transition-all duration-150 cursor-pointer group ${activeDesignId === prompt.id ? 'bg-white/10 text-white' : 'hover:bg-white/[0.02] text-white/70'}`}
                            onClick={async () => {
                              try {
                                const sessions = await (window.api as any).promptAi.listSessions(prompt.id);
                                if (!sessions || sessions.length === 0) {
                                  await (window.api as any).promptAi.createSession(prompt.id);
                                }
                              } catch (err) {
                                  console.error("Failed to check or create session:", err);
                              }
                              setActiveProjectId(proj.id);
                              setActiveDesignId(prompt.id);
                              setProjectName(proj.name);
                              setItemName(prompt.name);
                              onDesignSelected?.();
                            }}
                            onContextMenu={(e) =>
                              handleContextMenu(e, "prompt", prompt, proj.id)
                            }
                          >
                            <div className={`w-1.5 h-1.5 rounded-full transition-colors flex-shrink-0 mx-1 ${activeDesignId === prompt.id ? 'bg-white/50' : 'bg-white/10 group-hover:bg-white/30'}`} />
                            <span className={`flex-1 min-w-0 text-xs truncate transition-colors ${activeDesignId === prompt.id ? 'text-white' : 'group-hover:text-white'}`}>
                              {editingId === prompt.id ? (
                                <input
                                  // eslint-disable-next-line jsx-a11y/no-autofocus
                                  autoFocus
                                  onFocus={(e) => e.target.select()}
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={handleRenameCommit}
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && handleRenameCommit()
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-transparent border-b border-white/20 outline-none text-white/80 w-full"
                                />
                              ) : (
                                prompt.name
                              )}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-white/20 text-center select-none">
                          暂无设计，请右键新建
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-[6px] border border-white/5 px-3 py-4 text-center text-xs text-white/35 mx-1">
              没有匹配的项目
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <PromptSidebarContextMenu
          type={contextMenu.type}
          title={contextMenu.title}
          x={contextMenu.x}
          y={contextMenu.y}
          onAddDesign={async () => {
            try {
              const created = await (window.api as any).promptDesign.designs.create({
                projectId: contextMenu.id,
                name: "新提示词设计",
              });
              await fetchData();
              setCollapsedProjects((prev) => ({
                ...prev,
                [contextMenu.id]: false,
              }));
              // 新建后自动进入编辑名称状态
              if (created?.id) {
                setEditingId(created.id);
                setEditingName(created.name || "新提示词设计");
              }
            } catch (error) {
              console.error("Add design failed", error);
            }
            setContextMenu(null);
          }}
          onRename={() => {
            setEditingId(contextMenu.id);
            setEditingName(contextMenu.title);
            setContextMenu(null);
          }}
          onDelete={async () => {
            try {
              if (contextMenu.type === "project") {
                await (window.api as any).promptDesign.projects.delete(contextMenu.id);
                if (activeProjectId === contextMenu.id) {
                  setActiveProjectId(null);
                  setActiveDesignId(null);
                }
              } else {
                await (window.api as any).promptDesign.designs.delete(contextMenu.id);
                if (activeDesignId === contextMenu.id) {
                  setActiveDesignId(null);
                }
              }
              await fetchData();
            } catch (error) {
              console.error("Delete failed", error);
            }
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
};
