/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TextFile } from "@/components/ui/TextFile";

vi.mock("md-editor-rt", () => ({
  MdPreview: ({ modelValue }: { modelValue: string }) => (
    <div data-testid="md-preview">{modelValue}</div>
  ),
}));

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
    render(
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
      const previewElement = screen.getByTestId("md-preview");
      expect(previewElement).toBeInTheDocument();
      expect(previewElement.textContent).toBe("```text\nline 1\nline 2\nline 3\n```");
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

  it("previews markdown file directly without wrapping in code blocks", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("# Title\n- Item 1\n- Item 2"),
    } as Response);

    render(
      <TextFile
        url="mc-img://chat-text/test.md"
        fileName="test.md"
        sizeBytes={100}
      />
    );

    fireEvent.click(screen.getByTestId("text-file-card"));

    await waitFor(() => {
      const previewElement = screen.getByTestId("md-preview");
      expect(previewElement).toBeInTheDocument();
      expect(previewElement.textContent).toBe("# Title\n- Item 1\n- Item 2");
    });
  });

  it("previews typescript file with typescript code blocks", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("const x: number = 42;"),
    } as Response);

    render(
      <TextFile
        url="mc-img://chat-text/test.ts"
        fileName="test.ts"
        sizeBytes={100}
      />
    );

    fireEvent.click(screen.getByTestId("text-file-card"));

    await waitFor(() => {
      const previewElement = screen.getByTestId("md-preview");
      expect(previewElement).toBeInTheDocument();
      expect(previewElement.textContent).toBe("```typescript\nconst x: number = 42;\n```");
    });
  });

  it("handles backticks correctly in file content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("Some code with ``` in it"),
    } as Response);

    render(
      <TextFile
        url="mc-img://chat-text/test.js"
        fileName="test.js"
        sizeBytes={100}
      />
    );

    fireEvent.click(screen.getByTestId("text-file-card"));

    await waitFor(() => {
      const previewElement = screen.getByTestId("md-preview");
      expect(previewElement).toBeInTheDocument();
      expect(previewElement.textContent).toBe("````javascript\nSome code with ``` in it\n````");
    });
  });
});
