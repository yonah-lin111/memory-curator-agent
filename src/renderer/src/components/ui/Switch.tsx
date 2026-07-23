import type React from "react"

// 开关组件属性接口。
export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  // 开关状态变更回调。
  onChange: (checked: boolean) => void
}

/**
 * Switch - 统一的紧凑型布尔开关。
 */
export const Switch = ({ className = "", onChange, ...props }: SwitchProps): React.JSX.Element => (
  <input
    {...props}
    type="checkbox"
    role="switch"
    onChange={(event) => onChange(event.target.checked)}
    className={`h-4 w-6 shrink-0 cursor-pointer appearance-none rounded-full bg-white/15 p-0.5 transition-colors duration-150 checked:bg-white/80 before:block before:h-3 before:w-3 before:rounded-full before:bg-white/55 before:transition-transform before:duration-150 checked:before:translate-x-2.5 checked:before:bg-black focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
  />
)
