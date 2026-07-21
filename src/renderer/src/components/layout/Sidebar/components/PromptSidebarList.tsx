import type React from "react";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText, Search, Plus, Import } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import {
  PROMPT_DESIGN_CREATED_EVENT,
  PROMPT_DESIGN_TITLE_GENERATING_EVENT,
  PROMPT_DESIGN_TITLE_UPDATED_EVENT,
} from "@/features/prompt-design/lib/promptCommand";
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
  const [modules, setModules] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);
  const [titleGeneratingDesignId, setTitleGeneratingDesignId] = useState<string | null>(null);

  const [collapsedProjects, setCollapsedProjects] = useState<
    Record<string, boolean>
  >({});
  const [collapsedModules, setCollapsedModules] = useState<
    Record<string, boolean>
  >({});
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [newProjectPath, setNewProjectPath] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  /** 路径编辑状态 */
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
  const [editingPath, setEditingPath] = useState<string>("");
  /** 项目编辑状态（Modal 表单） */
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState<string>("");
  const [editingProjectPath, setEditingProjectPath] = useState<string>("");
  /** 记录哪些项目名称已检测为截断（scrollWidth > clientWidth） */
  const [truncatedIds, setTruncatedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    type: "project" | "module" | "prompt";
    id: string;
    title: string;
    projectId?: string;
    projectPath?: string;
    x: number;
    y: number;
  } | null>(null);

  const activeProjectId = usePromptDesignStore(
    (state) => state.activeProjectId,
  );
  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);
  const setActiveProjectId = usePromptDesignStore(
    (state) => state.setActiveProjectId,
  );
  const setActiveDesignId = usePromptDesignStore(
    (state) => state.setActiveDesignId,
  );
  const setActiveModuleId = usePromptDesignStore(
    (state) => state.setActiveModuleId,
  );
  const setProjectName = usePromptDesignStore((state) => state.setProjectName);
  const setItemName = usePromptDesignStore((state) => state.setItemName);

  const fetchData = async () => {
    try {
      if (!window.api || !(window.api as any).promptDesign) {
        return;
      }
      const p = await (window.api as any).promptDesign.projects.list();
      const m = await (window.api as any).promptDesign.modules.list();
      const d = await (window.api as any).promptDesign.designs.list();
      setProjects(p);
      setModules(m);
      setDesigns(d);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const handleClick = () => setContextMenu(null);
    const handlePromptDesignCreated = () => {
      void fetchData();
      const projectId = usePromptDesignStore.getState().activeProjectId;
      if (projectId) {
        setCollapsedProjects((previous) => ({ ...previous, [projectId]: false }));
      }
    };
    const handleTitleGenerating = (event: Event) => {
      const detail = (event as CustomEvent<{ designId: string; isGenerating: boolean }>).detail;
      setTitleGeneratingDesignId(detail?.isGenerating ? detail.designId : null);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener(PROMPT_DESIGN_CREATED_EVENT, handlePromptDesignCreated);
    window.addEventListener(PROMPT_DESIGN_TITLE_UPDATED_EVENT, handlePromptDesignCreated);
    window.addEventListener(PROMPT_DESIGN_TITLE_GENERATING_EVENT, handleTitleGenerating);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener(PROMPT_DESIGN_CREATED_EVENT, handlePromptDesignCreated);
      window.removeEventListener(PROMPT_DESIGN_TITLE_UPDATED_EVENT, handlePromptDesignCreated);
      window.removeEventListener(PROMPT_DESIGN_TITLE_GENERATING_EVENT, handleTitleGenerating);
    };
  }, []);

  const handleContextMenu = (
    e: React.MouseEvent,
    type: "project" | "module" | "prompt",
    item: { id: string; name: string; path?: string },
    projectId?: string,
  ) => {
    e.preventDefault();
    setContextMenu({
      type,
      id: item.id,
      title: item.name,
      projectId,
      projectPath: (item as any).path,
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

  const toggleModule = (moduleId: string) => {
    setCollapsedModules((previous) => ({
      ...previous,
      [moduleId]: !previous[moduleId],
    }));
  };

  const handleRenameCommit = async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      if (projects.some((project) => project.id === editingId)) {
        await (window.api as any).promptDesign.projects.rename(
          editingId,
          editingName.trim(),
        );
      } else if (modules.some((module) => module.id === editingId)) {
        await (window.api as any).promptDesign.modules.rename(
          editingId,
          editingName.trim(),
        );
      } else {
        await (window.api as any).promptDesign.designs.rename(
          editingId,
          editingName.trim(),
        );
      }
      await fetchData();
    } catch (error) {
      console.error("Rename failed", error);
    }
    setEditingId(null);
  };

  /** 提交项目路径编辑 */
  const handlePathCommit = async () => {
    if (!editingPathId || !editingPath.trim()) {
      setEditingPathId(null);
      return;
    }

    try {
      await (window.api as any).promptDesign.projects.update(editingPathId, {
        path: editingPath.trim(),
      });
      await fetchData();
    } catch (error) {
      console.error("Path update failed", error);
    }
    setEditingPathId(null);
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

  const mergedProjects = projects.map((project) => ({
    ...project,
    modules: modules
      .filter((module) => module.projectId === project.id)
      .map((module) => ({
        ...module,
        prompts: designs.filter((design) => design.moduleId === module.id),
      })),
    directPrompts: designs.filter(
      (design) => design.projectId === project.id && !design.moduleId,
    ),
  }));

  const filteredProjects = mergedProjects
    .map((proj) => {
      if (proj.name.toLowerCase().includes(keyword)) {
        return proj;
      }
      const filteredModules = proj.modules
        .map((module: any) => {
          if (module.name.toLowerCase().includes(keyword)) {
            return module;
          }
          const prompts = module.prompts.filter((prompt: any) =>
            prompt.name.toLowerCase().includes(keyword),
          );
          return prompts.length > 0 ? { ...module, prompts } : null;
        })
        .filter(Boolean);
      if (filteredModules.length > 0) {
        return {
          ...proj,
          modules: filteredModules,
          directPrompts: proj.directPrompts.filter((prompt: any) =>
            prompt.name.toLowerCase().includes(keyword),
          ),
        };
      }
      const directPrompts = proj.directPrompts.filter((prompt: any) =>
        prompt.name.toLowerCase().includes(keyword),
      );
      if (directPrompts.length > 0) return { ...proj, directPrompts };
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

  /** 提交项目编辑（名称和路径） */
  const handleEditProjectCommit = async () => {
    if (!editingProjectId || !editingProjectName.trim()) {
      setEditingProjectId(null);
      return;
    }

    try {
      await (window.api as any).promptDesign.projects.update(editingProjectId, {
        name: editingProjectName.trim(),
        path: editingProjectPath.trim() || undefined,
      });
      await fetchData();
    } catch (error) {
      console.error("Project update failed", error);
    }
    setEditingProjectId(null);
  };

  const handleEditProjectCancel = () => {
    setEditingProjectId(null);
  };

  const renderEditProjectForm = () => (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1 text-left">
        <span className="text-[11px] font-semibold text-white/40">
          项目名称
        </span>
        <Input
          type="text"
          value={editingProjectName}
          onChange={(e) => setEditingProjectName(e.target.value)}
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
          value={editingProjectPath}
          onChange={(e) => setEditingProjectPath(e.target.value)}
          placeholder="例如: /Users/xxx/project"
          size="xs"
          className="!h-[28px]"
        />
      </div>
    </div>
  );

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
            <IconButton
              aria-label="Import project"
              onClick={handleImportProject}
            >
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
                    className={`flex items-center justify-between px-1 py-1 cursor-pointer rounded-[6px] transition-colors group ${activeProjectId === proj.id ? "bg-white/10" : "hover:bg-white/[0.02]"}`}
                    onClick={() => {
                      if (editingId !== proj.id && editingPathId !== proj.id) {
                        toggleProject(proj.id);
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, "project", proj)}
                  >
                    {(() => {
                      const isTruncated = truncatedIds.has(proj.id);
                      const isEditing =
                        editingId === proj.id || editingPathId === proj.id;

                      const nameElement = (
                        <div
                          className={`flex-1 min-w-0 text-xs font-semibold uppercase tracking-wider transition-colors truncate pr-2 ${activeProjectId === proj.id ? "text-white/90" : "text-white/40 group-hover:text-white/60"}`}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollWidth > el.clientWidth) {
                              setTruncatedIds((prev) =>
                                new Set(prev).add(proj.id),
                              );
                            }
                          }}
                        >
                          {editingPathId === proj.id ? (
                            <input
                              // eslint-disable-next-line jsx-a11y/no-autofocus
                              autoFocus
                              onFocus={(e) => e.target.select()}
                              value={editingPath}
                              onChange={(e) => setEditingPath(e.target.value)}
                              onBlur={handlePathCommit}
                              onKeyDown={(e) =>
                                e.key === "Enter" &&
                                !e.nativeEvent.isComposing &&
                                handlePathCommit()
                              }
                              onClick={(e) => e.stopPropagation()}
                              placeholder="/path/to/project"
                              className="bg-transparent border-b border-white/20 outline-none text-white/80 w-full normal-case font-normal"
                            />
                          ) : editingId === proj.id ? (
                            <input
                              // eslint-disable-next-line jsx-a11y/no-autofocus
                              autoFocus
                              onFocus={(e) => e.target.select()}
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={handleRenameCommit}
                              onKeyDown={(e) =>
                                e.key === "Enter" &&
                                !e.nativeEvent.isComposing &&
                                handleRenameCommit()
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent border-b border-white/20 outline-none text-white/80 w-full"
                            />
                          ) : (
                            proj.name
                          )}
                        </div>
                      );

                      // 仅在名称被截断且未处于编辑态时显示 Tooltip
                      if (isTruncated && !isEditing) {
                        return (
                          <Tooltip
                            content={proj.name}
                            placement="top"
                            className="flex-1 min-w-0"
                          >
                            {nameElement}
                          </Tooltip>
                        );
                      }

                      return nameElement;
                    })()}
                    <ChevronRight
                      className={`w-3.5 h-3.5 text-white/30 group-hover:text-white/50 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    />
                  </div>
                  {!isCollapsed && (
                    <div className="flex flex-col gap-0.5">
                      {proj.modules.length > 0 ? (
                        proj.modules.map((module: any) => (
                          <div key={module.id} className="flex flex-col gap-0.5">
                            <div
                              className="flex w-full cursor-pointer items-center gap-2.5 rounded-[6px] p-2 text-left text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.02] hover:text-white/85"
                              onClick={() => {
                                if (editingId !== module.id) toggleModule(module.id);
                                setActiveModuleId(module.id);
                              }}
                              onContextMenu={(event) =>
                                handleContextMenu(event, "module", module, proj.id)
                              }
                            >
                              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-[1px] bg-white/20" />
                              {editingId === module.id ? (
                                <input
                                  // eslint-disable-next-line jsx-a11y/no-autofocus
                                  autoFocus
                                  onFocus={(event) => event.target.select()}
                                  value={editingName}
                                  onChange={(event) => setEditingName(event.target.value)}
                                  onBlur={handleRenameCommit}
                                  onKeyDown={(event) =>
                                    event.key === "Enter" &&
                                    !event.nativeEvent.isComposing &&
                                    handleRenameCommit()
                                  }
                                  onClick={(event) => event.stopPropagation()}
                                  className="w-full border-b border-white/20 bg-transparent text-white/80 outline-none"
                                />
                              ) : (
                                <span className="min-w-0 flex-1 truncate">{module.name}</span>
                              )}
                              <ChevronRight
                                className={`h-3.5 w-3.5 text-white/30 transition-transform ${collapsedModules[module.id] ? "" : "rotate-90"}`}
                              />
                            </div>
                            {!collapsedModules[module.id] && module.prompts.map((prompt: any) => (
                              <div
                                key={prompt.id}
                                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[6px] py-2 pr-2 pl-5 text-left transition-all duration-150 group ${activeDesignId === prompt.id ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/[0.02]"}`}
                                onClick={async () => {
                                  try {
                                    const sessions = await (window.api as any).promptAi.listSessions(prompt.id);
                                    if (!sessions || sessions.length === 0) {
                                      await (window.api as any).promptAi.createSession(prompt.id);
                                    }
                                  } catch (error) {
                                    console.error("Failed to check or create session:", error);
                                  }
                                  setActiveProjectId(proj.id);
                                  setActiveModuleId(module.id);
                                  const useStore = usePromptDesignStore.getState();
                                  if (useStore.setActiveDesignIdSafe) {
                                    const success = await useStore.setActiveDesignIdSafe(prompt.id);
                                    if (!success) return;
                                  } else {
                                    setActiveDesignId(prompt.id);
                                  }
                                  setProjectName(proj.name);
                                  setItemName(prompt.name);
                                  onDesignSelected?.();
                                }}
                                onContextMenu={(event) =>
                                  handleContextMenu(event, "prompt", prompt, proj.id)
                                }
                              >
                                {titleGeneratingDesignId === prompt.id ? (
                                  <div className="h-4 w-full animate-pulse rounded-[6px] bg-white/10" />
                                ) : (
                                  <>
                                    <svg className="h-3 w-3 flex-shrink-0 stroke-current text-white/35" viewBox="0 0 12 12" fill="none">
                                      <path d="M3 1v5h7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span className="min-w-0 flex-1 truncate text-xs">
                                      {editingId === prompt.id ? (
                                    <input
                                      // eslint-disable-next-line jsx-a11y/no-autofocus
                                      autoFocus
                                      onFocus={(event) => event.target.select()}
                                      value={editingName}
                                      onChange={(event) => setEditingName(event.target.value)}
                                      onBlur={handleRenameCommit}
                                      onKeyDown={(event) =>
                                        event.key === "Enter" &&
                                        !event.nativeEvent.isComposing &&
                                        handleRenameCommit()
                                      }
                                      onClick={(event) => event.stopPropagation()}
                                      className="w-full border-b border-white/20 bg-transparent text-white/80 outline-none"
                                    />
                                      ) : prompt.name}
                                    </span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ))
                      ) : null}
                      {proj.directPrompts.map((prompt: any) => (
                        <div
                          key={prompt.id}
                          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[6px] p-2 text-left transition-all duration-150 group ${activeDesignId === prompt.id ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/[0.02]"}`}
                          onClick={async () => {
                            try {
                              const sessions = await (window.api as any).promptAi.listSessions(prompt.id);
                              if (!sessions || sessions.length === 0) {
                                await (window.api as any).promptAi.createSession(prompt.id);
                              }
                            } catch (error) {
                              console.error("Failed to check or create session:", error);
                            }
                            setActiveProjectId(proj.id);
                            setActiveModuleId(null);
                            const useStore = usePromptDesignStore.getState();
                            if (useStore.setActiveDesignIdSafe) {
                              const success = await useStore.setActiveDesignIdSafe(prompt.id);
                              if (!success) return;
                            } else {
                              setActiveDesignId(prompt.id);
                            }
                            setProjectName(proj.name);
                            setItemName(prompt.name);
                            onDesignSelected?.();
                          }}
                          onContextMenu={(event) =>
                            handleContextMenu(event, "prompt", prompt, proj.id)
                          }
                        >
                          {titleGeneratingDesignId === prompt.id ? (
                            <div className="h-4 w-full animate-pulse rounded-[6px] bg-white/10" />
                          ) : (
                            <>
                              <FileText className="h-3.5 w-3.5 flex-shrink-0 text-white/35" />
                              <span className="min-w-0 flex-1 truncate text-xs">
                                {editingId === prompt.id ? (
                              <input
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus
                                onFocus={(event) => event.target.select()}
                                value={editingName}
                                onChange={(event) => setEditingName(event.target.value)}
                                onBlur={handleRenameCommit}
                                onKeyDown={(event) =>
                                  event.key === "Enter" &&
                                  !event.nativeEvent.isComposing &&
                                  handleRenameCommit()
                                }
                                onClick={(event) => event.stopPropagation()}
                                className="w-full border-b border-white/20 bg-transparent text-white/80 outline-none"
                              />
                                ) : prompt.name}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                      {proj.modules.length === 0 && proj.directPrompts.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-white/20 text-center select-none">
                          暂无模块，请右键新建
                        </div>
                      ) : null}
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
          onAddModule={async () => {
            try {
              const created = await (window.api as any).promptDesign.modules.create({
                projectId: contextMenu.id,
                name: "新模块",
              });
              await fetchData();
              setCollapsedProjects((prev) => ({ ...prev, [contextMenu.id]: false }));
              if (created?.id) {
                setEditingId(created.id);
                setEditingName(created.name || "新模块");
              }
            } catch (error) {
              console.error("Add module failed", error);
            }
            setContextMenu(null);
          }}
          onAddProjectDesign={async () => {
            try {
              const created = await (window.api as any).promptDesign.designs.create({
                projectId: contextMenu.id,
                name: "新提示词设计",
              });
              await fetchData();
              setCollapsedProjects((previous) => ({
                ...previous,
                [contextMenu.id]: false,
              }));
              if (created?.id) {
                setEditingId(created.id);
                setEditingName(created.name || "新提示词设计");
              }
            } catch (error) {
              console.error("Add project design failed", error);
            }
            setContextMenu(null);
          }}
          onAddDesign={async () => {
            try {
              const created = await (
                window.api as any
              ).promptDesign.designs.create({
                projectId: contextMenu.projectId,
                moduleId: contextMenu.id,
                name: "新提示词设计",
              });
              await fetchData();
              setCollapsedProjects((prev) => ({
                ...prev,
                [contextMenu.projectId || ""]: false,
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
          onEditProject={() => {
            const project = projects.find((p) => p.id === contextMenu.id);
            setEditingProjectId(contextMenu.id);
            setEditingProjectName(contextMenu.title);
            setEditingProjectPath(project?.path || "");
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
                await (window.api as any).promptDesign.projects.delete(
                  contextMenu.id,
                );
                if (activeProjectId === contextMenu.id) {
                  setActiveProjectId(null);
                  setActiveDesignId(null);
                }
              } else if (contextMenu.type === "module") {
                await (window.api as any).promptDesign.modules.delete(contextMenu.id);
                if (designs.some((design) => design.moduleId === contextMenu.id && design.id === activeDesignId)) {
                  setActiveDesignId(null);
                }
              } else {
                await (window.api as any).promptDesign.designs.delete(
                  contextMenu.id,
                );
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

      {/* 项目编辑弹窗 */}
      <Modal
        isOpen={editingProjectId !== null}
        onClose={handleEditProjectCancel}
        title="编辑项目"
        form={renderEditProjectForm()}
        onConfirm={handleEditProjectCommit}
        onCancel={handleEditProjectCancel}
      />
    </div>
  );
};
