/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AiToolCallBlock } from "@renderer/features/ai-chat/components/AiToolCallBlock";
import type { AiToolStep } from "@renderer/features/ai-chat/types";

describe("AiToolCallBlock", () => {
  it("ask answer 只展示固定描述并追加键值选择摘要", () => {
    const step: AiToolStep = {
      id: "ask-answer-1",
      title: "Ask user",
      status: "done",
      tool: "common_tool.ask",
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
      screen.getByText("请问您要添加的人物与您是什么关系？")
    ).toBeInTheDocument();
    expect(
      screen.getByText("家人")
    ).toBeInTheDocument();
    expect(
      screen.getByText("请提供该人物的姓名")
    ).toBeInTheDocument();
    expect(
      screen.getByText("王小美")
    ).toBeInTheDocument();
  });

  it("ask 被取消时展示取消状态", () => {
    const step: AiToolStep = {
      id: "ask-cancel-1",
      title: "Tool cancelled: common_tool.ask",
      status: "cancelled",
      tool: "common_tool.ask",
      observation: "Ask was cancelled.",
      data: {
        error: "Ask request was cancelled.",
      },
    };

    render(<AiToolCallBlock steps={[step]} />);

    expect(screen.getByLabelText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Ask was cancelled.")).toBeInTheDocument();
  });

  it("工具确认请求提交 confirm 回答", async () => {
    const onSubmitToolConfirmationAnswer = vi.fn(async () => undefined);
    const step: AiToolStep = {
      id: "call-add",
      title: "Tool result: people_tool.add",
      status: "running",
      tool: "people_tool.add",
      observation: "Tool confirmation required before executing people_tool.add.",
      data: {
        kind: "tool_confirmation_request",
        id: "confirm-1",
        tool: "people_tool.add",
        input: {
          name: "测试助手",
        },
        questions: [
          {
            header: "确认创建",
            question: "确认创建人物档案：测试助手？",
            options: [
              {
                label: "确认创建",
                description: "执行该写入操作。",
              },
              {
                label: "取消创建",
                description: "不执行该写入操作。",
              },
            ],
            custom: false,
          },
        ],
      },
    };

    render(
      <AiToolCallBlock
        steps={[step]}
        onSubmitToolConfirmationAnswer={onSubmitToolConfirmationAnswer}
      />,
    );

    await userEvent.click(screen.getAllByText("确认创建")[1]);
    await userEvent.click(screen.getByText("Submit"));

    expect(onSubmitToolConfirmationAnswer).toHaveBeenCalledWith({
      requestId: "confirm-1",
      action: "confirm",
    });
  });
});
