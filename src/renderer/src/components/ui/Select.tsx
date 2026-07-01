import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

// 下拉菜单单个选项接口。
export interface SelectOption<T> {
  // 选项值。
  value: T;
  // 选项显示文本。
  label: string;
}

// 下拉菜单分组选项接口。
export interface SelectGroup<T> {
  // 分组显示文本。
  label: string;
  // 分组下的子选项。
  options: SelectOption<T>[];
}

// 下拉菜单组件属性接口。
export interface SelectProps<T> {
  // 组件唯一标识。
  id?: string;
  // 当前选中值。
  value: T;
  // 值改变回调。
  onChange: (value: T) => void;
  // 可选列表（支持平铺或按组展示）。
  options: (SelectOption<T> | SelectGroup<T>)[];
  // 附加样式类。
  className?: string;
  // 文字对齐方式。默认为 "left"。
  align?: "left" | "center";
  // 下拉菜单弹出方向。默认为 "down"。
  position?: "up" | "down";
  // 触发按钮背景类。默认为 "bg-[#303030]"。
  bgClass?: string;
  // 是否禁用选择器。
  disabled?: boolean;
}

/**
 * 判断是否为分组选项
 */
const isGroup = <T,>(
  item: SelectOption<T> | SelectGroup<T>,
): item is SelectGroup<T> => {
  return "options" in item;
};

/**
 * Select - 统一的公共自定义下拉选择器组件
 */
export const Select = <T extends string>({
  id,
  value,
  onChange,
  options,
  className = "",
  align = "left",
  position = "down",
  bgClass = "bg-[#303030]",
  disabled = false,
}: SelectProps<T>): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    /**
     * 处理点击外部区域时自动关闭下拉选择器。
     */
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 展开时，滚动到选中的选项使其在容器中间显示
  useEffect(() => {
    if (isOpen && listboxRef.current) {
      const selectedEl = listboxRef.current.querySelector('[aria-selected="true"]') as HTMLElement;
      if (selectedEl) {
        const listbox = listboxRef.current;
        const scrollTop = selectedEl.offsetTop - listbox.clientHeight / 2 + selectedEl.clientHeight / 2;
        listbox.scrollTop = scrollTop;
      }
    }
  }, [isOpen, value]);

  // 查找当前选中的选项。
  const findSelectedOption = (
    items: (SelectOption<T> | SelectGroup<T>)[],
  ): SelectOption<T> | undefined => {
    for (const item of items) {
      if (isGroup(item)) {
        const found = item.options.find((opt) => opt.value === value);
        if (found) return found;
      } else if (item.value === value) {
        return item;
      }
    }
    return undefined;
  };

  const selectedOption = findSelectedOption(options);

  // 根据对齐方式计算触发按钮和内容的样式。
  const buttonAlignStyles =
    align === "center" ? "justify-center relative" : "justify-between";

  const textAlignStyles = align === "center" ? "text-center" : "text-left";

  const chevronStyles =
    align === "center" ? "absolute right-2.5 top-1/2 -translate-y-1/2" : "";

  // 根据展开方向计算下拉菜单定位。
  const positionStyles =
    position === "up" ? "bottom-[100%] mb-1" : "top-[100%] mt-1";

  // 渲染单个选项
  const renderOption = (option: SelectOption<T>, isGrouped: boolean) => {
    const isSelected = option.value === value;
    return (
      <IconButton
        key={option.value}
        role="option"
        aria-selected={isSelected}
        iconOnly={false}
        hoverBgClass="hover:bg-white/10"
        className={`flex w-full items-center justify-between rounded-[4px] px-2.5 py-1.5 text-xs font-normal outline-none ${
          isSelected ? "bg-white/5 text-white" : "text-white/70"
        } ${isGrouped ? "pl-5" : ""}`}
        onMouseDown={(e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
          onChange(option.value);
        }}
      >
        <span className={`flex-1 whitespace-nowrap ${textAlignStyles}`}>
          {option.label}
        </span>
        {isSelected && (
          <Check className="h-3 w-3 text-white ml-2 flex-shrink-0" />
        )}
      </IconButton>
    );
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <IconButton
        id={id}
        iconOnly={false}
        hoverBgClass=""
        hoverTextClass=""
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex h-8 w-full items-center border border-white/10 ${bgClass} px-2.5 py-1.5 text-xs font-normal text-white/80 rounded-[6px] outline-none hover:border-white/20 focus:border-white/25 transition-colors duration-150 ${buttonAlignStyles}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={`flex-1 truncate pr-4 ${textAlignStyles}`}>
          {selectedOption ? selectedOption.label : String(value)}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-white/55 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          } ${chevronStyles}`}
        />
      </IconButton>
      {isOpen && (
        <div
          ref={listboxRef}
          role="listbox"
          className={`absolute left-0 z-50 min-w-full w-max rounded-[6px] border border-white/10 bg-[#303030] p-1 shadow-lg max-h-60 overflow-y-auto custom-scrollbar animate-card-modal-in ${positionStyles}`}
        >
          {options.map((item, index) => {
            if (isGroup(item)) {
              return (
                <div key={`group-${index}`} className="flex flex-col">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-white/30 uppercase tracking-wider text-left select-none">
                    {item.label}
                  </div>
                  {item.options.map((option) => renderOption(option, true))}
                </div>
              );
            }
            return renderOption(item, false);
          })}
        </div>
      )}
    </div>
  );
};
