import type React from "react"
import { create } from "zustand"

// 全局头部状态接口
type HeaderState = {
  // 自定义面包屑标题
  customTitle: React.ReactNode | null
  // 页面日期导航器组件
  dateNavigator: React.ReactNode | null
  // 自定义头部动作
  extraActions: React.ReactNode | null
  // 是否隐藏 AI 聊天按钮
  hideChatButton: boolean
  // 增加 Settings 相关的状态
  settingsState: {
    isDirty: boolean
    isSaving: boolean
    onSave: () => void | Promise<void>
    onReload: () => void | Promise<void>
  } | null
  // 设置自定义面包屑标题
  setCustomTitle: (title: React.ReactNode | null) => void
  // 设置页面日期导航器组件
  setDateNavigator: (navigator: React.ReactNode | null) => void
  // 设置自定义头部动作
  setExtraActions: (actions: React.ReactNode | null) => void
  // 设置是否隐藏 AI 聊天按钮
  setHideChatButton: (hide: boolean) => void
  // 设置 Settings 相关的状态
  setSettingsState: (state: HeaderState["settingsState"]) => void
  // 重置头部状态
  resetHeader: () => void
}

/**
 * 全局工作区 Header 状态管理 Store
 * 用于支持各子页面动态上报面包屑与操作按钮至系统框架顶栏
 */
export const useHeaderStore = create<HeaderState>((set) => ({
  customTitle: null,
  dateNavigator: null,
  extraActions: null,
  hideChatButton: false,
  settingsState: null,
  setCustomTitle: (title) => set({ customTitle: title }),
  setDateNavigator: (navigator) => set({ dateNavigator: navigator }),
  setExtraActions: (actions) => set({ extraActions: actions }),
  setHideChatButton: (hide) => set({ hideChatButton: hide }),
  setSettingsState: (state) => set({ settingsState: state }),
  resetHeader: () =>
    set({
      customTitle: null,
      dateNavigator: null,
      extraActions: null,
      hideChatButton: false,
      settingsState: null,
    }),
}))
