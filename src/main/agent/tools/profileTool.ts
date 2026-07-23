import type { ToolConfirmationConfig } from "@/agent/tools/toolConfirmation"
import type { AgentTool } from "@/agent/types"
import type { PersonalProfileItem, PersonalProfileUpdateInput } from "@/db/schema"
import { createProfile, getProfile, updateProfilePartial } from "@/services/profileService"

// 个人信息可写字段。
const PROFILE_FIELDS = [
  "avatar",
  "name",
  "gender",
  "status",
  "birthday",
  "contact",
  "tags",
  "details",
] as const

// 个人信息工具入参。
type ProfileToolInput = Partial<PersonalProfileUpdateInput> & {
  confirmationSummary?: string
}

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

/**
 * 解析个人信息工具入参，仅保留明确提供的合法字段。
 */
const parseProfileInput = (
  input: unknown,
  options: { requireName: boolean; requireChange: boolean },
): ProfileToolInput => {
  if (!isRecord(input)) {
    throw new Error("个人信息工具入参必须为对象")
  }

  const parsed: ProfileToolInput = {}
  for (const field of PROFILE_FIELDS) {
    const value = input[field]
    if (value === undefined) continue

    if (field === "tags") {
      if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
        throw new Error("tags 必须为字符串数组")
      }
      parsed.tags = value
      continue
    }

    if (typeof value !== "string") {
      throw new Error(`${field} 必须为字符串`)
    }
    parsed[field] = value
  }

  if (options.requireName && !parsed.name?.trim()) {
    throw new Error("创建个人信息档案需要 name")
  }
  if (options.requireChange && PROFILE_FIELDS.every((field) => parsed[field] === undefined)) {
    throw new Error("至少需要提供一个待更新字段")
  }

  return parsed
}

/**
 * 转换个人信息为安全的工具返回数据。
 */
const toToolItem = (profile: PersonalProfileItem) => ({
  name: profile.name,
  gender: profile.gender,
  status: profile.status,
  birthday: profile.birthday,
  contact: profile.contact,
  tags: profile.tags,
  details: profile.details,
  updatedAt: profile.updatedAt,
})

/**
 * 生成个人信息写入确认中的目标名称。
 */
const renderTarget = (input: unknown): string | null => {
  if (!isRecord(input)) return null
  return typeof input.name === "string" && input.name.trim() ? input.name.trim() : "个人信息档案"
}

/**
 * 生成个人信息写入确认说明。
 */
const renderSummary = (action: "create" | "update", input: unknown): string | null => {
  if (!isRecord(input)) return null
  if (typeof input.confirmationSummary === "string" && input.confirmationSummary.trim()) {
    return input.confirmationSummary.trim()
  }

  const fields = PROFILE_FIELDS.filter((field) => input[field] !== undefined)
  if (!fields.length) return null

  return action === "create"
    ? `将创建个人信息档案：${typeof input.name === "string" ? input.name : "未命名"}。`
    : `将更新个人信息：${fields.join("、")}。`
}

/**
 * 创建个人信息写入确认配置。
 */
const createConfirmation = (action: "create" | "update"): ToolConfirmationConfig => ({
  header: action === "create" ? "确认创建" : "确认更新",
  question: action === "create" ? "确认创建个人信息档案" : "确认更新个人信息档案",
  confirm: action === "create" ? "确认创建" : "确认更新",
  cancel: action === "create" ? "取消创建" : "取消更新",
  renderTarget,
  renderSummary: (input) => renderSummary(action, input),
  completion: {
    renderMessage: (_input, result) => {
      const item = isRecord(result.data) && isRecord(result.data.item) ? result.data.item : null
      const name = item && typeof item.name === "string" ? item.name : "个人信息档案"
      return action === "create" ? `已创建个人信息档案：${name}。` : `已更新个人信息档案：${name}。`
    },
  },
})

/**
 * 创建个人信息相关的查询、创建与更新工具。
 */
