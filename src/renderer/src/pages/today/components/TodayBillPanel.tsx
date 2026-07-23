import { ArrowDownRight, ArrowUpRight, Receipt } from "lucide-react"
import type React from "react"
import { useEffect, useState } from "react"
import { AmountInput } from "@/components/ui/AmountInput"
import { IconButton } from "@/components/ui/IconButton"
import { Input } from "@/components/ui/Input"
import { Tooltip } from "@/components/ui/Tooltip"
import {
  BILL_TYPES,
  type BillCategory,
  type BillType,
  EXPENSE_CATEGORIES,
  formatAmount,
  INCOME_CATEGORIES,
  parseAmountToCents,
} from "@/pages/bills/components/billShared"

/** 今日账单摘要（来自 preload todaySummary） */
export type TodaySummary = {
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

export interface TodayBillPanelProps {
  summary: TodaySummary | null
  entryDate: string
  onRefresh: () => void
  setSummary: React.Dispatch<React.SetStateAction<TodaySummary | null>>
}

/**
 * TodayBillPanel - Today 页今日账单面板。
 * 包含今日账单收支统计、最新账单明细、右上角轻量气泡录入，以及列表项快捷气泡编辑。
 * 本组件已彻底重构，实现 100% 气泡录入与原地修改，不再依赖任何遮罩弹窗。
 */
export const TodayBillPanel = ({
  summary,
  entryDate,
  onRefresh,
  setSummary,
}: TodayBillPanelProps): React.JSX.Element => {
  const hasBillApi = Boolean(window.api?.bill)

  // 新增记录的气泡草稿状态。
  const [draft, setDraft] = useState<BillDraft>({
    amount: "",
    category: "餐饮",
    billType: "expense",
    billDate: entryDate,
    note: "",
    tags: [],
  })

  // 当前正在编辑的账单草稿状态。
  const [editDraft, setEditDraft] = useState<BillDraft>({
    amount: "",
    category: "餐饮",
    billType: "expense",
    billDate: entryDate,
    note: "",
    tags: [],
  })

  // entryDate 切换时同步 draft 默认日期（表单未填写时）。
  useEffect(() => {
    setDraft((prev) => (prev.amount === "" ? { ...prev, billDate: entryDate } : prev))
  }, [entryDate])

  const handleSave = async (billDraft: BillDraft): Promise<boolean> => {
    if (!hasBillApi) {
      const today = new Date().toISOString().slice(0, 10)
      setSummary((prev) => ({
        expenseTotal:
          (prev?.expenseTotal ?? 0) +
          (billDraft.billType === "expense" ? Number(billDraft.amount) : 0),
        incomeTotal:
          (prev?.incomeTotal ?? 0) +
          (billDraft.billType === "income" ? Number(billDraft.amount) : 0),
        recentItems: [
          {
            id: Date.now(),
            amount: Number(billDraft.amount),
            category: billDraft.category,
            billType: billDraft.billType,
            billDate: today,
            note: billDraft.note,
            tags: billDraft.tags,
          },
          ...(prev?.recentItems ?? []),
        ],
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
        tags: billDraft.tags,
      })
      await onRefresh()
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
              tags: billDraft.tags,
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
          recentItems: updatedItems,
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
        tags: billDraft.tags,
      })
      await onRefresh()
      return true
    } catch {
      return false
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    if (!hasBillApi) {
      setSummary((prev) => {
        if (!prev) return prev
        const updatedItems = prev.recentItems.filter((item) => item.id !== id)
        const expenseTotal = updatedItems
          .filter((item) => item.billType === "expense")
          .reduce((sum, item) => sum + item.amount, 0)
        const incomeTotal = updatedItems
          .filter((item) => item.billType === "income")
          .reduce((sum, item) => sum + item.amount, 0)

        return {
          expenseTotal,
          incomeTotal,
          recentItems: updatedItems,
        }
      })
      return
    }

    try {
      await window.api.bill!.delete(id)
      await onRefresh()
    } catch (e) {
      console.error(e)
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
      tags: draft.tags,
    })

    if (success) {
      setDraft({
        amount: "",
        category: "餐饮",
        billType: "expense",
        billDate: entryDate,
        note: "",
        tags: [],
      })
    }
  }

  const handleCancel = (): void => {
    setDraft({
      amount: "",
      category: "餐饮",
      billType: "expense",
      billDate: entryDate,
      note: "",
      tags: [],
    })
  }

  const handleStartEdit = (item: any): void => {
    setEditDraft({
      amount: formatAmount(item.amount),
      category: item.category,
      billType: item.billType,
      billDate: item.billDate,
      note: item.note,
      tags: item.tags || [],
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
      tags: editDraft.tags,
    })
  }

  const renderAddForm = (): React.JSX.Element => {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {/* 类型选择 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">类型</span>
          <div className="flex gap-1 bg-[#212121] p-0.5 rounded-[6px] h-[28px] items-center">
            {BILL_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    billType: type.value,
                    category: type.value === "expense" ? "餐饮" : "工资",
                  }))
                }
                className={`flex-1 rounded-[4px] py-0.5 text-xs font-medium transition-colors ${
                  draft.billType === type.value
                    ? "bg-[#303030] text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* 金额输入 */}
        <AmountInput
          label="金额"
          value={draft.amount}
          onChange={(val) => setDraft((prev) => ({ ...prev, amount: val }))}
        />

        {/* 备注输入 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">备注</span>
          <Input
            type="text"
            value={draft.note}
            onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="备注说明（可选）"
            size="xs"
            className="!h-[28px]"
          />
        </div>

        {/* 分类选择 - 单行并排 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">分类</span>
          <div className="grid grid-cols-8 gap-1.5">
            {(draft.billType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat) => (
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

        {/* 标签输入 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">标签</span>
          <Input
            as="tags"
            tags={draft.tags}
            maxTags={3}
            onChangeTags={(tags) => setDraft((prev) => ({ ...prev, tags }))}
            size="xs"
            placeholder="按回车确认标签"
          />
        </div>
      </div>
    )
  }

  const renderEditForm = (): React.JSX.Element => {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {/* 类型选择 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">类型</span>
          <div className="flex gap-1 bg-[#212121] p-0.5 rounded-[6px] h-[28px] items-center">
            {BILL_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() =>
                  setEditDraft((prev) => ({
                    ...prev,
                    billType: type.value,
                    category: type.value === "expense" ? "餐饮" : "工资",
                  }))
                }
                className={`flex-1 rounded-[4px] py-0.5 text-xs font-medium transition-colors ${
                  editDraft.billType === type.value
                    ? "bg-[#303030] text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* 金额输入 */}
        <AmountInput
          label="金额"
          value={editDraft.amount}
          onChange={(val) => setEditDraft((prev) => ({ ...prev, amount: val }))}
        />

        {/* 备注输入 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">备注</span>
          <Input
            type="text"
            value={editDraft.note}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="备注说明（可选）"
            size="xs"
            className="!h-[28px]"
          />
        </div>

        {/* 分类选择 - 单行并排 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">分类</span>
          <div className="grid grid-cols-8 gap-1.5">
            {(editDraft.billType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(
              (cat) => (
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
              ),
            )}
          </div>
        </div>

        {/* 标签输入 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">标签</span>
          <Input
            as="tags"
            tags={editDraft.tags}
            maxTags={3}
            onChangeTags={(tags) => setEditDraft((prev) => ({ ...prev, tags }))}
            size="xs"
            placeholder="按回车确认标签"
          />
        </div>
      </div>
    )
  }

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
            contentClassName="!w-[420px] !p-4 !whitespace-normal flex flex-col"
            onConfirm={handleAddConfirm}
            onCancel={handleCancel}
            form={renderAddForm()}
          >
            <IconButton aria-label="Add bill entry" preset="add" title="添加账单" />
          </Tooltip>
        </div>
      </div>

      {/* 收支摘要 */}
      <div className="flex gap-4">
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
      {summary && summary.recentItems.length > 0 ? (
        <>
          <div className="border-t border-white/5 my-2" />
          <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {summary.recentItems.map((item) => (
              <div
                key={item.id}
                className="group/item flex w-full items-center gap-2 hover:bg-white/[0.04] rounded-[4px] px-1 py-0.5 transition-colors"
              >
                <div className="flex items-center gap-2 text-left min-w-0 flex-1">
                  <div className="w-12 flex-shrink-0">
                    <span className="text-sm text-white/30 truncate block w-full">
                      {item.category}
                    </span>
                  </div>

                  <div className="flex items-center flex-1 min-w-0 gap-6">
                    <span className="text-sm text-white/50 truncate max-w-[140px]">
                      {item.note || "无备注"}
                    </span>

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-[4px] bg-white/[0.03] px-1 py-[1px] text-[10px] text-white/40 border border-white/[0.02] truncate max-w-[40px]"
                            title={tag}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-auto flex items-center flex-shrink-0">
                  <span
                    className={`text-xs font-mono font-bold ${
                      item.billType === "expense" ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {item.billType === "expense" ? "-" : "+"}¥{formatAmount(item.amount)}
                  </span>

                  <div className="flex items-center w-0 opacity-0 overflow-hidden group-hover/item:w-[54px] group-hover/item:opacity-100 group-hover/item:ml-1.5 transition-all duration-300 ease-in-out">
                    <div className="flex items-center gap-1.5 w-[54px] flex-shrink-0">
                      <Tooltip
                        placement="top"
                        trigger="click"
                        contentClassName="!w-[420px] !p-4 !whitespace-normal flex flex-col"
                        onConfirm={() => handleEditConfirm(item.id)}
                        form={renderEditForm()}
                      >
                        <IconButton
                          aria-label={`Edit bill ${item.note || item.category}`}
                          preset="edit"
                          onClick={() => handleStartEdit(item)}
                        />
                      </Tooltip>

                      <Tooltip
                        placement="top"
                        title="确认删除该账单吗？"
                        onConfirm={() => handleDelete(item.id)}
                        variant="danger"
                      >
                        <IconButton
                          aria-label={`Delete bill ${item.note || item.category}`}
                          preset="delete"
                        />
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <Receipt className="h-7 w-7 text-white/30" />
          <h2 className="mt-3 text-sm font-bold text-white/80">暂无今日账单</h2>
          <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-white/40">
            今日还没有账单，点击右上角加号，记录第一笔收支。
          </p>
        </div>
      )}
    </div>
  )
}
