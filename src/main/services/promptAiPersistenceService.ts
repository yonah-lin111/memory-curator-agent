import type {
  AiAgentRunStatus,
  AiChatMessageRole,
  AiChatSessionStatus,
  AiToolStep,
  AiChatMessagePart,
  PromptAiChatSessionRow,
  PromptAiChatMessageRow,
} from "@/db/schema";

import type Database from "better-sqlite3";

export type EnsurePromptAiSessionInput = {
  id: string;
  designItemId: string;
  title: string;
  status: AiChatSessionStatus;
  timestamp: string;
};

export type AppendPromptAiMessageInput = {
  id: string;
  sessionId: string;
  role: AiChatMessageRole;
  content: string;
  model?: string;
  timestamp: string;
};

export type PromptAiChatMessageItem = {
  id: string;
  sessionId: string;
  role: AiChatMessageRole;
  content: string;
  toolSteps?: AiToolStep[];
  answer?: string;
  parts?: AiChatMessagePart[];
  model?: string;
  createdAt: string;
};

export type PromptAiChatSessionItem = {
  id: string;
  designItemId: string;
  title: string;
  status: AiChatSessionStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messages: PromptAiChatMessageItem[];
};

export class PromptAiPersistenceService {
  constructor(private db: Database.Database) {}

  public ensureSession(input: EnsurePromptAiSessionInput): void {
    if (input.designItemId === 'default-design-item-id') {
      const checkProject = this.db.prepare("SELECT id FROM prompt_design_projects WHERE id = 'default-project-id'").get();
      if (!checkProject) {
        this.db.prepare(`
          INSERT INTO prompt_design_projects (id, name, type, created_at, updated_at)
          VALUES ('default-project-id', 'Default Project', 'virtual', ?, ?)
        `).run(input.timestamp, input.timestamp);
      }
      
      const checkDesign = this.db.prepare("SELECT id FROM prompt_design_items WHERE id = 'default-design-item-id'").get();
      if (!checkDesign) {
        this.db.prepare(`
          INSERT INTO prompt_design_items (id, project_id, name, created_at, updated_at)
          VALUES ('default-design-item-id', 'default-project-id', 'Default Design', ?, ?)
        `).run(input.timestamp, input.timestamp);
      }
    }

    const checkStmt = this.db.prepare(
      "SELECT id FROM prompt_ai_chat_sessions WHERE id = ?",
    );
    const existing = checkStmt.get(input.id);

    if (!existing) {
      const insertStmt = this.db.prepare(`
        INSERT INTO prompt_ai_chat_sessions (id, design_item_id, title, status, created_at, updated_at, last_message_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(
        input.id,
        input.designItemId,
        input.title,
        input.status,
        input.timestamp,
        input.timestamp,
        input.timestamp,
      );
    } else {
      const updateStmt = this.db.prepare(`
        UPDATE prompt_ai_chat_sessions
        SET title = ?, status = ?, updated_at = ?, last_message_at = ?
        WHERE id = ?
      `);
      updateStmt.run(
        input.title,
        input.status,
        input.timestamp,
        input.timestamp,
        input.id,
      );
    }
  }

  public appendMessage(input: AppendPromptAiMessageInput): void {
    const insertStmt = this.db.prepare(`
      INSERT INTO prompt_ai_chat_messages (id, session_id, role, content, parts_json, tool_steps_json, time, model, created_at, updated_at, cancelled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      input.id,
      input.sessionId,
      input.role,
      input.content,
      "[]",
      "[]",
      input.timestamp,
      input.model ?? null,
      input.timestamp,
      input.timestamp,
      0,
    );
    this.updateSessionTimestamp(input.sessionId, input.timestamp);
  }

  public updateMessageContent(messageId: string, content: string): void {
    const stmt = this.db.prepare(`
      UPDATE prompt_ai_chat_messages
      SET content = ?
      WHERE id = ?
    `);
    stmt.run(content, messageId);
  }

  public getSession(sessionId: string): PromptAiChatSessionItem | null {
    const sessionStmt = this.db.prepare(`
      SELECT * FROM prompt_ai_chat_sessions WHERE id = ?
    `);
    const sessionRow = sessionStmt.get(sessionId) as
      PromptAiChatSessionRow | undefined;
    if (!sessionRow) return null;

    const messagesStmt = this.db.prepare(`
      SELECT * FROM prompt_ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC
    `);
    const messageRows = messagesStmt.all(sessionId) as PromptAiChatMessageRow[];

    const messages = messageRows.map((row) => {
      const parts = row.parts_json
        ? (JSON.parse(row.parts_json) as AiChatMessagePart[])
        : [];
      const toolSteps = row.tool_steps_json
        ? (JSON.parse(row.tool_steps_json) as AiToolStep[])
        : [];
      return {
        id: row.id,
        sessionId: row.session_id,
        role: row.role as AiChatMessageRole,
        content: row.content,
        parts: parts.length > 0 ? parts : undefined,
        toolSteps: toolSteps.length > 0 ? toolSteps : undefined,
        answer: row.answer ?? undefined,
        model: row.model ?? undefined,
        createdAt: row.created_at,
      };
    });

    return {
      id: sessionRow.id,
      designItemId: sessionRow.design_item_id,
      title: sessionRow.title,
      status: sessionRow.status,
      createdAt: sessionRow.created_at,
      updatedAt: sessionRow.updated_at,
      lastMessageAt: sessionRow.last_message_at,
      messages,
    };
  }

  public listSessions(designItemId: string): PromptAiChatSessionItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM prompt_ai_chat_sessions 
      WHERE design_item_id = ?
      ORDER BY last_message_at DESC
    `);
    const rows = stmt.all(designItemId) as PromptAiChatSessionRow[];
    return rows.map((row) => ({
      id: row.id,
      designItemId: row.design_item_id,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
      messages: [],
    }));
  }

  public updateSessionTitle(sessionId: string, title: string): void {
    const stmt = this.db.prepare(
      "UPDATE prompt_ai_chat_sessions SET title = ?, updated_at = ? WHERE id = ?"
    );
    stmt.run(title, new Date().toISOString(), sessionId);
  }

  public deleteSession(sessionId: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM prompt_ai_chat_sessions WHERE id = ?",
    );
    stmt.run(sessionId);
  }

  public recordAgentRun(
    runId: string,
    sessionId: string,
    messageId: string,
    timestamp: string,
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO prompt_ai_agent_runs (external_id, session_id, assistant_message_id, status, started_at)
      VALUES (?, ?, ?, 'running', ?)
    `);
    stmt.run(runId, sessionId, messageId, timestamp);
  }

  public updateAgentRunStatus(
    runId: string,
    status: AiAgentRunStatus,
    error?: string,
  ): void {
    const timestamp = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE prompt_ai_agent_runs
      SET status = ?, finished_at = ?, error = ?
      WHERE external_id = ?
    `);
    stmt.run(
      status,
      status === "completed" || status === "failed" ? timestamp : null,
      error ?? null,
      runId,
    );
  }

  private updateSessionTimestamp(sessionId: string, timestamp: string): void {
    const stmt = this.db.prepare(`
      UPDATE prompt_ai_chat_sessions
      SET last_message_at = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(timestamp, timestamp, sessionId);
  }
}
