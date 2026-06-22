# 账单记录功能设计规格

## 概述

为 MEMORY CURATOR 添加纯本地账单记录功能。用户在 Today 页可快速查看摘要并录入，在独立 Bills 页可管理全部账单记录。纯本地 SQLite 存储，无 AI 介入。

## 范围

- 侧栏导航新增 Bills 入口（LIBRARY 分组，snippets 与 people 之间）
- Today 页顶部卡片区改造：4 卡片改为 2x2 网格 + 右侧账单摘要卡片
- 独立 BillsPage：表格列表 + 筛选 + 月度统计
- BillEntryModal 录入/编辑弹窗
- 独立 bill bridge（`window.api.bill.*`）

## 数据模型

### 账单分类 (BillCategory)

固定 8 个枚举：`"餐饮" | "交通" | "购物" | "娱乐" | "居住" | "医疗" | "教育" | "其他"`

### 收支类型 (BillType)

`"expense" | "income"`

### 数据库表 (bills)

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | 主键 |
| amount | INTEGER NOT NULL | 金额，单位：分 |
| category | TEXT NOT NULL | 分类枚举值 |
| bill_type | TEXT NOT NULL | expense/income |
| bill_date | TEXT NOT NULL | YYYY-MM-DD |
| note | TEXT NOT NULL DEFAULT '' | 备注 |
| tags | TEXT NOT NULL DEFAULT '[]' | JSON 序列化标签数组 |
| created_at | TEXT NOT NULL | YYYY-MM-DD HH:mm |
| updated_at | TEXT NOT NULL | YYYY-MM-DD HH:mm |

### 页面类型 (BillItem)

```typescript
type BillItem = {
  id: number
  amount: number      // 分，前端显示时 /100
  category: BillCategory
  billType: BillType
  billDate: string    // YYYY-MM-DD
  note: string
  tags: string[]
  createdAt: string
  updatedAt: string
}
```

### BillService 接口

```typescript
type BillService = {
  list: (filters?: { billDate?: string; category?: BillCategory; billType?: BillType }) => BillItem[]
  create: (input: BillCreateInput) => BillItem
  update: (id: number, input: BillUpdateInput) => BillItem
  delete: (id: number) => void
  todaySummary: () => { expenseTotal: number; incomeTotal: number; recentItems: BillItem[] }
}

type BillCreateInput = Omit<BillItem, "id" | "createdAt" | "updatedAt">
type BillUpdateInput = Partial<Omit<BillItem, "id" | "createdAt" | "updatedAt">>
```

## 文件结构

### 新建文件

| 文件 | 说明 |
|------|------|
| `src/renderer/src/pages/bills/BillsPage.tsx` | 账单列表主页面 |
| `src/renderer/src/pages/bills/components/BillEntryModal.tsx` | 录入/编辑弹窗 |
| `src/renderer/src/pages/bills/components/BillSummaryCard.tsx` | Today 页今日账单摘要卡片 |
| `src/renderer/src/pages/bills/components/billShared.ts` | 类型、常量、格式化函数 |
| `src/main/services/billsService.ts` | 账单 DB CRUD 服务 |
| `src/main/ipc/billsHandlers.ts` | IPC 桥接 handler |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/renderer/src/components/layout/Sidebar/Sidebar.tsx` | SidebarPageId 新增 `"bills"` |
| `src/renderer/src/components/layout/Sidebar/components/SidebarNavigationList.tsx` | NAVIGATION_GROUPS 新增 bills nav 项（snippets 后、people 前） |
| `src/renderer/src/App.tsx` | VALID_PAGES 新增 `"bills"`、getPageCategory 分类、renderPageById 路由、导入 BillsPage |
| `src/renderer/src/pages/today/TodayPage.tsx` | 卡片区布局改为 2x2 网格 + 右侧 BillSummaryCard |
| `src/main/ipc/index.ts` | 注册 billsHandlers |
| `src/main/services/index.ts` | 注册 billsService |
| `src/db/schema.ts` | 新增 bills 表类型定义 |
| `src/db/init.ts` | 新增 bills 表建表语句 |

## UI 设计

### 侧栏导航

- 分组：LIBRARY
- 位置：snippets 之后、people 之前
- 标题："Bills"
- 描述："账单收支记录"
- 图标：`Receipt`（lucide-react）

### Today 页面顶部区域

改造布局为两列：左侧 2x2 统计卡片网格，右侧账单摘要卡片。

```
┌─────────────────────────────────────────────────┐
│ ┌─────────┐ ┌─────────┐ ┌───────────────────┐  │
│ │  待办   │ │  随记   │ │   今日账单         │  │
│ └─────────┘ └─────────┘ │   收入 ¥xxx.xx     │  │
│ ┌─────────┐ ┌─────────┐ │   支出 ¥xxx.xx     │  │
│ │  日记   │ │  心情   │ │   ─────────────    │  │
│ └─────────┘ └─────────┘ │   最近 4 条...      │  │
│                         │   [+ 添加记录]      │  │
│                         └───────────────────┘  │
└─────────────────────────────────────────────────┘
```

- 左侧：`grid grid-cols-2 gap-3` 保持现有卡片样式
- 右侧：`BillSummaryCard` 纵向卡片，占据与 2x2 网格同等高度
- 整体容器用 `flex` 或 `grid grid-cols-[1fr_auto]`

### BillSummaryCard（Today 右侧卡片）

- 标题行 "今日账单" + icon
- 收入行：绿色金额（汇总今日 type=income 的 amount 总和）
- 支出行：红色金额（汇总今日 type=expense 的 amount 总和）
- 分隔线
- 最近 4 条记录列表（分类标签 + 备注摘要 + 金额，点击可编辑）
- 底部 "+ 添加记录" 按钮 → 打开 BillEntryModal

### BillsPage

- 顶部筛选栏：收支类型 tabs（全部/支出/收入）+ 分类下拉筛选
- 右上角 "+ 添加账单" 按钮
- 主体表格列：日期、分类（标签）、金额（expense 红色/income 绿色）、备注、标签
- 底部月度统计栏：本月支出总计、本月收入总计、净收支
- 点击行或操作按钮 → BillEntryModal 编辑模式
- 每行支持删除（带确认）

### BillEntryModal

- Modal 弹窗，参考 `TodayNoteEntryModal` 的组件模式
- 金额输入：数字输入框，显示 ¥ 前缀
- 收支类型切换：两个 tab 按钮 "支出" / "收入"
- 分类选择：8 个按钮网格
- 日期选择：默认当天，可用日期选择器修改
- 备注：textarea
- 标签：tag input（输入回车添加，点击 x 删除）
- 保存/取消按钮
- 编辑模式下预填已有数据

## IPC 接口

```typescript
// renderer 调用
window.api.bill.list(filters?)
window.api.bill.create(input)
window.api.bill.update(id, input)
window.api.bill.delete(id)
window.api.bill.todaySummary()
```

与现有 `window.api.daily` 模式一致，通过 preload bridge 暴露。

## 错误处理

- 金额必填且 > 0，否则提示"金额不能为空"
- 分类必选，否则提示"请选择分类"
- DB 操作失败时 toast 提示具体错误
- 删除操作需二次确认

## 非目标

- 无 AI Agent 集成
- 无预算预警
- 无图表/趋势分析
- 无多币种
- 无导出功能
