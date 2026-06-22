import type React from "react";
import { useState } from "react";
import { BILL_CATEGORIES, BILL_TYPES, parseAmountToCents, type BillCategory, type BillType } from "./billShared";

/** 账单草稿 */
export type BillDraft = {
  amount: string
  category: BillCategory
  billType: BillType
  billDate: string
  note: string
  tags: string[]
}

/** 编辑模式预填数据 */
export type BillEntryData = {
  id: number
  amount: number
  category: BillCategory
  billType: BillType
  billDate: string
  note: string
  tags: string[]
}

type BillEntryModalProps = {
  /** 编辑模式预填数据，不传为新建模式 */
  bill?: BillEntryData | null
  onClose: () => void
  onSave: (draft: BillDraft) => Promise<boolean>
}

/** 生成今日日期 YYYY-MM-DD */
const getToday = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** 格式化金额显示 */
const formatCents = (cents: number): string => (cents / 100).toFixed(2)

/**
 * BillEntryModal - 账单录入/编辑弹窗。
 */
export const BillEntryModal = ({ bill, onClose, onSave }: BillEntryModalProps): React.JSX.Element => {
  const [amount, setAmount] = useState(bill ? formatCents(bill.amount) : "")
  const [billType, setBillType] = useState<BillType>(bill?.billType ?? "expense")
  const [category, setCategory] = useState<BillCategory>(bill?.category ?? "餐饮")
  const [billDate, setBillDate] = useState(bill?.billDate ?? getToday())
  const [note, setNote] = useState(bill?.note ?? "")
  const [tags, setTags] = useState<string[]>(bill?.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseAmountToCents(amount)
    if (parsedAmount <= 0) {
      setError("请输入有效金额")
      return
    }

    setIsSaving(true)
    const success = await onSave({ amount: String(parsedAmount), category, billType, billDate, note, tags })
    setIsSaving(false)

    if (success) onClose()
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault()
      const trimmed = tagInput.trim()
      if (trimmed && !tags.includes(trimmed)) {
        setTags((prev) => [...prev, trimmed])
      }
      setTagInput("")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[6px] border border-white/10 bg-[#212121] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-white mb-4">
          {bill ? "编辑账单" : "添加账单"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            {BILL_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setBillType(type.value)}
                className={`flex-1 rounded-[6px] border px-3 py-2 text-sm font-medium transition-colors ${
                  billType === type.value
                    ? "border-white/20 bg-white text-black"
                    : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/8"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">金额</label>
            <div className="flex items-center rounded-[6px] border border-white/10 bg-white/[0.04] px-3 py-2">
              <span className="text-sm text-white/40 mr-1">¥</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">分类</label>
            <div className="grid grid-cols-4 gap-2">
              {BILL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-[6px] border px-2 py-1.5 text-xs font-medium transition-colors ${
                    category === cat
                      ? "border-white/20 bg-white text-black"
                      : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/8"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">日期</label>
            <input
              type="date"
              required
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full rounded-[6px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">备注</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注说明（可选）"
              rows={2}
              className="w-full resize-none rounded-[6px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/20"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">标签</label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-[4px] border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                      className="text-white/40 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="输入标签后按回车"
              className="w-full rounded-[6px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/20"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[6px] border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-[6px] bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
            >
              {isSaving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
