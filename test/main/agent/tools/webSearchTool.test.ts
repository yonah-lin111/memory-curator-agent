import { describe, expect, it, vi } from "vitest"
import { createWebSearchTool } from "@/agent/tools/webSearchTool"

// 创建联网搜索配置读取器。
const createConfigResolver =
  (exaApiKey = "", tavilyApiKey = "") =>
  () => ({ exaApiKey, tavilyApiKey })

describe("webSearchTool", () => {
  it("通过 Exa MCP 执行联网搜索并返回文本结果", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: { content: [{ type: "text", text: "搜索结果" }] },
        }),
        { status: 200 },
      ),
    )
    const tool = createWebSearchTool(fetcher, new Map(), createConfigResolver())

    const result = await tool.execute({ query: "最新 AI 新闻", numResults: 3, type: "fast" })

    expect(result).toEqual({
      observation: "搜索结果",
      data: { query: "最新 AI 新闻", numResults: 3, type: "fast", provider: "exa" },
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://mcp.exa.ai/mcp",
      expect.objectContaining({ method: "POST" }),
    )
    const request = fetcher.mock.calls[0]?.[1]
    expect(JSON.parse(String(request?.body))).toMatchObject({
      method: "tools/call",
      params: {
        name: "web_search_exa",
        arguments: { query: "最新 AI 新闻", numResults: 3, type: "fast", livecrawl: "fallback" },
      },
    })
  })

  it("未配置 API Key 时仍直接请求 Tavily", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: { content: [{ type: "text", text: "Exa 结果" }] },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ title: "Tavily 结果", url: "https://example.com", content: "公开响应" }],
          }),
          { status: 200 },
        ),
      )
    const tool = createWebSearchTool(fetcher, new Map(), createConfigResolver())

    await tool.execute({ query: "first" })
    await expect(tool.execute({ query: "second" })).resolves.toMatchObject({
      data: { provider: "tavily" },
    })

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://api.tavily.com/search",
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      }),
    )
  })

  it("匿名 Tavily 认证失败后暂停重复直连", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: { content: [{ type: "text", text: "Exa 首次结果" }] },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: { content: [{ type: "text", text: "Exa 回退结果" }] },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: { content: [{ type: "text", text: "Exa 后续结果" }] },
          }),
          { status: 200 },
        ),
      )
    const tool = createWebSearchTool(fetcher, new Map(), createConfigResolver())

    await tool.execute({ query: "first" })
    await expect(tool.execute({ query: "second" })).resolves.toMatchObject({
      data: { provider: "exa" },
    })
    await expect(tool.execute({ query: "third" })).resolves.toMatchObject({
      data: { provider: "exa" },
    })

    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(
      fetcher.mock.calls.filter(([url]) => url === "https://api.tavily.com/search"),
    ).toHaveLength(1)
  })

  it("拒绝空查询和超出限制的结果数", async () => {
    const tool = createWebSearchTool(vi.fn<typeof fetch>(), new Map(), createConfigResolver())

    await expect(tool.execute({ query: "" })).rejects.toThrow("Web search query is required")
    await expect(tool.execute({ query: "有效查询", numResults: 11 })).rejects.toThrow(
      "Web search numResults must be an integer between 1 and 10",
    )
  })

  it("配置 Tavily 后轮询调用并归一化搜索结果", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: { content: [{ type: "text", text: "Exa 结果" }] },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            answer: "Tavily 摘要",
            results: [{ title: "示例标题", url: "https://example.com", content: "示例内容" }],
          }),
          { status: 200 },
        ),
      )
    const tool = createWebSearchTool(
      fetcher,
      new Map(),
      createConfigResolver("", "tavily-test-key"),
    )

    await expect(tool.execute({ query: "first" })).resolves.toMatchObject({
      data: { provider: "exa" },
    })
    await expect(tool.execute({ query: "second", numResults: 3 })).resolves.toEqual({
      observation: "Tavily 摘要\n\n1. 示例标题\nhttps://example.com\n示例内容",
      data: { query: "second", numResults: 3, type: "auto", provider: "tavily" },
    })
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tavily-test-key" }),
      }),
    )
    const request = fetcher.mock.calls[1]?.[1]
    expect(JSON.parse(String(request?.body))).toEqual({
      query: "second",
      max_results: 3,
      search_depth: "basic",
      include_answer: false,
    })
  })

  it("首选服务失败时回退至另一服务", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Exa unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ title: "回退结果", url: "https://example.com/fallback", content: "可用" }],
          }),
          { status: 200 },
        ),
      )
    const tool = createWebSearchTool(
      fetcher,
      new Map(),
      createConfigResolver("", "tavily-test-key"),
    )

    await expect(tool.execute({ query: "fallback" })).resolves.toEqual({
      observation: "1. 回退结果\nhttps://example.com/fallback\n可用",
      data: { query: "fallback", numResults: 8, type: "auto", provider: "tavily" },
    })
    expect(fetcher).toHaveBeenNthCalledWith(1, "https://mcp.exa.ai/mcp", expect.anything())
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://api.tavily.com/search", expect.anything())
  })

  it("Tavily 作为首选服务失败时回退至 Exa", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: { content: [{ type: "text", text: "初始 Exa 结果" }] },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("Tavily unavailable", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: { content: [{ type: "text", text: "Exa 回退结果" }] },
          }),
          { status: 200 },
        ),
      )
    const tool = createWebSearchTool(
      fetcher,
      new Map(),
      createConfigResolver("", "tavily-test-key"),
    )

    await tool.execute({ query: "first" })
    await expect(tool.execute({ query: "second" })).resolves.toEqual({
      observation: "Exa 回退结果",
      data: { query: "second", numResults: 8, type: "auto", provider: "exa" },
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://api.tavily.com/search", expect.anything())
    expect(fetcher).toHaveBeenNthCalledWith(3, "https://mcp.exa.ai/mcp", expect.anything())
  })
})
