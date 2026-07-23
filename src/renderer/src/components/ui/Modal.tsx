import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { IconButton } from "@/components/ui/IconButton"

// Modal 变体类型
export type ModalVariant = "primary" | "danger"

// Modal 组件属性接口
export interface ModalProps {
  // 是否显示弹窗
  isOpen: boolean
  // 关闭弹窗回调
  onClose: () => void
  // 弹窗标题
  title?: string
  // 弹窗描述/内容文本（当 form 为空时作为主要内容展示）
  description?: string
  // 自定义表单内容（与 description 二选一，form 优先）
  form?: React.ReactNode
  // 确认回调（若提供则显示确认/取消按钮）
  onConfirm?: () => void
  // 取消回调（可选）
  onCancel?: () => void
  // 确认按钮样式类型
  variant?: ModalVariant
  // 额外的弹窗容器样式名
  className?: string
}

/**
 * Modal - 视口居中的通用弹窗组件
 * 采用 React Portal 挂载到 document.body，支持消息提示与表单两种模式。
 * 设计语言与 Tooltip 统一，黑色主题，圆角6px，阴影过渡。
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  form,
  onConfirm,
  onCancel,
  variant = "primary",
  className = "",
}: ModalProps): React.JSX.Element | null => {
  const [isAnimatingOut, setIsAnimatingOut] = useState<boolean>(false)
  const [shouldRender, setShouldRender] = useState<boolean>(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  /** 记录 mousedown 起点是否在 backdrop 上，防止拖选文字后松开导致误关 */
  const isMouseDownOnBackdrop = useRef<boolean>(false)

  // 是否为确认模式（有 onConfirm 回调）
  const isConfirmMode = typeof onConfirm === "function"

  // 控制渲染与动画状态
  useEffect(() => {
    let animTimeout: NodeJS.Timeout
    if (isOpen) {
      setShouldRender(true)
      setIsAnimatingOut(false)
    } else {
      if (shouldRender) {
        setIsAnimatingOut(true)
        animTimeout = setTimeout(() => {
          setShouldRender(false)
          setIsAnimatingOut(false)
        }, 120)
      }
    }
    return () => {
      if (animTimeout) clearTimeout(animTimeout)
    }
  }, [isOpen, shouldRender])

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose()
        if (isConfirmMode) {
          onCancel?.()
        }
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, isConfirmMode, onClose, onCancel])

  /** mousedown 起点追踪 */
  const handleBackdropMouseDown = (e: React.MouseEvent): void => {
    isMouseDownOnBackdrop.current = e.target === backdropRef.current
  }

  /** 仅当 mousedown 和 click 均发生在 backdrop 上时才关闭 */
  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (isMouseDownOnBackdrop.current && backdropRef.current && e.target === backdropRef.current) {
      onClose()
      if (isConfirmMode) {
        onCancel?.()
      }
    }
    isMouseDownOnBackdrop.current = false
  }

  /** 关闭并触发取消回调 */
  const handleClose = useCallback((): void => {
    onClose()
    if (isConfirmMode) {
      onCancel?.()
    }
  }, [onClose, onCancel, isConfirmMode])

  // 处理确认提交
  const handleConfirm = (e: React.FormEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    onClose()
    onConfirm?.()
  }

  if (!shouldRender) return null

  const animationClass = isAnimatingOut ? "animate-tooltip-out" : "animate-tooltip-in"

  const modalContent = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[999998] flex items-center justify-center"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        className={`relative z-[999999] w-[320px] max-w-[90vw] rounded-[6px] bg-[#303030] p-4 text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)] select-text ${animationClass} ${className}`}
      >
        {/* 标题行 */}
        {title && (
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white/90">{title}</h3>
            <IconButton
              preset="close"
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                handleClose()
              }}
              title="关闭"
            />
          </div>
        )}

        {/* 内容区域 */}
        {form ? (
          <form onSubmit={handleConfirm} className="flex flex-col">
            {form}
            {isConfirmMode && (
              <div className="flex items-center justify-end mt-3 gap-1.5">
                <IconButton
                  type="button"
                  preset="close"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClose()
                  }}
                  title="取消"
                />
                <IconButton
                  type="submit"
                  preset={variant === "danger" ? "delete" : "confirm"}
                  title="确认"
                />
              </div>
            )}
          </form>
        ) : (
          <>
            {/* 纯消息模式 */}
            {description && <p className="text-xs text-white/60 leading-relaxed">{description}</p>}
            {isConfirmMode && (
              <div className="flex items-center justify-end mt-3 gap-1.5">
                <IconButton
                  preset="close"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClose()
                  }}
                  title="取消"
                />
                <IconButton
                  preset={variant === "danger" ? "delete" : "confirm"}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose()
                    onConfirm?.()
                  }}
                  title="确认"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
