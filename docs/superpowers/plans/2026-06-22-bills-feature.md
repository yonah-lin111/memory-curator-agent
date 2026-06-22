# 账单记录功能 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 MEMORY CURATOR 添加纯本地账单记录功能，包含侧栏入口、BillsPage 列表管理、Today 页快捷摘要卡片。

**Architecture:** 遵循现有三层模式 — `billsService`（主进程 DB CRUD）→ `billsHandlers`（IPC 桥接）→ `window.api.bill`（preload 暴露）→ 前端页面组件。账单使用独立 `bills` SQLite 表，不耦合 daily 机制。

**Tech Stack:** Electron + React + TypeScript + Tailwind CSS + SQLite (better-sqlite3) + lucide-react

**设计规格:** `docs/superpowers/specs/2026-06-22-bills-feature-design.md`

---

### Task 1: 数据库 Schema 与表创建

**Files:**
- Modify: `src/main/db/schema.ts` (末尾追加)
- Modify: `src/main/db/index.ts:880-900` (initDatabase 内追加)

- [ ] **Step 1: 在 schema.ts 末尾追加账单类型定义**

在 `src/main/db/schema.ts` 文件末尾追加：

```typescript
// ==================== Bills ====================

/** 账单分类 */
export type BillCategory = '餐饮' | '交通' | '购物' | '娱乐' | '居住' | '医疗' | '教育' | '其他'

/** 收支类型 */
export type BillType = 'expense' | 'income'

/** 合法账单分类集合 */
export const BILL_CATEGORIES: BillCategory[] = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他']

/** 账单数据库行 */
export type BillRow = {
  id: number
  amount: number
  category: string
  bill_type: string
  bill_date: string
  note: string
  tags: string
  created_at: string
  updated_at: string
}

/** 账单页面项 */
export type BillItem = {
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

/** 账单创建输入 */
export type BillCreateInput = {
  amount: number
  category: BillCategory
  billType: BillType
  billDate: string
  note: string
  tags: string[]
}

/** 账单更新输入 */
export type BillUpdateInput = Partial<BillCreateInput>

/** 账单列表筛选 */
export type BillListFilters = {
  billDate?: string
  category?: BillCategory
  billType?: BillType
}

/** 今日账单摘要 */
export type BillTodaySummary = {
  expenseTotal: number
  incomeTotal: number
  recentItems: BillItem[]
}
```

- [ ] **Step 2: 在 db/index.ts 末尾追加建表函数并注册**

在 `src/main/db/index.ts` 文件末尾（`getDatabase` 前）追加：

```typescript
/**
 * 创建账单表与索引。
 */
export const createBillsTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY,
      amount INTEGER NOT NULL,
      category TEXT NOT NULL,
      bill_type TEXT NOT NULL,
      bill_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bills_bill_date
    ON bills(bill_date);

    CREATE INDEX IF NOT EXISTS idx_bills_bill_type
    ON bills(bill_type);

    CREATE INDEX IF NOT EXISTS idx_bills_category
    ON bills(category);
  `)
}
```

修改 `initDatabase` 函数，在 `createThemeItemsTable(sqlite)` 后追加一行调用：

```typescript
  createThemeItemsTable(sqlite)
  createBillsTable(sqlite)  // 新增
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit -p src/main/tsconfig.json 2>&1 | head -30
npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/main/db/schema.ts src/main/db/index.ts
git commit -m "feat: 添加 bills 表定义与建表逻辑"
```

---

### Task 2: billsService（主进程 DB 服务）

**Files:**
- Create: `src/main/services/billsService.ts`

- [ ] **Step 1: 创建 billsService.ts**

```typescript
import type { BillCategory, BillCreateInput, BillItem, BillListFilters, BillRow, BillTodaySummary, BillType, BillUpdateInput } from '@/db/schema'
import { BILL_CATEGORIES } from '@/db/schema'

