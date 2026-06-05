import { create } from "zustand";
import type React from "react";

// 全局头部状态接口
type HeaderState = {
  // 自定义面包屑标题
  customTitle: string | null;
  // 自定义头部动作
  extraActions: React.ReactNode | null;
  // 是否隐藏 AI 聊天按钮
  hideChatButton: boolean;
  // 设置自定义面包屑标题
  setCustomTitle: (title: string | null) => void;
  // 设置自定义头部动作
  setExtraActions: (actions: React.ReactNode | null) => void;
  // 设置是否隐藏 AI 聊天按钮
  setHideChatButton: (hide: boolean) => void;
  // 重置头部状态
  resetHeader: () => void;
};

/**
 * 全局工作区 Header 状态管理 Store
 * 用于支持各子页面动态上报面包屑与操作按钮至系统框架顶栏
 */
export const useHeaderStore = create<HeaderState>((set) => ({
  customTitle: null,
  extraActions: null,
  hideChatButton: false,
  setCustomTitle: (title) => set({ customTitle: title }),
  setExtraActions: (actions) => set({ extraActions: actions }),
  setHideChatButton: (hide) => set({ hideChatButton: hide }),
  resetHeader: () => set({ customTitle: null, extraActions: null, hideChatButton: false }),
}));
