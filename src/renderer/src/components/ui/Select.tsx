import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";

// 下拉菜单单个选项接口。
export interface SelectOption<T> {
  // 选项值。
  value: T;
  // 选项显示文本。
  label: string;
}

// 下拉菜单组件属性接口。
export interface SelectProps<T> {
  // 组件唯一标识。
  id?: string;
  // 当前选中值。
  value: T;
  // 值改变回调。
  onChange: (value: T) => void;
  // 可选列表。
  options: SelectOption<T>[];
  // 附加样式类。
  className?: string;
  // 文字对齐方式。默认为 "left"。
  align?: "left" | "center";
  // 下拉菜单弹出方向。默认为 "down"。
  position?: "up" | "down";
  // 触发按钮背景类。默认为 "bg-black/35"。
  bgClass?: string;
}

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
  bgClass = "bg-black/35",
}: SelectProps<T>): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const selectedOption = options.find((opt) => opt.value === value);

  // 根据对齐方式计算触发按钮和内容的样式。
  const buttonAlignStyles =
    align === "center" ? "justify-center relative" : "justify-between";

  const textAlignStyles = align === "center" ? "text-center" : "text-left";

  const chevronStyles =
    align === "center" ? "absolute right-2.5 top-1/2 -translate-y-1/2" : "";

  // 根据展开方向计算下拉菜单定位。
  const positionStyles =
    position === "up" ? "bottom-[100%] mb-1" : "top-[100%] mt-1";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <IconButton
        id={id}
        iconOnly={false}
        hoverBgClass=""
        hoverTextClass=""
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
          role="listbox"
          className={`absolute left-0 z-50 w-full rounded-[6px] border border-white/10 bg-black p-1 shadow-lg max-h-60 overflow-y-auto custom-scrollbar animate-card-modal-in ${positionStyles}`}
        >
          {options.map((option) => {
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
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span className={`flex-1 truncate ${textAlignStyles}`}>
                  {option.label}
                </span>
                {isSelected && (
                  <Check className="h-3 w-3 text-white ml-2 flex-shrink-0" />
                )}
              </IconButton>
            );
          })}
        </div>
      )}
    </div>
  );
};
