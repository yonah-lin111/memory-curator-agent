export type Project = {
  id: string;
  name: string;
  type: "filesystem" | "virtual";
  path?: string;
  createdAt: number;
  updatedAt: number;
};
