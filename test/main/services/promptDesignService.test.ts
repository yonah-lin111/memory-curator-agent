import Database from 'better-sqlite3'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createPromptDesignTables, createPromptActiveNodesTable } from '@/db/index'
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
    createPromptActiveNodesTable(testDb)

    // Insert a dummy project
    testDb.prepare(`
      INSERT INTO prompt_design_projects (external_id, name, type, created_at, updated_at)
      VALUES ('p-1', 'Test Project', 'virtual', '2026-05-31', '2026-05-31')
    `).run()
  })

  afterEach(() => {
    testDb.close()
  })

  it('correctly updates prompt design items and parses/saves/sorts active nodes', () => {
    // 1. Create a design item
    const design = promptDesignService.createDesign({
      id: 'd-1',
      projectId: 'p-1',
      name: 'Test Design'
    })

    expect(design.id).toBe('d-1')
    expect(design.name).toBe('Test Design')

    // 2. Perform designData update containing ReactFlow nodes
    const designData = {
      nodes: [
        {
          id: 'node-format',
          parentId: 'node-task',
          data: {
            nodeType: 'output_format',
            title: 'Format Rule',
            content: 'Deliver output as JSON'
          },
          position: { x: 10, y: 300 }
        },
        {
          id: 'node-role',
          data: {
            nodeType: 'system_role',
            title: 'System Role',
            content: 'You are an AI assistant'
          },
          position: { x: 50, y: 100 }
        },
        {
          id: 'node-helper',
          data: {
            nodeType: 'assemble_a', // should be excluded as an auxiliary node
            title: 'Assembler',
            content: ''
          },
          position: { x: 150, y: 200 }
        }
      ]
    }

    promptDesignService.updateDesign('d-1', {
      name: 'Updated Name',
      designData
    })

    // 3. Verify design_items is updated
    const designRow = testDb.prepare("SELECT * FROM prompt_design_items WHERE external_id = 'd-1'").get() as any
    expect(designRow.name).toBe('Updated Name')
    expect(JSON.parse(designRow.design_data)).toEqual(designData)

    // 4. Verify prompt_active_nodes gets populated, filtered, and sorted
    const activeNodes = testDb.prepare("SELECT * FROM prompt_active_nodes ORDER BY sort_order ASC").all() as any[]

    // Expecting 2 nodes: format and role (helper assemble_a should be filtered out)
    expect(activeNodes).toHaveLength(2)

    // Check sort order. Based on position.y ascending:
    // node-role: y = 100 -> sort_order = 0
    // node-format: y = 300 -> sort_order = 1
    const firstNode = activeNodes[0]
    expect(firstNode.external_id).toBe('node-role')
    expect(firstNode.node_type).toBe('system_role')
    expect(firstNode.title).toBe('System Role')
    expect(firstNode.content).toBe('You are an AI assistant')
    expect(firstNode.parent_node_id).toBeNull()

    const secondNode = activeNodes[1]
    expect(secondNode.external_id).toBe('node-format')
    expect(secondNode.node_type).toBe('output_format')
    expect(secondNode.title).toBe('Format Rule')
    expect(secondNode.content).toBe('Deliver output as JSON')
    expect(secondNode.parent_node_id).toBe('node-task')
  })
})
