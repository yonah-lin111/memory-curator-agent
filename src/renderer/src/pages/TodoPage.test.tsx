/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@renderer/components/ui/Toast";
import { TodoPage } from "@renderer/pages/TodoPage";

// 工作台单日数据类型，直接从 bridge 签名反推。
type WorkspaceDayDataShape =
  Awaited<ReturnType<Window["api"]["workspace"]["listDay"]>>;

// 渲染页面时补齐 Toast 上下文。
const renderTodoPage = (): void => {
  render(
    <ToastProvider>
      <TodoPage />
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

describe("TodoPage", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-05-27T09:00:00"));
    window.api = {
      workspace: {
        listDay: vi.fn().mockResolvedValue(createWorkspaceDayData()),
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
        createWorkspaceDayData({
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
        createWorkspaceDayData({
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

    window.api.workspace.listDay = listDay;

    renderTodoPage();

    expect(await screen.findByText("今天任务")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "查看前一天 2026-05-26" }),
    );
    expect(await screen.findByText("昨天任务")).toBeInTheDocument();
  });

  it("支持新增、切换完成、切换优先级和删除待办", async () => {
    const user = userEvent.setup();
    const listDay = vi.fn().mockResolvedValue(
      createWorkspaceDayData({
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

    window.api.workspace.listDay = listDay;
    window.api.workspace.createTodo = createTodo;
    window.api.workspace.updateTodo = updateTodo;
    window.api.workspace.deleteTodo = deleteTodo;
    window.api.workspace.sortTodos = vi.fn().mockResolvedValue([]);

    renderTodoPage();

    await user.type(
      await screen.findByPlaceholderText("添加一个待办，回车保存"),
      "新任务{enter}",
    );
    await waitFor(() => expect(createTodo).toHaveBeenCalled());

    const existingTodoText = screen.getByText("旧任务");
    const existingTodoItem = existingTodoText.closest(".group");
    const toggleButton = existingTodoItem?.querySelector<HTMLButtonElement>(
      'button[aria-label="标记为已完成"]',
    );
    const priorityButton = existingTodoItem?.querySelector<HTMLButtonElement>(
      'button[aria-label="切换 旧任务 的优先级"]',
    );
    const deleteButton = existingTodoItem?.querySelector<HTMLButtonElement>(
      'button[aria-label="删除待办 旧任务"]',
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
