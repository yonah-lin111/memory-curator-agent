import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project } from "./types";

interface PromptDesignState {
  projects: Project[];
  activeProjectId: string | null;
  isAIPanelOpen: boolean;

  createProject: (project: Omit<Project, "id" | "createdAt" | "updatedAt">) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  toggleAIPanel: (isOpen?: boolean) => void;
  setActiveProject: (id: string | null) => void;
}

export const usePromptDesignStore = create<PromptDesignState>()(
  persist(
    (set) => ({
      projects: [],
      activeProjectId: null,
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
          activeProjectId: id
        };
      }),

      deleteProject: (id) => set((state) => {
        const newProjects = state.projects.filter(p => p.id !== id);
        return {
          projects: newProjects,
          activeProjectId: state.activeProjectId === id ? (newProjects[0]?.id || null) : state.activeProjectId,
        };
      }),

      renameProject: (id, name) => set((state) => ({
        projects: state.projects.map(p => 
          p.id === id ? { ...p, name, updatedAt: Date.now() } : p
        )
      })),
      
      toggleAIPanel: (isOpen) => set((state) => ({ 
        isAIPanelOpen: isOpen !== undefined ? isOpen : !state.isAIPanelOpen 
      })),
      
      setActiveProject: (id) => set({ activeProjectId: id })
    }),
    {
      name: "prompt-design-storage",
      partialize: (state) => ({ 
        projects: state.projects,
      }),
    }
  )
);
