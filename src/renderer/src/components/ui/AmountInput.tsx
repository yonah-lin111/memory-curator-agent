import type React from "react"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/Input"
import { evaluateMathExpression } from "@/pages/bills/components/billShared"

export interface AmountInputProps {
  value: string
  onChange: (val: string) => void
  onEnter?: () => void
  label?: string
}

export const AmountInput = ({
  value,
  onChange,
  onEnter,
  label,
}: AmountInputProps): React.JSX.Element => {
  const [liveResult, setLiveResult] = useState<number | null>(null)

  useEffect(() => {
    if (/[\+\-\*\/]/.test(value)) {
      const result = evaluateMathExpression(value)
      if (result !== null && result > 0 && String(result) !== value) {
        setLiveResult(result)
      } else {
        setLiveResult(null)
      }
    } else {
      setLiveResult(null)
    }
  }, [value])

  const handleResolve = () => {
    if (liveResult !== null) {
      onChange(liveResult.toFixed(2))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (liveResult !== null) {
        onChange(liveResult.toFixed(2))
      } else if (onEnter) {
        onEnter()
      }
    }
  }

  const inputNode = (
    <Input
      type="text"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={handleResolve}
      onKeyDown={handleKeyDown}
      placeholder="0.00"
      prefix={<span className="text-white/40 mr-1 font-mono text-xs">¥</span>}
      className={`!py-0.5 !h-[28px] !text-xs [&_input]:!text-xs transition-colors duration-300 ${
        liveResult !== null ? "border-green-400/30 focus-within:border-green-400/50" : ""
      }`}
    />
  )

  if (label) {
    return (
      <div className="flex flex-col gap-1 text-left w-full">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white/40">{label}</span>
          {liveResult !== null && (
            <span className="text-[11px] font-mono text-green-400 animate-in fade-in duration-200">
              = {liveResult.toFixed(2)}
            </span>
          )}
        </div>
        {inputNode}
      </div>
    )
  }

  return inputNode
}
