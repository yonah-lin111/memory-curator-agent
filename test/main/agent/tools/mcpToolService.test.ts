import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clients: [] as Array<{
    connect: ReturnType<typeof vi.fn>;
    listTools: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    callTool: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    connect = vi.fn().mockResolvedValue(undefined);
    listTools = vi.fn().mockResolvedValue({
      tools: [{ name: "search", description: "Search", inputSchema: { type: "object" } }],
    });
    close = vi.fn().mockResolvedValue(undefined);
    callTool = vi.fn().mockResolvedValue({ content: [] });
    setRequestHandler = vi.fn();

    constructor() {
      mocks.clients.push(this);
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: class {
    close = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  ListRootsRequestSchema: {},
}));

import {
  closePromptDesignMcpConnections,
  createPromptDesignMcpTools,
} from "@/agent/tools/mcpToolService";

describe("mcpToolService", () => {
  afterEach(async () => {
    await closePromptDesignMcpConnections();
    mocks.clients.length = 0;
    vi.useRealTimers();
  });

  it("复用同一项目和服务的连接，并在空闲超时后关闭", async () => {
    vi.useFakeTimers();
    const server = {
      id: "test-server",
      name: "Test server",
      command: "test-mcp",
      args: [],
      timeout: 1_000,
    };

    const [first, second] = await Promise.all([
      createPromptDesignMcpTools([server], "/tmp/project"),
      createPromptDesignMcpTools([server], "/tmp/project"),
    ]);

    expect(mocks.clients).toHaveLength(1);
    expect(mocks.clients[0]?.connect).toHaveBeenCalledTimes(1);
    expect(mocks.clients[0]?.listTools).toHaveBeenCalledTimes(1);

    await first.close();
    expect(mocks.clients[0]?.close).not.toHaveBeenCalled();

    await second.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.clients[0]?.close).toHaveBeenCalledTimes(1);
  });

  it("工具调用失败时驱逐旧连接并重试一次", async () => {
    const server = {
      id: "test-server",
      name: "Test server",
      command: "test-mcp",
      args: [],
      timeout: 1_000,
    };
    const mcp = await createPromptDesignMcpTools([server], "/tmp/project");
    mocks.clients[0]?.callTool.mockRejectedValueOnce(new Error("connection closed"));

    await expect(mcp.tools[0]?.execute({ query: "test" })).resolves.toEqual({
      observation: JSON.stringify({ content: [] }),
      data: { content: [] },
    });
    expect(mocks.clients).toHaveLength(2);
    expect(mocks.clients[0]?.close).toHaveBeenCalledTimes(1);
    expect(mocks.clients[1]?.callTool).toHaveBeenCalledTimes(1);

    await mcp.close();
  });
});
