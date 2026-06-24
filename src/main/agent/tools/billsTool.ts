import type { BillItem, BillCategory, BillType, BillListFilters, BillCreateInput, BillUpdateInput } from '@/db/schema'
import type { BillsService } from '@/services/billsService'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'
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

// Bill 写入工具结果。
type BillWriteToolResult = {
  // 回灌模型的观察文本。
  observation: string
  // 调试或 UI 可用结构化数据。
  data: unknown
}

// Bill 写入工具类型。
type BillWriteTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 Bill 写入。
   */
  execute: (input: unknown) => Promise<BillWriteToolResult>
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
 * 读取 Bill 写入输入中的非空字符串字段。
 */
const getBillInputString = (input: unknown, key: string): string | null => {
  if (!isRecord(input)) {
    return null
  }

  const value = parseString(input[key])?.trim()

  return value || null
}

// Bill 创建确认配置。
const BILL_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认创建',
  question: '确认创建账单记录',
  confirm: '确认创建',
  cancel: '取消创建',
  renderTarget: (input) => {
    if (!isRecord(input)) return null
    return `${parseString(input.category) || ''} 账单`
  },
  renderSummary: (input) => {
    const aiSummary = getBillInputString(input, 'confirmationSummary')
    if (aiSummary) return aiSummary
    if (!isRecord(input)) return null
    const amount = typeof input.amount === 'number' ? formatAmount(input.amount) : ''
    const billType = input.billType === 'expense' ? '支出' : '收入'
    return `将创建账单记录：[${parseString(input.billDate) || ''}] ${billType} [${parseString(input.category) || ''}]: ${amount}。`
  },
  completion: {
    renderMessage: (_input, result) => {
      if (!isRecord(result.data) || !isRecord(result.data.item)) return '已创建账单记录。'
      const item = result.data.item as BillItem
      const amount = typeof item.amount === 'number' ? formatAmount(item.amount) : ''
      const billType = item.billType === 'expense' ? '支出' : '收入'
      return `已创建账单记录：[${item.billDate}] ${billType} [${item.category}]: ${amount}。`
    }
  }
}

// Bill 更新确认配置。
const BILL_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认更新',
  question: '确认更新账单记录',
  confirm: '确认更新',
  cancel: '取消更新',
  renderTarget: (input) => {
    if (!isRecord(input)) return null
    return `账单 #${input.id}`
  },
  renderSummary: (input) => {
    const aiSummary = getBillInputString(input, 'confirmationSummary')
    if (aiSummary) return aiSummary
    if (!isRecord(input)) return null
    return `将更新账单记录：#${input.id}。`
  },
  completion: {
    renderMessage: (_input, result) => {
      if (!isRecord(result.data) || !isRecord(result.data.item)) return '已更新账单记录。'
      const item = result.data.item as BillItem
      const amount = typeof item.amount === 'number' ? formatAmount(item.amount) : ''
      const billType = item.billType === 'expense' ? '支出' : '收入'
      return `已更新账单记录：[${item.billDate}] ${billType} [${item.category}]: ${amount}。`
    }
  }
}

// Bill 删除确认配置。
const BILL_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: '确认删除',
  question: '确认永久删除账单记录',
  confirm: '确认删除',
  cancel: '取消删除',
  renderTarget: (input) => {
    if (!isRecord(input)) return null
    return `账单 #${input.id}`
  },
  renderSummary: (input) => {
    const aiSummary = getBillInputString(input, 'confirmationSummary')
    if (aiSummary) return aiSummary
    if (!isRecord(input)) return null
    return `将永久删除账单记录：#${input.id}。`
  },
  completion: {
    renderMessage: (input) => {
      if (!isRecord(input)) return '已删除账单记录。'
      return `已永久删除账单记录：#${input.id}。`
    }
  }
}

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
 * 解析 Bill 新建入参。
 */
const parseCreateInput = (input: unknown): BillCreateInput => {
  if (!isRecord(input)) {
    throw new Error('Bill profile input must be an object')
  }

  const amount = typeof input.amount === 'number' ? input.amount : 0
  const category = parseString(input.category) as BillCategory
  const billType = parseString(input.billType) as BillType
  const billDate = parseString(input.billDate) ?? ''
  const note = parseString(input.note) ?? ''
  const tags = Array.isArray(input.tags) ? input.tags.filter((t): t is string => typeof t === 'string') : []

  return {
    amount,
    category,
    billType,
    billDate,
    note,
    tags
  }
}

