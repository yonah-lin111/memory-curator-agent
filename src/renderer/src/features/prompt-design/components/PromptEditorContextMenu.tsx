import React, { useEffect, useRef, useCallback, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
  Quote,
  List,
  ListOrdered,
  Link,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Braces,
  ChevronRight,
} from "lucide-react";
import { usePublisher, useCellValue } from "@mdxeditor/gurx";
import {
  applyFormat$,
  applyBlockType$,
  applyListType$,
  insertCodeBlock$,
  insertThematicBreak$,
  openLinkEditDialog$,
  currentFormat$,
} from "@mdxeditor/editor";

/** FORMAT 位掩码常量（对齐 @mdxeditor/editor FormatConstants） */
const IS_BOLD = 1;
const IS_ITALIC = 2;
const IS_STRIKETHROUGH = 4;
const IS_UNDERLINE = 8;
const IS_CODE = 16;

/** 文本格式字面量 */
type TextFmt = "bold" | "italic" | "underline" | "strikethrough" | "code";

/** 菜单项定义 */
interface ContextMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  active?: boolean;
  shortcut?: string;
}

/** 二级子菜单定义 */
interface SubMenuDef {
  key: string;
  label: string;
  items: ContextMenuItem[];
}

interface PromptEditorContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

// ──────────── 布局常量（对齐 PromptCanvasContextMenu 设计语言）────────────
const MENU_WIDTH = 200;
const SUB_MENU_WIDTH = 184;
const VIEWPORT_PADDING = 8;
const SUB_MENU_MAX_HEIGHT = 360;
/** 每条菜单项估算高度（py-2 ≈ 8px × 2 + 13px 字高 ≈ 29px） */
const ITEM_EST_HEIGHT = 29;
/** 菜单顶部/底部内边距（p-1 = 4px） */
const MENU_PAD = 4;
/** 分隔线高度（my-1 + border = 4+4+1 = 9px） */
const SEPARATOR_HEIGHT = 9;
/** 估算安全冗余，确保在 DOM 测量渲染前不会因为边缘点击溢出 */
const HEIGHT_SAFETY = 24;

/**
 * MDX 编辑器右键上下文菜单。
 * 支持最硬核的“DOM 动态测量二次精细定位”：
 * 首先使用安全的高估数值进行防闪烁首帧占位，
 * 在 DOM 生成后利用 useLayoutEffect 获取 100% 精确尺寸，完美进行视口钳位！
 */
