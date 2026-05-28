import type React from "react";
import { MessageSquare } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";

// 固定的顶部栏组件属性接口
export interface HeaderProps {
  // 当前页分类名称
  category: string;
  // 当前页面标识
  activePage: string;
}

/**
 * Header - 框架级固定顶部栏组件
 */
export const Header = ({ category, activePage }: HeaderProps): React.JSX.Element => {
  return (
    <header className="flex-shrink-0 mb-3 rounded-[6px] border border-white/5 bg-[#212121] px-4 py-2 flex items-center justify-between select-none h-10">
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-white/30">//</span>
        <span className="text-white/40 font-bold uppercase tracking-wider">
          {category}
        </span>
        <span className="text-white/20">/</span>
        <span className="text-white font-bold">{activePage}</span>
      </div>
      <IconButton
        aria-label="打开聊天"
        className="text-white/45 hover:bg-white/5 hover:text-white"
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </IconButton>
    </header>
  );
};
