import type React from "react";
import { MessageSquare, RotateCcw } from "lucide-react";
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
}: HeaderProps): React.JSX.Element => {
  const { toasts } = useToast();
  const { customTitle, dateNavigator, extraActions, hideChatButton, settingsState } = useHeaderStore();

  return (
    <header className="flex-shrink-0 mb-3 rounded-[6px] border border-white/5 bg-[#212121] px-4 py-2 flex items-center justify-between h-10 relative z-30">
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-white/30">//</span>
        <span className="text-white/40 font-bold uppercase tracking-wider">
          {category}
        </span>
        <span className="text-white/20">/</span>
        <span className="text-white font-bold">{activePage}</span>
        {["today", "todo", "snippets", "journal"].includes(activePage) && !isChatOpen && dateNavigator && (
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
            <span className="text-white font-bold max-w-[240px] truncate select-text">{chatTitle}</span>
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
        {!isChatOpen && settingsState && (
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
        {chatLeadingAction}
        {!hideChatButton && (
          <IconButton
            aria-label={isChatOpen ? "Close chat" : "Open chat"}
            highlighted={isChatOpen}
            preset={isChatOpen ? "close" : undefined}
            onClick={onChatToggle}
          >
            {isChatOpen ? null : <MessageSquare className="h-3.5 w-3.5" />}
          </IconButton>
        )}
      </div>
    </header>
  );
};
