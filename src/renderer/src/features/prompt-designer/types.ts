export type PromptProject = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type PromptVersion = {
  id: string;
  content: string;
  versionNumber: number;
  notes?: string;
  createdAt: string;
};

export type PromptDesign = {
  id: string;
  projectId: string;
  name: string;
  content: string;
  currentVersionNumber: number;
  versions: PromptVersion[];
  createdAt: string;
  updatedAt: string;
};
