import type React from "react";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  BILL_TYPES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  formatAmount,
  parseAmountToCents,
  type BillCategory,
  type BillType,
} from "./components/billShared";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";
import { AmountInput } from "@/components/ui/AmountInput";
import { IconButton } from "@/components/ui/IconButton";
import { DatePicker } from "@/components/ui/DatePicker";
import { DatePickerButton } from "@/components/ui/DatePickerButton";
import { getMonday } from "@/lib/dailyShared";

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
  const [categoryGroup, setCategoryGroup] = useState<"expense" | "income">(
    "expense",
  );
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [timeFilterMode, setTimeFilterMode] = useState<
    "all" | "date" | "week" | "month"
  >("all");
  const [selectedTime, setSelectedTime] = useState<string>("");

  // 当全局类型筛选变化时，同步分类的 Tab
  useEffect(() => {
    if (typeFilter === "expense" || typeFilter === "income") {
      setCategoryGroup(typeFilter);
    }
  }, [typeFilter]);

  // 当切换大分类时，重置子分类选择以避免无匹配数据
  useEffect(() => {
    setCategoryFilter("all");
  }, [categoryGroup]);

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

  // 重置所有筛选条件
  const handleResetFilters = (): void => {
    setTypeFilter("all");
    setCategoryFilter("all");
    setCategoryGroup("expense");
    setActiveTag(null);
    setTimeFilterMode("all");
    setSelectedTime("");
  };

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

  // 客户端二次筛选标签及时间，获取最终在页面展示的账单列表
  const visibleBills = bills.filter((bill) => {
    // 标签过滤
    if (activeTag && !bill.tags.includes(activeTag)) {
      return false;
    }

    // 时间区间/日期过滤
    if (timeFilterMode === "date" && selectedTime) {
      return bill.billDate === selectedTime;
    }
    if (timeFilterMode === "week" && selectedTime) {
      return getMonday(bill.billDate) === getMonday(selectedTime);
    }
    if (timeFilterMode === "month" && selectedTime) {
      return bill.billDate.startsWith(selectedTime);
    }

    return true;
  });

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
          <Input
            type="text"
            value={draft.note}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, note: e.target.value }))
            }
            placeholder="备注说明（可选）"
            size="xs"
            className="!h-[28px]"
          />
        </div>

        {/* 分类选择 - 单行并排 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">分类</span>
          <div className="grid grid-cols-8 gap-1.5">
            {(draft.billType === "expense"
              ? EXPENSE_CATEGORIES
              : INCOME_CATEGORIES
            ).map((cat) => (
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
          <Input
            type="text"
            value={editDraft.note}
            onChange={(e) =>
              setEditDraft((prev) => ({ ...prev, note: e.target.value }))
            }
            placeholder="备注说明（可选）"
            size="xs"
            className="!h-[28px]"
          />
        </div>

        {/* 分类选择 - 单行并排 */}
        <div className="flex flex-col gap-1 text-left col-span-2">
          <span className="text-[11px] font-semibold text-white/40">分类</span>
          <div className="grid grid-cols-8 gap-1.5">
            {(editDraft.billType === "expense"
              ? EXPENSE_CATEGORIES
              : INCOME_CATEGORIES
            ).map((cat) => (
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
            maxTags={3}
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

          <div className="flex-1 overflow-y-scroll custom-scrollbar pr-0.5 flex flex-col gap-2">
            {isLoading ? (
              <p className="text-xs text-white/30 py-8 text-center">
                加载中...
              </p>
            ) : visibleBills.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="h-7 w-7 text-white/30 flex items-center justify-center mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-receipt"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>
                </div>
                <h2 className="text-sm font-bold text-white/80">
                  暂无匹配账单记录
                </h2>
                <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-white/40">
                  没有找到符合当前筛选条件的账单，可尝试调整过滤条件或点击右上角加号录入新账单。
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 mb-1">
                {visibleBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="group/item flex w-full items-center gap-3 hover:bg-white/[0.04] rounded-[4px] px-2 py-1.5 transition-colors border-b border-white/[0.02] last:border-0"
                  >
                    <div className="flex items-center gap-3 text-left min-w-0 flex-1">
                      <div className="w-[100px] flex-shrink-0">
                        <span className="text-xs text-white/30 font-mono">
                          {bill.billDate}
                        </span>
                      </div>
                      <div className="w-[50px] flex-shrink-0">
                        <span className="text-xs text-white/70 font-medium">
                          {bill.category}
                        </span>
                      </div>
                      
                      <div className="flex items-center flex-1 min-w-0 gap-8">
                        <span className="text-xs text-white/50 truncate max-w-[150px]">
                          {bill.note || (
                            <span className="italic text-white/20">无备注</span>
                          )}
                        </span>
                        
                        {bill.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {bill.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-[4px] bg-white/[0.03] px-1 py-[1px] text-[10px] text-white/40 border border-white/[0.02] truncate max-w-[60px]"
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
                        className={`text-sm font-mono font-bold ${
                          bill.billType === "expense"
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {bill.billType === "expense" ? "-" : "+"}¥
                        {formatAmount(bill.amount)}
                      </span>

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
          {/* 右侧标题区 */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-shrink-0 mb-[-8px]">
            <span className="text-sm font-bold text-white/80">条件筛选</span>
            <Tooltip placement="bottom" title="重置全部筛选条件">
              <IconButton
                size="medium"
                onClick={handleResetFilters}
                className="text-white/40 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          </div>

          {/* 收支类型 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-bold text-white/80">收支类型</span>
            </div>
            <div className="flex gap-1 bg-[#212121] p-0.5 rounded-[6px] h-[28px] items-center border border-white/5">
              {[
                { value: "all", label: "全部收支" },
                { value: "income", label: "收入" },
                { value: "expense", label: "支出" },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setTypeFilter(type.value as BillType | "all")}
                  className={`flex-1 rounded-[4px] py-0.5 text-xs font-medium transition-colors ${
                    typeFilter === type.value
                      ? "bg-[#303030] text-white"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* 时间筛选 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-bold text-white/80">时间筛选</span>
            </div>
            <div className="flex gap-1 bg-[#212121] p-0.5 rounded-[6px] h-[28px] items-center border border-white/5">
              {[
                { value: "all", label: "全部" },
                { value: "date", label: "按日" },
                { value: "week", label: "按周" },
                { value: "month", label: "按月" },
              ].map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => {
                    setTimeFilterMode(mode.value as any);
                    if (mode.value === "all") {
                      setSelectedTime("");
                    } else if (mode.value === "month") {
                      setSelectedTime(new Date().toISOString().slice(0, 7));
                    } else {
                      setSelectedTime(new Date().toISOString().slice(0, 10));
                    }
                  }}
                  className={`flex-1 rounded-[4px] py-0.5 text-xs font-medium transition-colors ${
                    timeFilterMode === mode.value
                      ? "bg-[#303030] text-white"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="mt-1">
              <DatePicker
                mode={
                  timeFilterMode === "all"
                    ? "date"
                    : (timeFilterMode as "date" | "week" | "month")
                }
                value={selectedTime}
                onChange={(date) => setSelectedTime(date)}
                className="w-full"
                disabled={timeFilterMode === "all"}
              >
                <DatePickerButton
                  mode={
                    timeFilterMode === "all"
                      ? "date"
                      : (timeFilterMode as "date" | "week" | "month")
                  }
                  value={selectedTime}
                  className="w-full"
                  placeholder="全部时间"
                />
              </DatePicker>
            </div>
          </div>

          {/* 分类筛选 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-bold text-white/80">分类筛选</span>
            </div>

            {/* 大分类切换 */}
            <div className="flex gap-1 bg-[#212121] p-0.5 rounded-[6px] h-[26px] items-center border border-white/5 mb-0.5">
              {[
                { value: "expense", label: "支出" },
                { value: "income", label: "收入" },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() =>
                    setCategoryGroup(type.value as "expense" | "income")
                  }
                  className={`flex-1 rounded-[4px] py-0.5 text-[11px] font-medium transition-colors ${
                    categoryGroup === type.value
                      ? "bg-[#303030] text-white"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Tag
                highlighted={categoryFilter === "all"}
                onClick={() => setCategoryFilter("all")}
                className="font-medium cursor-pointer"
              >
                全部分类
              </Tag>
              {(categoryGroup === "expense"
                ? EXPENSE_CATEGORIES
                : INCOME_CATEGORIES
              ).map((cat) => (
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
            <div className="flex flex-wrap gap-1.5 overflow-y-scroll custom-scrollbar max-h-[300px] pr-0.5">
              {allTags.length === 0 ? (
                <span className="text-xs text-white/30 py-4 text-center w-full">
                  暂无标签
                </span>
              ) : (
                allTags.map((tag) => (
                  <Tag
                    key={tag}
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
