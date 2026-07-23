import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"

import { createPromptEditorTools } from "@/agent/tools/promptEditorTools"

type ToolResult = {
  observation: string
  data: {
    content: string
    documentHash: string
    lines?: { number: number; content: string }[]
    version?: number
    baseVersion: number
    nextVersion: number
    applied: boolean
  }
}

/**
 * 按名称找到工具并统一执行，避免测试耦合 AgentTool 的其他字段。
 */
const executeTool = async (
  name: string,
  tools: ReturnType<typeof createPromptEditorTools>,
  input: unknown = {},
): Promise<ToolResult> => {
  const tool = tools.find((item) => item.name === name)
  if (!tool) throw new Error(`Tool ${name} not found`)
  return tool.execute(input) as Promise<ToolResult>
}

describe("prompt editor tools", () => {
  it("inserts with exact anchors and requires a new read before another write", async () => {
    let document = { content: "one\ntwo", version: 7 }
    const tools = createPromptEditorTools({
      readDocument: async () => document,
      applyDocument: async (candidate) => {
        document = { content: candidate.content, version: candidate.version + 1 }
        return document
      },
    })

    await executeTool("prompt_editor_read", tools)
    const inserted = await executeTool("prompt_editor_insert_lines", tools, {
      documentVersion: 7,
      afterLine: 1,
      content: "middle",
      expectedBeforeLine: "one",
      expectedAfterLine: "two",
    })
    expect(inserted.data).toMatchObject({
      content: "one\nmiddle\ntwo",
      nextVersion: 8,
      applied: true,
    })

    const staleWrite = await executeTool("prompt_editor_delete_lines", tools, {
      documentVersion: 8,
      startLine: 1,
      expectedDocumentHash: inserted.data.documentHash,
    })
    expect(staleWrite.data.applied).toBe(false)
    expect(staleWrite.data.content).toBe("")
  })

  it("uses a unique anchor match when afterLine is off by one", async () => {
    let document = { content: "one\ntwo\nthree", version: 1 }
    const tools = createPromptEditorTools({
      readDocument: async () => document,
      applyDocument: async (candidate) => {
        document = { content: candidate.content, version: candidate.version + 1 }
        return document
      },
    })

    await executeTool("prompt_editor_read", tools)
    const result = await executeTool("prompt_editor_insert_lines", tools, {
      documentVersion: 1,
      afterLine: 0,
      content: "middle",
      expectedBeforeLine: "one",
      expectedAfterLine: "two",
    })
    expect(result.data).toMatchObject({
      content: "one\nmiddle\ntwo\nthree",
      nextVersion: 2,
      applied: true,
    })
  })

  it("inserts into an empty document with empty boundary anchors", async () => {
    let document = { content: "", version: 1 }
    const tools = createPromptEditorTools({
      readDocument: async () => document,
      applyDocument: async (candidate) => {
        document = { content: candidate.content, version: candidate.version + 1 }
        return document
      },
    })

    await executeTool("prompt_editor_read", tools)
    const result = await executeTool("prompt_editor_insert_lines", tools, {
      documentVersion: 1,
      afterLine: 0,
      content: "first line",
      expectedBeforeLine: "",
      expectedAfterLine: "",
    })
    expect(result.data).toMatchObject({ content: "first line", nextVersion: 2, applied: true })
  })

  it("rejects insertion when adjacent anchors match multiple boundaries", async () => {
    const tools = createPromptEditorTools({
      readDocument: async () => ({ content: "one\ntwo\none\ntwo", version: 1 }),
      applyDocument: async () => ({ content: "", version: 2 }),
    })

    await executeTool("prompt_editor_read", tools)
    const result = await executeTool("prompt_editor_insert_lines", tools, {
      documentVersion: 1,
      afterLine: 1,
      content: "middle",
      expectedBeforeLine: "one",
      expectedAfterLine: "two",
    })
    expect(result.data.applied).toBe(false)
    expect(result.observation).toContain("requested afterLine 1")
    expect(result.observation).toContain("match 2 insertion boundaries")
  })

  it("requires the latest document hash for line replacements", async () => {
    let document = { content: "first\nsecond", version: 1 }
    const tools = createPromptEditorTools({
      readDocument: async () => document,
      applyDocument: async (candidate) => {
        document = { content: candidate.content, version: candidate.version + 1 }
        return document
      },
    })

    const firstRead = await executeTool("prompt_editor_read", tools)
    expect(firstRead.data.lines).toEqual([
      { number: 1, content: "first" },
      { number: 2, content: "second" },
    ])
    await executeTool("prompt_editor_replace_lines", tools, {
      documentVersion: 1,
      startLine: 2,
      content: "accepted",
      expectedDocumentHash: firstRead.data.documentHash,
    })

    const secondRead = await executeTool("prompt_editor_read", tools)
    const staleHashResult = await executeTool("prompt_editor_replace_lines", tools, {
      documentVersion: secondRead.data.nextVersion,
      startLine: 2,
      content: "should not apply",
      expectedDocumentHash: firstRead.data.documentHash,
    })
    expect(staleHashResult.data.applied).toBe(false)
    expect(staleHashResult.observation).toContain(
      "expectedDocumentHash does not match the latest read",
    )

    const result = await executeTool("prompt_editor_replace_lines", tools, {
      documentVersion: secondRead.data.nextVersion,
      startLine: 2,
      content: "updated again",
      expectedDocumentHash: secondRead.data.documentHash,
    })
    expect(result.data).toMatchObject({
      content: "first\nupdated again",
      nextVersion: 3,
      applied: true,
    })
  })

  it("rejects replacing every line of a non-empty document with replace_lines", async () => {
    const tools = createPromptEditorTools({
      readDocument: async () => ({ content: "one\ntwo", version: 1 }),
      applyDocument: async () => ({ content: "", version: 2 }),
    })

    const read = await executeTool("prompt_editor_read", tools)
    const result = await executeTool("prompt_editor_replace_lines", tools, {
      documentVersion: read.data.nextVersion,
      startLine: 1,
      endLine: 2,
      content: "rewritten",
      expectedDocumentHash: read.data.documentHash,
    })
    expect(result.data.applied).toBe(false)
    expect(result.observation).toContain("use prompt_editor_replace instead")
  })

  it("requires the exact document hash for a full replacement", async () => {
    let document = { content: "one", version: 1 }
    const initialHash = createHash("sha256").update(document.content).digest("hex")
    const tools = createPromptEditorTools({
      readDocument: async () => document,
      applyDocument: async (candidate) => {
        document = { content: candidate.content, version: candidate.version + 1 }
        return document
      },
    })

    const initialRead = await executeTool("prompt_editor_read", tools)
    expect(initialRead.data.documentHash).toBe(initialHash)
    const result = await executeTool("prompt_editor_replace", tools, {
      documentVersion: 1,
      content: "rewritten",
      expectedDocumentHash: initialRead.data.documentHash,
      allowFullRewrite: true,
    })
    expect(result.data).toMatchObject({ content: "rewritten", nextVersion: 2, applied: true })

    const latestRead = await executeTool("prompt_editor_read", tools)
    const staleHashResult = await executeTool("prompt_editor_replace", tools, {
      documentVersion: latestRead.data.nextVersion,
      content: "should not apply",
      expectedDocumentHash: initialRead.data.documentHash,
      allowFullRewrite: true,
    })
    expect(staleHashResult.data.applied).toBe(false)
    expect(staleHashResult.observation).toContain(
      "expectedDocumentHash does not match the latest read",
    )
  })
})
