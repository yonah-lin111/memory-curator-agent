import type React from "react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Copy, Trash2, ClipboardPaste, Plus, ChevronRight } from "lucide-react";
import { type PromptCardType, cardTypeMeta } from "./PromptNode";

export type ContextMenuType = "node" | "edge" | "pane" | null;

export type ContextMenuState = {
  type: ContextMenuType;
  x: number;
  y: number;
  id?: string; // 节点 ID 或边 ID
};

export interface PromptCanvasContextMenuProps {
  menuState: ContextMenuState;
  onClose: () => void;
  onCopyNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onPasteNode: (x: number, y: number) => void;
  onAddNode: (type: PromptCardType, x: number, y: number) => void;
  onDeleteEdge: (edgeId: string) => void;
  canPaste: boolean;
}

const MENU_WIDTH = 156;
const SUB_MENU_WIDTH = 180;
const VIEWPORT_PADDING = 8;
const SUB_MENU_MAX_HEIGHT = 450;

const getMenuPosition = (
  x: number,
  y: number,
  menuHeight: number,
  subMenuHeight: number
): { left: number; top: number; subLeft: number; subTop: number } => {
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING);
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - menuHeight - VIEWPORT_PADDING);

  const left = Math.min(Math.max(x, VIEWPORT_PADDING), maxLeft);
  const top = Math.min(Math.max(y, VIEWPORT_PADDING), maxTop);

  // 计算子菜单的位置（右侧，如果右侧空间不够则显示在左侧）
  let subLeft = left + MENU_WIDTH + 4;
  if (subLeft + SUB_MENU_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
    subLeft = left - SUB_MENU_WIDTH - 4;
  }

  // 子菜单的基础垂直偏移：让子菜单与“添加卡片”按钮水平对齐
  const buttonOffsetTop = 36;
  const initialSubTop = top + buttonOffsetTop;

  // 计算子菜单的垂直位置，防止底部越界
  let subTop = initialSubTop;
  if (subTop + subMenuHeight > window.innerHeight - VIEWPORT_PADDING) {
    subTop = Math.max(VIEWPORT_PADDING, window.innerHeight - subMenuHeight - VIEWPORT_PADDING);
  }

  return { left, top, subLeft, subTop };
};

