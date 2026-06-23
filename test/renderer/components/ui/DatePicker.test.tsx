/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "@/components/ui/DatePicker";
import { DatePickerButton } from "@/components/ui/DatePickerButton";

describe("DatePicker and DatePickerButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ==========================================
  // 测试普通 DatePicker 和 DatePickerButton 的渲染与交互
  // ==========================================
  it("renders DatePicker and opens calendar on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DatePicker value="2026-06-23" onChange={onChange}>
        <DatePickerButton value="2026-06-23" />
      </DatePicker>,
    );

    // 默认应该显示当前选择的日期文本
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    // 弹窗默认应该隐藏
    expect(screen.queryByLabelText("Date picker")).not.toBeInTheDocument();

    // 点击按钮，弹出日历
    await user.click(button);

    // 日历弹窗应该被挂载在 body 中
    const picker = screen.getByLabelText("Date picker");
    expect(picker).toBeInTheDocument();
  });

  // ==========================================
  // 测试禁用状态下的行为
  // ==========================================
  it("does not open calendar when disabled is set on DatePicker", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DatePicker value="2026-06-23" onChange={onChange} disabled={true}>
        <DatePickerButton value="2026-06-23" />
      </DatePicker>,
    );

    // 获取触发按钮
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    // 应该拥有 disabled 属性
    expect(button).toBeDisabled();

    // 点击按钮应该无法触发任何交互，且不打开日历
    await user.click(button);
    expect(screen.queryByLabelText("Date picker")).not.toBeInTheDocument();
  });

  it("applies disabled styling and class to DatePickerButton", () => {
    render(
      <DatePickerButton value="2026-06-23" disabled={true} />
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("disabled:opacity-40");
    expect(button).toHaveClass("disabled:cursor-not-allowed");
  });
});
