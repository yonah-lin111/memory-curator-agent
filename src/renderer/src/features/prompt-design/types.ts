export type Project = {
  id: string;
  name: string;
  type: "filesystem" | "virtual";
  path?: string;
  createdAt: string;
  updatedAt: string;
};

export type PromptDesign = {
  id: string;
  projectId: string;
  name: string;
  designData: any;
  createdAt: string;
  updatedAt: string;
};

// 编辑器引用的不可变行快照。
export type PromptDesignReference = {
  id: string;
  startLine: number;
  endLine: number;
  content: string;
};
