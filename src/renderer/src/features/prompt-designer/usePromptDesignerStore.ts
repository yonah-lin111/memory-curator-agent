import { create } from "zustand";
import type { PromptProject, PromptDesign } from "./types";

interface PromptDesignerState {
  projects: PromptProject[];
  prompts: PromptDesign[];
  activeProjectId: string | null;
  activePromptId: string | null;
  
  setProjects: (projects: PromptProject[]) => void;
  setPrompts: (prompts: PromptDesign[]) => void;
  setActiveProject: (id: string | null) => void;
  setActivePrompt: (id: string | null) => void;
  
  createProject: (name: string) => void;
  createPrompt: (projectId: string, name: string) => void;
  updatePromptContent: (id: string, content: string) => void;
  saveNewVersion: (id: string, notes?: string) => void;
}

// Mock Data
const MOCK_PROJECTS: PromptProject[] = [
  {
    id: "proj-1",
    name: "日常助手",
    description: "用于处理日常任务的提示词",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "proj-2",
    name: "开发辅助",
    description: "写代码专用的提示词",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const MOCK_PROMPTS: PromptDesign[] = [
  {
    id: "prompt-1",
    projectId: "proj-1",
    name: "翻译小助手",
    content: "你是一个专业的翻译，请将以下文本翻译为{{目标语言}}：\n\n{{文本}}",
    currentVersionNumber: 1,
    versions: [
      {
        id: "v1-1",
        content: "你是一个专业的翻译，请将以下文本翻译为{{目标语言}}：\n\n{{文本}}",
        versionNumber: 1,
        createdAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const generateId = () => Math.random().toString(36).substring(2, 9);

export const usePromptDesignerStore = create<PromptDesignerState>((set, get) => ({
  projects: MOCK_PROJECTS,
  prompts: MOCK_PROMPTS,
  activeProjectId: MOCK_PROJECTS[0]?.id || null,
  activePromptId: MOCK_PROMPTS[0]?.id || null,

  setProjects: (projects) => set({ projects }),
  setPrompts: (prompts) => set({ prompts }),
  setActiveProject: (activeProjectId) => set({ activeProjectId }),
  setActivePrompt: (activePromptId) => set({ activePromptId }),

  createProject: (name) => {
    const newProject: PromptProject = {
      id: `proj-${generateId()}`,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    set((state) => ({ projects: [...state.projects, newProject] }));
  },

  createPrompt: (projectId, name) => {
    const newPrompt: PromptDesign = {
      id: `prompt-${generateId()}`,
      projectId,
      name,
      content: "",
      currentVersionNumber: 1,
      versions: [
        {
          id: `v1-${generateId()}`,
          content: "",
          versionNumber: 1,
          createdAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    set((state) => ({ 
      prompts: [...state.prompts, newPrompt],
      activePromptId: newPrompt.id
    }));
  },

  updatePromptContent: (id, content) => {
    set((state) => ({
      prompts: state.prompts.map(p => 
        p.id === id ? { ...p, content, updatedAt: new Date().toISOString() } : p
      )
    }));
  },

  saveNewVersion: (id, notes) => {
    set((state) => ({
      prompts: state.prompts.map(p => {
        if (p.id !== id) return p;
        const newVersionNumber = p.currentVersionNumber + 1;
        const newVersion = {
          id: `v${newVersionNumber}-${generateId()}`,
          content: p.content,
          versionNumber: newVersionNumber,
          notes,
          createdAt: new Date().toISOString()
        };
        return {
          ...p,
          currentVersionNumber: newVersionNumber,
          versions: [newVersion, ...p.versions],
          updatedAt: new Date().toISOString()
        };
      })
    }));
  }
}));