export const PromptCanvasContextMenu = ({
  menuState,
  onClose,
  onCopyNode,
  onDeleteNode,
  onPasteNode,
  onAddNode,
  onDeleteEdge,
  canPaste,
}: PromptCanvasContextMenuProps): React.JSX.Element | null => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const subMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // 重置状态
  useEffect(() => {
    setShowAddMenu(false);
  }, [menuState]);

  if (!menuState.type) return null;

  // 根据类型估算高度
  let menuHeight = 82;
  if (menuState.type === "node") menuHeight = 82;
  else if (menuState.type === "pane") menuHeight = 82;
  else if (menuState.type === "edge") menuHeight = 44;

  const entries = Object.entries(cardTypeMeta) as [PromptCardType, (typeof cardTypeMeta)[PromptCardType]][];
  const globalTypes = entries.filter(([_, meta]) => meta.category === "global_a" || meta.category === "global_c" || meta.category === "assemble");
  const containerTypes = entries.filter(([_, meta]) => meta.category === "task_b");
  const fieldTypes = entries.filter(([_, meta]) => meta.category === "task_field");

  const itemsCount = entries.length;
  const estimatedSubMenuHeight = itemsCount * 28 + 8 + 64; // 估算子菜单内容原始高度加三个分组标题的高
  const subMenuHeight = Math.min(SUB_MENU_MAX_HEIGHT, estimatedSubMenuHeight);

  const position = getMenuPosition(menuState.x, menuState.y, menuHeight, subMenuHeight);

  const handleDeleteClick = () => {
    if (menuState.type === "node" && menuState.id) {
      onDeleteNode(menuState.id);
    } else if (menuState.type === "edge" && menuState.id) {
      onDeleteEdge(menuState.id);
    }
    onClose();
  };

  const handleMouseEnterAddMenu = () => {
    if (subMenuTimeoutRef.current) {
      clearTimeout(subMenuTimeoutRef.current);
    }
    setShowAddMenu(true);
  };

  const handleMouseLeaveAddMenu = () => {
    subMenuTimeoutRef.current = setTimeout(() => {
      setShowAddMenu(false);
    }, 150);
  };

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-[999999] rounded-[6px] border border-white/10 bg-[#303030] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
      style={{
        width: MENU_WIDTH,
        left: position.left,
        top: position.top,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {menuState.type === "node" && (
        <>
          <button
            className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
            onClick={() => {
              if (menuState.id) onCopyNode(menuState.id);
              onClose();
            }}
          >
            <Copy className="h-3.5 w-3.5 text-white/45" />
            <span>复制卡片</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs transition-colors text-rose-400/80 hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400/45"
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400/80" />
            <span>删除卡片</span>
          </button>
        </>
      )}

      {menuState.type === "edge" && (
        <button
          className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs transition-colors text-rose-400/80 hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400/45"
          onClick={handleDeleteClick}
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-400/80" />
          <span>删除连接</span>
        </button>
      )}

      {menuState.type === "pane" && (
        <>
          <button
            disabled={!canPaste}
            className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-white/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
            onClick={() => {
              if (canPaste) {
                onPasteNode(menuState.x, menuState.y);
                onClose();
              }
            }}
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-white/45" />
            <span>粘贴</span>
          </button>

          <div
            className="relative"
            onMouseEnter={handleMouseEnterAddMenu}
            onMouseLeave={handleMouseLeaveAddMenu}
          >
            <button className={`flex w-full items-center justify-between gap-2 rounded-[4px] px-2 py-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45 ${showAddMenu ? "bg-white/8 text-white" : "text-white/75 hover:bg-white/8 hover:text-white"}`}>
              <div className="flex items-center gap-2">
                <Plus className={`h-3.5 w-3.5 ${showAddMenu ? "text-white/75" : "text-white/45"}`} />
                <span>添加卡片</span>
              </div>
              <ChevronRight className={`h-3.5 w-3.5 ${showAddMenu ? "text-white/75" : "text-white/45"}`} />
            </button>

            {showAddMenu && (
              <div
                className="fixed z-[999999] w-[180px] overflow-y-auto rounded-[6px] border border-white/10 bg-[#303030] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.45)] custom-scrollbar"
                style={{
                  maxHeight: SUB_MENU_MAX_HEIGHT,
                  left: position.subLeft,
                  top: position.subTop,
                }}
                onMouseEnter={handleMouseEnterAddMenu}
                onMouseLeave={handleMouseLeaveAddMenu}
              >
                {/* ── 全局配置 ── */}
                <div className="px-2 py-1 text-[9px] font-bold text-white/30 uppercase tracking-wider">
                  全局配置标签
                </div>
                {globalTypes.map(([type, meta]) => (
                  <button
                    key={type}
                    className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1 text-left text-[11px] text-white/75 transition-colors hover:bg-white/8 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNode(type, menuState.x, menuState.y);
                      onClose();
                    }}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${meta.color.split(' ')[1]}`} />
                    <span>{meta.label}</span>
                  </button>
                ))}

                <div className="h-[1px] bg-white/10 my-1.5 mx-2" />

                {/* ── 任务容器 ── */}
                <div className="px-2 py-1 text-[9px] font-bold text-white/30 uppercase tracking-wider">
                  任务容器标签
                </div>
                {containerTypes.map(([type, meta]) => (
                  <button
                    key={type}
                    className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1 text-left text-[11px] text-white/75 transition-colors hover:bg-white/8 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNode(type, menuState.x, menuState.y);
                      onClose();
                    }}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${meta.color.split(' ')[1]}`} />
                    <span>{meta.label}</span>
                  </button>
                ))}

                <div className="h-[1px] bg-white/10 my-1.5 mx-2" />

                {/* ── 任务字段 ── */}
                <div className="px-2 py-1 text-[9px] font-bold text-white/30 uppercase tracking-wider">
                  任务子属性标签
                </div>
                {fieldTypes.map(([type, meta]) => (
                  <button
                    key={type}
                    className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1 text-left text-[11px] text-white/75 transition-colors hover:bg-white/8 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNode(type, menuState.x, menuState.y);
                      onClose();
                    }}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${meta.color.split(' ')[1]}`} />
                    <span>{meta.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return createPortal(menuContent, document.body);
};
