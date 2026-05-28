import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerDailyHandlers } from '../../../src/main/ipc/dailyHandlers'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  dailyService: {
    listDay: vi.fn(),
    listMonthOverview: vi.fn(),
    saveJournal: vi.fn(),
    deleteJournal: vi.fn(),
    createTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
    reorderTodos: vi.fn(),
    createSnippet: vi.fn(),
    updateSnippet: vi.fn(),
    deleteSnippet: vi.fn()
  },
  filesService: {
    restoreReferencedMarkdownImages: vi.fn(),
    deleteUnusedMarkdownImages: vi.fn()
  },
  scheduleMarkdownImageMaintenance: vi.fn(),
  database: {}
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((name: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(name, handler)
    })
  }
}))

vi.mock('../../../src/main/db', () => ({
  getDatabase: vi.fn(() => mocks.database)
}))

vi.mock('../../../src/main/services/dailyService', () => ({
  createDailyService: vi.fn(() => mocks.dailyService)
}))

vi.mock('../../../src/main/services/filesService', () => ({
  createFilesService: vi.fn(() => mocks.filesService)
}))

vi.mock('../../../src/main/services/markdownImageMaintenance', () => ({
  scheduleMarkdownImageMaintenance: mocks.scheduleMarkdownImageMaintenance
}))

describe('dailyHandlers', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    vi.clearAllMocks()
    mocks.filesService.deleteUnusedMarkdownImages.mockResolvedValue({
      deletedCount: 0,
      deletedImages: []
    })
  })

  it('schedules markdown image maintenance after journal save', () => {
    mocks.dailyService.saveJournal.mockReturnValue({
      entryDate: '2026-05-28',
      content: '正文',
      createdAt: '2026-05-28 10:00',
      updatedAt: '2026-05-28 10:00'
    })

    registerDailyHandlers()

    const result = mocks.handlers.get('daily:journal:save')?.({}, {
      entryDate: '2026-05-28',
      content: '正文'
    })

    expect(result).toMatchObject({ entryDate: '2026-05-28', content: '正文' })
    expect(mocks.scheduleMarkdownImageMaintenance).toHaveBeenCalledWith(mocks.filesService)
  })

  it('schedules markdown image maintenance after snippet delete', () => {
    registerDailyHandlers()

    mocks.handlers.get('daily:snippet:delete')?.({}, 1)

    expect(mocks.dailyService.deleteSnippet).toHaveBeenCalledWith(1)
    expect(mocks.scheduleMarkdownImageMaintenance).toHaveBeenCalledWith(mocks.filesService)
  })
})
