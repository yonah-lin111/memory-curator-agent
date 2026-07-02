import { create } from "zustand";
import type { Project } from "./types";

interface PromptDesignState {
  projects: Project[];
  activeProjectId: string | null;
  isAIPanelOpen: boolean;

  fetchProjects: () => Promise<void>;
  createProject: (project: Omit<Project, "id" | "createdAt" | "updatedAt">) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  toggleAIPanel: (isOpen?: boolean) => void;
  setActiveProject: (id: string | null) => void;
}

export const usePromptDesignStore = create<PromptDesignState>()((set, get) => ({
  projects: [],
  activeProjectId: null,
  isAIPanelOpen: false,

  fetchProjects: async () => {
    try {
      const projects = await (window.api as any).promptDesign.projects.list();
      set({ projects });
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  },

  createProject: async (projectInfo) => {
    try {
      const newProject = await (window.api as any).promptDesign.projects.create(projectInfo);
      const { projects } = get();
      set({
        projects: [newProject, ...projects], // 最新在前
        activeProjectId: newProject.id
      });
      return newProject;
    } catch (error) {
      console.error("Failed to create project:", error);
      throw error;
    }
  },

  deleteProject: async (id) => {
    try {
      await (window.api as any).promptDesign.projects.delete(id);
      const { projects, activeProjectId } = get();
      const newProjects = projects.filter((p) => p.id !== id);
      set({
        projects: newProjects,
        activeProjectId: activeProjectId === id ? (newProjects[0]?.id || null) : activeProjectId,
      });
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  },

  renameProject: async (id, name) => {
    try {
      await (window.api as any).promptDesign.projects.rename(id, name);
      const { projects } = get();
      set({
        projects: projects.map((p) => (p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p)),
      });
    } catch (error) {
      console.error("Failed to rename project:", error);
    }
  },

  toggleAIPanel: (isOpen) => set((state) => ({ 
    isAIPanelOpen: isOpen !== undefined ? isOpen : !state.isAIPanelOpen 
  })),
  
  setActiveProject: (id) => set({ activeProjectId: id })
}));
