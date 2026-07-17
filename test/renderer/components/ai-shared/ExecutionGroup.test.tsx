/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExecutionGroupBlock,
  type ExecutionGroup,
} from "@/components/ai-shared/ExecutionGroup";

class ResizeObserverMock {
  observe = (): void => undefined;
  unobserve = (): void => undefined;
  disconnect = (): void => undefined;
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

/**
 * 渲染执行分组标题。
 */
const renderExecutionGroup = (parts: ExecutionGroup["parts"]): void => {
  render(
    <ExecutionGroupBlock
      group={{ id: "group", parts, connectsToNextExecution: false }}
      renderPart={(part) => <div key={part.id}>{part.id}</div>}
      renderToolParts={(toolParts) => (
        <div key={toolParts[0].id}>
          {toolParts.map((part) => part.id).join(",")}
        </div>
      )}
    />,
  );
};

describe("ExecutionGroupBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("使用英文显示工具与思考数量", () => {
    renderExecutionGroup([
      { id: "tool", kind: "tool" },
      { id: "reasoning", kind: "reasoning" },
    ]);

    expect(screen.getByText("1 tool call, 1 thought")).toBeInTheDocument();
  });

  it("没有可见思考时不显示思考数量", () => {
    renderExecutionGroup([
      { id: "tool-1", kind: "tool" },
      { id: "tool-2", kind: "tool" },
    ]);

    expect(screen.getByText("2 tool calls")).toBeInTheDocument();
    expect(screen.queryByText(/thoughts/)).not.toBeInTheDocument();
  });

  it("将连续工具片段批量交给工具渲染器", () => {
    const renderToolParts = vi.fn((toolParts: Extract<ExecutionGroup["parts"][number], { kind: "tool" }>[]) => (
      <div key={toolParts[0].id}>{toolParts.map((part) => part.id).join(",")}</div>
    ));

    render(
      <ExecutionGroupBlock
        group={{
          id: "group",
          parts: [
            { id: "read-1", kind: "tool" },
            { id: "read-2", kind: "tool" },
            { id: "reasoning", kind: "reasoning" },
            { id: "read-3", kind: "tool" },
          ],
          connectsToNextExecution: false,
        }}
        renderPart={(part) => <div key={part.id}>{part.id}</div>}
        renderToolParts={renderToolParts}
      />,
    );

    const combinedReadParts = renderToolParts.mock.calls.find((call) =>
      call[0].some((part) => part.id === "read-2"),
    );

    expect(combinedReadParts?.[0].map((part) => part.id)).toEqual([
      "read-1",
      "read-2",
    ]);
  });
});
