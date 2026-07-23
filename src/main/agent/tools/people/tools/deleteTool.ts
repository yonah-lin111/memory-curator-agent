import type { ToolConfirmationConfig } from "@/agent/tools/toolConfirmation"
import type { PeopleService } from "@/services/peopleService"
import type { PeopleWriteTool } from "../types"
import {
  isRecord,
  parseString,
  renderPeopleMutationCompletion,
  renderPeopleMutationSummary,
  renderPeopleMutationTarget,
} from "../utils"

/**
 * 解析 People 删除入参。
 */
const parseDeleteInput = (input: unknown): { id: string } => {
  if (!isRecord(input)) {
    throw new Error("People delete input must be an object")
  }

  const id = parseString(input.id)?.trim()
  if (!id) {
    throw new Error("People delete requires id")
  }

  return { id }
}

// People 删除确认配置。
const PEOPLE_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: "确认删除",
  question: "确认永久删除人物档案",
  confirm: "确认删除",
  cancel: "取消删除",
  renderTarget: renderPeopleMutationTarget,
  renderSummary: (input) => renderPeopleMutationSummary("delete", input),
  completion: {
    renderMessage: (input, result) =>
      renderPeopleMutationCompletion("delete", input, result as { data: unknown }),
  },
}

/**
 * 创建 People 删除工具。
 */
export const createPeopleDeleteTool = (
  peopleService: Pick<PeopleService, "delete">,
): PeopleWriteTool => ({
  name: "people_tool_delete",
  description: "Delete an existing people profile from the local People table by id.",
  confirmation: PEOPLE_DELETE_CONFIRMATION,
  prompt: {
    summary: "Delete an existing profile from the local People table by id.",
    intentKeywords: ["删除", "移除", "删掉", "delete person", "remove person"],
    whenToUse: [
      "Use when the user explicitly asks to delete a people profile.",
      "Use after people_tool_query when the user identifies a person by name or relationship instead of id, then delete the resolved profile id.",
    ],
    whenNotToUse: [
      "Do not use for temporary filtering or hiding.",
      "Do not use when the target profile id is unknown or ambiguous.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For deletion, confirmationSummary must identify the readable target and any key relationship or distinguishing facts known from query results; do not write only a generic delete sentence.",
      "Use human-readable names and relationships in confirmationSummary; do not use profile ids unless there is no readable target.",
      "Require the exact profile id.",
      "Ask the user for clarification before deleting when multiple profiles may match.",
    ],
    output:
      "Include confirmationSummary in the tool arguments with key deletion target facts; return a concise deletion confirmation.",
    examples: [
      '{"confirmationSummary":"将删除人物档案：**阿明**（朋友）。\\n- 这是本次查询确认到的目标人物","id":"person-1"}',
    ],
  },
  parameters: {
    type: "object",
    required: ["id"],
    properties: {
      id: {
        type: "string",
        description: "People profile id",
      },
    },
  },
  execute: async (input) => {
    const parsed = parseDeleteInput(input)
    peopleService.delete(parsed.id)

    return {
      observation: `Deleted people profile: ${parsed.id}.`,
      data: {
        id: parsed.id,
      },
    }
  },
})
