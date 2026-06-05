import type React from "react";
import { MessageSquare } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import { useToast, getToastColorClass } from "@renderer/components/ui/Toast";
import { useHeaderStore } from "@renderer/lib/headerStore";

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
  const { customTitle, extraActions } = useHeaderStore();

  return (
    <header className="flex-shrink-0 mb-3 rounded-[6px] border border-white/5 bg-[#212121] px-4 py-2 flex items-center justify-between h-10">
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-white/30">//</span>
        <span className="text-white/40 font-bold uppercase tracking-wider">
          {category}
        </span>
        <span className="text-white/20">/</span>
        <span className="text-white font-bold">{activePage}</span>
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
        {!isChatOpen && extraActions}
        {chatLeadingAction}
        <IconButton
          aria-label={isChatOpen ? "Close chat" : "Open chat"}
          highlighted={isChatOpen}
          onClick={onChatToggle}
          className={isChatOpen ? "" : "text-white/45 hover:bg-white/5 hover:text-white"}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </header>
  );
};
