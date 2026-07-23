import type React from "react"
import { createContext, useContext } from "react"

// 单选组上下文。
interface RadioGroupContextValue {
  // 单选组名称。
  name: string
  // 当前选中值。
  value: string
  // 值变化回调。
  onChange: (value: string) => void
  // 是否禁用整个单选组。
  disabled: boolean
}

// 单选组上下文实例。
const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

// 单选组组件属性。
export interface RadioGroupProps {
  // 单选组名称。
  name: string
  // 当前选中值。
  value: string
  // 值变化回调。
  onChange: (value: string) => void
  // 单选项内容。
  children: React.ReactNode
  // 是否禁用整个单选组。
  disabled?: boolean
  // 额外容器样式名。
  className?: string
}

// 单选框组件属性。
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  // 单选项标签。
  label: React.ReactNode
}

/**
 * Radio - 符合应用暗色主题的单选表单组件。
 */
export const Radio = ({
  label,
  className = "",
  disabled = false,
  name,
  checked,
  value,
  onChange,
  ...inputProps
}: RadioProps): React.JSX.Element => {
  // 读取所属单选组状态。
  const radioGroup = useContext(RadioGroupContext)
  // 合并单选组与单项禁用状态。
  const isDisabled = disabled || radioGroup?.disabled === true
  // 单选组优先接管受控选中状态。
  const isChecked = radioGroup ? radioGroup.value === String(value) : checked

  return (
    <label
      className={`flex items-center gap-2 rounded-[4px] px-1 py-1 text-xs text-white/65 transition-colors ${
        isDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-white/[0.04]"
      } ${className}`}
    >
      <input
        {...inputProps}
        checked={isChecked}
        className="peer sr-only"
        disabled={isDisabled}
        name={radioGroup?.name ?? name}
        onChange={(event) => {
          onChange?.(event)
          if (event.target.checked) {
            radioGroup?.onChange(event.target.value)
          }
        }}
        type="radio"
        value={value}
      />
      <span
        aria-hidden="true"
        className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/25 bg-black transition-colors before:h-1.5 before:w-1.5 before:rounded-full before:bg-black before:opacity-0 before:transition-opacity peer-checked:border-white peer-checked:bg-white peer-checked:before:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-white/40"
      />
      <span>{label}</span>
    </label>
  )
}

/**
 * RadioGroup - 为 Radio 提供统一的受控状态与互斥选择行为。
 */
export const RadioGroup = ({
  name,
  value,
  onChange,
  children,
  disabled = false,
  className = "",
}: RadioGroupProps): React.JSX.Element => {
  return (
    <RadioGroupContext.Provider value={{ name, value, onChange, disabled }}>
      <div className={className} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}
