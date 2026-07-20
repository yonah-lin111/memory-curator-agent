import { create } from 'zustand';

interface PromptDesignState {
  projectName: string;
  setProjectName: (name: string) => void;
  itemName: string;
  setItemName: (name: string) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  // 当前活动模块标识。
  activeModuleId: string | null;
  // 设置当前活动模块。
  setActiveModuleId: (id: string | null) => void;
  activeDesignId: string | null;
  setActiveDesignId: (id: string | null) => void;
  // 切换设计项前触发的回调集合。
  beforeDesignSwitchCallbacks: (() => Promise<boolean>)[];
  // 注册切换前拦截回调。返回取消注册函数。
  setBeforeDesignSwitch: (callback: () => Promise<boolean>) => () => void;
  // 设置当前活动设计项，触发拦截校验。
  setActiveDesignIdSafe: (id: string | null) => Promise<boolean>;
}

export const usePromptDesignStore = create<PromptDesignState>((set, get) => ({
  projectName: '未命名项目',
  setProjectName: (name: string) => set({ projectName: name }),
  itemName: '未命名设计',
  setItemName: (name: string) => set({ itemName: name }),
  activeProjectId: null,
  setActiveProjectId: (id: string | null) => set({ activeProjectId: id }),
  activeModuleId: null,
  setActiveModuleId: (id: string | null) => set({ activeModuleId: id }),
  activeDesignId: null,
  setActiveDesignId: (id: string | null) => set({ activeDesignId: id }),
  beforeDesignSwitchCallbacks: [],
  setBeforeDesignSwitch: (callback) => {
    set((state) => ({
      beforeDesignSwitchCallbacks: [...state.beforeDesignSwitchCallbacks, callback],
    }));
    return () => {
      set((state) => ({
        beforeDesignSwitchCallbacks: state.beforeDesignSwitchCallbacks.filter(
          (cb) => cb !== callback,
        ),
      }));
    };
  },
  setActiveDesignIdSafe: async (id) => {
    const { beforeDesignSwitchCallbacks } = get();
    for (const callback of beforeDesignSwitchCallbacks) {
      const canSwitch = await callback();
      if (!canSwitch) return false;
    }
    set({ activeDesignId: id });
    return true;
  },
}));
