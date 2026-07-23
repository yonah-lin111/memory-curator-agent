import type { AgentTool } from "@/agent/types"
import type { PeopleService } from "@/services/peopleService"
import { createPeopleAddTool } from "./tools/addTool"
import { createPeopleBatchAddTool } from "./tools/batchAddTool"
import { createPeopleBatchDeleteTool } from "./tools/batchDeleteTool"
import { createPeopleBatchUpdateTool } from "./tools/batchUpdateTool"
import { createPeopleDeleteTool } from "./tools/deleteTool"
import { createPeopleQueryTool } from "./tools/queryTool"
import { createPeopleUpdateTool } from "./tools/updateTool"

export type * from "./types"

export {
  createPeopleAddTool,
  createPeopleBatchAddTool,
  createPeopleBatchDeleteTool,
  createPeopleBatchUpdateTool,
  createPeopleDeleteTool,
  createPeopleQueryTool,
  createPeopleUpdateTool,
}

/**
 * 创建完整 People 工具组。
 */
export const createPeopleTools = (
  peopleService: Pick<PeopleService, "querySql" | "create" | "update" | "delete">,
): AgentTool[] => [
  createPeopleQueryTool(peopleService),
  createPeopleAddTool(peopleService),
  createPeopleUpdateTool(peopleService),
  createPeopleDeleteTool(peopleService),
  createPeopleBatchAddTool(peopleService),
  createPeopleBatchUpdateTool(peopleService),
  createPeopleBatchDeleteTool(peopleService),
]