/** 数据库语句接口 */
type Statement = {
  all: (...values: unknown[]) => unknown[]
  get: (...values: unknown[]) => unknown
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

/** Bills 服务依赖的最小数据库接口 */
export type DatabaseConnection = {
  prepare: (sql: string) => Statement
}

/** Bills 服务方法集合 */
export type BillsService = {
  list: (filters?: BillListFilters) => BillItem[]
  create: (input: BillCreateInput) => BillItem
  update: (id: number, input: BillUpdateInput) => BillItem
  delete: (id: number) => void
  todaySummary: () => BillTodaySummary
}

/** 提取 SQLite 自增主键 */
const getInsertedRowId = (result: unknown): number => {
  const rowId = (result as { lastInsertRowid?: number | bigint } | undefined)?.lastInsertRowid
  if (typeof rowId === 'bigint') return Number(rowId)
  if (typeof rowId === 'number') return rowId
  throw new Error('无法读取新建账单的主键')
}

/** 生成当前时间戳 */
const createTimestamp = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${date} ${hours}:${minutes}`
}

/** 生成今日日期 */
const getTodayDate = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

/** 解析数据库标签字段 */
const parseStoredTags = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((tag): tag is string => typeof tag === 'string')
  } catch {
    return []
  }
}

/** 数据库行转页面项 */
const mapRow = (row: BillRow): BillItem => ({
  id: row.id,
  amount: row.amount,
  category: row.category as BillCategory,
  billType: row.bill_type as BillType,
  billDate: row.bill_date,
  note: row.note,
  tags: parseStoredTags(row.tags),
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

/**
 * 校验账单输入。
 */
const validateBillInput = (input: BillCreateInput | BillUpdateInput): void => {
  if ('amount' in input && input.amount !== undefined && input.amount <= 0) {
    throw new Error('金额必须大于0')
  }
  if ('category' in input && input.category && !BILL_CATEGORIES.includes(input.category)) {
    throw new Error('账单分类不正确')
  }
  if ('billType' in input && input.billType && !['expense', 'income'].includes(input.billType)) {
    throw new Error('收支类型不正确')
  }
  if ('billDate' in input && input.billDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.billDate)) {
    throw new Error('账单日期格式不正确')
  }
}

/**
 * 创建 Bills 服务。
 */
export const createBillsService = (database: DatabaseConnection): BillsService => ({
  list: (filters) => {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filters?.billDate) {
      clauses.push('bill_date = ?')
      params.push(filters.billDate)
    }
    if (filters?.category) {
      clauses.push('category = ?')
      params.push(filters.category)
    }
    if (filters?.billType) {
      clauses.push('bill_type = ?')
      params.push(filters.billType)
    }

    const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''
    const rows = database
      .prepare(`SELECT * FROM bills${whereClause} ORDER BY bill_date DESC, id DESC`)
      .all(...params) as BillRow[]

    return rows.map(mapRow)
  },
  create: (input) => {
    if (input.amount <= 0) throw new Error('金额必须大于0')
    if (!BILL_CATEGORIES.includes(input.category)) throw new Error('账单分类不正确')

    const timestamp = createTimestamp()
    const inserted = database
      .prepare(
        'INSERT INTO bills (amount, category, bill_type, bill_date, note, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(input.amount, input.category, input.billType, input.billDate, input.note, JSON.stringify(input.tags), timestamp, timestamp)

    const row = database
      .prepare('SELECT * FROM bills WHERE id = ?')
      .get(getInsertedRowId(inserted)) as BillRow | undefined

    if (!row) throw new Error('新建账单后读取失败')
    return mapRow(row)
  },
  update: (id, input) => {
    validateBillInput(input)

    const existing = database.prepare('SELECT * FROM bills WHERE id = ?').get(id) as BillRow | undefined
    if (!existing) throw new Error('账单不存在')

    const updatedAt = createTimestamp()
    database
      .prepare(
        'UPDATE bills SET amount = ?, category = ?, bill_type = ?, bill_date = ?, note = ?, tags = ?, updated_at = ? WHERE id = ?'
      )
      .run(
        input.amount ?? existing.amount,
        input.category ?? existing.category,
        input.billType ?? existing.bill_type,
        input.billDate ?? existing.bill_date,
        input.note ?? existing.note,
        input.tags ? JSON.stringify(input.tags) : existing.tags,
        updatedAt,
        id
      )

    return mapRow({ ...existing, updated_at: updatedAt })
  },
  delete: (id) => {
    database.prepare('DELETE FROM bills WHERE id = ?').run(id)
  },
  todaySummary: () => {
    const today = getTodayDate()

    const expenseRow = database
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM bills WHERE bill_date = ? AND bill_type = 'expense'")
      .get(today) as { total: number }
    const incomeRow = database
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM bills WHERE bill_date = ? AND bill_type = 'income'")
      .get(today) as { total: number }

    const recentRows = database
      .prepare("SELECT * FROM bills WHERE bill_date = ? ORDER BY id DESC LIMIT 5")
      .all(today) as BillRow[]

    return {
      expenseTotal: expenseRow.total,
      incomeTotal: incomeRow.total,
      recentItems: recentRows.map(mapRow)
    }
  }
})
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit -p src/main/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/main/services/billsService.ts
git commit -m "feat: 添加 billsService DB CRUD 服务"
```

---

### Task 3: billsHandlers（IPC 桥接）

**Files:**
- Create: `src/main/ipc/billsHandlers.ts`
- Modify: `src/main/index.ts:13-14` (导入)
- Modify: `src/main/index.ts:66-67` (注册调用)

- [ ] **Step 1: 创建 billsHandlers.ts**

```typescript
import { ipcMain } from 'electron'
import { getDatabase } from '@/db'
import type { BillCreateInput, BillListFilters, BillUpdateInput } from '@/db/schema'
import { createBillsService, type DatabaseConnection } from '@/services/billsService'

/**
 * 注册 Bills IPC 处理器。
 */
export const registerBillsHandlers = (): void => {
  const database = getDatabase()
  const billsService = createBillsService(database as unknown as DatabaseConnection)

  ipcMain.handle('bills:list', (_, filters?: BillListFilters) =>
    billsService.list(filters)
  )

  ipcMain.handle('bills:create', (_, input: BillCreateInput) =>
    billsService.create(input)
  )

  ipcMain.handle('bills:update', (_, id: number, input: BillUpdateInput) =>
    billsService.update(id, input)
  )

  ipcMain.handle('bills:delete', (_, id: number) => {
    billsService.delete(id)
  })

  ipcMain.handle('bills:today-summary', () =>
    billsService.todaySummary()
  )
}
```

- [ ] **Step 2: 在 main/index.ts 中注册**

在 `src/main/index.ts` 导入区追加：

```typescript
import { registerBillsHandlers } from '@/ipc/billsHandlers'
```

在 handler 注册区块中追加（`registerThemesHandlers()` 后）：

```typescript
  registerThemesHandlers()
  registerBillsHandlers()  // 新增
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit -p src/main/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/billsHandlers.ts src/main/index.ts
git commit -m "feat: 添加 bills IPC 处理器并注册"
```

---

### Task 4: Preload 与类型声明

**Files:**
- Modify: `src/preload/index.ts` (追加 bill 内联类型 + api.bill 对象)
- Modify: `src/renderer/src/env.d.ts` (追加 bill 内联类型 + AppAPI.bill)

preload 和 env.d.ts 均使用内联类型定义，不导入 `@/db/schema`。

- [ ] **Step 1: 在 preload/index.ts 中追加内联 bill 类型**

在 `src/preload/index.ts` 的 `AssociatedPersonPayload` 类型定义之后追加：

```typescript
// 账单分类类型。
type BillCategory = '餐饮' | '交通' | '购物' | '娱乐' | '居住' | '医疗' | '教育' | '其他'

// 收支类型。
type BillType = 'expense' | 'income'

// 账单列表筛选。
type BillListFilters = {
  billDate?: string
  category?: BillCategory
  billType?: BillType
}

// 账单创建载荷。
type BillCreatePayload = {
  amount: number
  category: BillCategory
  billType: BillType
  billDate: string
  note: string
  tags: string[]
}

// 账单更新载荷。
type BillUpdatePayload = Partial<BillCreatePayload>

// 账单页面项。
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

// 今日账单摘要。
type BillTodaySummary = {
  expenseTotal: number
  incomeTotal: number
  recentItems: BillItem[]
}
```

- [ ] **Step 2: 在 preload/index.ts 的 api 对象中追加 bill**

在 `src/preload/index.ts`，`themes` 对象闭合 `}` 后、`api` 对象闭合 `}` 前追加：

```typescript
  bill: {
    list: (filters?: BillListFilters): Promise<BillItem[]> =>
      ipcRenderer.invoke('bills:list', filters),
    create: (input: BillCreatePayload): Promise<BillItem> =>
      ipcRenderer.invoke('bills:create', input),
    update: (id: number, input: BillUpdatePayload): Promise<BillItem> =>
      ipcRenderer.invoke('bills:update', id, input),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('bills:delete', id),
    todaySummary: (): Promise<BillTodaySummary> =>
      ipcRenderer.invoke('bills:today-summary')
  }
```

- [ ] **Step 3: 在 env.d.ts 中追加内联 bill 类型 + AppAPI.bill**

在 `src/renderer/src/env.d.ts`，`ThemeUpdateInput` 类型定义之后、`AppAPI` 接口之前，追加与 Step 1 完全相同的 bill 内联类型定义。

然后在 `AppAPI` 接口末尾（`themes` 属性声明闭合 `}` 后、`AppAPI` 闭合 `}` 前）追加：

```typescript
  /** 账单 API */
  bill?: {
    /** 列出账单 */
    list: (filters?: BillListFilters) => Promise<BillItem[]>
    /** 创建账单 */
    create: (input: BillCreatePayload) => Promise<BillItem>
    /** 更新账单 */
    update: (id: number, input: BillUpdatePayload) => Promise<BillItem>
    /** 删除账单 */
    delete: (id: number) => Promise<void>
    /** 今日账单摘要 */
    todaySummary: () => Promise<BillTodaySummary>
  }
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit -p src/main/tsconfig.json 2>&1 | head -20
npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/renderer/src/env.d.ts
git commit -m "feat: 添加 bills preload 桥接与类型声明"
```

---

### Task 5: billShared（前端共享类型与常量）

**Files:**
- Create: `src/renderer/src/pages/bills/components/billShared.ts`

- [ ] **Step 1: 创建 billShared.ts**

```typescript
/** 账单分类枚举 */
export type BillCategory = '餐饮' | '交通' | '购物' | '娱乐' | '居住' | '医疗' | '教育' | '其他'

/** 收支类型 */
export type BillType = 'expense' | 'income'

/** 账单分类列表 */
export const BILL_CATEGORIES: BillCategory[] = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他']

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
  '其他': 'Ellipsis'
}

/**
 * 格式化金额显示（分 -> 元，保留两位小数）。
 */
export const formatAmount = (amountInCents: number): string =>
  (amountInCents / 100).toFixed(2)

/**
 * 格式化输入字符串金额为分（元 * 100，取整）。
 */
export const parseAmountToCents = (input: string): number => {
  const num = parseFloat(input)
  if (isNaN(num) || num <= 0) return 0
  return Math.round(num * 100)
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/bills/components/billShared.ts
git commit -m "feat: 添加账单共享类型与工具函数"
```

---

### Task 6: BillEntryModal（录入/编辑弹窗）

**Files:**
- Create: `src/renderer/src/pages/bills/components/BillEntryModal.tsx`

- [ ] **Step 1: 创建 BillEntryModal.tsx**

```tsx
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
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/bills/components/BillEntryModal.tsx
git commit -m "feat: 添加 BillEntryModal 账单录入/编辑弹窗"
```

---

### Task 7: BillSummaryCard（Today 页右侧摘要卡片）

**Files:**
- Create: `src/renderer/src/pages/bills/components/BillSummaryCard.tsx`

- [ ] **Step 1: 创建 BillSummaryCard.tsx**

```tsx
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
    <div className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex flex-col">
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
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/bills/components/BillSummaryCard.tsx
git commit -m "feat: 添加 BillSummaryCard 今日账单摘要卡片"
```

---

### Task 8: BillsPage（账单列表主页面）

**Files:**
- Create: `src/renderer/src/pages/bills/BillsPage.tsx`

- [ ] **Step 1: 创建 BillsPage.tsx**

```tsx
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
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/bills/BillsPage.tsx
git commit -m "feat: 添加 BillsPage 账单列表主页面"
```

---

### Task 9: 侧栏导航与路由注册

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar/Sidebar.tsx:12-23` (SidebarPageId)
- Modify: `src/renderer/src/components/layout/Sidebar/components/SidebarNavigationList.tsx:1-15` (导入 Receipt)
- Modify: `src/renderer/src/components/layout/Sidebar/components/SidebarNavigationList.tsx:42-127` (NAVIGATION_GROUPS)
- Modify: `src/renderer/src/App.tsx:1-15` (导入 BillsPage)
- Modify: `src/renderer/src/App.tsx:28-40` (VALID_PAGES)
- Modify: `src/renderer/src/App.tsx:57-78` (getPageCategory)
- Modify: `src/renderer/src/App.tsx:83-108` (renderPageById)

- [ ] **Step 1: SidebarPageId 新增 "bills"**

`src/renderer/src/components/layout/Sidebar/Sidebar.tsx:12` — 在 `"people"` 前追加 `"bills"`：

```typescript
export type SidebarPageId =
  | "today"
  | "notes"
  | "journal"
  | "weekly"
  | "themes"
  | "memories"
  | "todo"
  | "snippets"
  | "bills"     // 新增
  | "people"
  | "showcase"
  | "settings";
```

- [ ] **Step 2: SidebarNavigationList 新增 bills nav 项**

`SidebarNavigationList.tsx` — 导入区追加 `Receipt`：

```typescript
import {
  BookOpen,
  Brain,
  CalendarDays,
  CheckSquare,
  FileText,
  Home,
  Layers,
  LayoutGrid,
  Receipt,
  Settings,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
```

在 `NAVIGATION_GROUPS` 的 LIBRARY 分组 items 中，snippets 和 people 之间插入：

```typescript
      {
        id: "bills",
        label: "Bills",
        description: "账单收支记录",
        icon: Receipt,
      },
```

- [ ] **Step 3: App.tsx 路由注册**

`src/renderer/src/App.tsx`:

a) 导入区追加：

```typescript
import { BillsPage } from "@/pages/bills/BillsPage";
```

b) `VALID_PAGES` 数组中 `"people"` 前追加 `"bills"`:

```typescript
const VALID_PAGES: SidebarPageId[] = [
  "today", "notes", "journal", "weekly", "themes", "memories",
  "todo", "snippets", "bills", "people", "showcase", "settings",
];
```

c) `getPageCategory` switch 中追加 `"bills"` 到 LIBRARY 分支：

```typescript
    case "notes":
    case "journal":
    case "todo":
    case "snippets":
    case "bills":     // 新增
    case "people":
      return "LIBRARY";
```

d) `renderPageById` switch 中追加 `"bills"` case：

```typescript
    case "bills":
      return <BillsPage />;
```

- [ ] **Step 4: 验证编译**

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/layout/Sidebar/Sidebar.tsx \
  src/renderer/src/components/layout/Sidebar/components/SidebarNavigationList.tsx \
  src/renderer/src/App.tsx
git commit -m "feat: 注册 Bills 侧栏导航与页面路由"
```

---

### Task 10: Today 页面卡片区布局改造

**Files:**
- Modify: `src/renderer/src/pages/today/TodayPage.tsx:2-4` (导入区)
- Modify: `src/renderer/src/pages/today/TodayPage.tsx:657-693` (顶部卡片区域)

- [ ] **Step 1: 导入区追加 BillSummaryCard**

```typescript
import { BillSummaryCard } from "@/pages/bills/components/BillSummaryCard";
```

- [ ] **Step 2: 替换顶部卡片区域布局**

将原 `grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0` 的 4 列统计卡片区域替换为两栏布局：

```tsx
        <div className="flex gap-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3 flex-1">
            {TODAY_STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.id}
                  className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex items-center justify-between"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white/40">
                      {stat.label}
                    </span>
                    <span className="text-lg font-bold font-mono text-white">
                      {stat.id === "todo"
                        ? todos.length
                        : stat.id === "notes"
                          ? notes.length
                          : stat.id === "journal"
                            ? journalContent.length
                            : stat.id === "clues"
                              ? predictedMood
                              : stat.value}
                    </span>
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-white/5 text-white/60">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="w-[220px] flex-shrink-0">
            <BillSummaryCard />
          </div>
        </div>
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/pages/today/TodayPage.tsx
git commit -m "feat: Today 页面卡片区改为 2x2 + 账单摘要布局"
```

---

### Task 11: 端到端验证

- [ ] **Step 1: 完整编译检查**

```bash
npx tsc --noEmit -p src/main/tsconfig.json && echo "MAIN OK" || echo "MAIN FAIL"
npx tsc --noEmit -p src/renderer/tsconfig.json && echo "RENDERER OK" || echo "RENDERER FAIL"
```

- [ ] **Step 2: 运行现有测试确保无回归**

```bash
npm test 2>&1 | tail -20
```

- [ ] **Step 3: 启动应用手动验证**

```bash
npm run dev
```

验证清单：
- 侧栏 LIBRARY 分组出现 "Bills" 入口，位于 snippets 和 people 之间
- 点击 Bills 进入账单列表页，初始显示空状态
- 点击 "添加账单" 打开录入弹窗，填写各项后保存
- 账单出现在列表中，表格列正确显示
- 点击行可编辑，删除按钮二次确认后删除
- 切换支出/收入 tab、分类下拉筛选正常
- 底部月度统计正确计算
- 切换到 Today 页面，顶部 2x2 统计卡片 + 右侧账单摘要卡片
- 账单摘要卡片显示今日收支合计和最近记录
- 从摘要卡片添加/编辑账单同步生效

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: 账单功能端到端验证通过"
```
