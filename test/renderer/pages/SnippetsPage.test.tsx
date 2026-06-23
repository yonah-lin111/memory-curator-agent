/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { SnippetsPage } from "@/pages/snippets/SnippetsPage";
import { Header } from "@/components/layout/Header";

// Today 单日数据类型，直接从 bridge 签名反推。
type DailyDayDataShape =
  Awaited<ReturnType<Window["api"]["daily"]["listDay"]>>;

// 渲染页面时补齐 Toast 与 Header 上下文。
const renderSnippetsPage = (): void => {
  render(
    <ToastProvider>
      <Header category="DAILY" activePage="snippets" />
      <SnippetsPage />
    </ToastProvider>,
  );
};

// 默认 Daily 返回值，供测试按需覆盖。
const createDailyDayData = (
  overrides?: Partial<DailyDayDataShape>,
): DailyDayDataShape => ({
  todos: [],
  snippets: [],
  journal: null,
  ...overrides,
});

describe("SnippetsPage", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-05-27T09:00:00"));
    window.api = {
      files: {
        saveMarkdownImage: vi.fn(),
      },
      daily: {
        listDay: vi.fn().mockResolvedValue(createDailyDayData()),
        listMonthOverview: vi.fn().mockResolvedValue({
          month: "2026-05",
          entries: [],
        }),
        saveJournal: vi.fn(),
        deleteJournal: vi.fn(),
        createTodo: vi.fn(),
        updateTodo: vi.fn(),
        deleteTodo: vi.fn(),
        sortTodos: vi.fn(),
        createSnippet: vi.fn(),
        updateSnippet: vi.fn(),
        deleteSnippet: vi.fn(),
      },
      notes: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      noteCategories: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    } as Window["api"];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("切换日期后重新加载片段", async () => {
    const listDay = vi
      .fn()
      .mockResolvedValueOnce(
        createDailyDayData({
          snippets: [
            {
              id: 1,
              entryDate: "2026-05-27",
              title: "今天片段",
              content: "A",
              tags: ["记录"],
              time: "09:00",
              createdAt: "2026-05-27 09:00",
              updatedAt: "2026-05-27 09:00",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createDailyDayData({
          snippets: [
            {
              id: 2,
              entryDate: "2026-05-26",
              title: "昨天片段",
              content: "B",
              tags: ["回看"],
              time: "09:00",
              createdAt: "2026-05-26 09:00",
              updatedAt: "2026-05-26 09:00",
            },
          ],
        }),
      );

    window.api.daily.listDay = listDay;
    window.api.daily.listMonthOverview = vi.fn().mockResolvedValue({
      month: "2026-05",
      entries: [
        {
          entryDate: "2026-05-26",
          todoCount: 0,
          snippetCount: 1,
          journalCount: 0,
        },
        {
          entryDate: "2026-05-27",
          todoCount: 0,
          snippetCount: 1,
          journalCount: 0,
        },
      ],
    });

    renderSnippetsPage();

    expect(await screen.findByText("今天片段")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Open date picker, current date 2026-05-27",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Select date 2026-05-26, has entries" }),
    );
    expect(await screen.findByText("昨天片段")).toBeInTheDocument();
  });

  it("点击日期后打开日期选择器并显示片段角标", async () => {
    window.api.daily.listMonthOverview = vi.fn().mockResolvedValue({
      month: "2026-05",
      entries: [
        {
          entryDate: "2026-05-26",
          todoCount: 0,
          snippetCount: 3,
          journalCount: 0,
        },
        {
          entryDate: "2026-05-27",
          todoCount: 0,
          snippetCount: 1,
          journalCount: 0,
        },
      ],
    });

    renderSnippetsPage();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Open date picker, current date 2026-05-27",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Date picker" });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select date 2026-05-27, has entries" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select date 2026-05-26, has entries" }),
    ).toBeInTheDocument();
  });

  it("支持按标签筛选并编辑片段", async () => {
    const updateSnippet = vi.fn().mockResolvedValue({
      id: 1,
      entryDate: "2026-05-27",
      title: "更新后的片段",
      content: "更新内容",
      tags: ["产品"],
      time: "09:30",
      createdAt: "2026-05-27 09:00",
      updatedAt: "2026-05-27 09:30",
    });

    window.api.daily.listDay = vi.fn().mockResolvedValue(
      createDailyDayData({
        snippets: [
          {
            id: 1,
            entryDate: "2026-05-27",
            title: "产品想法",
            content: "A",
            tags: ["产品"],
            time: "09:00",
            createdAt: "2026-05-27 09:00",
            updatedAt: "2026-05-27 09:00",
          },
          {
            id: 2,
            entryDate: "2026-05-27",
            title: "技术笔记",
            content: "B",
            tags: ["技术"],
            time: "09:10",
            createdAt: "2026-05-27 09:10",
            updatedAt: "2026-05-27 09:10",
          },
        ],
      }),
    );
    window.api.daily.updateSnippet = updateSnippet;

    renderSnippetsPage();

    expect(await screen.findByText("产品想法")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filter tag 产品" }));
    expect(screen.queryByText("技术笔记")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("产品想法"));
    await userEvent.clear(screen.getByLabelText("Snippet title"));
    await userEvent.type(screen.getByLabelText("Snippet title"), "更新后的片段");
    await userEvent.clear(screen.getByLabelText("Snippet content"));
    await userEvent.type(screen.getByLabelText("Snippet content"), "更新内容");
    await userEvent.click(screen.getByRole("button", { name: "保存随记卡片" }));

    await waitFor(() => {
      expect(updateSnippet).toHaveBeenCalledWith(1, {
        title: "更新后的片段",
        content: "更新内容",
        tags: ["产品"],
      });
    });
  });

  it("无 daily bridge 时仍可本地创建片段", async () => {
    const user = userEvent.setup();

    window.api = {
      files: {
        saveMarkdownImage: vi.fn(),
      },
      daily: undefined as never,
      notes: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      noteCategories: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    } as Window["api"];

    renderSnippetsPage();

    await user.click(screen.getByRole("button", { name: "Add snippet" }));
    await user.type(screen.getByLabelText("Snippet title"), "离线片段");
    await user.type(screen.getByLabelText("Snippet content"), "本地创建内容");
    await user.type(screen.getByLabelText("Input new tag"), "离线{Enter}");
    await user.click(screen.getByRole("button", { name: "保存随记卡片" }));

    expect(await screen.findByText("离线片段")).toBeInTheDocument();
  });

  it("无 daily bridge 时仍可本地更新并删除片段", async () => {
    const user = userEvent.setup();

    window.api = {
      files: {
        saveMarkdownImage: vi.fn(),
      },
      daily: undefined as never,
      notes: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      noteCategories: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    } as Window["api"];

    renderSnippetsPage();

    await user.click(screen.getByRole("button", { name: "Add snippet" }));
    await user.type(screen.getByLabelText("Snippet title"), "本地片段");
    await user.type(screen.getByLabelText("Snippet content"), "需要继续编辑");
    await user.type(screen.getByLabelText("Input new tag"), "本地{Enter}");
    await user.click(screen.getByRole("button", { name: "保存随记卡片" }));

    expect(await screen.findByText("本地片段")).toBeInTheDocument();

    await user.click(screen.getByText("本地片段"));
    await user.clear(screen.getByLabelText("Snippet title"));
    await user.type(screen.getByLabelText("Snippet title"), "本地片段-已更新");
    await user.click(screen.getByRole("button", { name: "保存随记卡片" }));
    expect(await screen.findByText("本地片段-已更新")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Delete snippet 本地片段-已更新" }),
    );
    await waitFor(() => {
      expect(screen.queryByText("本地片段-已更新")).not.toBeInTheDocument();
    });
  });

  it("片段写接口失败时显示兜底提示并保持原状态", async () => {
    const user = userEvent.setup();

    window.api.daily.listDay = vi.fn().mockResolvedValue(
      createDailyDayData({
        snippets: [
          {
            id: 1,
            entryDate: "2026-05-27",
            title: "稳定片段",
            content: "稳定内容",
            tags: ["稳定"],
            time: "09:00",
            createdAt: "2026-05-27 09:00",
            updatedAt: "2026-05-27 09:00",
          },
        ],
      }),
    );
    window.api.daily.createSnippet = vi
      .fn()
      .mockRejectedValue(new Error("create failed"));
    window.api.daily.updateSnippet = vi
      .fn()
      .mockRejectedValue(new Error("update failed"));
    window.api.daily.deleteSnippet = vi
      .fn()
      .mockRejectedValue(new Error("delete failed"));

    renderSnippetsPage();

    expect(await screen.findByText("稳定片段")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add snippet" }));
    await user.type(screen.getByLabelText("Snippet title"), "失败片段");
    await user.type(screen.getByLabelText("Snippet content"), "不会创建");
    await user.click(screen.getByRole("button", { name: "保存随记卡片" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("创建片段失败");
    expect(screen.queryByText("失败片段")).not.toBeInTheDocument();

    await user.click(screen.getByText("稳定片段"));
    await user.clear(screen.getByLabelText("Snippet title"));
    await user.type(screen.getByLabelText("Snippet title"), "稳定片段-修改");
    await user.click(screen.getByRole("button", { name: "保存随记卡片" }));
    await waitFor(() => {
      expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent("保存片段失败");
    });
    expect(screen.getByText("稳定片段")).toBeInTheDocument();
    expect(screen.queryByText("稳定片段-修改")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete snippet 稳定片段" }));
    await waitFor(() => {
      expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent("删除片段失败");
    });
    expect(screen.getByText("稳定片段")).toBeInTheDocument();
  });
});