/**
 * 解析 Bill 更新入参。
 */
const parseUpdateInput = (
  input: unknown
): { id: number; profile: BillUpdateInput } => {
  if (!isRecord(input)) {
    throw new Error('Bill update input must be an object')
  }

  const id = typeof input.id === 'number' ? input.id : undefined
  if (id === undefined) {
    throw new Error('Bill update requires numeric id')
  }

  const profile: BillUpdateInput = {}
  if (typeof input.amount === 'number') profile.amount = input.amount
  if (parseString(input.category)) profile.category = parseString(input.category) as BillCategory
  if (parseString(input.billType)) profile.billType = parseString(input.billType) as BillType
  if (parseString(input.billDate)) profile.billDate = parseString(input.billDate)
  if (typeof input.note === 'string') profile.note = input.note
  if (Array.isArray(input.tags)) {
    profile.tags = input.tags.filter((t): t is string => typeof t === 'string')
  }

  return {
    id,
    profile
  }
}

/**
 * 解析 Bill 删除入参。
 */
const parseDeleteInput = (input: unknown): { id: number } => {
  if (!isRecord(input)) {
    throw new Error('Bill delete input must be an object')
  }

  const id = typeof input.id === 'number' ? input.id : undefined
  if (id === undefined) {
    throw new Error('Bill delete requires numeric id')
  }

  return { id }
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
 * 创建账单新建工具。
 */
export const createBillAddTool = (
  billsService: Pick<BillsService, 'create'>
): BillWriteTool => ({
  name: 'bills_tool_add',
  description: 'Create a bill record (expense or income) in the local Bills table.',
  confirmation: BILL_ADD_CONFIRMATION,
  prompt: {
    summary: 'Create a new bill record in the local Bills table.',
    intentKeywords: [
      '记账',
      '买东西',
      '花了',
      '花费',
      '收到',
      '增加账单',
      '新增账单',
      '创建账单',
      'add bill',
      'create bill',
      'record expense',
      'record income'
    ],
    whenToUse: [
      'Use when the user explicitly asks to record, add, or create a bill (expense or income).',
      'Use when the user says "Yesterday I spent 50 yuan on dining" or "Today received salary 5000 yuan".'
    ],
    whenNotToUse: [
      'Do not use for read-only questions about existing bills.',
      'Do not use when the user only asks for summaries or lists without saving data.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'Always parse the amount to cents (100 cents = 1 yuan). For example, 15 yuan is 1500 cents.',
      'Choose a valid category and billType (expense or income) from the schema.',
      'Format the billDate to YYYY-MM-DD. Default to today\'s date if not specified.',
      'Never invent bill facts the user did not provide.'
    ],
    output: 'Include confirmationSummary in the tool arguments; return the created bill facts needed by the user.',
    examples: [
      `{"confirmationSummary":"将创建账单记录：[2026-06-23] 支出 [餐饮]: 15.00 元 (午餐)","amount":1500,"category":"餐饮","billType":"expense","billDate":"2026-06-23","note":"午餐","tags":[]}`
    ]
  },
  parameters: {
    type: 'object',
    required: ['amount', 'category', 'billType', 'billDate'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description: 'Concise Markdown Chinese explanation shown above the internal confirmation. Summarize the key bill facts: date, category, type, note and amount.'
      },
      amount: {
        type: 'number',
        description: 'Amount in cents (e.g., 1500 for 15.00 元). Must be greater than 0.'
      },
      category: {
        type: 'string',
        enum: [
          '餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他',
          '工资', '兼职', '理财', '礼金', '报销', '奖金', '退款'
        ],
        description: 'Bill category'
      },
      billType: {
        type: 'string',
        enum: ['expense', 'income'],
        description: 'Bill type (expense or income)'
      },
      billDate: {
        type: 'string',
        description: 'Transaction date in YYYY-MM-DD format.'
      },
      note: {
        type: 'string',
        description: 'Optional description or note.'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Optional tags.'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseCreateInput(input)
    const created = billsService.create(parsed)

    return {
      observation: `Created bill record: ${created.category} (${formatAmount(created.amount)}).`,
      data: {
        item: toToolItem(created)
      }
    }
  }
})

/**
 * 创建账单更新工具。
 */
export const createBillUpdateTool = (
  billsService: Pick<BillsService, 'update'>
): BillWriteTool => ({
  name: 'bills_tool_update',
  description: 'Update an existing bill record in the local Bills table by numeric id.',
  confirmation: BILL_UPDATE_CONFIRMATION,
  prompt: {
    summary: 'Update an existing bill record in the local Bills table by id.',
    intentKeywords: [
      '修改账单',
      '更新账单',
      '改账单',
      '纠正账单',
      'update bill',
      'edit bill'
    ],
    whenToUse: [
      'Use when the user explicitly asks to modify or update an existing bill.',
      'Always query or search the bill list first to find the correct numeric id, then invoke this tool.'
    ],
    whenNotToUse: [
      'Do not use for creating new bills.',
      'Do not use when the numeric id of the bill is unknown.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm updates; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'Never overwrite fields with guesses.'
    ],
    output: 'Include confirmationSummary in the tool arguments with key changed fields; return the updated bill facts needed by the user.',
    examples: [
      `{"confirmationSummary":"将更新账单记录：#5。\\n- 金额修改为 20.00 元","id":5,"amount":2000}`
    ]
  },
  parameters: {
    type: 'object',
    required: ['id'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description: 'Concise Markdown Chinese explanation shown above the internal confirmation.'
      },
      id: {
        type: 'number',
        description: 'The numeric bill id'
      },
      amount: {
        type: 'number',
        description: 'New amount in cents.'
      },
      category: {
        type: 'string',
        enum: [
          '餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他',
          '工资', '兼职', '理财', '礼金', '报销', '奖金', '退款'
        ],
        description: 'New category'
      },
      billType: {
        type: 'string',
        enum: ['expense', 'income'],
        description: 'New type (expense or income)'
      },
      billDate: {
        type: 'string',
        description: 'New transaction date in YYYY-MM-DD.'
      },
      note: {
        type: 'string',
        description: 'New note or description.'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'New tags.'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseUpdateInput(input)
    const updated = billsService.update(parsed.id, parsed.profile)

    return {
      observation: `Updated bill record: #${updated.id} (${formatAmount(updated.amount)}).`,
      data: {
        item: toToolItem(updated)
      }
    }
  }
})

/**
 * 创建账单删除工具。
 */
export const createBillDeleteTool = (
  billsService: Pick<BillsService, 'delete'>
): BillWriteTool => ({
  name: 'bills_tool_delete',
  description: 'Delete an existing bill record from the local Bills table by numeric id.',
  confirmation: BILL_DELETE_CONFIRMATION,
  prompt: {
    summary: 'Delete an existing bill record from the local Bills table by id.',
    intentKeywords: [
      '删除账单',
      '删掉账单',
      '移除账单',
      'delete bill',
      'remove bill'
    ],
    whenToUse: [
      'Use when the user explicitly asks to delete a bill.',
      'Always query or list bills first to find the correct numeric id before deleting.'
    ],
    whenNotToUse: [
      'Do not use for temporary filtering or hiding.',
      'Do not use when the target numeric id is unknown or ambiguous.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.'
    ],
    output: 'Include confirmationSummary in the tool arguments; return a concise deletion confirmation.',
    examples: [
      `{"confirmationSummary":"将删除账单记录：#5。","id":5}`
    ]
  },
  parameters: {
    type: 'object',
    required: ['id'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description: 'Concise Markdown Chinese explanation shown above the internal confirmation.'
      },
      id: {
        type: 'number',
        description: 'The numeric bill id to delete.'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseDeleteInput(input)
    billsService.delete(parsed.id)

    return {
      observation: `Deleted bill record: #${parsed.id}.`,
      data: {
        id: parsed.id
      }
    }
  }
})

/**
 * 创建完整 Bills 工具组。
 */
export const createBillsTools = (
  billsService: Pick<BillsService, 'list' | 'todaySummary' | 'create' | 'update' | 'delete'>
): AgentTool[] => [
  createBillListTool(billsService),
  createBillSummaryTool(billsService),
  createBillAddTool(billsService),
  createBillUpdateTool(billsService),
  createBillDeleteTool(billsService)
]
