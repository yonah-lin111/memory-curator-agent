import type React from "react";
import { Edit3, Trash2 } from "lucide-react";

// 右键菜单组件属性类型。
type AiChatHistoryContextMenuProps = {
  // 触发菜单的会话标题。
  sessionTitle: string;
  // 菜单左上角横坐标。
  x: number;
  // 菜单左上角纵坐标。
  y: number;
  // 触发编辑标题回调。
  onEditTitle: () => void;
  // 触发删除会话回调。
  onDeleteChat: () => void;
};

// 菜单宽度，用于把右键菜单限制在视口内。
const MENU_WIDTH = 156;

// 菜单高度，用于把右键菜单限制在视口内。
const MENU_HEIGHT = 82;

// 菜单与视口边缘的最小距离。
const VIEWPORT_PADDING = 8;

/**
 * 把菜单坐标钳制在当前视口内。
 */
const getMenuPosition = (x: number, y: number): { left: number; top: number } => {
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING);
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - MENU_HEIGHT - VIEWPORT_PADDING);

  return {
    left: Math.min(Math.max(x, VIEWPORT_PADDING), maxLeft),
    top: Math.min(Math.max(y, VIEWPORT_PADDING), maxTop),
  };
};

/**
 * AiChatHistoryContextMenu - 负责单个 AI 历史项的右键操作菜单。
 */
export const AiChatHistoryContextMenu = ({
  sessionTitle,
  x,
  y,
  onEditTitle,
  onDeleteChat,
}: AiChatHistoryContextMenuProps): React.JSX.Element => {
  const position = getMenuPosition(x, y);

  return (
    <div
      aria-label={`${sessionTitle} 操作菜单`}
      className="fixed z-50 w-[156px] rounded-[6px] border border-white/10 bg-[#000000] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
      role="menu"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <button
        className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
        role="menuitem"
        type="button"
        onClick={onEditTitle}
      >
        <Edit3 className="h-3.5 w-3.5 text-white/45" />
        <span>编辑标题</span>
      </button>
      <button
        className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-rose-300/85 transition-colors hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300/45"
        role="menuitem"
        type="button"
        onClick={onDeleteChat}
      >
        <Trash2 className="h-3.5 w-3.5 text-rose-300/70" />
        <span>删除聊天</span>
      </button>
    </div>
  );
};
