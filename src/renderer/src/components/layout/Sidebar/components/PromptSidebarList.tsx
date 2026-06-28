import type React from "react";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Folder,
  Component,
  Plus,
  Import,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";
import {
  cardTypeMeta,
  iconMap,
  type PromptCardType,
} from "@/features/prompt-design/components/PromptNode";
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import { PromptSidebarContextMenu } from "./PromptSidebarContextMenu";

const initialProjects = [
  {
    id: "proj1",
    name: "项目1",
    prompts: [
      { id: "p1-1", name: "提示词设计1" },
      { id: "p1-2", name: "提示词设计2" },
    ],
  },
  {
    id: "proj2",
    name: "项目2",
    prompts: [
      { id: "p2-1", name: "提示词设计1" },
      { id: "p2-2", name: "提示词设计2" },
    ],
  },
];

type PromptSidebarProps = {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  "aria-hidden"?: boolean;
};

export const PromptSidebarList = ({
  isCollapsed = false,
  onCollapsedChange,
  "aria-hidden": ariaHidden,
}: PromptSidebarProps): React.JSX.Element => {
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"components" | "projects">(
    "components",
  );
  const [projects, setProjects] = useState(initialProjects);
  const [collapsedProjects, setCollapsedProjects] = useState<
    Record<string, boolean>
  >({});
  const [newProjectName, setNewProjectName] = useState<string>("");
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

  const isLocked = usePromptDesignStore((state) => state.isCanvasLocked);

  useEffect(() => {
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

  const handleRenameCommit = () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === editingId) {
          return { ...p, name: editingName.trim() };
        }
        return {
          ...p,
          prompts: p.prompts.map((pr) =>
            pr.id === editingId ? { ...pr, name: editingName.trim() } : pr
          ),
        };
      })
    );
    setEditingId(null);
  };

  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: PromptCardType,
  ) => {
    if (isLocked) return;
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  if (isCollapsed) {
    const connectedTypesAll = Object.entries(cardTypeMeta).filter(
      ([_, meta]) => !meta.isIndependent,
    ) as [PromptCardType, (typeof cardTypeMeta)[PromptCardType]][];

    const independentTypesAll = Object.entries(cardTypeMeta).filter(
      ([_, meta]) => meta.isIndependent,
    ) as [PromptCardType, (typeof cardTypeMeta)[PromptCardType]][];

    return (
      <div
        className="flex h-full w-full flex-col items-center gap-4 py-1"
        aria-label="Prompt design components"
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

        <div
          className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-3 pb-4 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {connectedTypesAll.map(([type, meta]) => (
            <Tooltip key={type} content={meta.label} placement="right">
              <div
                className={`w-9 h-9 flex-shrink-0 rounded-[6px] transition-colors ${
                  isLocked
                    ? "opacity-50 cursor-not-allowed grayscale"
                    : "cursor-grab active:cursor-grabbing hover:bg-white/[0.02]"
                }`}
                draggable={!isLocked}
                onDragStart={(e) => onDragStart(e, type)}
              >
                <div
                  className={`w-full h-full ${meta.color} bg-opacity-10 border border-white/10 rounded-[6px] flex items-center justify-center`}
                >
                  {iconMap[meta.defaultIcon] || (
                    <div className="w-4 h-4 bg-white/20 rounded-full" />
                  )}
                </div>
              </div>
            </Tooltip>
          ))}

          <div className="w-4 h-[1px] bg-white/10 my-1 flex-shrink-0" />

          {independentTypesAll.map(([type, meta]) => (
            <Tooltip key={type} content={meta.label} placement="right">
              <div
                className={`w-9 h-9 flex-shrink-0 rounded-[6px] transition-colors ${
                  isLocked
                    ? "opacity-50 cursor-not-allowed grayscale"
                    : "cursor-grab active:cursor-grabbing hover:bg-white/[0.02]"
                }`}
                draggable={!isLocked}
                onDragStart={(e) => onDragStart(e, type)}
              >
                <div
                  className={`w-full h-full ${meta.color} bg-opacity-10 border border-white/10 rounded-[6px] flex items-center justify-center`}
                >
                  {iconMap[meta.defaultIcon] || (
                    <div className="w-4 h-4 bg-white/20 rounded-full" />
                  )}
                </div>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>
    );
  }

  // 按类型和搜索关键字过滤显示
  const keyword = searchKeyword.trim().toLowerCase();

  const connectedTypes = Object.entries(cardTypeMeta).filter(
    ([_, meta]) =>
      !meta.isIndependent &&
      (meta.label.toLowerCase().includes(keyword) ||
        _.toLowerCase().includes(keyword)),
  ) as [PromptCardType, (typeof cardTypeMeta)[PromptCardType]][];

  const independentTypes = Object.entries(cardTypeMeta).filter(
    ([_, meta]) =>
      meta.isIndependent &&
      (meta.label.toLowerCase().includes(keyword) ||
        _.toLowerCase().includes(keyword)),
  ) as [PromptCardType, (typeof cardTypeMeta)[PromptCardType]][];

  const filteredProjects = projects
    .map((proj) => {
      if (proj.name.toLowerCase().includes(keyword)) {
        return proj;
      }
      const filteredPrompts = proj.prompts.filter((p) =>
        p.name.toLowerCase().includes(keyword),
      );
      if (filteredPrompts.length > 0) {
        return { ...proj, prompts: filteredPrompts };
      }
      return null;
    })
    .filter(Boolean) as typeof initialProjects;

  const handleAddProjectConfirm = async () => {
    if (!newProjectName.trim()) return;
    const newProject = {
      id: `proj-${Date.now()}`,
      name: newProjectName.trim(),
      prompts: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setNewProjectName("");
  };

  const handleAddProjectCancel = () => {
    setNewProjectName("");
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
    </div>
  );

  return (
    <div
      className="flex h-full w-full flex-col gap-4"
      aria-label="Prompt design components"
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
          {activeTab === "projects" && (
            <>
              <Tooltip content="导入项目" placement="bottom">
                <IconButton aria-label="Import project">
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
              <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />
            </>
          )}
          <Tooltip
            content={
              activeTab === "components" ? "切换到项目列表" : "切换到组件列表"
            }
            placement="bottom"
          >
            <IconButton
              aria-label="Toggle view"
              onClick={() =>
                setActiveTab(
                  activeTab === "components" ? "projects" : "components",
                )
              }
            >
              {activeTab === "components" ? (
                <Folder className="h-4 w-4" />
              ) : (
                <Component className="h-4 w-4" />
              )}
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative px-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          placeholder={
            activeTab === "components" ? "搜索组件..." : "搜索项目..."
          }
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          className="w-full rounded-[6px] border border-white/5 bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-white/15"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4 flex flex-col gap-6 px-1">
        {activeTab === "components" ? (
          <>
            {/* 连线组件 */}
            {connectedTypes.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">
                  流程卡片
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {connectedTypes.map(([type, meta]) => (
                    <div
                      key={type}
                      className={`w-full text-left flex items-center gap-3 p-2.5 rounded-[6px] transition-all duration-150 group border border-transparent ${
                        isLocked
                          ? "opacity-50 cursor-not-allowed grayscale"
                          : "hover:bg-white/[0.02] text-white/70 cursor-grab active:cursor-grabbing"
                      }`}
                      draggable={!isLocked}
                      onDragStart={(e) => onDragStart(e, type)}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-9 h-9 ${meta.color} bg-opacity-10 border border-white/10 rounded-[6px] flex items-center justify-center`}
                        >
                          {iconMap[meta.defaultIcon] || (
                            <div className="w-4 h-4 bg-white/20 rounded-full" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-xs font-bold truncate text-white/90 group-hover:text-white">
                          {meta.label}
                        </span>
                        <span className="text-xs text-white/40 truncate group-hover:text-white/65 font-mono">
                          {type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 独立组件 */}
            {independentTypes.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">
                  独立卡片
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {independentTypes.map(([type, meta]) => (
                    <div
                      key={type}
                      className={`w-full text-left flex items-center gap-3 p-2.5 rounded-[6px] transition-all duration-150 group border border-transparent ${
                        isLocked
                          ? "opacity-50 cursor-not-allowed grayscale"
                          : "hover:bg-white/[0.02] text-white/70 cursor-grab active:cursor-grabbing"
                      }`}
                      draggable={!isLocked}
                      onDragStart={(e) => onDragStart(e, type)}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-9 h-9 ${meta.color} bg-opacity-10 border border-white/10 rounded-[6px] flex items-center justify-center`}
                        >
                          {iconMap[meta.defaultIcon] || (
                            <div className="w-4 h-4 bg-white/20 rounded-full" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-xs font-bold truncate text-white/90 group-hover:text-white">
                          {meta.label}
                        </span>
                        <span className="text-xs text-white/40 truncate group-hover:text-white/65 font-mono">
                          {type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {connectedTypes.length === 0 && independentTypes.length === 0 && (
              <div className="rounded-[6px] border border-white/5 px-3 py-4 text-center text-xs text-white/35 mx-1">
                没有匹配的组件
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((proj) => {
                const isCollapsed = collapsedProjects[proj.id];
                return (
                  <div key={proj.id} className="flex flex-col gap-1.5">
                    <div
                      className="flex items-center justify-between px-1 py-1 cursor-pointer rounded-[6px] hover:bg-white/[0.02] transition-colors group"
                      onClick={() => {
                        if (editingId !== proj.id) {
                          toggleProject(proj.id);
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, "project", proj)}
                    >
                      <div className="flex-1 min-w-0 text-xs font-semibold text-white/40 uppercase tracking-wider group-hover:text-white/60 transition-colors truncate pr-2">
                        {editingId === proj.id ? (
                          <input
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
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
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-white/30 group-hover:text-white/50 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                      />
                    </div>
                    {!isCollapsed && (
                      <div className="flex flex-col gap-0.5">
                        {proj.prompts.map((prompt) => (
                          <div
                            key={prompt.id}
                            className="w-full text-left flex items-center gap-2.5 p-2 rounded-[6px] transition-all duration-150 hover:bg-white/[0.02] text-white/70 cursor-pointer group"
                            onContextMenu={(e) =>
                              handleContextMenu(e, "prompt", prompt, proj.id)
                            }
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-white/30 transition-colors flex-shrink-0 mx-1" />
                            <span className="flex-1 min-w-0 text-xs truncate group-hover:text-white transition-colors">
                              {editingId === prompt.id ? (
                                <input
                                  // eslint-disable-next-line jsx-a11y/no-autofocus
                                  autoFocus
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
                        ))}
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
        )}
      </div>

      {contextMenu && (
        <PromptSidebarContextMenu
          type={contextMenu.type}
          title={contextMenu.title}
          x={contextMenu.x}
          y={contextMenu.y}
          onAddDesign={() => {
            setProjects((prev) =>
              prev.map((p) =>
                p.id === contextMenu.id
                  ? {
                      ...p,
                      prompts: [
                        ...p.prompts,
                        { id: `prompt-${Date.now()}`, name: "新提示词设计" },
                      ],
                    }
                  : p
              )
            );
            setCollapsedProjects((prev) => ({
              ...prev,
              [contextMenu.id]: false,
            }));
            setContextMenu(null);
          }}
          onRename={() => {
            setEditingId(contextMenu.id);
            setEditingName(contextMenu.title);
            setContextMenu(null);
          }}
          onDelete={() => {
            if (contextMenu.type === "project") {
              setProjects((prev) =>
                prev.filter((p) => p.id !== contextMenu.id)
              );
            } else {
              setProjects((prev) =>
                prev.map((p) =>
                  p.id === contextMenu.projectId
                    ? {
                        ...p,
                        prompts: p.prompts.filter(
                          (pr) => pr.id !== contextMenu.id
                        ),
                      }
                    : p
                )
              );
            }
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
};
