/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("md-editor-rt", () => ({
  MdPreview: ({ modelValue }: { modelValue: string }) => (
    <div data-testid="md-preview">{modelValue}</div>
  ),
}));

import { CuratorToolCallBlock } from "@/components/ai-shared/ToolCallBlock";
import type { CuratorToolStep } from "@/features/curator/types";

// Mock Lucide 图标以稳定断言工具语义图标。
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    Search: () => <span data-testid="icon-search" />,
    Plus: () => <span data-testid="icon-plus" />,
    Pencil: () => <span data-testid="icon-pencil" />,
    Trash2: () => <span data-testid="icon-trash2" />,
    FileText: () => <span data-testid="icon-filetext" />,
    Files: () => <span data-testid="icon-files" />,
    SearchCode: () => <span data-testid="icon-searchcode" />,
    Replace: () => <span data-testid="icon-replace" />,
    FilePenLine: () => <span data-testid="icon-filepenline" />,
    FileX: () => <span data-testid="icon-filex" />,
    Puzzle: () => <span data-testid="icon-puzzle" />,
    MessageCircleQuestion: () => <span data-testid="icon-messagecirclequestion" />,
    Clock: () => <span data-testid="icon-clock" />,
    ChartNoAxesCombined: () => <span data-testid="icon-chartnoaxescombined" />,
    Palette: () => <span data-testid="icon-palette" />,
    Wrench: () => <span data-testid="icon-wrench" />,
  };
});

describe("CuratorToolCallBlock", () => {
  it("ask answer 只展示固定描述并追加键值选择摘要", () => {
    const step: CuratorToolStep = {
      id: "ask-answer-1",
      title: "Ask user",
      status: "done",
      tool: "common_tool_ask",
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

    render(<CuratorToolCallBlock steps={[step]} />);

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
    const step: CuratorToolStep = {
      id: "ask-cancel-1",
      title: "Tool cancelled: common_tool_ask",
      status: "cancelled",
      tool: "common_tool_ask",
      observation: "Ask was cancelled.",
      data: {
        error: "Ask request was cancelled.",
      },
    };

    render(<CuratorToolCallBlock steps={[step]} />);

    expect(screen.getByLabelText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Ask was cancelled.")).toBeInTheDocument();
  });

  it("工具确认请求提交 confirm 回答", async () => {
    const onSubmitToolConfirmationAnswer = vi.fn(async () => undefined);
    const step: CuratorToolStep = {
      id: "call-add",
      title: "Tool result: people_tool_add",
      status: "running",
      tool: "people_tool_add",
      observation: "Tool confirmation required before executing people_tool_add.",
      data: {
        kind: "tool_confirmation_request",
        id: "confirm-1",
        tool: "people_tool_add",
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
      <CuratorToolCallBlock
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

  it("工具确认请求展示写入前说明", () => {
    const step: CuratorToolStep = {
      id: "confirm-1",
      title: "Tool result: people_tool_delete",
      status: "running",
      tool: "people_tool_delete",
      observation: "Tool confirmation required before executing people_tool_delete.",
      data: {
        kind: "tool_confirmation_request",
        id: "confirm-delete",
        tool: "people_tool_delete",
        input: {
          id: "person-1",
          confirmationSummary: "将删除人物档案：**阿明**（朋友）。\n- 这是本次查询确认到的目标人物",
        },
        summary: "将删除人物档案：**阿明**（朋友）。\n- 这是本次查询确认到的目标人物",
        questions: [
          {
            header: "确认删除",
            question: "确认永久删除人物档案：person-1？",
            options: [
              {
                label: "确认删除",
                description: "执行该写入操作。",
              },
              {
                label: "取消删除",
                description: "不执行该写入操作。",
              },
            ],
            custom: false,
          },
        ],
      },
    };

    render(<CuratorToolCallBlock steps={[step]} onSubmitToolConfirmationAnswer={vi.fn()} />);

    const summary = screen.getAllByTestId("tool-operation-summary")[1];
    const header = screen.getAllByText("确认删除")[0];

    expect(screen.queryByText("AI 输出说明")).not.toBeInTheDocument();
    expect(summary).toHaveTextContent("将删除人物档案：阿明（朋友）");
    expect(
      screen.getByText(
        "Tool confirmation required before executing people_tool_delete.",
      ),
    ).toBeInTheDocument();
    expect(
      summary.compareDocumentPosition(header) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("根据不同的工具渲染预期图标", () => {
    const testCases = [
      { tool: "people_tool_query", icon: "icon-search" },
      { tool: "people_tool_add", icon: "icon-plus" },
      { tool: "people_tool_update", icon: "icon-pencil" },
      { tool: "people_tool_delete", icon: "icon-trash2" },
      { tool: "people_tool_batch_add", icon: "icon-plus" },
      { tool: "people_tool_batch_update", icon: "icon-pencil" },
      { tool: "people_tool_batch_delete", icon: "icon-trash2" },
      { tool: "prompt_file_read", icon: "icon-filetext" },
      { tool: "Read", icon: "icon-filetext" },
      { tool: "prompt_glob", icon: "icon-files" },
      { tool: "Glob", icon: "icon-files" },
      { tool: "prompt_grep", icon: "icon-searchcode" },
      { tool: "Grep", icon: "icon-searchcode" },
      { tool: "prompt_editor_replace", icon: "icon-replace" },
      { tool: "Replace editor", icon: "icon-replace" },
      { tool: "prompt_editor_replace_lines", icon: "icon-filepenline" },
      { tool: "prompt_editor_delete_lines", icon: "icon-filex" },
      { tool: "load_skill", icon: "icon-puzzle" },
      { tool: "common_tool_ask", icon: "icon-messagecirclequestion" },
      { tool: "common_tool_time_now", icon: "icon-clock" },
      { tool: "common_tool_date_offset", icon: "icon-clock" },
      { tool: "today_tool_summary", icon: "icon-chartnoaxescombined" },
      { tool: "bills_tool_summary", icon: "icon-chartnoaxescombined" },
      { tool: "theme_tool_query", icon: "icon-palette" },
      { tool: "unknown_custom_tool", icon: "icon-wrench" },
    ];

    testCases.forEach(({ tool, icon }) => {
      const step: CuratorToolStep = {
        id: `step-${tool}`,
        title: `Tool result: ${tool}`,
        status: "done",
        tool,
        observation: "dummy observation",
      };

      const { container, unmount } = render(<CuratorToolCallBlock steps={[step]} />);
      expect(container.querySelector(`[data-testid="${icon}"]`)).toBeInTheDocument();
      unmount();
    });
  });
});
