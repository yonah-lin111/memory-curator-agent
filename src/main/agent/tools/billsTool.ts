import type { BillItem, BillCategory, BillType, BillListFilters } from '@/db/schema'
import type { BillsService } from '@/services/billsService'
import type {
  AgentTool,
  BillQueryToolInput,
  BillQueryToolItem,
  BillQueryToolResult,
  BillSummaryToolResult
} from '@/agent/types'

// Bill 查询工具类型。
type BillQueryTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 Bill 查询。
   */
  execute: (input: unknown) => Promise<BillQueryToolResult>
}

// Bill 摘要工具类型。
type BillSummaryTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 Bill 摘要查询。
   */
  execute: (input: unknown) => Promise<BillSummaryToolResult>
}

// 账单工具默认返回数量。
const DEFAULT_BILL_LIMIT = 20

// 账单工具最大返回数量。
const MAX_BILL_LIMIT = 50

/**
 * 格式化金额（分转元）。
 */
const formatAmount = (cents: number): string => `${(cents / 100).toFixed(2)} 元`

/**
 * 将账单映射为工具返回项。
 */
const toToolItem = (bill: BillItem): BillQueryToolItem => ({
  id: bill.id,
  amount: bill.amount,
  category: bill.category,
  billType: bill.billType,
  billDate: bill.billDate,
  note: bill.note,
  tags: bill.tags,
  createdAt: bill.createdAt,
  updatedAt: bill.updatedAt
})

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 解析字符串字段。
 */
const parseString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/**
 * 解析 Bill 工具入参。
 */
const parseInput = (input: unknown): BillQueryToolInput => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    startDate: parseString(input.startDate),
    endDate: parseString(input.endDate),
    category: parseString(input.category) as BillCategory | undefined,
    billType: parseString(input.billType) as BillType | undefined,
    limit: typeof input.limit === 'number' ? input.limit : undefined
  }
}

/**
 * 解析 Bill 摘要工具入参。
 */
const parseSummaryInput = (input: unknown): { date?: string } => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    date: parseString(input.date)
  }
}

/**
 * 创建账单列表查询工具。
 */
export const createBillListTool = (
  billsService: Pick<BillsService, 'list'>
): BillQueryTool => ({
  name: 'bills_tool_list',
  description: 'Query bills in the local Bills table. Read-only; never modifies data.',
  prompt: {
    summary: 'Query bills in the local Bills table. Read-only; supports date ranges, category, and type filtering.',
    intentKeywords: [
      '账单',
      '消费',
      '花销',
      '收入',
      '支出',
      '记账',
      '买',
      '餐饮',
      '购物',
      '工资',
      '理财',
      'bill',
      'expense',
      'income'
    ],
    whenToUse: [
      'Use when the user asks about bills, expenses, incomes, or spending history.',
      'Use when the user asks for transactions within a date range, of a specific category, or type.'
    ],
    whenNotToUse: [
      'Do not use for general chat or questions unrelated to local bills.',
      'Do not use when the user asks for creating, updating, or deleting bills.'
    ],
    safety: [
      'Read only from the local Bills table. Never write data.',
      'Never invent bill items that the tool did not return.',
      'Note that amount is in cents (100 cents = 1 yuan).'
    ],
    output: 'Return the bill facts needed to answer the user. Format amounts to Yuan (元) for user display.',
    examples: [
      `{"limit":10}`,
      `{"startDate":"2026-06-01","endDate":"2026-06-30","billType":"expense"}`,
      `{"category":"餐饮","limit":5}`
    ]
  },
  parameters: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format (inclusive).'
      },
      endDate: {
        type: 'string',
        description: 'End date in YYYY-MM-DD format (inclusive).'
      },
      category: {
        type: 'string',
        enum: [
          '餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他',
          '工资', '兼职', '理财', '礼金', '报销', '奖金', '退款'
        ],
        description: 'Filter by specific bill category'
      },
      billType: {
        type: 'string',
        enum: ['expense', 'income'],
        description: 'Filter by type (expense or income)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of rows to return'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseInput(input)
    const limit = Math.max(
      1,
      Math.min(parsed.limit ?? DEFAULT_BILL_LIMIT, MAX_BILL_LIMIT)
    )

    const filters: BillListFilters = {}
    if (parsed.category) filters.category = parsed.category
    if (parsed.billType) filters.billType = parsed.billType
    
    // 如果开始日期和结束日期相同，直接利用 service 的单日过滤
    if (parsed.startDate && parsed.startDate === parsed.endDate) {
      filters.billDate = parsed.startDate
    }

    let bills = billsService.list(filters)

    // 在内存中过滤更复杂的日期范围
    if (parsed.startDate && parsed.startDate !== parsed.endDate) {
      bills = bills.filter((bill) => bill.billDate >= parsed.startDate!)
    }
    if (parsed.endDate && parsed.startDate !== parsed.endDate) {
      bills = bills.filter((bill) => bill.billDate <= parsed.endDate!)
    }

    bills = bills.slice(0, limit)
    const items = bills.map(toToolItem)

    let observation = `Successfully queried ${items.length} bill items.`
    if (items.length > 0) {
      const details = items.map(
        (item) => `- [${item.billDate}] ${item.billType === 'expense' ? '支出' : '收入'} [${item.category}]: ${formatAmount(item.amount)}${item.note ? ` (${item.note})` : ''}`
      ).join('\n')
      observation += `\n\nQuery results:\n${details}`
    }

    return {
      observation,
      data: { items },
      items
    }
  }
})

