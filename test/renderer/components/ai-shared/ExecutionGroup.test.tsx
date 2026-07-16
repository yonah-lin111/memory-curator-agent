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

    expect(screen.getByText("1 tool calls, 1 thoughts")).toBeInTheDocument();
  });

  it("没有可见思考时不显示思考数量", () => {
    renderExecutionGroup([
      { id: "tool-1", kind: "tool" },
      { id: "tool-2", kind: "tool" },
    ]);

    expect(screen.getByText("2 tool calls")).toBeInTheDocument();
    expect(screen.queryByText(/thoughts/)).not.toBeInTheDocument();
  });
});
