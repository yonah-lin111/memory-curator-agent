import { create } from 'zustand';

interface PromptDesignState {
  isCanvasLocked: boolean;
  setIsCanvasLocked: (locked: boolean) => void;
}

export const usePromptDesignStore = create<PromptDesignState>((set) => ({
  isCanvasLocked: false,
  setIsCanvasLocked: (locked: boolean) => set({ isCanvasLocked: locked }),
}));
