import type {
  DayData,
  JournalItem,
  JournalSaveInput,
  MonthEntryOverview,
  MonthOverview,
  SnippetCreateInput,
  SnippetItem,
  SnippetUpdateInput,
  TodoCreateInput,
  TodoItem,
  TodoReorderInput,
  TodoUpdateInput,
} from "@/db/schema"
import { createJournalsService } from "@/services/journalsService"
import { createSnippetsService } from "@/services/snippetsService"
import { createTodosService } from "@/services/todosService"

// 数据库语句接口。
export type DatabaseStatement = {
  // 执行查询并返回全部行。
  all: (...values: unknown[]) => unknown[]
  // 执行查询并返回单行。
  get: (...values: unknown[]) => unknown
  // 执行写入语句。
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// Daily 服务依赖的最小数据库接口。
export type DatabaseConnection = {
  // 准备 SQL 语句。
  prepare: (sql: string) => DatabaseStatement
}

// Daily 服务方法集合。
export type DailyService = {
  // 读取单日数据。
  listDay: (entryDate: string) => DayData
  // 读取指定月份的概览。
  listMonthOverview: (month: string) => MonthOverview
  // 保存日记。
  saveJournal: (input: JournalSaveInput) => JournalItem
  // 删除日记。
  deleteJournal: (entryDate: string) => void
  // 创建待办。
  createTodo: (input: TodoCreateInput) => TodoItem
  // 更新待办。
  updateTodo: (id: number, input: TodoUpdateInput) => TodoItem
  // 删除待办。
  deleteTodo: (id: number) => void
  // 重新排序待办。
  reorderTodos: (input: TodoReorderInput) => TodoItem[]
  // 创建片段。
  createSnippet: (input: SnippetCreateInput) => SnippetItem
  // 更新片段。
  updateSnippet: (id: number, input: SnippetUpdateInput) => SnippetItem
  // 删除片段。
  deleteSnippet: (id: number) => void
}

/**
 * 校验日期格式。
 */
const validateEntryDate = (entryDate: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    throw new Error("工作台日期格式不正确")
  }
}

/**
 * 校验月份格式。
 */
const validateEntryMonth = (month: string): void => {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("工作台月份格式不正确")
  }
}

// SQL 聚合行类型。
type CountRow = {
  // 聚合所属日期。
  entry_date: string
  // 聚合数量。
  item_count: number
}

/**
 * 创建 Daily 服务。
 */
export const createDailyService = (database: DatabaseConnection): DailyService => {
  const todosService = createTodosService(database)
  const snippetsService = createSnippetsService(database)
  const journalsService = createJournalsService(database)

  return {
    listDay: (entryDate) => {
      validateEntryDate(entryDate)

      return {
        todos: todosService.listByDate(entryDate),
        snippets: snippetsService.listByDate(entryDate),
        journal: journalsService.get(entryDate),
      }
    },
    listMonthOverview: (month) => {
      validateEntryMonth(month)

      // 月份前缀查询条件。
      const monthPattern = `${month}-%`
      // 按日期聚合的概览映射。
      const overviewMap = new Map<string, MonthEntryOverview>()
      // 统一写入聚合计数，避免三类记录合并逻辑重复。
      const applyCountRows = (
        rows: CountRow[],
        field: "todoCount" | "snippetCount" | "journalCount",
      ): void => {
        rows.forEach((row) => {
          const currentItem = overviewMap.get(row.entry_date) ?? {
            entryDate: row.entry_date,
            todoCount: 0,
            snippetCount: 0,
            journalCount: 0,
          }
          overviewMap.set(row.entry_date, {
            ...currentItem,
            [field]: row.item_count,
          })
        })
      }

      applyCountRows(
        database
          .prepare(
            "SELECT entry_date, COUNT(*) AS item_count FROM todos WHERE entry_date LIKE ? GROUP BY entry_date",
          )
          .all(monthPattern) as CountRow[],
        "todoCount",
      )
      applyCountRows(
        database
          .prepare(
            "SELECT entry_date, COUNT(*) AS item_count FROM snippets WHERE entry_date LIKE ? GROUP BY entry_date",
          )
          .all(monthPattern) as CountRow[],
        "snippetCount",
      )
      applyCountRows(
        database
          .prepare(
            "SELECT entry_date, COUNT(*) AS item_count FROM journals WHERE entry_date LIKE ? GROUP BY entry_date",
          )
          .all(monthPattern) as CountRow[],
        "journalCount",
      )

      return {
        month,
        entries: [...overviewMap.values()].sort((left, right) =>
          left.entryDate.localeCompare(right.entryDate),
        ),
      }
    },
    saveJournal: (input) => journalsService.save(input),
    deleteJournal: (entryDate) => journalsService.delete(entryDate),
    createTodo: (input) => todosService.create(input),
    updateTodo: (id, input) => todosService.update(id, input),
    deleteTodo: (id) => todosService.delete(id),
    reorderTodos: (input) => todosService.reorder(input),
    createSnippet: (input) => snippetsService.create(input),
    updateSnippet: (id, input) => snippetsService.update(id, input),
    deleteSnippet: (id) => snippetsService.delete(id),
  }
}
