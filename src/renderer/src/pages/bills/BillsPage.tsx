import type React from "react";
import { useEffect, useState } from "react";
import { Plus, Trash2, Receipt } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { BILL_CATEGORIES, BILL_TYPES, formatAmount, type BillCategory, type BillType } from "./components/billShared";
import { BillEntryModal, type BillDraft, type BillEntryData } from "./components/BillEntryModal";

/** 本地账单项类型 */
type BillItem = {
  id: number
  amount: number
  category: BillCategory
  billType: BillType
  billDate: string
  note: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

/** 默认月度统计 */
type MonthStats = {
  expenseTotal: number
  incomeTotal: number
}

/**
 * BillsPage - 账单列表主页面。
 */
export const BillsPage = (): React.JSX.Element => {
  const hasBillApi = Boolean(window.api?.bill)
  const toast = useToast()

  const [bills, setBills] = useState<BillItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<BillEntryData | null>(null)
  const [typeFilter, setTypeFilter] = useState<BillType | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<BillCategory | "all">("all")
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const loadBills = async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      if (!hasBillApi) {
        setBills([])
        return
      }
      const filters: { billType?: BillType; category?: BillCategory } = {}
      if (typeFilter !== "all") filters.billType = typeFilter
      if (categoryFilter !== "all") filters.category = categoryFilter
      const result = await window.api.bill!.list(filters)
      setBills(result)
    } catch {
      setError("读取账单失败")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadBills()
  }, [typeFilter, categoryFilter])

  const monthStats: MonthStats = bills.reduce(
    (acc, b) => ({
      expenseTotal: acc.expenseTotal + (b.billType === "expense" ? b.amount : 0),
      incomeTotal: acc.incomeTotal + (b.billType === "income" ? b.amount : 0)
    }),
    { expenseTotal: 0, incomeTotal: 0 }
  )

  const handleCreate = async (draft: BillDraft): Promise<boolean> => {
    if (!hasBillApi) return false
    try {
      await window.api.bill!.create({
        amount: Number(draft.amount),
        category: draft.category,
        billType: draft.billType,
        billDate: draft.billDate,
        note: draft.note,
        tags: draft.tags
      })
      await loadBills()
      return true
    } catch {
      toast.error("创建账单失败")
      return false
    }
  }

  const handleUpdate = async (draft: BillDraft): Promise<boolean> => {
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
      await loadBills()
      return true
    } catch {
      toast.error("更新账单失败")
      return false
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    if (!hasBillApi) return
    try {
      await window.api.bill!.delete(id)
      await loadBills()
      setDeleteConfirmId(null)
    } catch {
      toast.error("删除账单失败")
    }
  }

  return (
    <section className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto custom-scrollbar px-1 lg:px-2 [scrollbar-gutter:stable]">
      <div className="flex items-center gap-3">
        {BILL_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => setTypeFilter(type.value as BillType)}
            className={`rounded-[6px] border px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === type.value
                ? "border-white/20 bg-white text-black"
                : "border-white/10 bg-[#212121] text-white/60 hover:bg-white/5"
            }`}
          >
            {type.label}
          </button>
        ))}
        <button
          onClick={() => setTypeFilter("all")}
          className={`rounded-[6px] border px-3 py-1.5 text-xs font-medium transition-colors ${
            typeFilter === "all"
              ? "border-white/20 bg-white text-black"
              : "border-white/10 bg-[#212121] text-white/60 hover:bg-white/5"
          }`}
        >
          全部
        </button>

        <div className="flex-1" />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as BillCategory | "all")}
          className="rounded-[6px] border border-white/10 bg-[#212121] px-3 py-1.5 text-xs text-white/60 outline-none"
        >
          <option value="all">全部分类</option>
          {BILL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setEditingBill(null)
            setIsModalOpen(true)
          }}
          className="flex items-center gap-1.5 rounded-[6px] bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-white/90"
        >
          <Plus className="h-3.5 w-3.5" />
          添加账单
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <p className="text-xs text-white/30 py-8 text-center">加载中...</p>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/30">
            <Receipt className="h-8 w-8" />
            <p className="text-xs">暂无账单记录</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/5">
                <th className="text-left py-2 px-2 font-normal">日期</th>
                <th className="text-left py-2 px-2 font-normal">分类</th>
                <th className="text-right py-2 px-2 font-normal">金额</th>
                <th className="text-left py-2 px-2 font-normal">备注</th>
                <th className="text-left py-2 px-2 font-normal">标签</th>
                <th className="text-right py-2 px-2 font-normal">操作</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr
                  key={bill.id}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => {
                    setEditingBill({
                      id: bill.id,
                      amount: bill.amount,
                      category: bill.category,
                      billType: bill.billType,
                      billDate: bill.billDate,
                      note: bill.note,
                      tags: bill.tags
                    })
                    setIsModalOpen(true)
                  }}
                >
                  <td className="py-2 px-2 text-xs text-white/50">{bill.billDate}</td>
                  <td className="py-2 px-2">
                    <span className="rounded-[4px] border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">
                      {bill.category}
                    </span>
                  </td>
                  <td className={`py-2 px-2 text-right font-mono text-xs font-bold ${bill.billType === "expense" ? "text-red-400" : "text-green-400"}`}>
                    {bill.billType === "expense" ? "-" : "+"}¥{formatAmount(bill.amount)}
                  </td>
                  <td className="py-2 px-2 text-xs text-white/50 max-w-[200px] truncate">{bill.note || "-"}</td>
                  <td className="py-2 px-2">
                    <div className="flex flex-wrap gap-1">
                      {bill.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-[4px] bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
                          {tag}
                        </span>
                      ))}
                      {bill.tags.length > 2 && (
                        <span className="text-[10px] text-white/30">+{bill.tags.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                    {deleteConfirmId === bill.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-[10px] text-white/40 hover:text-white/70"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => handleDelete(bill.id)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          确认
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(bill.id)}
                        className="p-1 hover:bg-white/5 rounded-[4px]"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-white/30 hover:text-red-400" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-end gap-6 border-t border-white/5 pt-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">本月支出</span>
          <span className="text-sm font-mono font-bold text-red-400">¥{formatAmount(monthStats.expenseTotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">本月收入</span>
          <span className="text-sm font-mono font-bold text-green-400">¥{formatAmount(monthStats.incomeTotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">净收支</span>
          <span className={`text-sm font-mono font-bold ${monthStats.incomeTotal - monthStats.expenseTotal >= 0 ? "text-green-400" : "text-red-400"}`}>
            {monthStats.incomeTotal - monthStats.expenseTotal >= 0 ? "+" : ""}¥{formatAmount(monthStats.incomeTotal - monthStats.expenseTotal)}
          </span>
        </div>
      </div>

      {isModalOpen && (
        <BillEntryModal
          bill={editingBill}
          onClose={() => {
            setIsModalOpen(false)
            setEditingBill(null)
          }}
          onSave={editingBill ? handleUpdate : handleCreate}
        />
      )}
    </section>
  )
}
