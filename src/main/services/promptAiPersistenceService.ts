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
      const checkProject = this.db.prepare("SELECT id FROM prompt_design_projects WHERE external_id = 'default-project-id'").get();
      if (!checkProject) {
        this.db.prepare(`
          INSERT INTO prompt_design_projects (external_id, name, type, created_at, updated_at)
          VALUES ('default-project-id', 'Default Project', 'virtual', ?, ?)
        `).run(input.timestamp, input.timestamp);
      }
      
      const checkDesign = this.db.prepare("SELECT id FROM prompt_design_items WHERE external_id = 'default-design-item-id'").get();
      if (!checkDesign) {
        this.db.prepare(`
          INSERT INTO prompt_design_items (external_id, project_id, name, created_at, updated_at)
          VALUES ('default-design-item-id', 'default-project-id', 'Default Design', ?, ?)
        `).run(input.timestamp, input.timestamp);
      }
    }

    const checkStmt = this.db.prepare(
      "SELECT id FROM prompt_ai_chat_sessions WHERE external_id = ?",
    );
    const existing = checkStmt.get(input.id);

    if (!existing) {
      const insertStmt = this.db.prepare(`
        INSERT INTO prompt_ai_chat_sessions (external_id, design_item_id, title, status, created_at, updated_at, last_message_at)
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
        WHERE external_id = ?
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
      INSERT INTO prompt_ai_chat_messages (external_id, session_id, role, content, parts_json, tool_steps_json, time, model, created_at, updated_at, cancelled)
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
      WHERE external_id = ?
    `);
    stmt.run(content, messageId);
  }

  public getSession(sessionId: string): PromptAiChatSessionItem | null {
    const sessionStmt = this.db.prepare(`
      SELECT * FROM prompt_ai_chat_sessions WHERE external_id = ?
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
        id: row.external_id,
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
      id: sessionRow.external_id,
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
      id: row.external_id,
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
      "UPDATE prompt_ai_chat_sessions SET title = ?, updated_at = ? WHERE external_id = ?"
    );
    stmt.run(title, new Date().toISOString(), sessionId);
  }

  public deleteSession(sessionId: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM prompt_ai_chat_sessions WHERE external_id = ?",
    );
    stmt.run(sessionId);
  }

  public undoLastTurn(sessionId: string): PromptAiChatSessionItem | null {
    const undoTx = this.db.transaction(() => {
      const messagesStmt = this.db.prepare(`
        SELECT rowid AS row_order, external_id, role, created_at 
        FROM prompt_ai_chat_messages 
        WHERE session_id = ? 
        ORDER BY created_at ASC, rowid ASC
      `);
      const messages = messagesStmt.all(sessionId) as { row_order: number; external_id: string; role: string; created_at: string }[];

      const turnStartIndex = [...messages].reverse().findIndex((m) => m.role === 'user');
      if (turnStartIndex < 0) return;

      const resolvedTurnStartIndex = messages.length - 1 - turnStartIndex;
      const removedMessages = messages.slice(resolvedTurnStartIndex);
      const removedMessageIds = removedMessages.map((m) => m.external_id);
      const removedAssistantMessageIds = removedMessages
        .filter((m) => m.role === 'assistant')
        .map((m) => m.external_id);

      if (removedAssistantMessageIds.length > 0) {
        const placeholders = removedAssistantMessageIds.map(() => '?').join(', ');
        this.db.prepare(`DELETE FROM prompt_ai_agent_runs WHERE session_id = ? AND assistant_message_id IN (${placeholders})`).run(sessionId, ...removedAssistantMessageIds);
      }

      if (removedMessageIds.length > 0) {
        const placeholders = removedMessageIds.map(() => '?').join(', ');
        this.db.prepare(`DELETE FROM prompt_ai_chat_messages WHERE external_id IN (${placeholders})`).run(...removedMessageIds);
      }

      const remainingMessages = messages.slice(0, resolvedTurnStartIndex);
      const latestMessageAt = remainingMessages.length > 0 
        ? remainingMessages[remainingMessages.length - 1].created_at 
        : new Date().toISOString();

      this.updateSessionTimestamp(sessionId, latestMessageAt);
    });

    undoTx();
    return this.getSession(sessionId);
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

  /**
   * 更新消息的工具步骤和片段数据。
   * 用于流式写入过程中累积工具步骤后批量持久化。
   */
  public upsertToolSteps(
    messageId: string,
    toolSteps: AiToolStep[],
    parts: AiChatMessagePart[],
  ): void {
    const timestamp = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE prompt_ai_chat_messages
      SET tool_steps_json = ?, parts_json = ?, updated_at = ?
      WHERE external_id = ?
    `);
    stmt.run(
      JSON.stringify(toolSteps),
      JSON.stringify(parts),
      timestamp,
      messageId,
    );
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
      WHERE external_id = ?
    `);
    stmt.run(timestamp, timestamp, sessionId);
  }
}
