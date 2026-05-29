import { describe, expect, it, vi } from 'vitest'
import { createSystemPrompt } from '../../../src/main/ipc/aiHandlers'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

vi.mock('../../../src/main/db', () => ({
  getDatabase: vi.fn()
}))

describe('aiHandlers', () => {
  it('system prompt 不硬编码具体工具名，避免工具被筛掉时诱导伪调用', () => {
    expect(createSystemPrompt().content).not.toContain('people_list')
    expect(createSystemPrompt().content).toContain('已授权工具')
  })
})
