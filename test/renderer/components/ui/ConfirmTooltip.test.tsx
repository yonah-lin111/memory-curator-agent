/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmTooltip } from "@/components/ui/ConfirmTooltip";

describe("ConfirmTooltip", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("toggles the tooltip visibility when the trigger is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmTooltip title="Confirm this action?" onConfirm={onConfirm}>
        <button type="button">Trigger</button>
      </ConfirmTooltip>,
    );

    // 默认隐藏（未挂载在 DOM 中）
    let tooltipTitle = screen.queryByText("Confirm this action?");
    expect(tooltipTitle).not.toBeInTheDocument();

    const triggerBtn = screen.getByRole("button", { name: "Trigger" });
    await user.click(triggerBtn);

    // 点击后挂载显示
    tooltipTitle = screen.getByText("Confirm this action?");
    expect(tooltipTitle).toBeInTheDocument();

    // 点击确认
    const confirmBtn = screen.getByRole("button", { name: "确认" });
    await user.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmTooltip
        title="Delete forever?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <button type="button">Trigger</button>
      </ConfirmTooltip>,
    );

    const triggerBtn = screen.getByRole("button", { name: "Trigger" });
    await user.click(triggerBtn);

    const cancelBtn = screen.getByRole("button", { name: "取消" });
    await user.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
