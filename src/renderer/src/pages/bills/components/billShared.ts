/** 支出分类列表 */
export const EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他'] as const

/** 收入分类列表 */
export const INCOME_CATEGORIES = ['工资', '兼职', '理财', '礼金', '报销', '奖金', '退款', '其他'] as const

/** 账单分类枚举 */
export type BillCategory = typeof EXPENSE_CATEGORIES[number] | typeof INCOME_CATEGORIES[number]

/** 收支类型 */
export type BillType = 'expense' | 'income'

/** 账单分类列表 */
export const BILL_CATEGORIES: BillCategory[] = Array.from(
  new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
)

/** 收支类型列表 */
export const BILL_TYPES: { value: BillType; label: string }[] = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' }
]

/** 分类图标映射 */
export const BILL_CATEGORY_ICONS: Record<BillCategory, string> = {
  '餐饮': 'UtensilsCrossed',
  '交通': 'Car',
  '购物': 'ShoppingBag',
  '娱乐': 'Gamepad2',
  '居住': 'Home',
  '医疗': 'HeartPulse',
  '教育': 'GraduationCap',
  '其他': 'Ellipsis',
  '工资': 'Coins',
  '兼职': 'Briefcase',
  '理财': 'TrendingUp',
  '礼金': 'Gift',
  '报销': 'Receipt',
  '奖金': 'Trophy',
  '退款': 'Undo2'
}

/**
 * 格式化金额显示（分 -> 元，保留两位小数）。
 */
export const formatAmount = (amountInCents: number): string =>
  (amountInCents / 100).toFixed(2)

/**
 * 评估基础数学表达式（支持加减乘除），返回计算结果
 */
export const evaluateMathExpression = (expr: string): number | null => {
  try {
    // 移除非法字符，只允许数字、小数点和基础运算符
    const sanitized = expr.replace(/[^\d.+\-*/()]/g, '')
    if (!sanitized) return null
    // 为了安全，使用 new Function 而非直接 eval，仅解析基础数学公式
    // 因为前端环境中我们只处理上面正则清洗过的字符串，没有安全风险
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const result = new Function(`return ${sanitized}`)()
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result
    }
    return null
  } catch {
    return null
  }
}

/**
 * 格式化输入字符串金额为分（元 * 100，取整），支持简单四则运算。
 */
export const parseAmountToCents = (input: string): number => {
  const num = evaluateMathExpression(input)
  if (num === null || num <= 0) return 0
  return Math.round(num * 100)
}
