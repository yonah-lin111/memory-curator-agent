/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import type { CuratorToolStep } from "@/features/curator/types"
import { PromptAiMcpCallBlock } from "@/features/prompt-design/components/PromptAiMcpCallBlock"

describe("PromptAiMcpCallBlock", () => {
  afterEach(() => {
    cleanup()
  })

  it("按服务展示 MCP 调用名称", () => {
    const steps: CuratorToolStep[] = [
      {
        id: "mcp-1",
        title: "MCP result",
        status: "done",
        tool: "search_graph",
        observation: "Found 3 matching functions.",
        input: { query: "prompt" },
        data: { total: 3 },
        mcp: { serverId: "codegraph", serverName: "CodeGraph", toolName: "search_graph" },
      },
    ]

    render(<PromptAiMcpCallBlock steps={steps} />)

    expect(screen.getByText("MCP · CodeGraph")).toBeInTheDocument()
    expect(screen.getByText("search_graph")).toBeInTheDocument()
    expect(document.querySelector(".lucide-check")).toBeInTheDocument()
    expect(screen.queryByText((_, element) => element?.tagName === "PRE")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("连续 MCP 调用默认显示两项并允许展开余下项", async () => {
    const steps: CuratorToolStep[] = ["search_graph", "get_code_snippet", "trace_path"].map(
      (toolName, index) => ({
        id: `mcp-${index}`,
        title: "MCP result",
        status: index === 1 ? "failed" : "done",
        tool: toolName,
        observation: "Completed.",
        mcp: { serverId: "codebase-memory-mcp", serverName: "Codebase Memory", toolName },
      }),
    )

    render(<PromptAiMcpCallBlock steps={steps} />)

    expect(screen.getByText("search_graph")).toBeInTheDocument()
    expect(screen.getByText("get_code_snippet")).toBeInTheDocument()
    expect(document.querySelector(".lucide-x")).toBeInTheDocument()
    expect(screen.queryByText("trace_path")).not.toBeInTheDocument()

    await userEvent.click(screen.getByText("Show 1 more..."))

    expect(screen.getByText("trace_path")).toBeInTheDocument()
  })
})
