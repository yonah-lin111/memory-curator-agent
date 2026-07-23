import { describe, expect, it, vi } from "vitest"
import {
  createSnippetAddTool,
  createSnippetDeleteTool,
  createSnippetQueryTool,
  createSnippetTools,
  createSnippetUpdateTool,
} from "@/agent/tools/snippetTool"
import type { SnippetsService } from "@/services/snippetsService"

describe("snippetTool_query", () => {
  it("support raw SQL select queries on snippets table", async () => {
    const mockQuerySql = vi.fn().mockReturnValue([
      {
        id: 1,
        entry_date: "2026-06-10",
        title: "Test Snippet",
        content: "const a = 1;",
        tags: '["js"]',
        created_at: "2026-06-10 12:00",
        updated_at: "2026-06-10 12:00",
      },
    ])
    const service = { querySql: mockQuerySql } as unknown as SnippetsService
    const tool = createSnippetQueryTool(service)

    const result = await tool.execute({
      sql: "SELECT * FROM snippets WHERE title = 'Test Snippet'",
    })

    expect(mockQuerySql).toHaveBeenCalledWith(
      "SELECT * FROM snippets WHERE title = 'Test Snippet' LIMIT 20",
    )
    expect(result.items).toEqual([
      {
        id: 1,
        entryDate: "2026-06-10",
        title: "Test Snippet",
        content: "const a = 1;",
        tags: ["js"],
        createdAt: "2026-06-10 12:00",
        updatedAt: "2026-06-10 12:00",
      },
    ])
  })

  it("rejects forbidden keywords or write operations in SQL", async () => {
    const service = { querySql: vi.fn() } as unknown as SnippetsService
    const tool = createSnippetQueryTool(service)

    await expect(
      tool.execute({
        sql: "DELETE FROM snippets",
      }),
    ).rejects.toThrow("Snippet SQL only allows SELECT queries")

    await expect(
      tool.execute({
        sql: "SELECT * FROM snippets; DROP TABLE snippets;",
      }),
    ).rejects.toThrow("Snippet SQL only allows a single SELECT statement without comments")

    await expect(
      tool.execute({
        sql: "SELECT * FROM snippets JOIN todos",
      }),
    ).rejects.toThrow("Snippet SQL contains a forbidden keyword")
  })

  it("supports structured queries", async () => {
    const mockQuerySql = vi.fn().mockReturnValue([])
    const service = { querySql: mockQuerySql } as unknown as SnippetsService
    const tool = createSnippetQueryTool(service)

    await tool.execute({
      query: "React",
      entryDate: "2026-06-10",
      conditions: {
        tag: "web",
      },
    })

    expect(mockQuerySql).toHaveBeenCalledWith(
      "SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE entry_date = '2026-06-10' AND tags LIKE '%web%' AND (title LIKE '%React%' OR content LIKE '%React%') ORDER BY updated_at DESC, created_at DESC LIMIT 20",
    )
  })
})

describe("snippetTool mutations", () => {
  it("snippets_tool_add should call create on service", async () => {
    const mockCreate = vi.fn().mockReturnValue({
      id: 2,
      entryDate: "2026-06-10",
      title: "New Snippet",
      content: "hello",
      tags: ["test"],
      createdAt: "2026-06-10 12:00",
      updatedAt: "2026-06-10 12:00",
    })
    const service = { create: mockCreate } as unknown as SnippetsService
    const tool = createSnippetAddTool(service)

    const result = await tool.execute({
      entryDate: "2026-06-10",
      title: "New Snippet",
      content: "hello",
      tags: ["test"],
      confirmationSummary: "Creating snippet",
    })

    expect(mockCreate).toHaveBeenCalledWith({
      entryDate: "2026-06-10",
      title: "New Snippet",
      content: "hello",
      tags: ["test"],
    })
    expect(result.data).toEqual({
      item: {
        id: 2,
        entryDate: "2026-06-10",
        title: "New Snippet",
        content: "hello",
        tags: ["test"],
        createdAt: "2026-06-10 12:00",
        updatedAt: "2026-06-10 12:00",
      },
    })
  })

  it("snippets_tool_update should call update on service", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      id: 2,
      entryDate: "2026-06-10",
      title: "Updated Title",
      content: "hello 2",
      tags: ["test2"],
      createdAt: "2026-06-10 12:00",
      updatedAt: "2026-06-10 12:05",
    })
    const service = { update: mockUpdate } as unknown as SnippetsService
    const tool = createSnippetUpdateTool(service)

    const result = await tool.execute({
      id: 2,
      title: "Updated Title",
      content: "hello 2",
      tags: ["test2"],
      confirmationSummary: "Updating snippet",
    })

    expect(mockUpdate).toHaveBeenCalledWith(2, {
      title: "Updated Title",
      content: "hello 2",
      tags: ["test2"],
    })
    expect(result.data).toEqual({
      item: {
        id: 2,
        entryDate: "2026-06-10",
        title: "Updated Title",
        content: "hello 2",
        tags: ["test2"],
        createdAt: "2026-06-10 12:00",
        updatedAt: "2026-06-10 12:05",
      },
    })
  })

  it("snippets_tool_delete should call delete on service", async () => {
    const mockDelete = vi.fn()
    const service = { delete: mockDelete } as unknown as SnippetsService
    const tool = createSnippetDeleteTool(service)

    const result = await tool.execute({
      id: 2,
      confirmationSummary: "Deleting snippet",
    })

    expect(mockDelete).toHaveBeenCalledWith(2)
    expect(result.data).toEqual({ id: 2 })
  })

  it("snippets_tool_batch_add should call create on service per item", async () => {
    const mockCreate = vi.fn().mockReturnValue({
      id: 3,
      entryDate: "2026-06-10",
      title: "Snippet 3",
      content: "content 3",
      tags: ["a"],
      createdAt: "2026-06-10 12:00",
      updatedAt: "2026-06-10 12:00",
    })
    const service = { create: mockCreate } as unknown as SnippetsService
    const tools = createSnippetTools(service)
    const batchTool = tools.find((t) => t.name === "snippets_tool_batch_add")!

    await batchTool.execute({
      items: [
        { entryDate: "2026-06-10", title: "S1", content: "c1", tags: ["a"] },
        { entryDate: "2026-06-10", title: "S2", content: "c2", tags: ["b"] },
      ],
      confirmationSummary: "Creating batch",
    })

    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it("snippets_tool_batch_delete should call delete on service per id", async () => {
    const mockDelete = vi.fn()
    const service = { delete: mockDelete } as unknown as SnippetsService
    const tools = createSnippetTools(service)
    const batchTool = tools.find((t) => t.name === "snippets_tool_batch_delete")!

    await batchTool.execute({
      ids: [1, 2],
      confirmationSummary: "Deleting batch",
    })

    expect(mockDelete).toHaveBeenCalledTimes(2)
    expect(mockDelete).toHaveBeenCalledWith(1)
    expect(mockDelete).toHaveBeenCalledWith(2)
  })
})
