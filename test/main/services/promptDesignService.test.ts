import Database from 'better-sqlite3'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createPromptDesignTables } from '@/db/index'
import { promptDesignService } from '@/services/promptDesignService'

// Mock the getDatabase import from db to return our test in-memory db
let testDb: Database.Database

vi.mock('@/db', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    getDatabase: () => testDb
  }
})

describe('promptDesignService', () => {
  beforeEach(() => {
    testDb = new Database(':memory:')
    testDb.exec('PRAGMA foreign_keys = ON;')
    createPromptDesignTables(testDb)

    // Insert a dummy project
    testDb.prepare(`
      INSERT INTO prompt_design_projects (external_id, name, type, created_at, updated_at)
      VALUES ('p-1', 'Test Project', 'virtual', '2026-05-31', '2026-05-31')
    `).run()
  })

  afterEach(() => {
    testDb.close()
  })

  it('correctly updates prompt design items', () => {
    // 1. Create a design item
    const design = promptDesignService.createDesign({
      id: 'd-1',
      projectId: 'p-1',
      name: 'Test Design'
    })

    expect(design.id).toBe('d-1')
    expect(design.name).toBe('Test Design')

    // 2. Perform a Markdown content update.
    const designData = '# Test prompt\n\nHello'

    promptDesignService.updateDesign('d-1', {
      name: 'Updated Name',
      designData
    })

    // 3. Verify design_items is updated
    const designRow = testDb.prepare("SELECT * FROM prompt_design_items WHERE external_id = 'd-1'").get() as any
    expect(designRow.name).toBe('Updated Name')
    expect(designRow.design_data).toEqual(designData)

  })
})
