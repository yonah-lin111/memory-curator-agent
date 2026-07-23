import Database from "better-sqlite3"
import { describe, expect, it } from "vitest"
import { createPromptAiPersistenceTables, createPromptDesignTables } from "@/db/index"

describe("SQLite Cascade Delete", () => {
  it("Cascades deletion from projects to designs and from designs to AI sessions/messages when foreign keys are enabled", () => {
    // 1. Initialize in-memory SQLite database
    const database = new Database(":memory:")

    // 2. Enable foreign key support (this is what we added in initDatabase)
    database.exec("PRAGMA foreign_keys = ON;")

    // 3. Create prompt design and prompt AI tables
    createPromptDesignTables(database)
    createPromptAiPersistenceTables(database)

    // 4. Insert a project
    database
      .prepare(`
      INSERT INTO prompt_design_projects (external_id, name, type, created_at, updated_at)
      VALUES ('p-1', 'Project 1', 'virtual', '2026-05-31', '2026-05-31')
    `)
      .run()

    // 5. Insert a design item
    database
      .prepare(`
      INSERT INTO prompt_design_items (external_id, project_id, name, created_at, updated_at)
      VALUES ('d-1', 'p-1', 'Design 1', '2026-05-31', '2026-05-31')
    `)
      .run()

    // 6. Insert an AI chat session
    database
      .prepare(`
      INSERT INTO prompt_ai_chat_sessions (external_id, design_item_id, title, status, created_at, updated_at, last_message_at)
      VALUES ('s-1', 'd-1', 'Session 1', 'idle', '2026-05-31', '2026-05-31', '2026-05-31')
    `)
      .run()

    // 7. Insert an AI chat message
    database
      .prepare(`
      INSERT INTO prompt_ai_chat_messages (external_id, session_id, role, content, parts_json, tool_steps_json, time, created_at, updated_at)
      VALUES ('m-1', 's-1', 'user', 'Hello', '[]', '[]', '2026-05-31', '2026-05-31', '2026-05-31')
    `)
      .run()

    // Verify inserts were successful
    expect(database.prepare("SELECT count(*) as count FROM prompt_design_projects").get()).toEqual({
      count: 1,
    })
    expect(database.prepare("SELECT count(*) as count FROM prompt_design_items").get()).toEqual({
      count: 1,
    })
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_sessions").get()).toEqual(
      { count: 1 },
    )
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_messages").get()).toEqual(
      { count: 1 },
    )

    // 8. Delete the project and verify cascade delete propagated through all layers
    database.prepare("DELETE FROM prompt_design_projects WHERE external_id = 'p-1'").run()

    expect(database.prepare("SELECT count(*) as count FROM prompt_design_projects").get()).toEqual({
      count: 0,
    })
    expect(database.prepare("SELECT count(*) as count FROM prompt_design_items").get()).toEqual({
      count: 0,
    })
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_sessions").get()).toEqual(
      { count: 0 },
    )
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_messages").get()).toEqual(
      { count: 0 },
    )
  })

  it("Cascades deletion from sessions to messages, runs, tool calls, and context snapshots when a session is deleted", () => {
    const database = new Database(":memory:")
    database.exec("PRAGMA foreign_keys = ON;")

    createPromptDesignTables(database)
    createPromptAiPersistenceTables(database)

    // 1. Insert setup data
    database
      .prepare(`
      INSERT INTO prompt_design_projects (external_id, name, type, created_at, updated_at)
      VALUES ('p-2', 'Project 2', 'virtual', '2026-05-31', '2026-05-31')
    `)
      .run()

    database
      .prepare(`
      INSERT INTO prompt_design_items (external_id, project_id, name, created_at, updated_at)
      VALUES ('d-2', 'p-2', 'Design 2', '2026-05-31', '2026-05-31')
    `)
      .run()

    database
      .prepare(`
      INSERT INTO prompt_ai_chat_sessions (external_id, design_item_id, title, status, created_at, updated_at, last_message_at)
      VALUES ('s-2', 'd-2', 'Session 2', 'idle', '2026-05-31', '2026-05-31', '2026-05-31')
    `)
      .run()

    database
      .prepare(`
      INSERT INTO prompt_ai_chat_messages (external_id, session_id, role, content, parts_json, tool_steps_json, time, created_at, updated_at)
      VALUES ('m-2', 's-2', 'user', 'Hello', '[]', '[]', '2026-05-31', '2026-05-31', '2026-05-31')
    `)
      .run()

    database
      .prepare(`
      INSERT INTO prompt_ai_agent_runs (external_id, session_id, assistant_message_id, status, started_at)
      VALUES ('r-2', 's-2', 'm-ai-2', 'completed', '2026-05-31')
    `)
      .run()

    database
      .prepare(`
      INSERT INTO prompt_ai_agent_tool_calls (external_id, run_id, message_id, tool_call_id, name, status, input_json, observation, data_json, created_at, updated_at)
      VALUES ('tc-2', 'r-2', 'm-ai-2', 'call-2', 'test_tool', 'done', '{}', '', '{}', '2026-05-31', '2026-05-31')
    `)
      .run()

    database
      .prepare(`
      INSERT INTO prompt_ai_agent_context_snapshots (run_id, context_key, kind, title, content, created_order, meta_json)
      VALUES ('r-2', 'snapshot-2', 'test', 'Snapshot Title', 'content', 1, '{}')
    `)
      .run()

    // Verify all rows exist
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_sessions").get()).toEqual(
      { count: 1 },
    )
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_messages").get()).toEqual(
      { count: 1 },
    )
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_agent_runs").get()).toEqual({
      count: 1,
    })
    expect(
      database.prepare("SELECT count(*) as count FROM prompt_ai_agent_tool_calls").get(),
    ).toEqual({ count: 1 })
    expect(
      database.prepare("SELECT count(*) as count FROM prompt_ai_agent_context_snapshots").get(),
    ).toEqual({ count: 1 })

    // 2. Delete the session
    database.prepare("DELETE FROM prompt_ai_chat_sessions WHERE external_id = 's-2'").run()

    // 3. Verify they are all deleted via multi-level cascade
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_sessions").get()).toEqual(
      { count: 0 },
    )
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_chat_messages").get()).toEqual(
      { count: 0 },
    )
    expect(database.prepare("SELECT count(*) as count FROM prompt_ai_agent_runs").get()).toEqual({
      count: 0,
    })
    expect(
      database.prepare("SELECT count(*) as count FROM prompt_ai_agent_tool_calls").get(),
    ).toEqual({ count: 0 })
    expect(
      database.prepare("SELECT count(*) as count FROM prompt_ai_agent_context_snapshots").get(),
    ).toEqual({ count: 0 })
  })
})
