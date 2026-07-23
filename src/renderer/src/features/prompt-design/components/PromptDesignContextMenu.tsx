import { ClipboardPaste, Copy, Quote, Scissors } from "lucide-react"
import type React from "react"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

export type PromptDesignContextMenuProps = {
  x: number
  y: number
  isEditMode: boolean
  canPaste: boolean
  canQuote: boolean
  onCopy: () => void
  onPaste: () => void
  onCut: () => void
  onQuote: () => void
  onClose: () => void
}

const MENU_WIDTH = 180
const MENU_HEIGHT = 196
const PADDING = 8

/** 将菜单限制在视口内，避免右键位置靠近边缘时内容溢出。 */
const getPosition = (x: number, y: number): React.CSSProperties => ({
  left: Math.min(Math.max(x, PADDING), Math.max(PADDING, window.innerWidth - MENU_WIDTH - PADDING)),
  top: Math.min(
    Math.max(y, PADDING),
    Math.max(PADDING, window.innerHeight - MENU_HEIGHT - PADDING),
  ),
})

export const PromptDesignContextMenu = ({
  x,
  y,
  isEditMode,
  canPaste,
  canQuote,
  onCopy,
  onPaste,
  onCut,
  onQuote,
  onClose,
}: PromptDesignContextMenuProps): React.JSX.Element => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
    }
  }, [onClose])

  const item = (label: string, icon: React.ReactNode, onClick: () => void, disabled = false) => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left text-xs text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="编辑器操作菜单"
      className="fixed z-[9999] w-[180px] rounded-[6px] border border-white/10 bg-[#303030] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
      style={getPosition(x, y)}
      onClick={(event) => event.stopPropagation()}
    >
      {item("复制", <Copy className="h-3.5 w-3.5" />, onCopy)}
      {item("粘贴", <ClipboardPaste className="h-3.5 w-3.5" />, onPaste, !isEditMode || !canPaste)}
      {item("剪切", <Scissors className="h-3.5 w-3.5" />, onCut, !isEditMode)}
      {item("引用到输入框", <Quote className="h-3.5 w-3.5" />, onQuote, !isEditMode || !canQuote)}
    </div>,
    document.body,
  )
}
