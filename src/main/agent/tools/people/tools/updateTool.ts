import type { ToolConfirmationConfig } from "@/agent/tools/toolConfirmation"
import type { AssociatedPersonUpdateInput } from "@/db/schema"
import type { PeopleService } from "@/services/peopleService"
import { PEOPLE_PROFILE_PROPERTIES, PEOPLE_PROFILE_REQUIRED } from "../constants"
import type { PeopleWriteTool } from "../types"
import {
  isRecord,
  parsePersonProfileInput,
  parseString,
  renderPeopleMutationCompletion,
  renderPeopleMutationSummary,
  renderPeopleMutationTarget,
  toToolItem,
} from "../utils"

/**
 * 解析 People 更新入参。
 */
const parseUpdateInput = (input: unknown): { id: string; profile: AssociatedPersonUpdateInput } => {
  if (!isRecord(input)) {
    throw new Error("People update input must be an object")
  }

  const id = parseString(input.id)?.trim()
  if (!id) {
    throw new Error("People update requires id")
  }

  return {
    id,
    profile: parsePersonProfileInput(input as Record<string, unknown>),
  }
}

// People 更新确认配置。
const PEOPLE_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: "确认更新",
  question: "确认更新人物档案",
  confirm: "确认更新",
  cancel: "取消更新",
  renderTarget: renderPeopleMutationTarget,
  renderSummary: (input) => renderPeopleMutationSummary("update", input),
  completion: {
    renderMessage: (input, result) =>
      renderPeopleMutationCompletion("update", input, result as { data: unknown }),
  },
}

/**
 * 创建 People 更新工具。
 */
export const createPeopleUpdateTool = (
  peopleService: Pick<PeopleService, "update">,
): PeopleWriteTool => ({
  name: "people_tool_update",
  description: "Update an existing people profile in the local People table by id.",
  confirmation: PEOPLE_UPDATE_CONFIRMATION,
  prompt: {
    summary: "Update an existing profile in the local People table by id.",
    intentKeywords: ["修改", "更新", "改成", "纠正", "补充人物", "update person", "edit person"],
    whenToUse: [
      "Use when the user explicitly asks to update an existing people profile.",
      "Use after people_tool_query when the user identifies a person by name or relationship instead of id, then update the resolved profile id.",
    ],
    whenNotToUse: [
      "Do not use for creating new people profiles.",
      "Do not use when the user only states a fact or preference and has not explicitly asked to update saved data.",
      "Do not use when the target profile id is unknown.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm updates; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For updates, confirmationSummary must name the target and list the key fields or facts that will change; do not write only a generic update sentence.",
      "Use human-readable names, relationships, and changed fields in confirmationSummary; do not use profile ids unless there is no readable target.",
      "Require the profile id and a complete replacement profile.",
      "Query first when the user only provides a name, then merge unchanged fields before updating.",
      "Never overwrite fields with guesses.",
    ],
    output:
      "Include confirmationSummary in the tool arguments with key changed fields; return the updated people profile facts needed by the user.",
    examples: [
      '{"confirmationSummary":"将更新 **阿明** 的人物档案。\\n- 状态：技术负责人\\n- 联系方式：GitHub: aming-coder","id":"person-1","name":"阿明","gender":"男","relationship":"朋友","status":"技术负责人","birthday":"09月11日","contact":"GitHub: aming-coder","tags":["极客"],"details":"# 阿明","avatar":""}',
    ],
  },
  parameters: {
    type: "object",
    required: ["id", ...PEOPLE_PROFILE_REQUIRED],
    properties: {
      id: {
        type: "string",
        description: "People profile id",
      },
      ...PEOPLE_PROFILE_PROPERTIES,
    },
  },
  execute: async (input) => {
    const parsed = parseUpdateInput(input)
    const updated = peopleService.update(parsed.id, parsed.profile)

    return {
      observation: `Updated people profile: ${updated.name}.`,
      data: {
        item: toToolItem(updated),
      },
    }
  },
})
