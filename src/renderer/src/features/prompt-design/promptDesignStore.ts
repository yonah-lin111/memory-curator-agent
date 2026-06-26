import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  PromptProject,
  PromptDesign,
  PromptConnection,
  CanvasViewport,
} from "./types";

interface PromptDesignState {
  // 数据字典
  projects: Record<string, PromptProject>;
  designs: Record<string, PromptDesign>; // 全局所有的设计卡片
  connections: Record<string, PromptConnection>;

  // 当前选中状态
  activeProjectId: string | null;
  activeDesignId: string | null;
  selectedDesignIds: string[]; // 支持多选

  // 视图状态
  canvasViewports: Record<string, CanvasViewport>; // 按 projectId 存储
  isAIPanelOpen: boolean;

  // actions
  setActiveProject: (projectId: string | null) => void;
  setActiveDesign: (designId: string | null) => void;
  setSelectedDesigns: (designIds: string[]) => void;
  toggleAIPanel: (isOpen?: boolean) => void;

  // Project CRUD
  addProject: (project: PromptProject) => void;
  updateProject: (id: string, project: Partial<PromptProject>) => void;
  deleteProject: (id: string) => void;

  // Design CRUD
  addDesign: (design: PromptDesign) => void;
  updateDesign: (id: string, design: Partial<PromptDesign>) => void;
  deleteDesign: (id: string) => void;
  updateDesignPosition: (id: string, position: { x: number; y: number }) => void;

  // Connection CRUD
  addConnection: (connection: PromptConnection) => void;
  updateConnection: (id: string, connection: Partial<PromptConnection>) => void;
  deleteConnection: (id: string) => void;

  // 环路检测
  wouldCreateCycle: (sourceId: string, targetId: string) => boolean;

  // Viewport
  setCanvasViewport: (projectId: string, viewport: CanvasViewport) => void;
}

export const usePromptDesignStore = create<PromptDesignState>()(
  persist(
    (set, get) => ({
      projects: {},
      designs: {},
      connections: {},

      activeProjectId: null,
      activeDesignId: null,
      selectedDesignIds: [],

      canvasViewports: {},
      isAIPanelOpen: false,

      setActiveProject: (projectId) =>
        set({
          activeProjectId: projectId,
          activeDesignId: null,
          selectedDesignIds: [],
        }),

      setActiveDesign: (designId) =>
        set((state) => {
          if (!designId) {
            return { activeDesignId: null, selectedDesignIds: [] };
          }
          return {
            activeDesignId: designId,
            selectedDesignIds: [designId],
            isAIPanelOpen: true, // 选中节点自动打开 AI 面板
          };
        }),

      setSelectedDesigns: (designIds) =>
        set({
          selectedDesignIds: designIds,
          activeDesignId: designIds.length === 1 ? designIds[0] : null,
        }),

      toggleAIPanel: (isOpen) =>
        set((state) => ({
          isAIPanelOpen: isOpen !== undefined ? isOpen : !state.isAIPanelOpen,
        })),

      addProject: (project) =>
        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
        })),

      updateProject: (id, project) =>
        set((state) => {
          const current = state.projects[id];
          if (!current) return state;
          return {
            projects: { ...state.projects, [id]: { ...current, ...project } },
          };
        }),

      deleteProject: (id) =>
        set((state) => {
          const { [id]: _, ...restProjects } = state.projects;

          // 级联删除相关的 designs 和 connections
          const newDesigns = { ...state.designs };
          const newConnections = { ...state.connections };

          Object.keys(newDesigns).forEach((key) => {
            if (newDesigns[key].projectId === id) {
              delete newDesigns[key];
            }
          });

          Object.keys(newConnections).forEach((key) => {
            if (newConnections[key].projectId === id) {
              delete newConnections[key];
            }
          });

          return {
            projects: restProjects,
            designs: newDesigns,
            connections: newConnections,
            activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
            activeDesignId: state.activeProjectId === id ? null : state.activeDesignId,
          };
        }),

      addDesign: (design) =>
        set((state) => ({
          designs: { ...state.designs, [design.id]: design },
        })),

      updateDesign: (id, design) =>
        set((state) => {
          const current = state.designs[id];
          if (!current) return state;
          return {
            designs: { ...state.designs, [id]: { ...current, ...design } },
          };
        }),

      deleteDesign: (id) =>
        set((state) => {
          const { [id]: _, ...restDesigns } = state.designs;

          // 删除相关的连接
          const newConnections = { ...state.connections };
          Object.keys(newConnections).forEach((key) => {
            if (
              newConnections[key].sourceId === id ||
              newConnections[key].targetId === id
            ) {
              delete newConnections[key];
            }
          });

          return {
            designs: restDesigns,
            connections: newConnections,
            activeDesignId: state.activeDesignId === id ? null : state.activeDesignId,
            selectedDesignIds: state.selectedDesignIds.filter((dId) => dId !== id),
          };
        }),

      updateDesignPosition: (id, position) =>
        set((state) => {
          const current = state.designs[id];
          if (!current) return state;
          return {
            designs: {
              ...state.designs,
              [id]: { ...current, position },
            },
          };
        }),

      addConnection: (connection) =>
        set((state) => ({
          connections: { ...state.connections, [connection.id]: connection },
        })),

      updateConnection: (id, connection) =>
        set((state) => {
          const current = state.connections[id];
          if (!current) return state;
          return {
            connections: { ...state.connections, [id]: { ...current, ...connection } },
          };
        }),

      deleteConnection: (id) =>
        set((state) => {
          const { [id]: _, ...restConnections } = state.connections;
          return { connections: restConnections };
        }),

      wouldCreateCycle: (sourceId: string, targetId: string) => {
        const { connections } = get();
        // 如果目标已经是源，或者要连向自己，就是环
        if (sourceId === targetId) return true;

        const visited = new Set<string>();

        // 查找是否有从 targetId 到 sourceId 的路径
        const hasPath = (currentId: string, targetNodeId: string): boolean => {
          if (currentId === targetNodeId) return true;
          if (visited.has(currentId)) return false;

          visited.add(currentId);

          // 找到所有从 currentId 出发的连接
          const outgoingConnections = Object.values(connections).filter(
            (c) => c.sourceId === currentId
          );

          for (const conn of outgoingConnections) {
            if (hasPath(conn.targetId, targetNodeId)) {
              return true;
            }
          }

          return false;
        };

        return hasPath(targetId, sourceId);
      },

      setCanvasViewport: (projectId, viewport) =>
        set((state) => ({
          canvasViewports: { ...state.canvasViewports, [projectId]: viewport },
        })),
    }),
    {
      name: "prompt-design-storage",
      partialize: (state) => ({
        projects: state.projects,
        designs: state.designs,
        connections: state.connections,
        canvasViewports: state.canvasViewports,
        // 其他状态不持久化
      }),
    }
  )
);
