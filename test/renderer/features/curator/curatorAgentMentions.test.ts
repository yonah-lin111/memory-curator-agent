import { describe, expect, it } from "vitest"
import {
  CURATOR_AGENT_MENTION_OPTIONS,
  createCuratorSendPayload,
  getCuratorAgentMentionDeletionRange,
  getMatchedCuratorAgentMentions,
  parseCuratorAgentMentionText,
} from "@/features/curator/curatorAgentMentions"

describe("curatorAgentMentions", () => {
  it("声明 8 个内置 agent/tool mention 选项", () => {
    expect(CURATOR_AGENT_MENTION_OPTIONS.map((option) => option.id)).toEqual([
      "people",
      "todo",
      "snippets",
      "journal",
      "notes",
      "today",
      "bills",
      "common",
    ])
    expect(CURATOR_AGENT_MENTION_OPTIONS.map((option) => option.token)).toEqual([
      "@people[tool]",
      "@todo[tool]",
      "@snippet[tool]",
      "@journal[tool]",
      "@note[tool]",
      "@today[tool]",
      "@bill[tool]",
      "@common[tool]",
    ])
  })

  it("按完整 token 提取 agent 并剥离用户正文", () => {
    const parsed = parseCuratorAgentMentionText("@people[tool]  查一下阿明 @todo[tool]")

    expect(parsed.text).toBe("查一下阿明")
    expect(parsed.agents).toEqual([
      {
        id: "people",
        token: "@people[tool]",
        label: "people",
        priority: 1,
      },
      {
        id: "todo",
        token: "@todo[tool]",
        label: "todo",
        priority: 2,
      },
    ])
  })

  it("重复 token 只按首次出现生成优先级", () => {
    const parsed = parseCuratorAgentMentionText("@todo[tool] 做计划 @people[tool] @todo[tool]")

    expect(parsed.text).toBe("做计划")
    expect(parsed.agents.map((agent) => `${agent.priority}:${agent.id}`)).toEqual([
      "1:todo",
      "2:people",
    ])
  })

  it("不把邮箱和不完整 token 当成 agent", () => {
    const parsed = parseCuratorAgentMentionText("发到 a@people[tool].com，并看看 @people")

    expect(parsed.text).toBe("发到 a@people[tool].com，并看看 @people")
    expect(parsed.agents).toEqual([])
  })

  it("支持 agent 面板模糊匹配", () => {
    expect(getMatchedCuratorAgentMentions("").map((option) => option.id)).toHaveLength(8)
    expect(getMatchedCuratorAgentMentions("pe").map((option) => option.id)).toEqual([
      "people",
      "snippets",
    ])
    expect(getMatchedCuratorAgentMentions("peo").map((option) => option.id)).toEqual([
      "people",
      "snippets",
    ])
    expect(getMatchedCuratorAgentMentions("people").map((option) => option.id)).toEqual(["people"])
    expect(getMatchedCuratorAgentMentions("people[tool]").map((option) => option.id)).toEqual([
      "people",
    ])
    expect(getMatchedCuratorAgentMentions("eo").map((option) => option.id)).toEqual([
      "people",
      "snippets",
      "notes",
    ])
    expect(getMatchedCuratorAgentMentions("ty").map((option) => option.id)).toEqual(["today"])
    expect(getMatchedCuratorAgentMentions("todo").map((option) => option.id)).toEqual([
      "todo",
      "today",
    ])
    expect(getMatchedCuratorAgentMentions("bi").map((option) => option.id)).toEqual(["bills"])
    expect(getMatchedCuratorAgentMentions("co").map((option) => option.id)).toEqual(["common"])
  })

  it("计算 Backspace 删除完整 token 的范围", () => {
    const value = "@people[tool] 查阿明"

    expect(getCuratorAgentMentionDeletionRange(value, "@people[tool]".length)).toEqual({
      start: 0,
      end: "@people[tool]".length,
    })
    expect(getCuratorAgentMentionDeletionRange(value, "@people[tool] ".length)).toEqual({
      start: 0,
      end: "@people[tool] ".length,
    })
    expect(getCuratorAgentMentionDeletionRange(value, 3)).toBeNull()
  })

  it("创建发送 payload 时只保留干净正文和 agent 元数据", () => {
    expect(createCuratorSendPayload("@people[tool] @todo[tool] 查阿明")).toEqual({
      text: "查阿明",
      agents: [
        {
          id: "people",
          token: "@people[tool]",
          label: "people",
          priority: 1,
        },
        {
          id: "todo",
          token: "@todo[tool]",
          label: "todo",
          priority: 2,
        },
      ],
    })
  })

  it("支持并正确解析单复数以及同义词形式的 tool 提及", () => {
    const parsed1 = parseCuratorAgentMentionText("记录支出 @bill[tool]")
    expect(parsed1.text).toBe("记录支出")
    expect(parsed1.agents).toEqual([
      {
        id: "bills",
        token: "@bill[tool]",
        label: "bill",
        priority: 1,
      },
    ])

    const parsed2 = parseCuratorAgentMentionText("记录支出 @bills[tool]")
    expect(parsed2.text).toBe("记录支出")
    expect(parsed2.agents).toEqual([
      {
        id: "bills",
        token: "@bill[tool]",
        label: "bill",
        priority: 1,
      },
    ])

    const parsed3 = parseCuratorAgentMentionText("捕捉灵感 @snippets[tool]")
    expect(parsed3.text).toBe("捕捉灵感")
    expect(parsed3.agents).toEqual([
      {
        id: "snippets",
        token: "@snippet[tool]",
        label: "snippet",
        priority: 1,
      },
    ])

    const parsed4 = parseCuratorAgentMentionText("找人 @person[tool]")
    expect(parsed4.text).toBe("找人")
    expect(parsed4.agents).toEqual([
      {
        id: "people",
        token: "@people[tool]",
        label: "people",
        priority: 1,
      },
    ])
  })
})
