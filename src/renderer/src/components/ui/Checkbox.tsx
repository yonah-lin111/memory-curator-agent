import type React from "react"

// 复选框组件属性接口。
export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  // 复选框状态变更回调。
  onChange: (checked: boolean) => void
}

/**
 * Checkbox - 统一的暗色主题复选框组件。
 */
export const Checkbox = ({
  className = "",
  onChange,
  ...props
}: CheckboxProps): React.JSX.Element => (
  <span className={`relative inline-flex h-4 w-4 shrink-0 cursor-pointer ${className}`}>
    <input
      {...props}
      type="checkbox"
      onChange={(event) => onChange(event.target.checked)}
      className="peer sr-only"
    />
    <span
      aria-hidden="true"
      className="absolute inset-0 rounded-[4px] border border-white/25 bg-black transition-colors before:absolute before:left-[5px] before:top-[2px] before:h-[7px] before:w-[4px] before:rotate-45 before:border-b-2 before:border-r-2 before:border-white before:opacity-0 before:transition-opacity peer-checked:border-white peer-checked:bg-white/80 peer-checked:before:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-white/40 peer-disabled:opacity-40"
    />
  </span>
)
