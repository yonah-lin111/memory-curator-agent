import { useCallback, useEffect, useState } from "react";
import { usePromptDesignStore } from "./promptDesignStore";
import { createPromptUuid } from "./core/promptIds";
import type { PromptProject, PromptDesign, PromptConnection } from "./types";

export function usePromptDesignController() {
  const store = usePromptDesignStore();

  // 是否打开了 Prompt Design Overlay
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const togglePrompts = useCallback((open?: boolean) => {
    setIsPromptsOpen((prev) => (open !== undefined ? open : !prev));
  }, []);

  // 1. 初始化默认项目
  useEffect(() => {
    // 检查是否已有项目，如果没有，创建默认项目
    const hasProjects = Object.keys(store.projects).length > 0;
    if (!hasProjects) {
      const defaultProjectId = createPromptUuid();
      const now = Date.now();
      store.addProject({
        id: defaultProjectId,
        name: "默认项目",
        type: "virtual",
        createdAt: now,
        updatedAt: now,
      });
      store.setActiveProject(defaultProjectId);
    } else if (!store.activeProjectId) {
      // 如果有项目但未选中，选中第一个
      const firstProjectId = Object.keys(store.projects)[0];
      if (firstProjectId) {
        store.setActiveProject(firstProjectId);
      }
    }
  }, [store.projects, store.activeProjectId, store.addProject, store.setActiveProject]);

  // 2. 派生状态
  const activeProject = store.activeProjectId
    ? store.projects[store.activeProjectId]
    : null;

  const currentProjectDesigns = store.activeProjectId
    ? Object.values(store.designs).filter(
        (d) => d.projectId === store.activeProjectId
      )
    : [];

  const currentProjectConnections = store.activeProjectId
    ? Object.values(store.connections).filter(
        (c) => c.projectId === store.activeProjectId
      )
    : [];

  const activeDesign = store.activeDesignId
    ? store.designs[store.activeDesignId]
    : null;

  // 3. 项目操作
  const createProject = useCallback(
    (name: string, type: "virtual" | "filesystem" = "virtual", rootDirectory?: string) => {
      const newProject: PromptProject = {
        id: createPromptUuid(),
        name,
        type,
        rootDirectory,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      store.addProject(newProject);
      store.setActiveProject(newProject.id);
      return newProject;
    },
    [store]
  );

  // 4. 卡片(Design)操作
  const createDesign = useCallback(
    (
      title: string,
      content: string = "",
      position: { x: number; y: number } = { x: 100, y: 100 }
    ) => {
      if (!store.activeProjectId) return null;

      const newDesign: PromptDesign = {
        id: createPromptUuid(),
        projectId: store.activeProjectId,
        title,
        content,
        position,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      store.addDesign(newDesign);
      store.setActiveDesign(newDesign.id);
      return newDesign;
    },
    [store]
  );

  // 5. 连线操作
  const createConnection = useCallback(
    (
      sourceId: string,
      targetId: string,
      sourceHandle?: string | null,
      targetHandle?: string | null,
      condition?: string
    ) => {
      if (!store.activeProjectId) return null;

      // 检查环路
      if (store.wouldCreateCycle(sourceId, targetId)) {
        console.warn("Cannot create connection: would create a cycle");
        return null;
      }

      const newConnection: PromptConnection = {
        id: createPromptUuid(),
        projectId: store.activeProjectId,
        sourceId,
        targetId,
        sourceHandle,
        targetHandle,
        condition,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      store.addConnection(newConnection);
      return newConnection;
    },
    [store]
  );

  return {
    // 基础状态
    isPromptsOpen,
    togglePrompts,

    // 状态
    projects: store.projects,
    designs: store.designs,
    connections: store.connections,
    activeProjectId: store.activeProjectId,
    activeDesignId: store.activeDesignId,
    selectedDesignIds: store.selectedDesignIds,
    isAIPanelOpen: store.isAIPanelOpen,

    // 派生状态
    activeProject,
    currentProjectDesigns,
    currentProjectConnections,
    activeDesign,

    // 动作 - 基础
    setActiveProject: store.setActiveProject,
    setActiveDesign: store.setActiveDesign,
    setSelectedDesigns: store.setSelectedDesigns,
    toggleAIPanel: store.toggleAIPanel,

    // 动作 - CRUD
    createProject,
    updateProject: store.updateProject,
    deleteProject: store.deleteProject,

    createDesign,
    updateDesign: store.updateDesign,
    deleteDesign: store.deleteDesign,
    updateDesignPosition: store.updateDesignPosition,

    createConnection,
    updateConnection: store.updateConnection,
    deleteConnection: store.deleteConnection,
    wouldCreateCycle: store.wouldCreateCycle,

    // Viewport
    canvasViewports: store.canvasViewports,
    setCanvasViewport: store.setCanvasViewport,
  };
}
