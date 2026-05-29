import type React from "react";
import { MessageSquare } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";

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
}: HeaderProps): React.JSX.Element => {
  return (
    <header className="flex-shrink-0 mb-3 rounded-[6px] border border-white/5 bg-[#212121] px-4 py-2 flex items-center justify-between select-none h-10">
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-white/30">//</span>
        <span className="text-white/40 font-bold uppercase tracking-wider">
          {category}
        </span>
        <span className="text-white/20">/</span>
        <span className="text-white font-bold">{activePage}</span>
        {isChatOpen && chatTitle && (
          <>
            <span className="text-white/30 font-bold">·</span>
            <span className="text-white font-bold max-w-[240px] truncate select-text">{chatTitle}</span>
          </>
        )}
      </div>
      <IconButton
        aria-label={isChatOpen ? "关闭聊天" : "打开聊天"}
        highlighted={isChatOpen}
        onClick={onChatToggle}
        className={isChatOpen ? "" : "text-white/45 hover:bg-white/5 hover:text-white"}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </IconButton>
    </header>
  );
};
