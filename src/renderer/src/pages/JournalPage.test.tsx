/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@renderer/components/ui/Toast";
import { JournalPage } from "@renderer/pages/JournalPage";

// 工作台单日数据类型，直接从 bridge 签名反推。
type WorkspaceDayDataShape =
  Awaited<ReturnType<Window["api"]["workspace"]["listDay"]>>;

vi.mock("@uiw/react-md-editor", () => ({
  default: ({
    value,
    onChange,
    textareaProps,
  }: {
    value?: string;
    onChange?: (value?: string) => void;
    textareaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  }) => (
    <textarea
      aria-label={textareaProps?.["aria-label"] ?? "日记正文"}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={textareaProps?.onBlur}
    />
  ),
}));

// 渲染页面时复用 ToastProvider，避免 Hook 缺失。
const renderJournalPage = (): void => {
  render(
    <ToastProvider>
      <JournalPage />
    </ToastProvider>,
  );
};

// 默认工作台返回值，供测试按需覆盖。
const createWorkspaceDayData = (
  overrides?: Partial<WorkspaceDayDataShape>,
): WorkspaceDayDataShape => ({
  todos: [],
  snippets: [],
  journal: null,
  ...overrides,
});

describe("JournalPage", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-05-27T09:00:00"));
    window.api = {
      workspace: {
        listDay: vi.fn().mockResolvedValue(createWorkspaceDayData()),
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
    } as Window["api"];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("支持切换日期并重新读取日记", async () => {
    const listDay = vi
      .fn()
      .mockResolvedValueOnce(
        createWorkspaceDayData({
          journal: {
            entryDate: "2026-05-27",
            content: "今天的日记",
            createdAt: "2026-05-27 09:00",
            updatedAt: "2026-05-27 09:30",
          },
        }),
      )
      .mockResolvedValueOnce(
        createWorkspaceDayData({
          journal: {
            entryDate: "2026-05-26",
            content: "昨天的日记",
            createdAt: "2026-05-26 09:00",
            updatedAt: "2026-05-26 09:30",
          },
        }),
      );

    window.api.workspace.listDay = listDay;
    window.api.workspace.listMonthOverview = vi.fn().mockResolvedValue({
      month: "2026-05",
      entries: [
        {
          entryDate: "2026-05-26",
          todoCount: 0,
          snippetCount: 0,
          journalCount: 1,
        },
        {
          entryDate: "2026-05-27",
          todoCount: 0,
          snippetCount: 0,
          journalCount: 1,
        },
      ],
    });

    renderJournalPage();

    expect(await screen.findByDisplayValue("今天的日记")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: "打开 Journal 日期选择器，当前日期 2026-05-27",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "选择日期 2026-05-26，当日已有 1 篇日记" }),
    );

    expect(listDay).toHaveBeenLastCalledWith("2026-05-26");
    expect(await screen.findByDisplayValue("昨天的日记")).toBeInTheDocument();
  });

  it("点击日期后打开日期选择器并显示日记角标", async () => {
    window.api.workspace.listMonthOverview = vi.fn().mockResolvedValue({
      month: "2026-05",
      entries: [
        {
          entryDate: "2026-05-26",
          todoCount: 0,
          snippetCount: 0,
          journalCount: 1,
        },
        {
          entryDate: "2026-05-27",
          todoCount: 0,
          snippetCount: 0,
          journalCount: 1,
        },
      ],
    });

    renderJournalPage();

    await userEvent.click(
      screen.getByRole("button", {
        name: "打开 Journal 日期选择器，当前日期 2026-05-27",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Journal 日期选择器" });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "选择日期 2026-05-27，当日已有 1 篇日记" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "选择日期 2026-05-26，当日已有 1 篇日记" }),
    ).toBeInTheDocument();
  });

  it("切换日期前会先按旧日期保存当前草稿", async () => {
    const listDay = vi
      .fn()
      .mockResolvedValueOnce(createWorkspaceDayData())
      .mockResolvedValueOnce(
        createWorkspaceDayData({
          journal: {
            entryDate: "2026-05-26",
            content: "昨天内容",
            createdAt: "2026-05-26 09:00",
            updatedAt: "2026-05-26 09:10",
          },
        }),
      );
    const saveJournal = vi.fn().mockResolvedValue({
      entryDate: "2026-05-27",
      content: "待保存草稿",
      createdAt: "2026-05-27 09:00",
      updatedAt: "2026-05-27 09:20",
    });
    const user = userEvent.setup();

    window.api.workspace.listDay = listDay;
    window.api.workspace.saveJournal = saveJournal;

    renderJournalPage();

    await user.type(await screen.findByLabelText("日记正文"), "待保存草稿");
    await user.click(
      screen.getByRole("button", { name: "查看前一天 2026-05-26" }),
    );

    await waitFor(() => {
      expect(saveJournal).toHaveBeenCalledWith({
        entryDate: "2026-05-27",
        content: "待保存草稿",
      });
    });
    expect(listDay).toHaveBeenLastCalledWith("2026-05-26");
    expect(await screen.findByDisplayValue("昨天内容")).toBeInTheDocument();
  });

  it("输入日记后自动保存并刷新保存时间", async () => {
    const user = userEvent.setup();

    const saveJournal = vi.fn().mockResolvedValue({
      entryDate: "2026-05-27",
      content: "新的内容",
      createdAt: "2026-05-27 09:00",
      updatedAt: "2026-05-27 09:35",
    });

    window.api.workspace.listDay = vi
      .fn()
      .mockResolvedValue(createWorkspaceDayData());
    window.api.workspace.saveJournal = saveJournal;

    renderJournalPage();

    await user.type(await screen.findByLabelText("日记正文"), "新的内容");

    await waitFor(() => {
      expect(saveJournal).toHaveBeenCalledWith({
        entryDate: "2026-05-27",
        content: "新的内容",
      });
    }, { timeout: 2000 });

    expect(screen.getByText("09:35")).toBeInTheDocument();
  });

  it("清空正文后调用删除接口", async () => {
    const user = userEvent.setup();

    const deleteJournal = vi.fn().mockResolvedValue(undefined);

    window.api.workspace.listDay = vi.fn().mockResolvedValue(
      createWorkspaceDayData({
        journal: {
          entryDate: "2026-05-27",
          content: "旧内容",
          createdAt: "2026-05-27 09:00",
          updatedAt: "2026-05-27 09:05",
        },
      }),
    );
    window.api.workspace.deleteJournal = deleteJournal;

    renderJournalPage();

    const editor = await screen.findByLabelText("日记正文");
    await user.clear(editor);

    await waitFor(() => {
      expect(deleteJournal).toHaveBeenCalledWith("2026-05-27");
    }, { timeout: 2000 });
  });
});
