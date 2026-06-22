import type React from "react";
import { useEffect, useState } from "react";
import { Receipt, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  formatAmount,
  parseAmountToCents,
  type BillCategory,
  type BillType,
  BILL_CATEGORIES,
  BILL_TYPES,
} from "@/pages/bills/components/billShared";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";

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

/** 账单草稿 */
type BillDraft = {
  amount: string
  category: BillCategory
  billType: BillType
  billDate: string
  note: string
  tags: string[]
}

/**
 * TodayBillPanel - Today 页今日账单面板。
 * 包含今日账单收支统计、最新账单明细、右上角轻量气泡录入，以及列表项快捷气泡编辑。
 * 本组件已彻底重构，实现 100% 气泡录入与原地修改，不再依赖任何遮罩弹窗。
 */
export const TodayBillPanel = (): React.JSX.Element => {
  const hasBillApi = Boolean(window.api?.bill)
  const [summary, setSummary] = useState<TodaySummary | null>(null)

  // 新增记录的气泡草稿状态。
  const [draft, setDraft] = useState<BillDraft>({
    amount: "",
    category: "餐饮",
    billType: "expense",
    billDate: new Date().toISOString().slice(0, 10),
    note: "",
    tags: []
  })

  // 当前正在编辑的账单草稿状态。
  const [editDraft, setEditDraft] = useState<BillDraft>({
    amount: "",
    category: "餐饮",
    billType: "expense",
    billDate: new Date().toISOString().slice(0, 10),
    note: "",
    tags: []
  })

  const loadSummary = async (): Promise<void> => {
    if (!hasBillApi) return
    const result = await window.api.bill!.todaySummary()
    setSummary(result)
  }

  useEffect(() => {
    void loadSummary()
  }, [])

  const handleSave = async (billDraft: BillDraft): Promise<boolean> => {
    if (!hasBillApi) {
      const today = new Date().toISOString().slice(0, 10)
      setSummary((prev) => ({
        expenseTotal:
          (prev?.expenseTotal ?? 0) + (billDraft.billType === "expense" ? Number(billDraft.amount) : 0),
        incomeTotal:
          (prev?.incomeTotal ?? 0) + (billDraft.billType === "income" ? Number(billDraft.amount) : 0),
        recentItems: [
          {
            id: Date.now(),
            amount: Number(billDraft.amount),
            category: billDraft.category,
            billType: billDraft.billType,
            billDate: today,
            note: billDraft.note,
            tags: billDraft.tags
          },
          ...(prev?.recentItems ?? [])
        ].slice(0, 5)
      }))
      return true
    }
    try {
      await window.api.bill!.create({
        amount: Number(billDraft.amount),
        category: billDraft.category,
        billType: billDraft.billType,
        billDate: billDraft.billDate,
        note: billDraft.note,
        tags: billDraft.tags
      })
      await loadSummary()
      return true
    } catch {
      return false
    }
  }

  const handleEditSave = async (id: number, billDraft: BillDraft): Promise<boolean> => {
    if (!hasBillApi) {
      setSummary((prev) => {
        if (!prev) return prev
        const updatedItems = prev.recentItems.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              amount: Number(billDraft.amount),
              category: billDraft.category,
              billType: billDraft.billType,
              note: billDraft.note,
              tags: billDraft.tags
            }
          }
          return item
        })

        // 重新计算总额（分）
        const expenseTotal = updatedItems
          .filter((item) => item.billType === "expense")
          .reduce((sum, item) => sum + item.amount, 0)
        const incomeTotal = updatedItems
          .filter((item) => item.billType === "income")
          .reduce((sum, item) => sum + item.amount, 0)

        return {
          expenseTotal,
          incomeTotal,
          recentItems: updatedItems
        }
      })
      return true
    }
    try {
      await window.api.bill!.update(id, {
        amount: Number(billDraft.amount),
        category: billDraft.category,
        billType: billDraft.billType,
        billDate: billDraft.billDate,
        note: billDraft.note,
        tags: billDraft.tags
      })
      await loadSummary()
      return true
    } catch {
      return false
    }
  }

  const handleAddConfirm = async (): Promise<void> => {
    const parsedAmount = parseAmountToCents(draft.amount)
    if (parsedAmount <= 0) return

    const success = await handleSave({
      amount: String(parsedAmount),
      category: draft.category,
      billType: draft.billType,
      billDate: draft.billDate,
      note: draft.note,
      tags: draft.tags
    })

    if (success) {
      setDraft({
        amount: "",
        category: "餐饮",
        billType: "expense",
        billDate: new Date().toISOString().slice(0, 10),
        note: "",
        tags: []
      })
    }
  }

  const handleCancel = (): void => {
    setDraft({
      amount: "",
      category: "餐饮",
      billType: "expense",
      billDate: new Date().toISOString().slice(0, 10),
      note: "",
      tags: []
    })
  }

  const handleStartEdit = (item: any): void => {
    setEditDraft({
      amount: formatAmount(item.amount),
      category: item.category,
      billType: item.billType,
      billDate: item.billDate,
      note: item.note,
      tags: item.tags || []
    })
  }

  const handleEditConfirm = async (id: number): Promise<void> => {
    const parsedAmount = parseAmountToCents(editDraft.amount)
    if (parsedAmount <= 0) return

    await handleEditSave(id, {
      amount: String(parsedAmount),
      category: editDraft.category,
      billType: editDraft.billType,
      billDate: editDraft.billDate,
      note: editDraft.note,
      tags: editDraft.tags
    })
  }

  const renderAddForm = (): React.JSX.Element => {
    return (
      <div className="flex flex-col gap-3">
        {/* 收支类型选择 */}
        <div className="flex gap-1 bg-[#212121] p-0.5 rounded-[6px]">
          {BILL_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, billType: type.value }))}
              className={`flex-1 rounded-[4px] py-1 text-xs font-medium transition-colors ${
                draft.billType === type.value
                  ? "bg-[#303030] text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* 金额输入 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">金额</span>
          <div className="flex items-center rounded-[6px] border border-white/10 bg-[#212121] px-2.5 py-1 text-xs">
            <span className="text-white/40 mr-1 font-mono">¥</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={draft.amount}
              onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* 分类选择 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">分类</span>
          <div className="grid grid-cols-4 gap-1">
            {BILL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, category: cat }))}
                className={`rounded-[4px] border py-1 text-[10px] font-medium transition-colors text-center truncate ${
                  draft.category === cat
                    ? "border-white/20 bg-white text-black"
                    : "border-white/5 bg-[#212121] text-white/60 hover:bg-white/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 备注输入 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">备注</span>
          <input
            type="text"
            value={draft.note}
            onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="账单备注（可选）"
            className="w-full rounded-[6px] border border-white/10 bg-[#212121] px-2.5 py-1 text-xs text-white outline-none placeholder:text-white/20"
          />
        </div>

        {/* 标签输入 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">标签</span>
          <Input
            as="tags"
            tags={draft.tags}
            onChangeTags={(tags) => setDraft((prev) => ({ ...prev, tags }))}
            size="xs"
            placeholder="按回车确认标签"
          />
        </div>
      </div>
    );
  };

  const renderEditForm = (): React.JSX.Element => {
    return (
      <div className="flex flex-col gap-3">
        {/* 收支类型选择 */}
        <div className="flex gap-1 bg-[#212121] p-0.5 rounded-[6px]">
          {BILL_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setEditDraft((prev) => ({ ...prev, billType: type.value }))}
              className={`flex-1 rounded-[4px] py-1 text-xs font-medium transition-colors ${
                editDraft.billType === type.value
                  ? "bg-[#303030] text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* 金额输入 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">金额</span>
          <div className="flex items-center rounded-[6px] border border-white/10 bg-[#212121] px-2.5 py-1 text-xs">
            <span className="text-white/40 mr-1 font-mono">¥</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={editDraft.amount}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* 分类选择 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">分类</span>
          <div className="grid grid-cols-4 gap-1">
            {BILL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setEditDraft((prev) => ({ ...prev, category: cat }))}
                className={`rounded-[4px] border py-1 text-[10px] font-medium transition-colors text-center truncate ${
                  editDraft.category === cat
                    ? "border-white/20 bg-white text-black"
                    : "border-white/5 bg-[#212121] text-white/60 hover:bg-white/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 备注输入 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">备注</span>
          <input
            type="text"
            value={editDraft.note}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="账单备注（可选）"
            className="w-full rounded-[6px] border border-white/10 bg-[#212121] px-2.5 py-1 text-xs text-white outline-none placeholder:text-white/20"
          />
        </div>

        {/* 标签输入 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">标签</span>
          <Input
            as="tags"
            tags={editDraft.tags}
            onChangeTags={(tags) => setEditDraft((prev) => ({ ...prev, tags }))}
            size="xs"
            placeholder="按回车确认标签"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col h-full">
      {/* 头部栏 */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">今日账单</span>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip
            placement="bottom"
            trigger="click"
            contentClassName="!w-[280px] !p-3.5 !whitespace-normal flex flex-col"
            onConfirm={handleAddConfirm}
            onCancel={handleCancel}
            form={renderAddForm()}
          >
            <IconButton aria-label="Add bill entry" preset="add" title="添加账单" />
          </Tooltip>
        </div>
      </div>

      {/* 收支摘要 */}
      <div className="flex gap-4 mb-2">
        <div className="flex items-center gap-1">
          <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
          <span className="text-xs text-white/60">支出</span>
          <span className="text-xs font-mono font-bold text-red-400">
            ¥{formatAmount(summary?.expenseTotal ?? 0)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpRight className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs text-white/60">收入</span>
          <span className="text-xs font-mono font-bold text-green-400">
            ¥{formatAmount(summary?.incomeTotal ?? 0)}
          </span>
        </div>
      </div>

      {/* 账单历史列表 */}
      {summary && summary.recentItems.length > 0 && (
        <>
          <div className="border-t border-white/5 my-2" />
          <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {summary.recentItems.slice(0, 5).map((item) => (
              <Tooltip
                key={item.id}
                placement="top"
                trigger="click"
                contentClassName="!w-[280px] !p-3.5 !whitespace-normal flex flex-col"
                onConfirm={() => handleEditConfirm(item.id)}
                form={renderEditForm()}
              >
                <button
                  type="button"
                  onClick={() => handleStartEdit(item)}
                  className="flex w-full items-center gap-2 text-left hover:bg-white/[0.04] rounded-[4px] px-1 py-0.5 transition-colors"
                >
                  <span className="text-[10px] text-white/30 w-10 flex-shrink-0 truncate">
                    {item.category}
                  </span>
                  <span className="text-xs text-white/50 flex-1 truncate">
                    {item.note || "无备注"}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold flex-shrink-0 ${
                      item.billType === "expense" ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {item.billType === "expense" ? "-" : "+"}¥{formatAmount(item.amount)}
                  </span>
                </button>
              </Tooltip>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