export const PromptEditorContextMenu = ({
  x,
  y,
  onClose,
}: PromptEditorContextMenuProps): React.ReactPortal => {
  const menuRef = useRef<HTMLDivElement>(null);
  const subMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 当前展开的二级子菜单 key；null 表示全部收起 */
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  /** 当前激活二级菜单的触发项元素位置 */
  const [activeTriggerRect, setActiveTriggerRect] = useState<DOMRect | null>(null);

  /** ── MDX 信号发布者 ── */
  const applyFormat = usePublisher(applyFormat$);
  const applyBlockType = usePublisher(applyBlockType$);
  const applyListType = usePublisher(applyListType$);
  const insertCodeBlock = usePublisher(insertCodeBlock$);
  const insertThematicBreak = usePublisher(insertThematicBreak$);
  const openLinkDialog = usePublisher(openLinkEditDialog$);

  /** 当前文本格式位掩码 */
  const currentFormat = useCellValue(currentFormat$);

  /** 点击外部 / ESC 关闭主菜单 */
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleOutsideContextMenu = (): void => onClose();
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };

    const timer = setTimeout(() => {
      document.addEventListener("click", handleOutsideClick);
      document.addEventListener("contextmenu", handleOutsideContextMenu);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("contextmenu", handleOutsideContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  /** 执行编辑操作并关闭菜单 */
  const executeAction = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose],
  );

  /** 鼠标移入二级菜单触发项 */
  const handleSubEnter = useCallback((key: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (subMenuTimeoutRef.current) clearTimeout(subMenuTimeoutRef.current);
    setOpenSubMenu(key);
    setActiveTriggerRect(e.currentTarget.getBoundingClientRect());
  }, []);

  /** 鼠标移出二级菜单区域（延迟收起，避免穿越间隙时闪烁） */
  const handleSubLeave = useCallback(() => {
    subMenuTimeoutRef.current = setTimeout(() => {
      setOpenSubMenu(null);
      setActiveTriggerRect(null);
    }, 150);
  }, []);

  /** 保持二级菜单打开状态 */
  const handleSubMenuKeepAlive = useCallback(() => {
    if (subMenuTimeoutRef.current) clearTimeout(subMenuTimeoutRef.current);
  }, []);

  // ──────────── 菜单数据定义 ────────────

  const topActions: ContextMenuItem[] = [
    {
      key: "bold",
      label: "粗体",
      icon: <Bold size={14} />,
      action: () => applyFormat("bold" as TextFmt),
      active: ((currentFormat ?? 0) & IS_BOLD) !== 0,
      shortcut: "Ctrl+B",
    },
    {
      key: "italic",
      label: "斜体",
      icon: <Italic size={14} />,
      action: () => applyFormat("italic" as TextFmt),
      active: ((currentFormat ?? 0) & IS_ITALIC) !== 0,
      shortcut: "Ctrl+I",
    },
    {
      key: "underline",
      label: "下划线",
      icon: <Underline size={14} />,
      action: () => applyFormat("underline" as TextFmt),
      active: ((currentFormat ?? 0) & IS_UNDERLINE) !== 0,
      shortcut: "Ctrl+U",
    },
  ];

  const subMenus: SubMenuDef[] = [
    {
      key: "more-fmt",
      label: "更多格式",
      items: [
        {
          key: "strikethrough",
          label: "删除线",
          icon: <Strikethrough size={14} />,
          action: () => applyFormat("strikethrough" as TextFmt),
          active: ((currentFormat ?? 0) & IS_STRIKETHROUGH) !== 0,
        },
        {
          key: "code",
          label: "行内代码",
          icon: <Code2 size={14} />,
          action: () => applyFormat("code" as TextFmt),
          active: ((currentFormat ?? 0) & IS_CODE) !== 0,
        },
      ],
    },
    {
      key: "blocks",
      label: "标题与块",
      items: [
        { key: "h1", label: "标题 1", icon: <Heading1 size={14} />, action: () => applyBlockType("h1") },
        { key: "h2", label: "标题 2", icon: <Heading2 size={14} />, action: () => applyBlockType("h2") },
        { key: "h3", label: "标题 3", icon: <Heading3 size={14} />, action: () => applyBlockType("h3") },
        { key: "paragraph", label: "段落", icon: <Pilcrow size={14} />, action: () => applyBlockType("paragraph") },
        { key: "quote", label: "引用块", icon: <Quote size={14} />, action: () => applyBlockType("quote") },
      ],
    },
    {
      key: "lists",
      label: "列表与分隔",
      items: [
        { key: "bulletList", label: "无序列表", icon: <List size={14} />, action: () => applyListType("bullet") },
        { key: "orderedList", label: "有序列表", icon: <ListOrdered size={14} />, action: () => applyListType("number") },
        { key: "thematicBreak", label: "分割线", icon: <Minus size={14} />, action: () => insertThematicBreak(void 0) },
      ],
    },
    {
      key: "insert",
      label: "插入",
      items: [
        { key: "link", label: "链接", icon: <Link size={14} />, action: () => openLinkDialog(void 0) },
        { key: "codeBlock", label: "代码块", icon: <Braces size={14} />, action: () => insertCodeBlock({}) },
      ],
    },
  ];

  // ──────────── 布局与位置状态 ────────────
  const totalItems = topActions.length + subMenus.length; // 7

  const [coords, setCoords] = useState(() => {
    // 初始首帧占位计算（使用安全的估算高度，防止首帧大溢出）
    const estMenuHeight = MENU_PAD * 2 + totalItems * ITEM_EST_HEIGHT + SEPARATOR_HEIGHT + HEIGHT_SAFETY;
    const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING);
    const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - estMenuHeight - VIEWPORT_PADDING);

    const left = Math.min(Math.max(x, VIEWPORT_PADDING), maxLeft);
    const top = Math.min(Math.max(y, VIEWPORT_PADDING), maxTop);

    return { left, top };
  });

  /**
   * 最核心：useLayoutEffect 在 DOM 生成但还未被浏览器重绘前，
   * 100% 精确测量主菜单 DOM，重新校准垂直位置。
   */
  useLayoutEffect(() => {
    if (!menuRef.current) return;

    const domRect = menuRef.current.getBoundingClientRect();
    const realMenuHeight = domRect.height || (MENU_PAD * 2 + totalItems * ITEM_EST_HEIGHT + SEPARATOR_HEIGHT);

    // 基于真实测量的 realMenuHeight 进行重新定位
    const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING);
    const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - realMenuHeight - VIEWPORT_PADDING);

    const left = Math.min(Math.max(x, VIEWPORT_PADDING), maxLeft);
    const top = Math.min(Math.max(y, VIEWPORT_PADDING), maxTop);

    setCoords({ left, top });
  }, [x, y, totalItems]);

  /** 渲染单条菜单项 */
  const renderItem = useCallback(
    (item: ContextMenuItem) => (
      <button
        key={item.key}
        onClick={() => executeAction(item.action)}
        className={`flex items-center gap-2 w-full px-2 py-2 text-xs cursor-pointer
          rounded-[4px] transition-colors duration-75 select-none text-left
          ${item.active
            ? "text-white bg-white/10"
            : "text-white/75 hover:text-white hover:bg-white/8"
          }`}
      >
        <span className="flex items-center justify-center w-4 h-4 text-white/45">
          {item.icon}
        </span>
        <span className="flex-1">{item.label}</span>
        {item.shortcut && (
          <span className="text-white/30 text-[11px] ml-4">{item.shortcut}</span>
        )}
      </button>
    ),
    [executeAction],
  );

  /** 菜单内容 */
  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-[#303030] border border-white/10 rounded-[6px] p-1
                 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
      style={{ width: MENU_WIDTH, left: coords.left, top: coords.top }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* ── 顶层直接操作 ── */}
      {topActions.map(renderItem)}

      <div className="my-1 border-t border-white/8" />

      {/* ── 分类二级子菜单触发项 ── */}
      {subMenus.map((sub) => {
        const isOpen = openSubMenu === sub.key;

        return (
          <div
            key={sub.key}
            className="relative"
            onMouseLeave={handleSubLeave}
          >
            {/* 触发按钮 */}
            <button
              onMouseEnter={(e) => handleSubEnter(sub.key, e)}
              className={`flex w-full items-center justify-between gap-2 rounded-[4px] px-2 py-2 text-left text-xs transition-colors
                ${isOpen
                  ? "bg-white/8 text-white"
                  : "text-white/75 hover:bg-white/8 hover:text-white"
                }`}
            >
              <span>{sub.label}</span>
              <ChevronRight size={12} className={isOpen ? "text-white/75" : "text-white/45"} />
            </button>

            {/* 展开的二级子菜单 */}
            {isOpen && activeTriggerRect && (
              <PromptEditorSubMenu
                triggerRect={activeTriggerRect}
                items={sub.items}
                label={sub.label}
                renderItem={renderItem}
                onMouseEnter={handleSubMenuKeepAlive}
                onMouseLeave={handleSubLeave}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return createPortal(menuContent, document.body);
};

interface PromptEditorSubMenuProps {
  triggerRect: DOMRect;
  items: ContextMenuItem[];
  label: string;
  renderItem: (item: ContextMenuItem) => React.ReactNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * 完美的二级子菜单组件
 * 通过 DOMRect 物理空间测量与 Viewport 动态钳位定位，100% 杜绝顶部、底部、右侧溢出
 */
const PromptEditorSubMenu = ({
  triggerRect,
  items,
  label,
  renderItem,
  onMouseEnter,
  onMouseLeave,
}: PromptEditorSubMenuProps): React.JSX.Element => {
  const subMenuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ left: 0, top: 0, isReady: false });

  useLayoutEffect(() => {
    if (!subMenuRef.current) return;

    const domRect = subMenuRef.current.getBoundingClientRect();
    const subWidth = domRect.width || SUB_MENU_WIDTH;
    const subHeight = domRect.height || (items.length * ITEM_EST_HEIGHT + 24);

    // 计算 Left
    let left = triggerRect.right + 4;
    // 如果在右侧超出视口，移到触发按钮左侧
    if (left + subWidth > window.innerWidth - VIEWPORT_PADDING) {
      left = triggerRect.left - subWidth - 4;
    }
    // 水平钳位，确保不超出左右视口
    left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - subWidth - VIEWPORT_PADDING));

    // 计算 Top（默认与触发项顶部对齐）
    let top = triggerRect.top;
    // 如果在下方超出视口，向上移动
    if (top + subHeight > window.innerHeight - VIEWPORT_PADDING) {
      top = window.innerHeight - subHeight - VIEWPORT_PADDING;
    }
    // 顶部钳位
    if (top < VIEWPORT_PADDING) {
      top = VIEWPORT_PADDING;
    }

    setCoords({ left, top, isReady: true });
  }, [triggerRect, items.length]);

  return (
    <div
      ref={subMenuRef}
      className="fixed z-[9999] rounded-[6px] border border-white/10 bg-[#303030] p-1
                 shadow-[0_10px_28px_rgba(0,0,0,0.45)] overflow-y-auto custom-scrollbar"
      style={{
        width: SUB_MENU_WIDTH,
        maxHeight: SUB_MENU_MAX_HEIGHT,
        left: coords.left,
        top: coords.top,
        visibility: coords.isReady ? "visible" : "hidden",
        opacity: coords.isReady ? 1 : 0,
        transition: "opacity 0.05s ease-out",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="px-2 py-1 text-[9px] font-bold text-white/30 uppercase tracking-wider select-none">
        {label}
      </div>
      {items.map(renderItem)}
    </div>
  );
};
