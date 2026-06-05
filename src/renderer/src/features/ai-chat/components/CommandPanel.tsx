import type React from "react";

// 输入建议项接口。
export interface SuggestionItem {
  // 唯一标识。
  id: string;
}

// 建议面板组件属性接口。
export interface CommandPanelProps<T extends SuggestionItem> {
  // 是否显示面板。
  isOpen: boolean;
  // ARIA 标签文本。
  ariaLabel: string;
  // 可匹配的建议项列表。
  items: T[];
  // 当前处于激活/选中状态的索引。
  activeIndex: number;
  // 鼠标移入或导航时更新激活索引。
  onActiveIndexChange: (index: number) => void;
  // 点击选中建议项回调。
  onItemSelect: (item: T) => void;
  // 渲染单个项内容的自定义函数。
  renderItem: (item: T, isActive: boolean) => React.ReactNode;
  // 键盘快捷键监听处理函数（可选，仅用于 slash 命令面板特殊的 keydown 处理）。
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  // 自定义 ID 前缀，用于构建 aria-activedescendant 对应的元素 ID。
  idPrefix: string;
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
  idPrefix,
}: CommandPanelProps<T>): React.JSX.Element | null => {
  if (!isOpen || items.length === 0) {
    return null;
  }

  const activeItem = items[activeIndex] ?? items[0];

  return (
    <div
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={`${idPrefix}-${activeItem?.id}`}
      onKeyDown={onKeyDown}
      className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-40 overflow-hidden rounded-[6px] border border-white/10 bg-[#303030] shadow-2xl outline-none"
    >
      {items.map((item, index) => {
        const isActive = index === activeIndex;

        return (
          <button
            key={item.id}
            id={`${idPrefix}-${item.id}`}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onItemSelect(item)}
            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
              isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
            }`}
          >
            {renderItem(item, isActive)}
          </button>
        );
      })}
    </div>
  );
};
