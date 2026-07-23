import type {
  BillTodaySummary,
  JournalItem,
  NoteMaterialItem,
  SnippetItem,
  TodoItem,
} from "@/db/schema"
import type { BillsService } from "@/services/billsService"
import type { JournalsService } from "@/services/journalsService"
import type { NotesService } from "@/services/notesService"
import type { SnippetsService } from "@/services/snippetsService"
import type { TodosService } from "@/services/todosService"

// 聚合数据结构
export type AggregatedDayData = {
  date: string
  todos: TodoItem[]
  snippets: SnippetItem[]
  journals: JournalItem[]
  bills: BillTodaySummary | null
  notes: NoteMaterialItem[]
}

// 依赖的聚合器服务最小集
export type AggregatorServiceContext = {
  todosService: Pick<TodosService, "listByDate">
  snippetsService: Pick<SnippetsService, "listByDate">
  journalsService: Pick<JournalsService, "get">
  billsService?: Pick<BillsService, "todaySummary">
  notesService?: Pick<NotesService, "querySql">
}

export type AggregatorService = {
  // 聚合单日全量数据
  getAggregatedDayData: (date: string) => AggregatedDayData
}

/**
 * 校验日期格式。
 */
const validateDate = (date: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("聚合日期格式不正确")
  }
}

/**
 * 创建 Aggregator 服务。
 * 组合多个业务 Service，统一提供聚合查询，减少外层（如 Agent Tool）手写 SQL 及拼装逻辑。
 */
export const createAggregatorService = (context: AggregatorServiceContext): AggregatorService => {
  return {
    getAggregatedDayData: (date) => {
      validateDate(date)

      // 1. 获取待办
      const todos = context.todosService.listByDate(date)

      // 2. 获取片段
      const snippets = context.snippetsService.listByDate(date)

      // 3. 获取日记 (单日仅一篇，此处规范为数组格式以备将来拓展)
      const journal = context.journalsService.get(date)
      const journals = journal ? [journal] : []

      // 4. 获取账单摘要
      let bills: BillTodaySummary | null = null
      if (context.billsService) {
        bills = context.billsService.todaySummary(date)
      }

      // 5. 获取笔记（通过 querySql 读取时间在当天的）
      let notes: NoteMaterialItem[] = []
      if (context.notesService) {
        try {
          const notesRows = context.notesService.querySql(
            `SELECT n.id, n.title, n.content, n.tags, n.time, n.category_id, nc.name AS category_name
             FROM notes n
             LEFT JOIN note_categories nc ON n.category_id = nc.id
             WHERE n.time LIKE '${date}%'
             ORDER BY n.time DESC`,
          ) as any[]

          notes = notesRows.map((r) => ({
            id: r.id,
            title: r.title,
            content: r.content,
            tags: r.tags ? (typeof r.tags === "string" ? JSON.parse(r.tags) : r.tags) : [],
            time: r.time,
            categoryId: r.category_id ?? undefined,
            categoryName: r.category_name ?? undefined,
          }))
        } catch (error) {
          console.warn("Failed to fetch notes for today aggregation", error)
        }
      }

      return {
        date,
        todos,
        snippets,
        journals,
        bills,
        notes,
      }
    },
  }
}
