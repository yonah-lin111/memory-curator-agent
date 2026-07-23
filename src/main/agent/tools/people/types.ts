import type { AgentTool, PeopleQueryToolResult } from "@/agent/types"

// People 查询工具类型。
export type PeopleQueryTool = Omit<AgentTool, "execute"> & {
  /**
   * 执行 People 查询。
   */
  execute: (input: unknown) => Promise<PeopleQueryToolResult>
}

// People 写入工具结果。
export type PeopleWriteToolResult = {
  // 回灌模型的观察文本。
  observation: string
  // 调试或 UI 可用结构化数据。
  data: unknown
}

// People 写入工具类型。
export type PeopleWriteTool = Omit<AgentTool, "execute"> & {
  /**
   * 执行 People 写入。
   */
  execute: (input: unknown) => Promise<PeopleWriteToolResult>
}

// People 写入动作。
export type PeopleWriteAction = "add" | "update" | "delete"

// People 数据库行类型。
export type PeopleSqlRow = Record<string, unknown>
