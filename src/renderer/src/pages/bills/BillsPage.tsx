import type React from "react";
import { useEffect, useState } from "react";
import { Receipt, Tag as TagIcon, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  BILL_CATEGORIES,
  BILL_TYPES,
  formatAmount,
  parseAmountToCents,
  type BillCategory,
  type BillType,
} from "./components/billShared";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { DatePicker } from "@/components/ui/DatePicker";
import { DatePickerButton } from "@/components/ui/DatePickerButton";

/** 本地账单项类型 */
type BillItem = {
  id: number;
  amount: number;
  category: BillCategory;
  billType: BillType;
  billDate: string;
  note: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

/** 默认月度统计 */
type MonthStats = {
  expenseTotal: number;
  incomeTotal: number;
};

/** 账单草稿 */
type BillDraft = {
  amount: string;
  category: BillCategory;
  billType: BillType;
  billDate: string;
  note: string;
  tags: string[];
};

/**
 * BillsPage - 账单列表主页面。
 * 调整为双栏网格布局，右侧分类与标签快速查询，列表项完全支持 Tooltip 原地添加与编辑修改。
 */
export const BillsPage = (): React.JSX.Element => {
  const hasBillApi = Boolean(window.api?.bill);
  const toast = useToast();

  const [bills, setBills] = useState<BillItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选器状态
  const [typeFilter, setTypeFilter] = useState<BillType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<BillCategory | "all">(
    "all",
  );
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // 新增记录的气泡草稿状态
  const [draft, setDraft] = useState<BillDraft>({
    amount: "",
    category: "餐饮",
    billType: "expense",
    billDate: new Date().toISOString().slice(0, 10),
    note: "",
    tags: [],
  });

  // 当前正在编辑的账单草稿状态
  const [editDraft, setEditDraft] = useState<BillDraft>({
    amount: "",
    category: "餐饮",
    billType: "expense",
    billDate: new Date().toISOString().slice(0, 10),
    note: "",
    tags: [],
  });

  const loadBills = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      if (!hasBillApi) {
        setBills([]);
        return;
      }
      const filters: { billType?: BillType; category?: BillCategory } = {};
      if (typeFilter !== "all") filters.billType = typeFilter;
      if (categoryFilter !== "all") filters.category = categoryFilter;
      const result = await window.api.bill!.list(filters);
      setBills(result);
    } catch {
      setError("读取账单失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBills();
  }, [typeFilter, categoryFilter]);

  // 切换分类或类型过滤时清空标签过滤，避免空过滤死胡同
  useEffect(() => {
    setActiveTag(null);
  }, [typeFilter, categoryFilter]);

  // 提取当前筛选条件下的所有唯一标签
  const allTags = Array.from(new Set(bills.flatMap((b) => b.tags || [])));

  // 客户端二次筛选标签，获取最终在页面展示的账单列表
  const visibleBills = bills.filter(
    (bill) => !activeTag || bill.tags.includes(activeTag),
  );

  // 根据当前可视列表统计数据
  const monthStats: MonthStats = visibleBills.reduce(
    (acc, b) => ({
      expenseTotal:
        acc.expenseTotal + (b.billType === "expense" ? b.amount : 0),
      incomeTotal: acc.incomeTotal + (b.billType === "income" ? b.amount : 0),
    }),
    { expenseTotal: 0, incomeTotal: 0 },
  );

  const handleCreate = async (billDraft: BillDraft): Promise<boolean> => {
    if (!hasBillApi) return false;
    try {
      await window.api.bill!.create({
        amount: Number(billDraft.amount),
        category: billDraft.category,
        billType: billDraft.billType,
        billDate: billDraft.billDate,
        note: billDraft.note,
        tags: billDraft.tags,
      });
      await loadBills();
      return true;
    } catch {
      toast.error("创建账单失败");
      return false;
    }
  };

  const handleUpdate = async (
    id: number,
    billDraft: BillDraft,
  ): Promise<boolean> => {
    if (!hasBillApi) return false;
    try {
      await window.api.bill!.update(id, {
        amount: Number(billDraft.amount),
        category: billDraft.category,
        billType: billDraft.billType,
        billDate: billDraft.billDate,
        note: billDraft.note,
        tags: billDraft.tags,
      });
      await loadBills();
      return true;
    } catch {
      toast.error("更新账单失败");
      return false;
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!hasBillApi) return;
    try {
      await window.api.bill!.delete(id);
      await loadBills();
    } catch {
      toast.error("删除账单失败");
    }
  };

  const handleAddConfirm = async (): Promise<void> => {
    const parsedAmount = parseAmountToCents(draft.amount);
    if (parsedAmount <= 0) {
      toast.error("请输入有效金额");
      return;
    }

    const success = await handleCreate({
      amount: String(parsedAmount),
      category: draft.category,
      billType: draft.billType,
      billDate: draft.billDate,
      note: draft.note,
      tags: draft.tags,
    });

    if (success) {
      setDraft({
        amount: "",
        category: "餐饮",
        billType: "expense",
        billDate: new Date().toISOString().slice(0, 10),
        note: "",
        tags: [],
      });
    }
  };

  const handleAddCancel = (): void => {
    setDraft({
      amount: "",
      category: "餐饮",
      billType: "expense",
      billDate: new Date().toISOString().slice(0, 10),
      note: "",
      tags: [],
    });
  };

  const handleStartEdit = (item: BillItem): void => {
    setEditDraft({
      amount: formatAmount(item.amount),
      category: item.category,
      billType: item.billType,
      billDate: item.billDate,
      note: item.note,
      tags: item.tags || [],
    });
  };

  const handleEditConfirm = async (id: number): Promise<void> => {
    const parsedAmount = parseAmountToCents(editDraft.amount);
    if (parsedAmount <= 0) {
      toast.error("请输入有效金额");
      return;
    }

    await handleUpdate(id, {
      amount: String(parsedAmount),
      category: editDraft.category,
      billType: editDraft.billType,
      billDate: editDraft.billDate,
      note: editDraft.note,
      tags: editDraft.tags,
    });
  };

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
                  setDraft((prev) => ({ ...prev, billType: type.value }))
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
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">金额</span>
          <div className="flex items-center rounded-[6px] border border-white/10 bg-[#212121] px-2.5 h-[28px] text-xs">
            <span className="text-white/40 mr-1 font-mono">¥</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={draft.amount}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="0.00"
              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* 日期选择 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">日期</span>
          <DatePicker
            value={draft.billDate}
            onChange={(date) =>
              setDraft((prev) => ({ ...prev, billDate: date }))
            }
          >
            <DatePickerButton value={draft.billDate} className="w-full" />
          </DatePicker>
        </div>

        {/* 备注输入 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">备注</span>
          <input
            type="text"
            value={draft.note}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, note: e.target.value }))
            }
            placeholder="备注说明（可选）"
            className="w-full rounded-[6px] border border-white/10 bg-[#212121] px-2.5 h-[28px] text-xs text-white outline-none placeholder:text-white/20"
          />
        </div>

        {/* 分类选择 - 单行并排 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">分类</span>
          <div className="grid grid-cols-8 gap-1.5">
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

        {/* 标签输入 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
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
                  setEditDraft((prev) => ({ ...prev, billType: type.value }))
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
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">金额</span>
          <div className="flex items-center rounded-[6px] border border-white/10 bg-[#212121] px-2.5 h-[28px] text-xs">
            <span className="text-white/40 mr-1 font-mono">¥</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={editDraft.amount}
              onChange={(e) =>
                setEditDraft((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="0.00"
              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* 日期选择 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">日期</span>
          <DatePicker
            value={editDraft.billDate}
            onChange={(date) =>
              setEditDraft((prev) => ({ ...prev, billDate: date }))
            }
          >
            <DatePickerButton value={editDraft.billDate} className="w-full" />
          </DatePicker>
        </div>

        {/* 备注输入 */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[11px] font-semibold text-white/40">备注</span>
          <input
            type="text"
            value={editDraft.note}
            onChange={(e) =>
              setEditDraft((prev) => ({ ...prev, note: e.target.value }))
            }
            placeholder="备注说明（可选）"
            className="w-full rounded-[6px] border border-white/10 bg-[#212121] px-2.5 h-[28px] text-xs text-white outline-none placeholder:text-white/20"
          />
        </div>

        {/* 分类选择 - 单行并排 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">分类</span>
          <div className="grid grid-cols-8 gap-1.5">
            {BILL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  setEditDraft((prev) => ({ ...prev, category: cat }))
                }
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

        {/* 标签输入 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
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
    <section className="flex h-full min-h-0 flex-col gap-3 text-white">
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 左侧主账单展示区 */}
        <div className="min-h-0 flex-1 flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              {/* 账单列表标题与数量 */}
              <div className="flex items-center gap-2 mr-1">
                <span className="text-sm font-bold text-white/80">
                  账单列表
                </span>
                <span className="text-[11px] text-white/30">
                  ({visibleBills.length})
                </span>
              </div>

              {/* 分割线 */}
              <div className="h-3 w-px bg-white/10" />

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
                全部收支
              </button>

              {activeTag && (
                <div className="flex items-center gap-1 rounded-[6px] border border-white/5 bg-white/5 px-2 py-1 text-xs text-white/60">
                  <TagIcon className="h-2.5 w-2.5" />
                  <span>{activeTag}</span>
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className="ml-1 text-white/40 hover:text-white"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
            </div>

            <Tooltip
              placement="bottom"
              trigger="click"
              contentClassName="!w-[420px] !p-4 !whitespace-normal flex flex-col"
              onConfirm={handleAddConfirm}
              onCancel={handleAddCancel}
              form={renderAddForm()}
            >
              <IconButton preset="add" aria-label="添加账单" title="添加账单" />
            </Tooltip>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex-shrink-0">{error}</p>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5 flex flex-col gap-2">
            {isLoading ? (
              <p className="text-xs text-white/30 py-8 text-center">
                加载中...
              </p>
            ) : visibleBills.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 text-white/30">
                <Receipt className="h-8 w-8" />
                <p className="text-xs">暂无匹配账单记录</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 mb-1">
                {visibleBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between border-b border-white/[0.03] hover:bg-white/[0.02] rounded-[4px] pr-2 group/item"
                  >
                    <div className="flex w-full items-center gap-3 py-2 px-2 text-left">
                      {/* 日期 */}
                      <span className="text-xs text-white/40 font-mono w-20 flex-shrink-0">
                        {bill.billDate}
                      </span>

                      {/* 分类 */}
                      <span className="rounded-[4px] border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70 flex-shrink-0">
                        {bill.category}
                      </span>

                      {/* 备注 */}
                      <span className="text-xs text-white/50 flex-1 truncate">
                        {bill.note || "-"}
                      </span>

                      {/* 标签列表 */}
                      <div className="flex flex-wrap gap-1 max-w-[120px] overflow-hidden flex-shrink-0">
                        {bill.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-[4px] bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40"
                          >
                            {tag}
                          </span>
                        ))}
                        {bill.tags.length > 2 && (
                          <span className="text-[10px] text-white/30">
                            +{bill.tags.length - 2}
                          </span>
                        )}
                      </div>

                      {/* 金额 */}
                      <span
                        className={`text-xs font-mono font-bold w-20 text-right flex-shrink-0 ${
                          bill.billType === "expense"
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {bill.billType === "expense" ? "-" : "+"}¥
                        {formatAmount(bill.amount)}
                      </span>
                    </div>

                    {/* 操作区域 */}
                    <div className="flex items-center w-0 opacity-0 overflow-hidden group-hover/item:w-[54px] group-hover/item:opacity-100 group-hover/item:ml-1.5 transition-all duration-300 ease-in-out">
                      <div className="flex items-center gap-1.5 w-[54px] flex-shrink-0">
                        <Tooltip
                          placement="top"
                          trigger="click"
                          contentClassName="!w-[420px] !p-4 !whitespace-normal flex flex-col"
                          onConfirm={() => handleEditConfirm(bill.id)}
                          form={renderEditForm()}
                        >
                          <IconButton
                            aria-label={`Edit bill ${bill.note || bill.category}`}
                            preset="edit"
                            onClick={() => handleStartEdit(bill)}
                          />
                        </Tooltip>

                        <Tooltip
                          placement="top"
                          title="确认删除该账单吗？"
                          onConfirm={() => handleDelete(bill.id)}
                          variant="danger"
                        >
                          <IconButton
                            aria-label={`Delete bill ${bill.note || bill.category}`}
                            preset="delete"
                          />
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 底部统计栏 */}
          <div className="flex items-center justify-end gap-6 border-t border-white/5 pt-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">所选支出</span>
              <span className="text-sm font-mono font-bold text-red-400">
                ¥{formatAmount(monthStats.expenseTotal)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">所选收入</span>
              <span className="text-sm font-mono font-bold text-green-400">
                ¥{formatAmount(monthStats.incomeTotal)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">净收支</span>
              <span
                className={`text-sm font-mono font-bold ${monthStats.incomeTotal - monthStats.expenseTotal >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {monthStats.incomeTotal - monthStats.expenseTotal >= 0
                  ? "+"
                  : ""}
                ¥
                {formatAmount(monthStats.incomeTotal - monthStats.expenseTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* 右侧：分类与标签 */}
        <aside className="flex min-h-0 w-full lg:w-[300px] flex-col gap-4 rounded-[6px] border border-white/6 bg-[#212121] p-4 flex-shrink-0">
          {/* 分类筛选 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-bold text-white/80">分类筛选</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Tag
                highlighted={categoryFilter === "all"}
                onClick={() => setCategoryFilter("all")}
                className="font-medium cursor-pointer"
              >
                全部分类
              </Tag>
              {BILL_CATEGORIES.map((cat) => (
                <Tag
                  key={cat}
                  highlighted={categoryFilter === cat}
                  onClick={() => setCategoryFilter(cat)}
                  className="font-medium cursor-pointer"
                >
                  {cat}
                </Tag>
              ))}
            </div>
          </div>

          {/* 标签筛选 */}
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-bold text-white/80">标签筛选</span>
            </div>
            <div className="flex flex-wrap gap-1.5 overflow-y-auto custom-scrollbar max-h-[300px] pr-0.5">
              {allTags.length === 0 ? (
                <span className="text-xs text-white/30 py-4 text-center w-full">
                  暂无标签
                </span>
              ) : (
                allTags.map((tag) => (
                  <Tag
                    key={tag}
                    size="small"
                    highlighted={activeTag === tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    className="font-medium cursor-pointer"
                    prefix="#"
                  >
                    {tag}
                  </Tag>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};
