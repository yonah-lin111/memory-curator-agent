import { Clipboard, Edit3, FileText, RotateCcw, Trash2 } from "lucide-react"
import type React from "react"
import { useEffect, useState } from "react"

// AI 消息右键菜单组件属性类型。
type CuratorMessageContextMenuProps = {
  // 菜单左上角横坐标。
  x: number
  // 菜单左上角纵坐标。
  y: number
  // 是否允许重新生成当前回答。
  canRegenerate: boolean
  // 复制纯文本回调。
  onCopyText: () => void
  // 复制 Markdown 回调。
  onCopyMarkdown: () => void
  // 重新生成回答回调。
  onRegenerate: () => void
  // 删除当前 QA 回调。
  onDeleteQa: () => void
  // 编辑当前消息回调 (仅用户消息可用)。
  onEdit?: () => void
}

// 菜单宽度，用于把右键菜单限制在视口内。
const MENU_WIDTH = 176

// 基础菜单高度。
const BASE_MENU_HEIGHT = 122

// 带重新生成项的菜单高度。
const REGENERATE_MENU_HEIGHT = 162

// 菜单与视口边缘的最小距离。
const VIEWPORT_PADDING = 8

/**
 * 把菜单坐标钳制在当前视口内。
 */
const getMenuPosition = (x: number, y: number, height: number): { left: number; top: number } => {
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING)
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING)

  return {
    left: Math.min(Math.max(x, VIEWPORT_PADDING), maxLeft),
    top: Math.min(Math.max(y, VIEWPORT_PADDING), maxTop),
  }
}

/**
 * CuratorMessageContextMenu - 负责单条 AI 消息的右键操作菜单。
 */
export const CuratorMessageContextMenu = ({
  x,
  y,
  canRegenerate,
  onCopyText,
  onCopyMarkdown,
  onRegenerate,
  onDeleteQa,
  onEdit,
}: CuratorMessageContextMenuProps): React.JSX.Element => {
  // 是否已进入重新生成二次确认态。
  const [isConfirmingRegenerate, setIsConfirmingRegenerate] = useState<boolean>(false)
  // 是否已进入删除 QA 二次确认态。
  const [isConfirmingDeleteQa, setIsConfirmingDeleteQa] = useState<boolean>(false)
  const menuHeight = canRegenerate || onEdit ? REGENERATE_MENU_HEIGHT : BASE_MENU_HEIGHT
  const position = getMenuPosition(x, y, menuHeight)

  useEffect(() => {
    setIsConfirmingRegenerate(false)
    setIsConfirmingDeleteQa(false)
  }, [x, y, canRegenerate])

  /**
   * 第一次点击进入确认态，第二次点击才真正重新生成。
   */
  const handleRegenerateClick = (): void => {
    if (!isConfirmingRegenerate) {
      setIsConfirmingRegenerate(true)
      setIsConfirmingDeleteQa(false)
      return
    }

    onRegenerate()
  }

  /**
   * 第一次点击进入确认态，第二次点击才真正删除 QA。
   */
  const handleDeleteQaClick = (): void => {
    if (!isConfirmingDeleteQa) {
      setIsConfirmingDeleteQa(true)
      setIsConfirmingRegenerate(false)
      return
    }

    onDeleteQa()
  }

  return (
    <div
      aria-label="AI message action menu"
      className="fixed z-50 w-[176px] rounded-[6px] border border-white/10 bg-[#303030] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
      role="menu"
      onClick={(event) => event.stopPropagation()}
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <button
        className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
        role="menuitem"
        type="button"
        onClick={onCopyText}
      >
        <Clipboard className="h-3.5 w-3.5 text-white/45" />
        <span>复制内容</span>
      </button>
      <button
        className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/45"
        role="menuitem"
        type="button"
        onClick={onCopyMarkdown}
      >
        <FileText className="h-3.5 w-3.5 text-white/45" />
        <span>复制markdown</span>
      </button>
      {onEdit ? (
        <button
          className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-amber-400/80 transition-colors hover:bg-amber-400/10 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400/45"
          role="menuitem"
          type="button"
          onClick={onEdit}
        >
          <Edit3 className="h-3.5 w-3.5 text-amber-400/80" />
          <span>编辑消息</span>
        </button>
      ) : null}
      {canRegenerate ? (
        <button
          className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400/45 ${
            isConfirmingRegenerate
              ? "bg-sky-500 text-black hover:bg-sky-400"
              : "text-sky-400/80 hover:bg-sky-400/10 hover:text-sky-300"
          }`}
          role="menuitem"
          type="button"
          onClick={handleRegenerateClick}
        >
          <RotateCcw
            className={`h-3.5 w-3.5 ${isConfirmingRegenerate ? "text-black" : "text-sky-400/80"}`}
          />
          <span>{isConfirmingRegenerate ? "确认重新生成" : "重新生成"}</span>
        </button>
      ) : null}
      <button
        className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400/45 ${
          isConfirmingDeleteQa
            ? "bg-rose-600 text-white hover:bg-rose-500"
            : "text-rose-400/80 hover:bg-rose-400/10 hover:text-rose-300"
        }`}
        role="menuitem"
        type="button"
        onClick={handleDeleteQaClick}
      >
        <Trash2
          className={`h-3.5 w-3.5 ${isConfirmingDeleteQa ? "text-white" : "text-rose-400/80"}`}
        />
        <span>{isConfirmingDeleteQa ? "确认删除QA" : "删除QA"}</span>
      </button>
    </div>
  )
}
