import type { Viewport } from "@xyflow/react";

/** 项目类型：虚拟项目（仅存数据库）或文件系统项目（与本地目录绑定） */
export type PromptProjectType = "virtual" | "filesystem";

/** 提示词项目 */
export interface PromptProject {
  id: string;
  name: string;
  type: PromptProjectType;
  rootDirectory?: string;
  createdAt: number;
  updatedAt: number;
}

/** 提示词设计（即卡片节点） */
export interface PromptDesign {
  id: string;
  projectId: string;
  title: string;
  content: string;
  tags?: string[];
  chatSessionId?: string; // 关联的 AI 会话 ID
  position: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
}

/** 提示词设计间的连线（边） */
export interface PromptConnection {
  id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  condition?: string;
  createdAt: number;
  updatedAt: number;
}

/** 画布视口状态 */
export interface CanvasViewport extends Viewport {}

/** React Flow 节点数据 */
export interface PromptNodeData extends Record<string, unknown> {
  id: string;
  title: string;
  content: string;
  tags?: string[];
}
