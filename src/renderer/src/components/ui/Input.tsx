import type React from "react";
import { forwardRef, useState } from "react";
import { Tag } from "@/components/ui/Tag";

export interface BaseInputProps {
  /**
   * 输入框尺寸类型
   * - "sm": standard (text-sm, px-3 py-1.5, or p-2.5 if textarea)
   * - "xs": small/tag (text-xs, px-3 py-1.5)
   * @default "sm"
   */
  size?: "sm" | "xs";
  /**
   * 背景色 Class
   * @default "bg-[#212121]"
   */
  bgClass?: string;
}

export interface StandardInputProps
  extends BaseInputProps,
    Omit<
      React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>,
      "size" | "prefix"
    > {
  /**
   * 决定渲染为 input 还是 textarea
   * @default "input"
   */
  as?: "input" | "textarea";
  /**
   * 前缀插槽
   */
  prefix?: React.ReactNode;
  /**
   * 后缀插槽
   */
  suffix?: React.ReactNode;
  /**
   * 是否开启自适应高度且限制最大行数
   */
  autosize?: boolean;
}

export interface TagInputProps
  extends BaseInputProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size"> {
  /**
   * 渲染为标签+输入框组合
   */
  as: "tags";
  /**
   * 当前绑定的标签列表
   */
  tags: string[];
  /**
   * 标签列表变更回调
   */
  onChangeTags: (tags: string[]) => void;
  /**
   * 最大标签数限制
   * @default 6
   */
  maxTags?: number;
}

export interface NumberInputProps
  extends BaseInputProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size" | "prefix"> {
  /**
   * 渲染为数字输入框
   */
  as: "number";
  /**
   * 当前绑定的数值
   */
  value: number;
  /**
   * 数值变更回调
   */
  onChangeValue: (value: number) => void;
  /**
   * 前缀插槽
   */
  prefix?: React.ReactNode;
  /**
   * 后缀插槽
   */
  suffix?: React.ReactNode;
}

export type InputProps = StandardInputProps | TagInputProps | NumberInputProps;

/**
 * Input - 统一的自定义公共输入框/文本域组件
 * 样式背景和高亮参考 Select.tsx 设计，支持多态渲染、尺寸定制、标签输入组合、前后缀插槽、自动伸缩行高和 Ref 转发。
 */
