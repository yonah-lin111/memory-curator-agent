import type React from "react";
import {
  MessageSquare,
  RotateCcw,
  Book,
  Bot,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useToast, getToastColorClass } from "@/components/ui/Toast";
import { useHeaderStore } from "@/lib/headerStore";

// 固定的顶部栏组件属性接口
export interface HeaderProps {
  // 当前页分类名称
  category: string;
  // 当前页面标识
  activePage: string;
  // AI 对话模式是否打开
  isChatOpen?: boolean;
  // AI 对话模式切换回调
  onChatToggle?: () => void;
  // 当前激活的 AI 会话标题
  chatTitle?: string;
  // 聊天按钮左侧扩展动作
  chatLeadingAction?: React.ReactNode;
  // 提示词面板是否打开
  isPromptsOpen?: boolean;
  // 提示词面板切换回调
  onPromptsToggle?: () => void;
  // 提示词 AI 助手是否打开
  isPromptAiOpen?: boolean;
  // 提示词 AI 助手切换回调
  onPromptAiToggle?: () => void;
  // 提示词项目名称
  promptsProjectName?: string;
  // 提示词设计项名称
  promptsItemName?: string;
}

/**
 * Header - 框架级固定顶部栏组件
 */
export const Header = ({
  category,
  activePage,
  isChatOpen = false,
  onChatToggle,
  chatTitle,
  chatLeadingAction,
  isPromptsOpen = false,
  onPromptsToggle,
  isPromptAiOpen = false,
  onPromptAiToggle,
  promptsProjectName,
  promptsItemName,
}: HeaderProps): React.JSX.Element => {
  const { toasts } = useToast();
  const {
    customTitle,
    dateNavigator,
    extraActions,
    hideChatButton,
    settingsState,
  } = useHeaderStore();

  const rightZoneKey = isChatOpen
    ? "chat"
    : isPromptsOpen
      ? "prompts"
      : `normal-${extraActions ? "extra" : "none"}-${settingsState ? "settings" : "none"}`;

  return (
    <header className="flex-shrink-0 mb-3 rounded-[6px] border border-white/5 bg-[#212121] px-4 py-2 flex items-center justify-between h-10 relative z-30">
      <div
        key={`left-${activePage}-${isChatOpen ? "chat" : "normal"}`}
        className="flex items-center gap-2 text-xs font-mono animate-slide-in-from-left"
      >
        <span className="text-white/30">//</span>
        <span className="text-white/40 font-bold uppercase tracking-wider">
          {category}
        </span>
        <span className="text-white/20">/</span>
        <span className="text-white font-bold">{activePage}</span>
        {["today", "todo", "snippets", "journal", "weekly"].includes(
          activePage,
        ) &&
          !isChatOpen &&
          dateNavigator && (
            <span className="flex items-center ml-2">{dateNavigator}</span>
          )}
        {!isChatOpen && customTitle && (
          <>
            <span className="text-white/20">/</span>
            <span className="font-bold text-white/80">{customTitle}</span>
          </>
        )}
        {isChatOpen && chatTitle && (
          <>
            <span className="text-white/30 font-bold">·</span>
            <span className="text-white font-bold max-w-[240px] truncate select-text">
              {chatTitle}
            </span>
          </>
        )}
        {isPromptsOpen && (promptsProjectName || promptsItemName) && (
          <>
            <span className="text-white/30 font-bold">·</span>
            <span className="flex items-center max-w-[300px] truncate select-text">
              {promptsProjectName && (
                <span className="text-white font-bold">
                  {promptsProjectName}
                </span>
              )}
              {promptsProjectName && promptsItemName && (
                <span className="text-white/30 mx-1.5">-</span>
              )}
              {promptsItemName && (
                <span className="text-white font-bold">{promptsItemName}</span>
              )}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {/* 全局 Toast 文字消息展示 */}
        <div className="flex items-center gap-2 mr-1">
          {toasts.map((toast) => {
            const colorClass = getToastColorClass(toast.type);
            return (
              <span
                key={toast.id}
                aria-hidden="true"
                className={`text-xs font-medium tracking-wide select-none ${colorClass} ${
                  toast.isExiting ? "animate-toast-out" : "animate-toast-in"
                }`}
              >
                {toast.message}
              </span>
            );
          })}
        </div>
        <div
          key={`right-zone-${rightZoneKey}`}
          className="flex items-center gap-1.5 animate-slide-in-from-right"
        >
          {!isChatOpen && !isPromptsOpen && settingsState && (
            <div className="flex items-center gap-2 mr-2 border-r border-white/5 pr-2">
              <span
                className={`text-xs ${
                  settingsState.isDirty ? "text-amber-300" : "text-white/35"
                }`}
              >
                {settingsState.isDirty ? "未保存" : "已同步"}
              </span>
              <IconButton
                disabled={settingsState.isSaving}
                onClick={settingsState.onReload}
                title="重置修改"
                aria-label="重置修改"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                preset="save"
                disabled={settingsState.isSaving || !settingsState.isDirty}
                onClick={settingsState.onSave}
                title={settingsState.isSaving ? "保存中" : "保存设置"}
                aria-label="保存设置"
              />
            </div>
          )}
          {!isChatOpen && extraActions}
          {/* 提示词展开后的扩展 icon组 */}
          {isPromptsOpen && !hideChatButton && (
            <>
              <IconButton
                aria-label={isPromptAiOpen ? "关闭提示词 AI" : "打开提示词 AI"}
                title="提示词 AI 助手"
                highlighted={isPromptAiOpen}
                onClick={onPromptAiToggle}
              >
                <Bot className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                aria-label="关闭提示词"
                title="关闭提示词"
                preset="close"
                onClick={onPromptsToggle}
              />
            </>
          )}
          {/* 聊天展开后的扩展 icon 组 */}
          {isChatOpen && !hideChatButton && (
            <>
              {chatLeadingAction}
              <IconButton
                aria-label="关闭对话"
                title="关闭对话"
                preset="close"
                onClick={onChatToggle}
              />
            </>
          )}
          {/* 正常状态下的按钮组 */}
          {!isChatOpen && !isPromptsOpen && !hideChatButton && (
            <>
              <IconButton
                aria-label="打开提示词"
                title="提示词"
                onClick={onPromptsToggle}
              >
                <Book className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                aria-label="打开对话"
                title="对话"
                onClick={onChatToggle}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </IconButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
