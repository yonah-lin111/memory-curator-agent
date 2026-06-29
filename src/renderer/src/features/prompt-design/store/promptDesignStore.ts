import { create } from 'zustand';

interface PromptDesignState {
  isCanvasLocked: boolean;
  setIsCanvasLocked: (locked: boolean) => void;
  exportRequest: number;
  requestExport: () => void;
  resetExportRequest: () => void;
}

export const usePromptDesignStore = create<PromptDesignState>((set) => ({
  isCanvasLocked: false,
  setIsCanvasLocked: (locked: boolean) => set({ isCanvasLocked: locked }),
  exportRequest: 0,
  requestExport: () => set((state) => ({ exportRequest: state.exportRequest + 1 })),
  resetExportRequest: () => set({ exportRequest: 0 }),
}));
