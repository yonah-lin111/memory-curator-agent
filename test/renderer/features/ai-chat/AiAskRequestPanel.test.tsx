/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiAskRequestPanel,
  type AiAskRequest,
} from "@renderer/features/ai-chat/components/AiAskRequestPanel";

// 多问题 Ask 请求。
const request: AiAskRequest = {
  kind: "ask_request",
  id: "ask_test_1",
  questions: [
    {
      header: "范围",
      question: "应该修改哪个范围？",
      options: [
        {
          label: "当前项目",
          description: "只修改当前工作区。",
        },
        {
          label: "参考项目",
          description: "只读取参考项目。",
        },
      ],
      custom: true,
    },
    {
      header: "交互",
      question: "多个问题如何展示？",
      options: [
        {
          label: "箭头切换",
          description: "一次只展示一个问题。",
        },
        {
          label: "全部列出",
          description: "所有问题同时展示。",
        },
      ],
      custom: false,
    },
  ],
};

describe("AiAskRequestPanel", () => {
  afterEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it("多个问题时通过箭头切换，默认只展示当前问题", async () => {
    const user = userEvent.setup();

    render(<AiAskRequestPanel request={request} onSubmit={() => undefined} />);

    expect(screen.getByText("应该修改哪个范围？")).toBeInTheDocument();
    expect(screen.queryByText("多个问题如何展示？")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.queryByText("应该修改哪个范围？")).not.toBeInTheDocument();
    expect(screen.getByText("多个问题如何展示？")).toBeInTheDocument();
  });

  it("同一个 ask 只在当前挂载周期内阻止二次提交", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const { unmount } = render(
      <AiAskRequestPanel request={request} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByText("当前项目"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByText("箭头切换"));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      requestId: "ask_test_1",
      answers: [["当前项目"], ["箭头切换"]],
    });
    expect(screen.getByText("已提交，不能重复使用。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    unmount();
    render(<AiAskRequestPanel request={request} onSubmit={onSubmit} />);

    expect(screen.queryByText("已提交，不能重复使用。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    await user.click(screen.getByText("当前项目"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByText("箭头切换"));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("当前挂载周期内提交后不能二次提交", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AiAskRequestPanel request={request} onSubmit={onSubmit} />);

    await user.click(screen.getByText("当前项目"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByText("箭头切换"));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("已提交，不能重复使用。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("自定义输入无需添加按钮即可作为答案提交", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AiAskRequestPanel request={request} onSubmit={onSubmit} />);

    expect(screen.queryByRole("button", { name: "添加" })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("输入回答"), "整个工作区");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByText("箭头切换"));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith({
      requestId: "ask_test_1",
      answers: [["整个工作区"], ["箭头切换"]],
    });
  });

  it("单选问题选中自定义回答后会清除普通选项", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AiAskRequestPanel request={request} onSubmit={onSubmit} />);

    await user.click(screen.getByText("当前项目"));
    await user.click(screen.getByText("自定义回答"));
    await user.type(screen.getByPlaceholderText("输入回答"), "整个工作区");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByText("箭头切换"));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith({
      requestId: "ask_test_1",
      answers: [["整个工作区"], ["箭头切换"]],
    });
  });
});
