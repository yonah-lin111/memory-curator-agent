import type { AgentToolRegistryContext } from "@/agent/tools/toolRegistry"
import type { AgentTool, AgentToolResult } from "@/agent/types"

// Today 查询工具入参
type TodayQueryToolInput = {
  date?: string
}

// 格式化日期为 YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

/**
 * 解析入参。
 */
const parseInput = (input: unknown): TodayQueryToolInput => {
  if (!isRecord(input)) return {}
  return {
    date: typeof input.date === "string" ? input.date : undefined,
  }
}

/**
 * 创建 Today 工具。
 */
export const createTodayTool = (context: AgentToolRegistryContext): AgentTool => ({
  name: "today_tool_summary",
  description:
    "Query and summarize today's (or a specific date's) todos, snippets, journals, and bills in one go.",
  prompt: {
    summary:
      "Query all records for a specific date (defaults to today) across todos, snippets, journals, and bills.",
    intentKeywords: [
      "今天",
      "今日",
      "today",
      "今天的总结",
      "今天的待办",
      "今天的日记",
      "这天",
      "那一天",
      "这一天",
    ],
    whenToUse: [
      "Use when the user asks for a summary of today.",
      "Use when the user asks to write a journal based on today's todos, snippets, and bills.",
      "Use when the user asks for what happened on a specific date (todos, snippets, journals, bills).",
    ],
    whenNotToUse: ["Do not use to write data. This tool is read-only."],
    safety: ["Read only. Never modifies data."],
    output:
      "Returns a comprehensive object containing todos, snippets, journal, and bills for the specified date.",
    examples: ["{}", '{"date":"2026-06-30"}'],
  },
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "The date to query in YYYY-MM-DD format. Defaults to today if not provided.",
      },
    },
  },
  execute: async (input): Promise<AgentToolResult> => {
    const parsed = parseInput(input)
    let targetDate = parsed.date?.trim() || formatDate(new Date())

    // 简单校验日期格式防止 SQL 注入
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      targetDate = formatDate(new Date())
    }

    if (!context.aggregatorService) {
      throw new Error("Aggregator service is not available.")
    }

    const aggregatedData = context.aggregatorService.getAggregatedDayData(targetDate)

    return {
      observation: `Queried records for ${targetDate}. Found ${aggregatedData.todos.length} todos, ${aggregatedData.snippets.length} snippets, ${aggregatedData.journals.length} journals, ${aggregatedData.notes.length} notes, and bills data.`,
      data: aggregatedData,
    }
  },
})
