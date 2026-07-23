import type React from "react"
import { useEffect, useRef } from "react"

// 输入建议项接口。
export interface SuggestionItem {
  // 唯一标识。
  id: string
}

// 建议面板组件属性接口。
export interface CommandPanelProps<T extends SuggestionItem> {
  // 是否显示面板。
  isOpen: boolean
  // ARIA 标签文本。
  ariaLabel: string
  // 可匹配的建议项列表。
  items: T[]
  // 当前处于激活/选中状态的索引。
  activeIndex: number
  // 鼠标移入或导航时更新激活索引。
  onActiveIndexChange: (index: number) => void
  // 点击选中建议项回调。
  onItemSelect: (item: T) => void
  // 渲染单个项内容的自定义函数。
  renderItem: (item: T, isActive: boolean) => React.ReactNode
  // 键盘快捷键监听处理函数（可选，仅用于 slash 命令面板特殊的 keydown 处理）。
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void
  // 滚动事件处理函数（可选，用于触底自动加载更多等）。
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
  // 自定义 ID 前缀，用于构建 aria-activedescendant 对应的元素 ID。
  idPrefix: string
  // 面板额外样式，用于编辑器光标定位等特殊场景。
  style?: React.CSSProperties
  // 面板额外类名，用于编辑器光标定位等特殊场景。
  className?: string
  // 是否禁用面板的鼠标交互，仅保留键盘操作。
  keyboardOnly?: boolean
}

/**
 * CommandPanel - 统一的 AI 输入框命令与提及补全浮动建议面板组件。
 */
export const CommandPanel = <T extends SuggestionItem>({
  isOpen,
  ariaLabel,
  items,
  activeIndex,
  onActiveIndexChange,
  onItemSelect,
  renderItem,
  onKeyDown,
  onScroll,
  idPrefix,
  style,
  className,
  keyboardOnly = false,
}: CommandPanelProps<T>): React.JSX.Element | null => {
  const containerRef = useRef<HTMLDivElement>(null)

  const activeItem = items[activeIndex] ?? items[0]

  useEffect(() => {
    if (!isOpen || !containerRef.current || !activeItem) {
      return
    }

    const activeEl = containerRef.current.querySelector(
      `[id="${idPrefix}-${activeItem.id}"]`,
    ) as HTMLElement

    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" })
    }
  }, [activeIndex, activeItem, isOpen, idPrefix])

  if (!isOpen || items.length === 0) {
    return null
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={`${idPrefix}-${activeItem?.id}`}
      onKeyDown={onKeyDown}
      onScroll={onScroll}
      style={keyboardOnly ? { ...style, pointerEvents: "none" } : style}
      className={`absolute bottom-[calc(100%+8px)] left-0 right-0 z-40 max-h-[30vh] overflow-y-auto rounded-[6px] border border-white/10 bg-[#303030] shadow-2xl outline-none ${className ?? ""}`}
    >
      {items.map((item, index) => {
        const isActive = index === activeIndex

        return (
          <button
            key={item.id}
            id={`${idPrefix}-${item.id}`}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseEnter={keyboardOnly ? undefined : () => onActiveIndexChange(index)}
            onClick={keyboardOnly ? undefined : () => onItemSelect(item)}
            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
              isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
            }`}
          >
            {renderItem(item, isActive)}
          </button>
        )
      })}
    </div>
  )
}
