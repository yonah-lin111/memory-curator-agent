/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiChatMessageBubble } from "@renderer/features/ai-chat/components/AiChatMessageBubble";
import type { AiChatMessage } from "@renderer/features/ai-chat/types";

vi.mock("md-editor-rt", () => ({
  MdPreview: ({ modelValue }: { modelValue: string }) => (
    <div>{modelValue}</div>
  ),
}));

/**
 * 测试渲染默认不关心右键菜单打开行为。
 */
const noopContextMenu = (): void => undefined;

describe("AiChatMessageBubble", () => {
  afterEach(() => {
    cleanup();
  });

  it("工具调用后隐藏回答中泄漏的工具 JSON，只展示工具摘要与最终结论", () => {
    const message: AiChatMessage = {
      id: "a1",
      role: "assistant",
      content: 'Processing: "查一下阿明"',
      time: "10:01",
      toolSteps: [
        {
          id: "tool-1",
          title: "Query local People",
          status: "done",
          tool: "people_query",
          observation: "找到 1 位关联人物：阿明",
        },
      ],
      answer:
        'Tool observation:\n找到 1 位关联人物：阿明\nTool data:\n```json\n{"rows":[{"name":"阿明","details":"完整详情"}]}\n```\n\n阿明是你本地 People 中的朋友。',
    };

    render(
      <AiChatMessageBubble
        message={message}
        onOpenContextMenu={noopContextMenu}
      />,
    );

    expect(screen.getByText("people_query")).toBeInTheDocument();
    expect(screen.getByText("找到 1 位关联人物：阿明")).toBeInTheDocument();
    expect(
      screen.getByText("阿明是你本地 People 中的朋友。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Tool data/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"rows"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/完整详情/)).not.toBeInTheDocument();
  });

  it("工具步骤区域不直接展示 SQL 原始行 JSON", () => {
    const message: AiChatMessage = {
      id: "a2",
      role: "assistant",
      content: 'Processing: "我的女朋友是谁？"',
      time: "14:22",
      toolSteps: [
        {
          id: "tool-1",
          title: "Query local People",
          status: "done",
          tool: "people_query",
          observation:
            'SQL query returned 1 row: [{"id":"tolin","name":"黄酥梨","relationship":"女朋友","details":"喜欢笑，还是个小吃货"}]',
        },
      ],
      answer: "你的女朋友是黄酥梨。",
    };

    render(
      <AiChatMessageBubble
        message={message}
        onOpenContextMenu={noopContextMenu}
      />,
    );

    expect(screen.getByText("people_query")).toBeInTheDocument();
    expect(
      screen.getByText(
        "SQL query returned 1 row and was normalized as structured results.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/"id"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/黄酥梨.*details/)).not.toBeInTheDocument();
  });

  it("展示英文 SQL 汇总观察文本", () => {
    const message: AiChatMessage = {
      id: "a2-legacy-summary",
      role: "assistant",
      content: 'Processing: "查一下"',
      time: "14:23",
      toolSteps: [
        {
          id: "tool-1",
          title: "Tool result: people_query",
          status: "done",
          tool: "people_query",
          observation: "SQL query returned 1 row.",
        },
      ],
      answer: "Done.",
    };

    render(
      <AiChatMessageBubble
        message={message}
        onOpenContextMenu={noopContextMenu}
      />,
    );

    expect(screen.getByText("SQL query returned 1 row.")).toBeInTheDocument();
  });

  it("按流式片段顺序交错展示 AI 内容和工具重试", () => {
    const message: AiChatMessage = {
      id: "a3",
      role: "assistant",
      content: 'Processing: "测试工具重试"',
      time: "15:18",
      parts: [
        {
          id: "part-1",
          kind: "text",
          content: "我会先传递错误参数。",
        },
        {
          id: "part-2",
          kind: "tool",
          stepId: "tool-1",
        },
        {
          id: "part-3",
          kind: "text",
          content: "工具报错了，现在修正参数重试。",
        },
        {
          id: "part-4",
          kind: "tool",
          stepId: "tool-2",
        },
        {
          id: "part-5",
          kind: "text",
          content: "测试完成。",
        },
      ],
      toolSteps: [
        {
          id: "tool-1",
          title: "Query local People",
          status: "failed",
          tool: "people_query",
          observation:
            "Tool execution failed: People SQL can only query the associated_people table",
        },
        {
          id: "tool-2",
          title: "Query local People",
          status: "done",
          tool: "people_query",
          observation: "SQL query returned no rows.",
        },
      ],
      answer: "我会先传递错误参数。工具报错了，现在修正参数重试。测试完成。",
    };

    const { container } = render(
      <AiChatMessageBubble
        message={message}
        onOpenContextMenu={noopContextMenu}
      />,
    );
    const renderedText = container.textContent ?? "";

    expect(renderedText.indexOf("我会先传递错误参数。")).toBeLessThan(
      renderedText.indexOf(
        "Tool execution failed: People SQL can only query the associated_people table",
      ),
    );
    expect(
      renderedText.indexOf(
        "Tool execution failed: People SQL can only query the associated_people table",
      ),
    ).toBeLessThan(renderedText.indexOf("工具报错了，现在修正参数重试。"));
    expect(renderedText.indexOf("工具报错了，现在修正参数重试。")).toBeLessThan(
      renderedText.indexOf("SQL query returned no rows."),
    );
    expect(renderedText.indexOf("SQL query returned no rows.")).toBeLessThan(
      renderedText.indexOf("测试完成。"),
    );
  });

  it("正在生成中时展示 loading 动画/指示器而不是具体的发送时间", () => {
    const message: AiChatMessage = {
      id: "a4",
      role: "assistant",
      content: 'Processing: "正在回复中"',
      time: "18:22",
      answer: "回复内容",
    };

    const { container } = render(
      <AiChatMessageBubble
        message={message}
        isGenerating={true}
        onOpenContextMenu={noopContextMenu}
      />,
    );

    // 不应该展示具体的发送时间
    expect(screen.queryByText("18:22")).not.toBeInTheDocument();

    // 应该包含 animate-ping 动画效果相关的 span
    const pingSpan = container.querySelector(".animate-ping");
    expect(pingSpan).toBeInTheDocument();
  });
});