export const createProfileTools = (): AgentTool[] => [
  {
    name: "profile_tool_query",
    description: "Read the local personal profile.",
    prompt: {
      summary: "Read the current user personal profile.",
      whenToUse: [
        "Use when the user asks about their saved personal information or when facts are needed before a profile update.",
      ],
      whenNotToUse: ["Do not use to modify personal information."],
      safety: ["Never invent personal facts that are not returned by this tool."],
    },
    parameters: { type: "object", properties: {} },
    execute: async () => {
      const profile = getProfile()
      return {
        observation: profile ? "Read personal profile." : "No personal profile exists.",
        data: { item: profile ? toToolItem(profile) : null },
      }
    },
  },
  {
    name: "profile_tool_create",
    description: "Create the local personal profile when none exists.",
    confirmation: createConfirmation("create"),
    prompt: {
      summary: "Create the current user personal profile.",
      whenToUse: [
        "Use only when the user explicitly asks to create or save their personal profile and no profile exists.",
      ],
      whenNotToUse: [
        "Do not use when a personal profile already exists; use profile_tool_update for changes.",
        "Do not use to delete personal information.",
      ],
      safety: [
        "The system will request internal confirmation before writing.",
        "Require name and never invent profile facts.",
        "Include confirmationSummary with the name and key facts being created.",
      ],
    },
    parameters: {
      type: "object",
      required: ["name"],
      properties: {
        confirmationSummary: {
          type: "string",
          description: "Concise Markdown Chinese summary shown in the confirmation.",
        },
        avatar: { type: "string", description: "Avatar URI." },
        name: { type: "string", description: "User name." },
        gender: { type: "string", description: "Gender text." },
        status: { type: "string", description: "Short status." },
        birthday: { type: "string", description: "Birthday text." },
        contact: { type: "string", description: "Contact details." },
        tags: { type: "array", items: { type: "string" }, description: "Personal tags." },
        details: { type: "string", description: "Personal details in Markdown." },
      },
    },
    execute: async (input) => {
      const parsed = parseProfileInput(input, { requireName: true, requireChange: false })
      const created = createProfile({
        avatar: parsed.avatar ?? "",
        name: parsed.name!,
        gender: parsed.gender ?? "",
        status: parsed.status ?? "",
        birthday: parsed.birthday ?? "",
        contact: parsed.contact ?? "",
        tags: parsed.tags ?? [],
        details: parsed.details ?? "",
      })
      return {
        observation: `Created personal profile: ${created.name}.`,
        data: { item: toToolItem(created) },
      }
    },
  },
  {
    name: "profile_tool_update",
    description: "Partially update the local personal profile, creating it when absent.",
    confirmation: createConfirmation("update"),
    prompt: {
      summary: "Partially update the current user personal profile.",
      whenToUse: [
        "Use when the user explicitly asks to change, correct, or add saved personal information.",
      ],
      whenNotToUse: [
        "Do not use to delete or clear the profile.",
        "Do not use when the user did not request saving changes.",
      ],
      safety: [
        "The system will request internal confirmation before writing.",
        "Only provide fields explicitly requested by the user; omitted fields remain unchanged.",
        "When no profile exists, name is required to create one.",
        "Include confirmationSummary with the fields and facts being changed.",
      ],
    },
    parameters: {
      type: "object",
      properties: {
        confirmationSummary: {
          type: "string",
          description: "Concise Markdown Chinese summary shown in the confirmation.",
        },
        avatar: { type: "string", description: "Avatar URI." },
        name: { type: "string", description: "User name." },
        gender: { type: "string", description: "Gender text." },
        status: { type: "string", description: "Short status." },
        birthday: { type: "string", description: "Birthday text." },
        contact: { type: "string", description: "Contact details." },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Complete personal tags to retain.",
        },
        details: { type: "string", description: "Personal details in Markdown." },
      },
    },
    execute: async (input) => {
      const parsed = parseProfileInput(input, { requireName: false, requireChange: true })
      const updated = updateProfilePartial(parsed)
      return {
        observation: `Updated personal profile: ${updated.name}.`,
        data: { item: toToolItem(updated) },
      }
    },
  },
]
