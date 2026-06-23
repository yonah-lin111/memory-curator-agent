/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { JournalPage } from "@/pages/journal/JournalPage";
import { Header } from "@/components/layout/Header";

// Daily 单日数据类型，直接从 bridge 签名反推。
type DailyDayDataShape =
  Awaited<ReturnType<Window["api"]["daily"]["listDay"]>>;

vi.mock("md-editor-rt", () => ({
  MdEditor: ({
    value,
    onChange,
    onBlur,
    placeholder,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="Journal content"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={onBlur}
    />
  ),
}));

// 渲染页面时复用 ToastProvider 与 Header，避免 Hook 缺失。
const renderJournalPage = (): void => {
  render(
    <ToastProvider>
      <Header category="DAILY" activePage="journal" />
      <JournalPage />
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

describe("JournalPage", () => {
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

  it("支持切换日期并重新读取日记", async () => {
    const listDay = vi
      .fn()
      .mockResolvedValueOnce(
        createDailyDayData({
          journal: {
            id: 1,
            entryDate: "2026-05-27",
            content: "今天的日记",
            createdAt: "2026-05-27 09:00",
            updatedAt: "2026-05-27 09:30",
          },
        }),
      )
      .mockResolvedValueOnce(
        createDailyDayData({
          journal: {
            id: 2,
            entryDate: "2026-05-26",
            content: "昨天的日记",
            createdAt: "2026-05-26 09:00",
            updatedAt: "2026-05-26 09:30",
          },
        }),
      );

    window.api.daily.listDay = listDay;
    window.api.daily.listMonthOverview = vi.fn().mockResolvedValue({
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
        name: "Open date picker, current date 2026-05-27",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Select date 2026-05-26, has entries" }),
    );

    expect(listDay).toHaveBeenLastCalledWith("2026-05-26");
    expect(await screen.findByDisplayValue("昨天的日记")).toBeInTheDocument();
  });

  it("点击日期后打开日期选择器并显示日记角标", async () => {
    window.api.daily.listMonthOverview = vi.fn().mockResolvedValue({
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

  it("切换日期前会先按旧日期保存当前草稿", async () => {
    const listDay = vi
      .fn()
      .mockResolvedValueOnce(createDailyDayData())
      .mockResolvedValueOnce(
        createDailyDayData({
          journal: {
            id: 3,
            entryDate: "2026-05-26",
            content: "昨天内容",
            createdAt: "2026-05-26 09:00",
            updatedAt: "2026-05-26 09:10",
          },
        }),
      );
    const saveJournal = vi.fn().mockResolvedValue({
      id: 5,
      entryDate: "2026-05-27",
      content: "待保存草稿",
      createdAt: "2026-05-27 09:00",
      updatedAt: "2026-05-27 09:20",
    });
    const user = userEvent.setup();

    window.api.daily.listDay = listDay;
    window.api.daily.saveJournal = saveJournal;

    renderJournalPage();

    await user.type(await screen.findByLabelText("Journal content"), "待保存草稿");
    await user.click(
      screen.getByRole("button", { name: "View previous day 2026-05-26" }),
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
      id: 6,
      entryDate: "2026-05-27",
      content: "新的内容",
      createdAt: "2026-05-27 09:00",
      updatedAt: "2026-05-27 09:35",
    });

    window.api.daily.listDay = vi
      .fn()
      .mockResolvedValue(createDailyDayData());
    window.api.daily.saveJournal = saveJournal;

    renderJournalPage();

    await user.type(await screen.findByLabelText("Journal content"), "新的内容");

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

    window.api.daily.listDay = vi.fn().mockResolvedValue(
      createDailyDayData({
        journal: {
          id: 4,
          entryDate: "2026-05-27",
          content: "旧内容",
          createdAt: "2026-05-27 09:00",
          updatedAt: "2026-05-27 09:05",
        },
      }),
    );
    window.api.daily.deleteJournal = deleteJournal;

    renderJournalPage();

    const editor = await screen.findByLabelText("Journal content");
    await user.clear(editor);

    await waitFor(() => {
      expect(deleteJournal).toHaveBeenCalledWith("2026-05-27");
    }, { timeout: 2000 });
  });
});
