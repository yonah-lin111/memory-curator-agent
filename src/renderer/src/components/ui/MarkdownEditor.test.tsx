/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "./MarkdownEditor";

// MdEditor 最近一次接收的属性。
let latestMdEditorProps: {
  noUploadImg?: boolean;
  onUploadImg?: (files: File[], callback: (urls: string[]) => void) => void;
} | null = null;

vi.mock("md-editor-rt", () => ({
  MdEditor: (props: typeof latestMdEditorProps) => {
    latestMdEditorProps = props;
    return <textarea aria-label="markdown" />;
  },
}));

describe("MarkdownEditor", () => {
  beforeEach(() => {
    latestMdEditorProps = null;
    window.api = {
      files: {
        saveMarkdownImage: vi.fn().mockResolvedValue({
          fileName: "clipboard.png",
          filePath: "/Users/yonah/.mc/img/md/clipboard.png",
          url: "file:///Users/yonah/.mc/img/md/clipboard.png",
        }),
      },
      daily: {
        listDay: vi.fn(),
        listMonthOverview: vi.fn(),
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

  it("enables image upload and persists pasted images through the bridge", async () => {
    const callback = vi.fn();
    const file = new File([new Uint8Array([1, 2, 3])], "paste.png", {
      type: "image/png",
    });

    render(
      <MarkdownEditor
        height={320}
        id="editor"
        placeholder="写点什么"
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(latestMdEditorProps?.noUploadImg).toBeUndefined();

    latestMdEditorProps?.onUploadImg?.([file], callback);

    await waitFor(() => {
      expect(window.api.files.saveMarkdownImage).toHaveBeenCalledWith({
        name: "paste.png",
        mimeType: "image/png",
        bytes: expect.any(ArrayBuffer),
      });
      expect(callback).toHaveBeenCalledWith([
        "file:///Users/yonah/.mc/img/md/clipboard.png",
      ]);
    });
  });
});
