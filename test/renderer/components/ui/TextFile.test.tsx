/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TextFile } from "@/components/ui/TextFile";

describe("TextFile Component", () => {
  beforeAll(() => {
    // 模拟 fetch 返回文本内容。
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("line 1\nline 2\nline 3"),
    } as Response);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders file name, size, and icon", () => {
    render(
      <TextFile
        url="mc-img://chat-text/test-file.txt"
        fileName="readme.md"
        sizeBytes={2048}
      />
    );

    expect(screen.getByTestId("text-file-card")).toBeInTheDocument();
    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });

  it("formats bytes correctly", () => {
    const { rerender } = render(
      <TextFile
        url="mc-img://chat-text/a.txt"
        fileName="a.txt"
        sizeBytes={500}
      />
    );

    expect(screen.getByText("500 B")).toBeInTheDocument();

    cleanup();

    render(
      <TextFile
        url="mc-img://chat-text/b.txt"
        fileName="b.txt"
        sizeBytes={1536000}
      />
    );

    expect(screen.getByText("1.5 MB")).toBeInTheDocument();
  });

  it("opens preview modal on click and displays text content", async () => {
    render(
      <TextFile
        url="mc-img://chat-text/test.txt"
        fileName="test.txt"
        sizeBytes={100}
      />
    );

    expect(screen.queryByTestId("text-file-preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("text-file-card"));

    expect(screen.getByTestId("text-file-preview")).toBeInTheDocument();

    await waitFor(() => {
      const preElement = screen.getByTestId("text-file-preview").querySelector("pre");
      expect(preElement).toBeInTheDocument();
      expect(preElement?.textContent).toBe("line 1\nline 2\nline 3");
    });
  });

  it("does not open preview when preview prop is false", () => {
    render(
      <TextFile
        url="mc-img://chat-text/test.txt"
        fileName="test.txt"
        sizeBytes={100}
        preview={false}
      />
    );

    fireEvent.click(screen.getByTestId("text-file-card"));
    expect(screen.queryByTestId("text-file-preview")).not.toBeInTheDocument();
  });

  it("closes preview via Close button and Escape key", async () => {
    render(
      <TextFile
        url="mc-img://chat-text/test.txt"
        fileName="test.txt"
        sizeBytes={100}
      />
    );

    fireEvent.click(screen.getByTestId("text-file-card"));
    expect(screen.getByTestId("text-file-preview")).toBeInTheDocument();

    const closeBtn = screen.getByLabelText("Close preview");
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId("text-file-preview")).not.toBeInTheDocument();

    // 重新打开后按 Escape
    fireEvent.click(screen.getByTestId("text-file-card"));
    expect(screen.getByTestId("text-file-preview")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("text-file-preview")).not.toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("fail"));

    render(
      <TextFile
        url="mc-img://chat-text/bad.txt"
        fileName="bad.txt"
        sizeBytes={100}
      />
    );

    fireEvent.click(screen.getByTestId("text-file-card"));

    await waitFor(() => {
      expect(screen.getByText("文件加载失败")).toBeInTheDocument();
    });
  });
});
