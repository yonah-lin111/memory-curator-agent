import { create } from 'zustand';

interface PromptDesignState {
  isCanvasLocked: boolean;
  setIsCanvasLocked: (locked: boolean) => void;
  exportRequest: number;
  exportFormat: 'xml' | 'markdown';
  requestExport: (format?: 'xml' | 'markdown') => void;
  resetExportRequest: () => void;
  edgeType: 'smoothstep' | 'default';
  setEdgeType: (type: 'smoothstep' | 'default') => void;
  projectName: string;
  setProjectName: (name: string) => void;
  itemName: string;
  setItemName: (name: string) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeDesignId: string | null;
  setActiveDesignId: (id: string | null) => void;
  // 添加一个可选的 updateNodeData 方法，供内部节点在画布外层缺失上下文时安全调用更新
  updateNodeData?: (nodeId: string, newData: any) => void;
  setUpdateNodeData: (fn: (nodeId: string, newData: any) => void) => void;
}

export const usePromptDesignStore = create<PromptDesignState>((set) => ({
  isCanvasLocked: false,
  setIsCanvasLocked: (locked: boolean) => set({ isCanvasLocked: locked }),
  exportRequest: 0,
  exportFormat: 'xml',
  requestExport: (format = 'xml') => set((state) => ({ exportRequest: state.exportRequest + 1, exportFormat: format })),
  resetExportRequest: () => set({ exportRequest: 0 }),
  edgeType: 'default',
  setEdgeType: (type: 'smoothstep' | 'default') => set({ edgeType: type }),
  projectName: '未命名项目',
  setProjectName: (name: string) => set({ projectName: name }),
  itemName: '未命名设计',
  setItemName: (name: string) => set({ itemName: name }),
  activeProjectId: null,
  setActiveProjectId: (id: string | null) => set({ activeProjectId: id }),
  activeDesignId: null,
  setActiveDesignId: (id: string | null) => set({ activeDesignId: id }),
  updateNodeData: undefined,
  setUpdateNodeData: (fn) => set({ updateNodeData: fn }),
}));
