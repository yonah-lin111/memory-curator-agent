import { beforeEach, describe, expect, it, vi } from "vitest"
import { registerNotesHandlers } from "@/ipc/notesHandlers"

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  notesService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  filesService: {
    restoreReferencedMarkdownImages: vi.fn(),
    deleteUnusedMarkdownImages: vi.fn(),
  },
  scheduleMarkdownImageMaintenance: vi.fn(),
  database: {},
}))

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((name: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(name, handler)
    }),
  },
}))

vi.mock("../../../src/main/db", () => ({
  getDatabase: vi.fn(() => mocks.database),
}))

vi.mock("../../../src/main/services/notesService", () => ({
  createNotesService: vi.fn(() => mocks.notesService),
}))

vi.mock("../../../src/main/services/filesService", () => ({
  createFilesService: vi.fn(() => mocks.filesService),
}))

vi.mock("../../../src/main/services/markdownImageMaintenance", () => ({
  scheduleMarkdownImageMaintenance: mocks.scheduleMarkdownImageMaintenance,
}))

describe("notesHandlers", () => {
  beforeEach(() => {
    mocks.handlers.clear()
    vi.clearAllMocks()
    mocks.filesService.deleteUnusedMarkdownImages.mockResolvedValue({
      deletedCount: 0,
      deletedImages: [],
    })
  })

  it("schedules markdown image maintenance after note content changes", () => {
    mocks.notesService.update.mockReturnValue({
      id: 1,
      title: "笔记",
      content: "正文",
      source: "随手速记",
      tags: [],
      time: "2026-05-28 10:00",
      isCurated: false,
    })

    registerNotesHandlers()

    const result = mocks.handlers.get("notes:update")?.({}, 1, {
      title: "笔记",
      content: "正文",
      source: "随手速记",
      tags: [],
    })

    expect(result).toMatchObject({ id: 1, content: "正文" })
    expect(mocks.scheduleMarkdownImageMaintenance).toHaveBeenCalledWith(mocks.filesService)
  })

  it("keeps note update successful when maintenance is scheduled", () => {
    mocks.notesService.update.mockReturnValue({
      id: 1,
      title: "笔记",
      content: "正文",
      source: "随手速记",
      tags: [],
      time: "2026-05-28 10:00",
      isCurated: false,
    })
    registerNotesHandlers()

    const result = mocks.handlers.get("notes:update")?.({}, 1, {
      title: "笔记",
      content: "正文",
      source: "随手速记",
      tags: [],
    })

    expect(result).toMatchObject({ id: 1, content: "正文" })
    expect(mocks.scheduleMarkdownImageMaintenance).toHaveBeenCalledWith(mocks.filesService)
  })
})
