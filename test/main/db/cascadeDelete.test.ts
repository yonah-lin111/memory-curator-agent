import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { createPromptDesignTables, createPromptAiPersistenceTables } from '@/db/index'

describe('SQLite Cascade Delete', () => {
  it('Cascades deletion from projects to designs and from designs to AI sessions/messages when foreign keys are enabled', () => {
    // 1. Initialize in-memory SQLite database
    const database = new Database(':memory:')
    
    // 2. Enable foreign key support (this is what we added in initDatabase)
    database.exec('PRAGMA foreign_keys = ON;')
    
    // 3. Create prompt design and prompt AI tables
    createPromptDesignTables(database)
    createPromptAiPersistenceTables(database)
    
    // 4. Insert a project
    database.prepare(`
      INSERT INTO prompt_design_projects (external_id, name, type, created_at, updated_at)
      VALUES ('p-1', 'Project 1', 'virtual', '2026-05-31', '2026-05-31')
    `).run()
    
    // 5. Insert a design item
    database.prepare(`
      INSERT INTO prompt_design_items (external_id, project_id, name, created_at, updated_at)
      VALUES ('d-1', 'p-1', 'Design 1', '2026-05-31', '2026-05-31')
    `).run()
    
    // 6. Insert an AI chat session
    database.prepare(`
      INSERT INTO prompt_ai_chat_sessions (external_id, design_item_id, title, status, created_at, updated_at, last_message_at)
      VALUES ('s-1', 'd-1', 'Session 1', 'idle', '2026-05-31', '2026-05-31', '2026-05-31')
    `).run()
    
    // 7. Insert an AI chat message
    database.prepare(`
      INSERT INTO prompt_ai_chat_messages (external_id, session_id, role, content, parts_json, tool_steps_json, time, created_at, updated_at)
      VALUES ('m-1', 's-1', 'user', 'Hello', '[]', '[]', '2026-05-31', '2026-05-31', '2026-05-31')
    `).run()
    
    // Verify inserts were successful
    expect(database.prepare("SELECT count(*) as count FROM prompt_design_projects").get()).toEqual({ count: 1 })
    expect(database.prepare("SELECT count(*) as count FROM prompt_design_items").get()).toEqual({ count: 1 })
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_sessions").get()).toEqual({ count: 1 })
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_messages").get()).toEqual({ count: 1 })
    
    // 8. Delete the project and verify cascade delete propagated through all layers
    database.prepare("DELETE FROM prompt_design_projects WHERE external_id = 'p-1'").run()
    
    expect(database.prepare("SELECT count(*) as count FROM prompt_design_projects").get()).toEqual({ count: 0 })
    expect(database.prepare("SELECT count(*) as count FROM prompt_design_items").get()).toEqual({ count: 0 })
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_sessions").get()).toEqual({ count: 0 })
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_messages").get()).toEqual({ count: 0 })
  })
})
