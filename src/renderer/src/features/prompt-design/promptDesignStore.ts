import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, PromptDesign, CardConnection } from "./types";

interface PromptDesignState {
  projects: Project[];
  activeProjectId: string | null;
  activePromptDesignId: string | null;
  promptDesigns: Record<string, PromptDesign[]>;
  connections: Record<string, CardConnection[]>;
  canvasViewport: { x: number; y: number; zoom: number };
  selectedCardIds: string[];
  isAIPanelOpen: boolean;

  // Actions
  createProject: (project: Omit<Project, "id" | "createdAt" | "updatedAt">) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  
  createPromptDesign: (projectId: string, prompt: Omit<PromptDesign, "id" | "projectId" | "createdAt" | "updatedAt">) => void;
  deletePromptDesign: (projectId: string, id: string) => void;
  updatePromptContent: (projectId: string, id: string, content: string) => void;
  updatePromptTitle: (projectId: string, id: string, title: string) => void;
  updateCardPosition: (projectId: string, id: string, x: number, y: number) => void;
  
  setCanvasViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  toggleAIPanel: (isOpen?: boolean) => void;
  setActiveProject: (id: string | null) => void;
  setActivePromptDesign: (id: string | null) => void;
}

export const usePromptDesignStore = create<PromptDesignState>()(
  persist(
    (set) => ({
      projects: [],
      activeProjectId: null,
      activePromptDesignId: null,
      promptDesigns: {},
      connections: {},
      canvasViewport: { x: 0, y: 0, zoom: 1 },
      selectedCardIds: [],
      isAIPanelOpen: false,

      createProject: (projectInfo) => set((state) => {
        const id = `proj_${Date.now()}`;
        const newProject: Project = {
          ...projectInfo,
          id,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        return {
          projects: [...state.projects, newProject],
          promptDesigns: { ...state.promptDesigns, [id]: [] },
          connections: { ...state.connections, [id]: [] },
          activeProjectId: id
        };
      }),

      deleteProject: (id) => set((state) => {
        const newProjects = state.projects.filter(p => p.id !== id);
        const { [id]: _, ...newPromptDesigns } = state.promptDesigns;
        const { [id]: __, ...newConnections } = state.connections;
        
        return {
          projects: newProjects,
          promptDesigns: newPromptDesigns,
          connections: newConnections,
          activeProjectId: state.activeProjectId === id ? (newProjects[0]?.id || null) : state.activeProjectId,
          activePromptDesignId: state.activeProjectId === id ? null : state.activePromptDesignId
        };
      }),

      renameProject: (id, name) => set((state) => ({
        projects: state.projects.map(p => 
          p.id === id ? { ...p, name, updatedAt: Date.now() } : p
        )
      })),

      createPromptDesign: (projectId, promptInfo) => set((state) => {
        const id = `prompt_${Date.now()}`;
        const newPrompt: PromptDesign = {
          ...promptInfo,
          id,
          projectId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        const projectPrompts = state.promptDesigns[projectId] || [];
        
        return {
          promptDesigns: {
            ...state.promptDesigns,
            [projectId]: [...projectPrompts, newPrompt]
          },
          activePromptDesignId: id,
          isAIPanelOpen: true
        };
      }),

      deletePromptDesign: (projectId, id) => set((state) => {
        const projectPrompts = state.promptDesigns[projectId] || [];
        const projectConnections = state.connections[projectId] || [];
        
        return {
          promptDesigns: {
            ...state.promptDesigns,
            [projectId]: projectPrompts.filter(p => p.id !== id)
          },
          connections: {
            ...state.connections,
            [projectId]: projectConnections.filter(c => c.sourceId !== id && c.targetId !== id)
          },
          activePromptDesignId: state.activePromptDesignId === id ? null : state.activePromptDesignId
        };
      }),

      updatePromptContent: (projectId, id, content) => set((state) => {
        const projectPrompts = state.promptDesigns[projectId] || [];
        return {
          promptDesigns: {
            ...state.promptDesigns,
            [projectId]: projectPrompts.map(p => 
              p.id === id ? { ...p, content, updatedAt: Date.now() } : p
            )
          }
        };
      }),

      updatePromptTitle: (projectId, id, title) => set((state) => {
        const projectPrompts = state.promptDesigns[projectId] || [];
        return {
          promptDesigns: {
            ...state.promptDesigns,
            [projectId]: projectPrompts.map(p => 
              p.id === id ? { ...p, title, updatedAt: Date.now() } : p
            )
          }
        };
      }),

      updateCardPosition: (projectId, id, x, y) => set((state) => {
        const projectPrompts = state.promptDesigns[projectId] || [];
        return {
          promptDesigns: {
            ...state.promptDesigns,
            [projectId]: projectPrompts.map(p => 
              p.id === id ? { ...p, canvasX: x, canvasY: y, updatedAt: Date.now() } : p
            )
          }
        };
      }),

      setCanvasViewport: (viewport) => set({ canvasViewport: viewport }),
      
      toggleAIPanel: (isOpen) => set((state) => ({ 
        isAIPanelOpen: isOpen !== undefined ? isOpen : !state.isAIPanelOpen 
      })),
      
      setActiveProject: (id) => set({ 
        activeProjectId: id,
        activePromptDesignId: null 
      }),
      
      setActivePromptDesign: (id) => set({ activePromptDesignId: id })
    }),
    {
      name: "prompt-design-storage",
      partialize: (state) => ({ 
        projects: state.projects,
        promptDesigns: state.promptDesigns,
        connections: state.connections,
        canvasViewport: state.canvasViewport 
      }),
    }
  )
);