export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  (props, ref) => {
    const { as = "input", size = "sm", bgClass = "bg-[#212121]", className = "", ...rest } = props;

    if (as === "tags") {
      const { tags, onChangeTags, maxTags = 6, placeholder, disabled, ...tagProps } = rest as TagInputProps;
      const [tagInput, setTagInput] = useState("");

      const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const trimmed = tagInput.trim();
          if (trimmed) {
            if (tags.length >= maxTags) {
              return;
            }
            if (!tags.includes(trimmed)) {
              onChangeTags([...tags, trimmed]);
            }
            setTagInput("");
          }
        }
      };

      const defaultPlaceholder = tags.length >= maxTags
        ? `最多可添加 ${maxTags} 个标签`
        : "输入新标签并按回车确认...";

      const baseClass = `w-full rounded-[6px] border border-white/10 ${bgClass} text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 hover:border-white/20 focus:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed`;
      const sizeClass = size === "xs" ? "text-xs px-3 py-1.5" : "text-sm px-3 py-1.5";
      const combinedClassName = `${baseClass} ${sizeClass} ${className}`.trim();

      return (
        <div className="w-full">
          <input
            ref={ref as React.ForwardedRef<HTMLInputElement>}
            type="text"
            className={combinedClassName}
            disabled={disabled || tags.length >= maxTags}
            placeholder={placeholder ?? defaultPlaceholder}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            {...(tagProps as Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size">)}
          />
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Tag
                  key={tag}
                  prefix="#"
                  onClose={() => {
                    onChangeTags(tags.filter((t) => t !== tag));
                  }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (as === "number") {
      const { value, onChangeValue, prefix, suffix, disabled, ...numberProps } = rest as NumberInputProps;
      const baseClass = `w-full rounded-[6px] border border-white/10 ${bgClass} text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 hover:border-white/20 focus:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed`;
      const sizeClass = size === "xs" ? "text-xs px-3 py-1.5" : "text-sm px-3 py-1.5";

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const numVal = val === "" ? 0 : Number(val);
        if (!isNaN(numVal)) {
          onChangeValue(numVal);
        }
      };

      if (prefix || suffix) {
        const containerClass = `flex items-center gap-1.5 w-full rounded-[6px] border border-white/10 ${bgClass} text-white/80 transition-colors duration-150 hover:border-white/20 focus-within:border-white/25 px-2.5 py-1.5 ${className}`.trim();
        return (
          <div className={containerClass}>
            {prefix}
            <div className="relative min-w-0 flex-1">
              <input
                ref={ref as React.ForwardedRef<HTMLInputElement>}
                type="number"
                className="w-full bg-transparent px-0 py-0 text-sm text-white placeholder:text-white/20 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={value}
                onChange={handleChange}
                disabled={disabled}
                {...(numberProps as Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size" | "prefix" | "type">)}
              />
            </div>
            {suffix}
          </div>
        );
      }

      const combinedClassName = `${baseClass} ${sizeClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`.trim();

      return (
        <input
          ref={ref as React.ForwardedRef<HTMLInputElement>}
          type="number"
          className={combinedClassName}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          {...(numberProps as Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size" | "prefix" | "type">)}
        />
      );
    }

    const { prefix, suffix, autosize, ...standardProps } = rest as StandardInputProps;

    // 如果提供了前缀、后缀或者自适应高度
    if (prefix || suffix || autosize) {
      const containerClass = `flex items-center gap-1.5 w-full rounded-[6px] border border-white/10 ${bgClass} text-white/80 transition-colors duration-150 hover:border-white/20 focus-within:border-white/25 px-2.5 py-1.5 ${className}`.trim();

      return (
        <div className={containerClass}>
          {prefix}
          <div className="relative min-w-0 flex-1">
            {autosize ? (
              <>
                <div
                  className="invisible px-0 py-0 border border-transparent break-words whitespace-pre-wrap pointer-events-none min-h-[19.5px]"
                  aria-hidden="true"
                  style={{
                    fontSize: "13px",
                    lineHeight: "19.5px",
                    maxHeight: "58.5px",
                  }}
                >
                  {(standardProps.value as string) || " "}
                </div>
                <textarea
                  ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
                  className="absolute inset-0 w-full h-full min-w-0 bg-transparent px-0 py-0 text-sm text-white placeholder:text-white/20 outline-none resize-none overflow-y-auto custom-scrollbar min-h-0"
                  style={{
                    fontSize: "13px",
                    lineHeight: "19.5px",
                    maxHeight: "58.5px",
                  }}
                  {...(standardProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
                />
              </>
            ) : as === "textarea" ? (
              <textarea
                ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
                className="w-full bg-transparent px-0 py-0 text-sm text-white placeholder:text-white/20 outline-none resize-none min-h-24"
                {...(standardProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
              />
            ) : (
              <input
                ref={ref as React.ForwardedRef<HTMLInputElement>}
                className="w-full bg-transparent px-0 py-0 text-sm text-white placeholder:text-white/20 outline-none"
                {...(standardProps as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            )}
          </div>
          {suffix}
        </div>
      );
    }

    // 基础共有样式
    const baseClass = `w-full rounded-[6px] border border-white/10 ${bgClass} text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 hover:border-white/20 focus:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed`;

    // 尺寸和元素样式定制
    const isTextarea = as === "textarea";
    const sizeClass = isTextarea
      ? "text-sm p-2.5 leading-relaxed resize-none min-h-24"
      : size === "xs"
      ? "text-xs px-3 py-1.5"
      : "text-sm px-3 py-1.5";

    const combinedClassName = `${baseClass} ${sizeClass} ${className}`.trim();

    if (isTextarea) {
      return (
        <textarea
          ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
          className={combinedClassName}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      );
    }

    return (
      <input
        ref={ref as React.ForwardedRef<HTMLInputElement>}
        className={combinedClassName}
        {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    );
  }
);

Input.displayName = "Input";
