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

    testDb.prepare(`
      INSERT INTO prompt_design_modules (external_id, project_id, name, created_at, updated_at)
      VALUES ('m-1', 'p-1', 'Test Module', '2026-05-31', '2026-05-31')
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
      moduleId: 'm-1',
      name: 'Test Design'
    })

    expect(design.id).toBe('d-1')
    expect(design.name).toBe('Test Design')
    expect(design.status).toBe('todo')

    // 2. Perform a Markdown content update.
    const designData = '# Test prompt\n\nHello'

    promptDesignService.updateDesign('d-1', {
      name: 'Updated Name',
      designData
    })
    promptDesignService.updateDesign('d-1', { status: 'completed' })

    // 3. Verify design_items is updated
    const designRow = testDb.prepare("SELECT * FROM prompt_design_items WHERE external_id = 'd-1'").get() as any
    expect(designRow.name).toBe('Updated Name')
    expect(designRow.design_data).toEqual(designData)
    expect(designRow.status).toBe('completed')
    expect(() => testDb.prepare("UPDATE prompt_design_items SET status = 'invalid' WHERE external_id = 'd-1'").run()).toThrow()

  })

  it('cascades prompt designs when deleting a module', () => {
    const module = promptDesignService.createModule({
      id: 'm-2',
      projectId: 'p-1',
      name: 'Second Module'
    })

    promptDesignService.createDesign({
      id: 'd-2',
      projectId: 'p-1',
      moduleId: module.id,
      name: 'Second Design'
    })

    promptDesignService.deleteModule(module.id)

    expect(promptDesignService.listModules('p-1')).not.toContainEqual(
      expect.objectContaining({ id: module.id })
    )
    expect(promptDesignService.listDesigns('p-1')).not.toContainEqual(
      expect.objectContaining({ id: 'd-2' })
    )
  })

  it('creates a prompt design directly under a project', () => {
    const design = promptDesignService.createDesign({
      id: 'd-3',
      projectId: 'p-1',
      name: 'Project Design'
    })

    expect(design.moduleId).toBeUndefined()
    expect(promptDesignService.listDesigns('p-1')).toContainEqual(
      expect.objectContaining({ id: 'd-3', moduleId: undefined })
    )
  })

  it('places a new module design first', () => {
    promptDesignService.createDesign({
      id: 'd-1',
      projectId: 'p-1',
      moduleId: 'm-1',
      name: 'Existing Design'
    })
    promptDesignService.createDesign({
      id: 'd-2',
      projectId: 'p-1',
      moduleId: 'm-1',
      name: 'New Design'
    })

    const moduleDesigns = promptDesignService
      .listDesigns('p-1')
      .filter((design) => design.moduleId === 'm-1')

    expect(moduleDesigns.map((design) => design.id)).toEqual(['d-2', 'd-1'])
  })

  it('persists prompt design sort order', () => {
    promptDesignService.createDesign({
      id: 'd-1',
      projectId: 'p-1',
      moduleId: 'm-1',
      name: 'First Design'
    })
    promptDesignService.createDesign({
      id: 'd-2',
      projectId: 'p-1',
      moduleId: 'm-1',
      name: 'Second Design'
    })

    const sortedDesigns = promptDesignService.sortDesigns(['d-2', 'd-1'])

    expect(sortedDesigns.map((design) => design.id)).toEqual(['d-2', 'd-1'])
    expect(promptDesignService.listDesigns('p-1').map((design) => design.id)).toEqual([
      'd-2',
      'd-1'
    ])
  })
})
