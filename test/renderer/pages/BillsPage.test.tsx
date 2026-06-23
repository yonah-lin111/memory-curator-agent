/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { BillsPage } from "@/pages/bills/BillsPage";

const renderBillsPage = (): void => {
  render(
    <ToastProvider>
      <BillsPage />
    </ToastProvider>,
  );
};

describe("BillsPage", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-06-23T09:00:00"));
    window.api = {
      bill: {
        list: vi.fn().mockResolvedValue([
          {
            id: 1,
            amount: 1500, // 15.00 CNY in cents
            category: "餐饮",
            billType: "expense",
            billDate: "2026-06-23",
            note: "午餐测试备注",
            tags: ["工作日", "美食"],
            createdAt: "2026-06-23 09:00",
            updatedAt: "2026-06-23 09:00",
          },
          {
            id: 2,
            amount: 50000, // 500.00 CNY in cents
            category: "工资",
            billType: "income",
            billDate: "2026-06-23",
            note: "兼职收入",
            tags: ["兼职"],
            createdAt: "2026-06-23 09:00",
            updatedAt: "2026-06-23 09:00",
          },
        ]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        todaySummary: vi.fn(),
      },
    } as any;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("正确渲染账单小卡片列表", async () => {
    renderBillsPage();

    // 验证标题和统计加载
    expect(await screen.findByText("账单列表")).toBeInTheDocument();

    // 验证小卡片和筛选栏中的分类 (卡片中1个，侧边栏筛选中1个，合计2个)
    expect(await screen.findAllByText("餐饮")).toHaveLength(2);
    expect(await screen.findAllByText("工资")).toHaveLength(2);

    // 验证小卡片中的金额
    expect(screen.getByText("-¥15.00")).toBeInTheDocument();
    expect(screen.getByText("+¥500.00")).toBeInTheDocument();

    // 验证备注和日期
    expect(screen.getByText("午餐测试备注")).toBeInTheDocument();
    expect(screen.getByText("兼职收入")).toBeInTheDocument();
    expect(screen.getAllByText("2026-06-23")).toHaveLength(2);

    // 验证标签渲染
    expect(screen.getByText("#工作日")).toBeInTheDocument();
    expect(screen.getByText("#美食")).toBeInTheDocument();
    expect(screen.getByText("#兼职")).toBeInTheDocument();
  });

  it("当无账单记录时正确展示空状态", async () => {
    window.api!.bill!.list = vi.fn().mockResolvedValue([]);
    renderBillsPage();

    // 验证展示空状态标题和描述
    expect(await screen.findByText("暂无匹配账单记录")).toBeInTheDocument();
    expect(
      screen.getByText(
        "没有找到符合当前筛选条件的账单，可尝试调整过滤条件或点击右上角加号录入新账单。",
      ),
    ).toBeInTheDocument();
  });
});
