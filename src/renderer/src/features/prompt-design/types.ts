export type Project = {
  id: string;
  name: string;
  type: "filesystem" | "virtual";
  path?: string; // filesystem 类型的工作目录
  createdAt: number;
  updatedAt: number;
};

export type CardConnection = {
  id: string;
  projectId: string;
  sourceId: string; 
  targetId: string; 
  condition?: string; 
};

export type PromptDesign = {
  id: string;
  projectId: string;
  chatSessionId: string;
  title: string;
  content: string;
  canvasX: number;
  canvasY: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};