/**
 * 创建账单今日/指定日摘要工具。
 */
export const createBillSummaryTool = (
  billsService: Pick<BillsService, 'todaySummary'>
): BillSummaryTool => ({
  name: 'bills_tool_summary',
  description: 'Query daily summary context of expense, income, and recent transactions.',
  prompt: {
    summary: 'Query daily summary context of expense, income, and recent transactions for a specific date.',
    intentKeywords: [
      '消费摘要',
      '今天花了多少钱',
      '今日总结',
      '收支汇总',
      '今日花销',
      '今天记账',
      'daily summary',
      'spending summary'
    ],
    whenToUse: [
      'Use when the user asks for a total summary of expenses and incomes for a specific day.',
      'Use when the user asks "How much did I spend today/yesterday?"'
    ],
    whenNotToUse: [
      'Do not use when the user asks for specific transactions over a long date range.',
      'Do not use when the user has not asked for a daily or single-day summary.'
    ],
    safety: [
      'Read only from the local Bills table. Never write data.',
      'Default to today\'s date if no date is specified.',
      'Format amounts to Yuan (元) for user display.'
    ],
    output: 'Return the total income, total expense, and recent transactions for the day.',
    examples: [
      `{}`,
      `{"date":"2026-06-23"}`
    ]
  },
  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Target date in YYYY-MM-DD format. Defaults to today.'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseSummaryInput(input)
    const summary = billsService.todaySummary(parsed.date)
    const items = summary.recentItems.map(toToolItem)

    const targetDate = parsed.date ?? new Date().toISOString().slice(0, 10)
    let observation = `Daily Summary for ${targetDate}:\n- Total Expense: ${formatAmount(summary.expenseTotal)}\n- Total Income: ${formatAmount(summary.incomeTotal)}`
    
    if (items.length > 0) {
      const details = items.map(
        (item) => `- ${item.billType === 'expense' ? '支出' : '收入'} [${item.category}]: ${formatAmount(item.amount)}${item.note ? ` (${item.note})` : ''}`
      ).join('\n')
      observation += `\n\nRecent items on this day:\n${details}`
    } else {
      observation += '\nNo transactions recorded on this day.'
    }

    return {
      observation,
      data: {
        expenseTotal: summary.expenseTotal,
        incomeTotal: summary.incomeTotal,
        items
      },
      expenseTotal: summary.expenseTotal,
      incomeTotal: summary.incomeTotal,
      items
    }
  }
})

/**
 * 创建完整 Bills 工具组。
 */
export const createBillsTools = (
  billsService: Pick<BillsService, 'list' | 'todaySummary'>
): AgentTool[] => [
  createBillListTool(billsService),
  createBillSummaryTool(billsService)
]
