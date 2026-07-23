import type { ToolConfirmationConfig } from "@/agent/tools/toolConfirmation"
import type { PeopleService } from "@/services/peopleService"
import { PEOPLE_PROFILE_PROPERTIES, PEOPLE_PROFILE_REQUIRED } from "../constants"
import type { PeopleWriteTool } from "../types"
import { getPeopleInputString, isRecord, parsePersonProfileInput, toToolItem } from "../utils"

// People 批量创建确认配置。
const PEOPLE_BATCH_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: "批量确认创建",
  question: "确认批量创建人物档案",
  confirm: "确认创建",
  cancel: "取消创建",
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const items = Array.isArray(input.items) ? input.items : []
    return `${items.length} 项人物`
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null
    const aiSummary = getPeopleInputString(input, "confirmationSummary")
    if (aiSummary) return aiSummary
    const items = Array.isArray(input.items) ? input.items : []
    if (items.length === 0) return null
    const previews = (items as unknown[])
      .slice(0, 3)
      .map((item) => {
        if (!isRecord(item)) return null
        const name = getPeopleInputString(item, "name")
        const relationship = getPeopleInputString(item, "relationship")
        return name ? `${name}${relationship ? `（${relationship}）` : ""}` : null
      })
      .filter((p): p is string => Boolean(p))
    const suffix = items.length > 3 ? ` 等 ${items.length} 项` : ""
    return `将批量创建人物档案：${previews.join("、")}${suffix}。`
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null
      const count = (result.data as { count?: unknown }).count
      return typeof count === "number" ? `已批量创建 ${count} 项人物档案。` : "已批量创建人物档案。"
    },
  },
}

/**
 * 创建 People 批量新建工具。
 */
export const createPeopleBatchAddTool = (
  peopleService: Pick<PeopleService, "create">,
): PeopleWriteTool => ({
  name: "people_tool_batch_add",
  description: "Create multiple people profiles at once in the local People table.",
  confirmation: PEOPLE_BATCH_ADD_CONFIRMATION,
  prompt: {
    summary: "Batch create multiple profiles in the local People table.",
    intentKeywords: [
      "批量添加",
      "批量创建",
      "批量新增",
      "批量记录人物",
      "batch add people",
      "batch create profiles",
    ],
    whenToUse: [
      "Use when the user explicitly asks to create multiple people profiles at once.",
      "Use when the user lists several people separated by newlines, commas, or bullet points.",
      "Use when batch creation is more efficient than calling the single-add tool multiple times.",
      "Use common_tool_ask to ask for missing required facts when any batch item is underspecified.",
    ],
    whenNotToUse: [
      "Do not use for creating a single profile — use people_tool_add instead.",
      "Do not use for read-only questions about existing profiles.",
      "Do not use when the user has not asked to save data.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For batch creation, confirmationSummary must summarize the items being created (count, key names and relationships).",
      "Each item must include the full profile: avatar, name, gender, relationship, status, birthday, contact, tags, details.",
      "Use empty strings for absent optional fields.",
      "Never invent profile facts the user did not provide or confirm.",
    ],
    output:
      "Include confirmationSummary in the tool arguments; return count and created profile facts needed by the user.",
    examples: [
      '{"confirmationSummary":"将批量创建 2 项人物档案。\\n- 小陈（朋友）\\n- 阿明（同事）","items":[{"avatar":"","name":"小陈","gender":"","relationship":"朋友","status":"","birthday":"","contact":"","tags":[],"details":""},{"avatar":"","name":"阿明","gender":"男","relationship":"同事","status":"技术负责人","birthday":"","contact":"","tags":["极客"],"details":""}]}',
    ],
  },
  parameters: {
    type: "object",
    required: ["items", "confirmationSummary"],
    properties: {
      confirmationSummary: {
        type: "string",
        description:
          "Concise Markdown Chinese explanation shown above the internal confirmation. List all items or summarize with count and key facts.",
      },
      items: {
        type: "array",
        description: "Array of people profiles to create",
        items: {
          type: "object",
          required: PEOPLE_PROFILE_REQUIRED,
          properties: PEOPLE_PROFILE_PROPERTIES,
        },
      },
    },
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.items)) {
      throw new Error("People batch create requires items array")
    }

    const results = (input.items as unknown[]).map((item) => {
      const created = peopleService.create(parsePersonProfileInput(item as Record<string, unknown>))
      return toToolItem(created)
    })

    return {
      observation: `Batch created ${results.length} people profiles.`,
      data: { items: results, count: results.length },
    }
  },
})
