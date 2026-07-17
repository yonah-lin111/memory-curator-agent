/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PromptAiMcpCallBlock } from "@/features/prompt-design/components/PromptAiMcpCallBlock";
import type { CuratorToolStep } from "@/features/curator/types";

describe("PromptAiMcpCallBlock", () => {
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
});
