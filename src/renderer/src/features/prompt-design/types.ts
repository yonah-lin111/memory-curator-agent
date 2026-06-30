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
