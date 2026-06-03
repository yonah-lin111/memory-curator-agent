/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiToolCallBlock } from "@renderer/features/ai-chat/components/AiToolCallBlock";
import type { AiToolStep } from "@renderer/features/ai-chat/types";

describe("AiToolCallBlock", () => {
  it("ask answer 只展示固定描述并追加键值选择摘要", () => {
    const step: AiToolStep = {
      id: "ask-answer-1",
      title: "Ask user",
      status: "done",
      tool: "ask_user",
      observation:
        'User has answered your clarification questions: "请问您要添加的人物与您是什么关系？"="家人", "请提供该人物的姓名"="王小美".',
      data: {
        kind: "ask_answer",
        id: "ask-1",
        answers: [
          {
            question: "请问您要添加的人物与您是什么关系？",
            answers: ["家人"],
          },
          {
            question: "请提供该人物的姓名",
            answers: ["王小美"],
          },
        ],
      },
    };

    render(<AiToolCallBlock steps={[step]} />);

    expect(
      screen.getByText("User has answered your clarification question."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/User has answered your clarification questions:/),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByText("请问您要添加的人物与您是什么关系？")
        .parentElement,
    ).toHaveTextContent("请问您要添加的人物与您是什么关系？=家人");
    expect(screen.getByText("请提供该人物的姓名").parentElement).toHaveTextContent(
      "请提供该人物的姓名=王小美",
    );
  });

  it("ask 被取消时展示取消状态", () => {
    const step: AiToolStep = {
      id: "ask-cancel-1",
      title: "Tool cancelled: ask_user",
      status: "cancelled",
      tool: "ask_user",
      observation: "Ask was cancelled.",
      data: {
        error: "Ask request was cancelled.",
      },
    };

    render(<AiToolCallBlock steps={[step]} />);

    expect(screen.getByLabelText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Ask was cancelled.")).toBeInTheDocument();
  });
});
