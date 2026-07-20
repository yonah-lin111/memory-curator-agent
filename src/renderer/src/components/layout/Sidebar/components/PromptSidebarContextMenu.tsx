import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Edit3, Trash2, Plus } from "lucide-react";

type ContextMenuType = "project" | "module" | "prompt";

type PromptSidebarContextMenuProps = {
  type: ContextMenuType;
  title: string;
  x: number;
  y: number;
  onAddModule?: () => void;
  onAddProjectDesign?: () => void;
  onAddDesign?: () => void;
  onEditProject?: () => void;
  onRename?: () => void;
  onDelete: () => void;
};

// 菜单宽度，用于把右键菜单限制在视口内。
const MENU_WIDTH = 156;

// 菜单与视口边缘的最小距离。
const VIEWPORT_PADDING = 8;

/**
 * 把菜单坐标钳制在当前视口内。
 */
const getMenuPosition = (
  x: number,
  y: number,
  type: ContextMenuType,
): { left: number; top: number } => {
  const MENU_HEIGHT = type === "project" ? 158 : type === "module" ? 120 : 82;
  const maxLeft = Math.max(
    VIEWPORT_PADDING,
    window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING,
  );
  const maxTop = Math.max(
    VIEWPORT_PADDING,
    window.innerHeight - MENU_HEIGHT - VIEWPORT_PADDING,
  );

  return {
    left: Math.min(Math.max(x, VIEWPORT_PADDING), maxLeft),
    top: Math.min(Math.max(y, VIEWPORT_PADDING), maxTop),
  };
};

/**
 * PromptSidebarContextMenu - 负责项目和提示词设计项的右键操作菜单。
 */
export const PromptSidebarContextMenu = ({
  type,
  title,
  x,
  y,
  onAddModule,
  onAddProjectDesign,
  onAddDesign,
  onEditProject,
  onRename,
  onDelete,
}: PromptSidebarContextMenuProps): React.JSX.Element => {
  // 是否已进入删除二次确认态。
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const position = getMenuPosition(x, y, type);

  useEffect(() => {
    setIsConfirmingDelete(false);
  }, [title]);

  /**
   * 第一次点击进入确认态，第二次点击才真正删除。
   */
  const handleDeleteClick = (): void => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    onDelete();
  };

  const menuContent = (
    <div
      aria-label={`${title} action menu`}
      className="fixed z-[9999] w-[156px] rounded-[6px] border border-white/10 bg-[#303030] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
      role="menu"
      onClick={(event) => event.stopPropagation()}
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      {type === "project" ? (
        <button
          className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
          role="menuitem"
          type="button"
          onClick={onEditProject}
        >
          <Edit3 className="h-3.5 w-3.5 text-white/45" />
          <span>编辑项目</span>
        </button>
      ) : (
        <button
          className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
          role="menuitem"
          type="button"
          onClick={onRename}
        >
          <Edit3 className="h-3.5 w-3.5 text-white/45" />
          <span>重命名</span>
        </button>
      )}

      {type === "project" ? (
        <button
          className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
          role="menuitem"
          type="button"
          onClick={onAddModule}
        >
          <Plus className="h-3.5 w-3.5 text-white/45" />
          <span>新增模块</span>
        </button>
      ) : null}

      {type === "project" ? (
        <button
          className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
          role="menuitem"
          type="button"
          onClick={onAddProjectDesign}
        >
          <Plus className="h-3.5 w-3.5 text-white/45" />
          <span>新增设计</span>
        </button>
      ) : type === "module" ? (
        <button
          className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
          role="menuitem"
          type="button"
          onClick={onAddDesign}
        >
          <Plus className="h-3.5 w-3.5 text-white/45" />
          <span>新增设计</span>
        </button>
      ) : null}
      <button
        className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400/45 ${
          isConfirmingDelete
            ? "bg-rose-600 text-white hover:bg-rose-500"
            : "text-rose-400/80 hover:bg-rose-400/10 hover:text-rose-300"
        }`}
        role="menuitem"
        type="button"
        onClick={handleDeleteClick}
      >
        <Trash2
          className={`h-3.5 w-3.5 ${
            isConfirmingDelete ? "text-white" : "text-rose-400/80"
          }`}
        />
        <span>
          {isConfirmingDelete
            ? "确认删除"
            : type === "project"
              ? "删除项目"
              : type === "module"
                ? "删除模块"
                : "删除设计"}
        </span>
      </button>
    </div>
  );

  return createPortal(menuContent, document.body);
};
