import { describe, expect, it, vi } from 'vitest'
import { createBillListTool, createBillSummaryTool, createBillsTools } from '@/agent/tools/billsTool'
import type { BillsService } from '@/services/billsService'

describe('billsTool list', () => {
  it('bills_tool_list should query list with pre-filters and support date/limit memory-filtering', async () => {
    const mockList = vi.fn().mockImplementation((filters) => {
      const data = [
        {
          id: 1,
          amount: 1500,
          category: '餐饮',
          billType: 'expense',
          billDate: '2026-06-20',
          note: 'Lunch',
          tags: [],
          createdAt: '2026-06-20 12:00',
          updatedAt: '2026-06-20 12:00'
        },
        {
          id: 2,
          amount: 2500,
          category: '餐饮',
          billType: 'expense',
          billDate: '2026-06-21',
          note: 'Dinner',
          tags: [],
          createdAt: '2026-06-21 18:00',
          updatedAt: '2026-06-21 18:00'
        },
        {
          id: 3,
          amount: 1000,
          category: '交通',
          billType: 'expense',
          billDate: '2026-06-22',
          note: 'Taxi',
          tags: [],
          createdAt: '2026-06-22 10:00',
          updatedAt: '2026-06-22 10:00'
        }
      ]
      return data.filter((item) => {
        if (filters?.category && item.category !== filters.category) return false
        if (filters?.billType && item.billType !== filters.billType) return false
        if (filters?.billDate && item.billDate !== filters.billDate) return false
        return true
      })
    })

    const service = { list: mockList } as unknown as BillsService
    const tool = createBillListTool(service)

    const result = await tool.execute({
      startDate: '2026-06-21',
      endDate: '2026-06-23',
      category: '餐饮',
      billType: 'expense',
      limit: 10
    })

    expect(mockList).toHaveBeenCalledWith({
      category: '餐饮',
      billType: 'expense'
    })

    // 只有第 2 项同时满足分类、收支类型和日期范围 [2026-06-21, 2026-06-23]
    expect(result.items).toEqual([
      {
        id: 2,
        amount: 2500,
        category: '餐饮',
        billType: 'expense',
        billDate: '2026-06-21',
        note: 'Dinner',
        tags: [],
        createdAt: '2026-06-21 18:00',
        updatedAt: '2026-06-21 18:00'
      }
    ])
  })

  it('bills_tool_list should direct filter billDate when startDate equals endDate', async () => {
    const mockList = vi.fn().mockReturnValue([])
    const service = { list: mockList } as unknown as BillsService
    const tool = createBillListTool(service)

    await tool.execute({
      startDate: '2026-06-23',
      endDate: '2026-06-23'
    })

    expect(mockList).toHaveBeenCalledWith({
      billDate: '2026-06-23'
    })
  })
})

describe('billsTool summary', () => {
  it('bills_tool_summary should call todaySummary on service and format amounts', async () => {
    const mockSummary = vi.fn().mockReturnValue({
      expenseTotal: 3500,
      incomeTotal: 10000,
      recentItems: [
        {
          id: 1,
          amount: 3500,
          category: '餐饮',
          billType: 'expense',
          billDate: '2026-06-23',
          note: 'Feast',
          tags: [],
          createdAt: '2026-06-23 12:00',
          updatedAt: '2026-06-23 12:00'
        }
      ]
    })

    const service = { todaySummary: mockSummary } as unknown as BillsService
    const tool = createBillSummaryTool(service)

    const result = await tool.execute({
      date: '2026-06-23'
    })

    expect(mockSummary).toHaveBeenCalledWith('2026-06-23')
    expect(result.expenseTotal).toBe(3500)
    expect(result.incomeTotal).toBe(10000)
    expect(result.observation).toContain('35.00 元')
    expect(result.observation).toContain('100.00 元')
  })
})

describe('createBillsTools factory', () => {
  it('should return list and summary tools', () => {
    const service = {} as unknown as BillsService
    const tools = createBillsTools(service)

    expect(tools.map(t => t.name)).toEqual(['bills_tool_list', 'bills_tool_summary'])
  })
})
