import { describe, expect, it } from "vitest"
import { isPromptChangeCommand } from "@/features/prompt-design/lib/promptCommand"

describe("promptCommand", () => {
  it("design[] 默认可执行且不再接受 -change", () => {
    expect(isPromptChangeCommand("/new design[首页]")).toBe(true)
    expect(isPromptChangeCommand("/new design[首页] -change")).toBe(false)
  })
})
