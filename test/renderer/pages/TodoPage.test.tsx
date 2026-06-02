/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@renderer/components/ui/Toast";
import { TodoPage } from "@renderer/pages/todo/TodoPage";

// Today 单日数据类型，直接从 bridge 签名反推。
type DailyDayDataShape =
  Awaited<ReturnType<Window["api"]["daily"]["listDay"]>>;

// 渲染页面时补齐 Toast 上下文。
const renderTodoPage = (): void => {
  render(
    <ToastProvider>
      <TodoPage />
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

describe("TodoPage", () => {
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
    } as Window["api"];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("切换日期后重新加载待办", async () => {
    const listDay = vi
      .fn()
      .mockResolvedValueOnce(
        createDailyDayData({
          todos: [
            {
              id: 1,
              entryDate: "2026-05-27",
              text: "今天任务",
              completed: false,
              priority: "P1",
              sortOrder: 0,
              createdAt: "2026-05-27 09:00",
              updatedAt: "2026-05-27 09:00",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createDailyDayData({
          todos: [
            {
              id: 2,
              entryDate: "2026-05-26",
              text: "昨天任务",
              completed: false,
              priority: "P0",
              sortOrder: 0,
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
          todoCount: 1,
          snippetCount: 0,
          journalCount: 0,
        },
        {
          entryDate: "2026-05-27",
          todoCount: 1,
          snippetCount: 0,
          journalCount: 0,
        },
      ],
    });

    renderTodoPage();

    expect(await screen.findByText("今天任务")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Open date picker, current date 2026-05-27",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Select date 2026-05-26, has entries" }),
    );
    expect(await screen.findByText("昨天任务")).toBeInTheDocument();
  });

  it("点击日期后打开日期选择器并显示待办角标", async () => {
    window.api.daily.listMonthOverview = vi.fn().mockResolvedValue({
      month: "2026-05",
      entries: [
        {
          entryDate: "2026-05-26",
          todoCount: 2,
          snippetCount: 0,
          journalCount: 0,
        },
        {
          entryDate: "2026-05-27",
          todoCount: 1,
          snippetCount: 0,
          journalCount: 0,
        },
      ],
    });

    renderTodoPage();

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

  it("支持新增、切换完成、切换优先级和删除待办", async () => {
    const user = userEvent.setup();
    const listDay = vi.fn().mockResolvedValue(
      createDailyDayData({
        todos: [
          {
            id: 1,
            entryDate: "2026-05-27",
            text: "旧任务",
            completed: false,
            priority: "P1",
            sortOrder: 0,
            createdAt: "2026-05-27 09:00",
            updatedAt: "2026-05-27 09:00",
          },
        ],
      }),
    );
    const createTodo = vi.fn().mockResolvedValue({
      id: 2,
      entryDate: "2026-05-27",
      text: "新任务",
      completed: false,
      priority: "P2",
      sortOrder: 1,
      createdAt: "2026-05-27 09:30",
      updatedAt: "2026-05-27 09:30",
    });
    const updateTodo = vi
      .fn()
      .mockResolvedValueOnce({
        id: 1,
        entryDate: "2026-05-27",
        text: "旧任务",
        completed: true,
        priority: "P1",
        sortOrder: 0,
        createdAt: "2026-05-27 09:00",
        updatedAt: "2026-05-27 09:40",
      })
      .mockResolvedValueOnce({
        id: 1,
        entryDate: "2026-05-27",
        text: "旧任务",
        completed: true,
        priority: "P2",
        sortOrder: 0,
        createdAt: "2026-05-27 09:00",
        updatedAt: "2026-05-27 09:41",
      });
    const deleteTodo = vi.fn().mockResolvedValue(undefined);

    window.api.daily.listDay = listDay;
    window.api.daily.createTodo = createTodo;
    window.api.daily.updateTodo = updateTodo;
    window.api.daily.deleteTodo = deleteTodo;
    window.api.daily.sortTodos = vi.fn().mockResolvedValue([]);

    renderTodoPage();

    await user.type(
      await screen.findByPlaceholderText("添加一个待办，回车保存"),
      "新任务{enter}",
    );
    await waitFor(() => expect(createTodo).toHaveBeenCalled());

    const existingTodoText = screen.getByText("旧任务");
    const existingTodoItem = existingTodoText.closest(".group");
    const toggleButton = existingTodoItem?.querySelector<HTMLButtonElement>(
      'button[aria-label="Mark as completed"]',
    );
    const priorityButton = existingTodoItem?.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle priority of 旧任务"]',
    );
    const deleteButton = existingTodoItem?.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete todo 旧任务"]',
    );

    expect(toggleButton).not.toBeNull();
    expect(priorityButton).not.toBeNull();
    expect(deleteButton).not.toBeNull();

    await user.click(toggleButton!);
    await waitFor(() => expect(updateTodo).toHaveBeenCalled());

    await user.click(priorityButton!);
    await waitFor(() => expect(updateTodo).toHaveBeenCalledTimes(2));

    await user.click(deleteButton!);
    await waitFor(() => expect(deleteTodo).toHaveBeenCalledWith(1));
  });
});
