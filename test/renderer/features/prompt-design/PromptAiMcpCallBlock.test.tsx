/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PromptAiMcpCallBlock } from "@/features/prompt-design/components/PromptAiMcpCallBlock";
import type { CuratorToolStep } from "@/features/curator/types";

describe("PromptAiMcpCallBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("按服务展示 MCP 调用并按需展开完整详情", async () => {
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
    ];

    render(<PromptAiMcpCallBlock steps={steps} />);

    expect(screen.getByText("MCP · CodeGraph")).toBeInTheDocument();
    expect(screen.getByText("search_graph")).toBeInTheDocument();
    expect(screen.queryByText((_, element) => element?.tagName === "PRE")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /search_graph/i }));

    expect(screen.getByText((_, element) => element?.tagName === "PRE")).toHaveTextContent('"query": "prompt"');
    expect(screen.getByText((_, element) => element?.tagName === "PRE")).toHaveTextContent('"total": 3');
  });

  it("连续 MCP 调用默认显示两项并允许展开余下项", async () => {
    const steps: CuratorToolStep[] = ["search_graph", "get_code_snippet", "trace_path"].map((toolName, index) => ({
      id: `mcp-${index}`,
      title: "MCP result",
      status: "done",
      tool: toolName,
      observation: "Completed.",
      mcp: { serverId: "codebase-memory-mcp", serverName: "Codebase Memory", toolName },
    }));

    render(<PromptAiMcpCallBlock steps={steps} />);

    expect(screen.getByText("search_graph")).toBeInTheDocument();
    expect(screen.getByText("get_code_snippet")).toBeInTheDocument();
    expect(screen.queryByText("trace_path")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Show 1 more..."));

    expect(screen.getByText("trace_path")).toBeInTheDocument();
  });
});
