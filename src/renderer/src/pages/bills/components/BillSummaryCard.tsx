import type React from "react";
import { useEffect, useState } from "react";
import { Receipt, Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatAmount, type BillCategory } from "./billShared";
import { BillEntryModal, type BillDraft } from "./BillEntryModal";

/** 今日账单摘要（来自 preload todaySummary） */
type TodaySummary = {
  expenseTotal: number
  incomeTotal: number
  recentItems: Array<{
    id: number
    amount: number
    category: BillCategory
    billType: "expense" | "income"
    billDate: string
    note: string
    tags: string[]
  }>
}

/**
 * BillSummaryCard - Today 页右侧今日账单摘要卡片。
 */
export const BillSummaryCard = (): React.JSX.Element => {
  const hasBillApi = Boolean(window.api?.bill)
  const [summary, setSummary] = useState<TodaySummary | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<{
    id: number
    amount: number
    category: BillCategory
    billType: "expense" | "income"
    billDate: string
    note: string
    tags: string[]
  } | null>(null)

  const loadSummary = async (): Promise<void> => {
    if (!hasBillApi) return
    const result = await window.api.bill!.todaySummary()
    setSummary(result)
  }

  useEffect(() => {
    void loadSummary()
  }, [])

  const handleSave = async (draft: BillDraft): Promise<boolean> => {
    if (!hasBillApi) {
      const today = new Date().toISOString().slice(0, 10)
      setSummary((prev) => ({
        expenseTotal: (prev?.expenseTotal ?? 0) + (draft.billType === "expense" ? Number(draft.amount) : 0),
        incomeTotal: (prev?.incomeTotal ?? 0) + (draft.billType === "income" ? Number(draft.amount) : 0),
        recentItems: [
          {
            id: Date.now(),
            amount: Number(draft.amount),
            category: draft.category,
            billType: draft.billType,
            billDate: today,
            note: draft.note,
            tags: draft.tags
          },
          ...(prev?.recentItems ?? [])
        ].slice(0, 5)
      }))
      return true
    }
    try {
      await window.api.bill!.create({
        amount: Number(draft.amount),
        category: draft.category,
        billType: draft.billType,
        billDate: draft.billDate,
        note: draft.note,
        tags: draft.tags
      })
      await loadSummary()
      return true
    } catch {
      return false
    }
  }

  const handleEditSave = async (draft: BillDraft): Promise<boolean> => {
    if (!hasBillApi || !editingBill) return false
    try {
      await window.api.bill!.update(editingBill.id, {
        amount: Number(draft.amount),
        category: draft.category,
        billType: draft.billType,
        billDate: draft.billDate,
        note: draft.note,
        tags: draft.tags
      })
      await loadSummary()
      setEditingBill(null)
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <Receipt className="h-4 w-4 text-white/50" />
        <span className="text-sm font-bold text-white/80">今日账单</span>
      </div>

      <div className="flex gap-4 mb-2">
        <div className="flex items-center gap-1">
          <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
          <span className="text-sm text-white/60">支出</span>
          <span className="text-sm font-mono font-bold text-red-400">
            ¥{formatAmount(summary?.expenseTotal ?? 0)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpRight className="h-3.5 w-3.5 text-green-400" />
          <span className="text-sm text-white/60">收入</span>
          <span className="text-sm font-mono font-bold text-green-400">
            ¥{formatAmount(summary?.incomeTotal ?? 0)}
          </span>
        </div>
      </div>

      {summary && summary.recentItems.length > 0 && (
        <>
          <div className="border-t border-white/5 my-2" />
          <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {summary.recentItems.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!hasBillApi) return
                  setEditingBill(item)
                  setIsModalOpen(true)
                }}
                className="flex items-center gap-2 text-left hover:bg-white/[0.04] rounded-[4px] px-1 py-0.5 transition-colors"
              >
                <span className="text-[10px] text-white/30 w-10 flex-shrink-0 truncate">
                  {item.category}
                </span>
                <span className="text-xs text-white/50 flex-1 truncate">
                  {item.note || "无备注"}
                </span>
                <span className={`text-xs font-mono font-bold flex-shrink-0 ${item.billType === "expense" ? "text-red-400" : "text-green-400"}`}>
                  {item.billType === "expense" ? "-" : "+"}¥{formatAmount(item.amount)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={() => {
            setEditingBill(null)
            setIsModalOpen(true)
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border border-white/10 px-3 py-2 text-xs font-medium text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          添加记录
        </button>
      </div>

      {isModalOpen && (
        <BillEntryModal
          bill={editingBill}
          onClose={() => {
            setIsModalOpen(false)
            setEditingBill(null)
          }}
          onSave={editingBill ? handleEditSave : handleSave}
        />
      )}
    </div>
  )
}
