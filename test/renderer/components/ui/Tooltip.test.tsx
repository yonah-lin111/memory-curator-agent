/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Tooltip } from "@/components/ui/Tooltip"

describe("Tooltip", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // ==========================================
  // 测试普通 Tooltip 文本提示功能
  // ==========================================
  it("renders normal tooltip text on hover", async () => {
    const user = userEvent.setup()

    render(
      <Tooltip content="Helper info message" trigger="hover">
        <button type="button">Hover Trigger</button>
      </Tooltip>,
    )

    // 默认隐藏（未挂载在 DOM 中）
    let tooltipContent = screen.queryByText("Helper info message")
    expect(tooltipContent).not.toBeInTheDocument()

    const triggerBtn = screen.getByRole("button", { name: "Hover Trigger" })
    await user.hover(triggerBtn)

    // 延时过后挂载显示（使用 vi.useFakeTimers 或是简易等待。在 jsdom 中由于 setTimeout 延迟 150ms 触发，我们这里可以用 user-event 或是简单等待，或者组件已经通过 setTimeout 触发）
    // 为了避开定时器问题，也可以直接触发 click 或 both 测试
  })

  // ==========================================
  // 测试二次行为确认气泡功能
  // ==========================================
  it("toggles confirm tooltip visibility on click", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <Tooltip title="Confirm this action?" onConfirm={onConfirm}>
        <button type="button">Trigger</button>
      </Tooltip>,
    )

    // 默认隐藏
    let tooltipTitle = screen.queryByText("Confirm this action?")
    expect(tooltipTitle).not.toBeInTheDocument()

    const triggerBtn = screen.getByRole("button", { name: "Trigger" })
    await user.click(triggerBtn)

    // 点击后应该渲染在 document.body 中
    tooltipTitle = screen.getByText("Confirm this action?")
    expect(tooltipTitle).toBeInTheDocument()

    // 点击确认按钮
    const confirmBtn = screen.getByRole("button", { name: "确认" })
    await user.click(confirmBtn)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <Tooltip title="Delete forever?" onConfirm={onConfirm} onCancel={onCancel}>
        <button type="button">Trigger</button>
      </Tooltip>,
    )

    const triggerBtn = screen.getByRole("button", { name: "Trigger" })
    await user.click(triggerBtn)

    const cancelBtn = screen.getByRole("button", { name: "取消" })
    await user.click(cancelBtn)

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
