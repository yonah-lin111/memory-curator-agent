/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MarkdownEditor } from "@/components/ui/MarkdownEditor"

const { codeMirrorExtensions } = vi.hoisted(() => ({
  codeMirrorExtensions: vi.fn(),
}))

// MdEditor 最近一次接收的属性。
let latestMdEditorProps: {
  noUploadImg?: boolean
  preview?: boolean
  onUploadImg?: (files: File[], callback: (urls: string[]) => void) => void
} | null = null

vi.mock("md-editor-rt", () => ({
  config: ({
    codeMirrorExtensions: configureExtensions,
  }: {
    codeMirrorExtensions: typeof codeMirrorExtensions
  }) => codeMirrorExtensions(configureExtensions),
  MdEditor: (props: typeof latestMdEditorProps) => {
    latestMdEditorProps = props
    return <textarea aria-label="markdown" />
  },
}))

describe("MarkdownEditor", () => {
  beforeEach(() => {
    latestMdEditorProps = null
    window.api = {
      files: {
        saveMarkdownImage: vi.fn().mockResolvedValue({
          fileName: "clipboard.png",
          filePath: "/Users/yonah/.mc/img/md/clipboard.png",
          url: "mc-img://md/clipboard.png",
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
      noteCategories: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    } as Window["api"]
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("enables image upload and persists pasted images through the bridge", async () => {
    const callback = vi.fn()
    const file = new File([new Uint8Array([1, 2, 3])], "paste.png", {
      type: "image/png",
    })

    render(
      <MarkdownEditor
        height={320}
        id="editor"
        placeholder="写点什么"
        value=""
        onChange={vi.fn()}
      />,
    )

    expect(latestMdEditorProps?.noUploadImg).toBeUndefined()
    expect(latestMdEditorProps?.preview).toBe(true)

    latestMdEditorProps?.onUploadImg?.([file], callback)

    await waitFor(() => {
      expect(window.api.files.saveMarkdownImage).toHaveBeenCalledWith({
        name: "paste.png",
        mimeType: "image/png",
        bytes: expect.any(ArrayBuffer),
      })
      expect(callback).toHaveBeenCalledWith(["mc-img://md/clipboard.png"])
    })
  })

  it("only abbreviates URLs and file paths", () => {
    const configureExtensions = codeMirrorExtensions.mock.calls[0]?.[0]
    const extensions = configureExtensions?.(
      [
        { type: "linkShortener", extension: [], options: { maxLength: 30 } },
        { type: "markdown", extension: [] },
      ],
      {
        editorId: "editor",
        theme: "dark",
        keyBindings: [],
      },
    )
    const linkShortener = extensions?.find((extension) => extension.type === "linkShortener")
    const findTexts = linkShortener?.options?.findTexts as
      | ((input: { lineText: string }) => Array<[number, number]>)
      | undefined
    const url = "https://example.com/a/very/long/path/that/should/be/abbreviated"
    const path =
      "/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/components/ui/MarkdownEditor.tsx"

    expect(findTexts?.({ lineText: "在日/常记录中理清头绪" })).toEqual([])
    expect(findTexts?.({ lineText: url })).toEqual([[0, url.length]])
    expect(findTexts?.({ lineText: path })).toEqual([[0, path.length]])
    expect(linkShortener?.options?.maxLength).toBe(30)
    expect(extensions).toContainEqual(expect.objectContaining({ type: "markdown" }))
  })
})
