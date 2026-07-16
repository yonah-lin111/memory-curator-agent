import type {
  AiAgentRunStatus,
  AiAgentToolCallStatus,
  AiChatMessageRole,
  AiChatSessionStatus,
  AiToolStep,
  AiChatMessagePart,
  PromptAiChatSessionRow,
  PromptAiChatMessageRow,
} from "@/db/schema";

import type Database from "better-sqlite3";

// 清理旧版本把 Agent 引用上下文写入用户消息正文的数据。
const removePersistedReferenceBlock = (
  content: string,
  references: Extract<AiChatMessagePart, { kind: "reference" }>[],
): string => {
  if (!references.length) return content;

  let cleanedContent = content.replace(/\n\n<references>[\s\S]*?<\/references>\s*$/, "");
  for (const reference of [...references].reverse()) {
    const legacyBlock = `\n\n第${reference.startLine}–${reference.endLine}行:\n${reference.content}`;
    if (cleanedContent.endsWith(legacyBlock)) {
      cleanedContent = cleanedContent.slice(0, -legacyBlock.length);
    }
  }
  return cleanedContent;
};

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
  references?: AiChatMessagePart[];
  timestamp: string;
};

export type PromptAiToolCallInput = {
  id: string;
  runId: string;
  messageId: string;
  toolCallId: string;
  name: string;
  status: AiAgentToolCallStatus;
  input: unknown;
  observation: string;
  data: unknown;
  error?: string;
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
  references?: AiChatMessagePart[];
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
      input.references?.length ? JSON.stringify(input.references) : "[]",
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

  /**
   * 将指定的消息标记为已被取消。
   */
  public cancelMessage(messageId: string): void {
    const stmt = this.db.prepare(`
      UPDATE prompt_ai_chat_messages
      SET cancelled = 1
      WHERE external_id = ?
    `);
    stmt.run(messageId);
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
      const references = parts.filter((part) => part.kind === "reference");
      return {
        id: row.external_id,
        sessionId: row.session_id,
        role: row.role as AiChatMessageRole,
        content: removePersistedReferenceBlock(row.content, references),
        parts: parts.length > 0 ? parts : undefined,
        references,
        toolSteps: toolSteps.length > 0 ? toolSteps : undefined,
        answer: row.answer ?? undefined,
        model: row.model ?? undefined,
        createdAt: row.created_at,
        cancelled: row.cancelled === 1 ? true : undefined,
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

  public deleteTurnByMessageId(
    sessionId: string,
    messageId: string,
  ): PromptAiChatSessionItem | null {
    const deleteTx = this.db.transaction(() => {
      const messagesStmt = this.db.prepare(`
        SELECT rowid AS row_order, external_id, role, created_at
        FROM prompt_ai_chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC, rowid ASC
      `);
      const messages = messagesStmt.all(sessionId) as { row_order: number; external_id: string; role: string; created_at: string }[];
      const messageIndex = messages.findIndex((message) => message.external_id === messageId);
      if (messageIndex < 0) return;

      let turnStartIndex = messageIndex;
      while (turnStartIndex > 0 && messages[turnStartIndex].role !== "user") {
        turnStartIndex -= 1;
      }
      if (messages[turnStartIndex].role !== "user") return;

      const removedMessages = messages.slice(turnStartIndex);
      const removedMessageIds = removedMessages.map((message) => message.external_id);
      const removedAssistantMessageIds = removedMessages
        .filter((message) => message.role === "assistant")
        .map((message) => message.external_id);

      if (removedAssistantMessageIds.length > 0) {
        const placeholders = removedAssistantMessageIds.map(() => "?").join(", ");
        this.db.prepare(`DELETE FROM prompt_ai_agent_runs WHERE session_id = ? AND assistant_message_id IN (${placeholders})`).run(sessionId, ...removedAssistantMessageIds);
      }
      const placeholders = removedMessageIds.map(() => "?").join(", ");
      this.db.prepare(`DELETE FROM prompt_ai_chat_messages WHERE external_id IN (${placeholders})`).run(...removedMessageIds);

      const remainingMessages = messages.slice(0, turnStartIndex);
      this.updateSessionTimestamp(sessionId, remainingMessages.at(-1)?.created_at ?? new Date().toISOString());
    });

    deleteTx();
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

  public upsertToolCall(input: PromptAiToolCallInput): void {
    const stmt = this.db.prepare(`
      INSERT INTO prompt_ai_agent_tool_calls (
        external_id, run_id, message_id, tool_call_id, name, status,
        input_json, observation, data_json, error, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id, tool_call_id) DO UPDATE SET
        message_id = excluded.message_id,
        name = excluded.name,
        status = excluded.status,
        input_json = excluded.input_json,
        observation = excluded.observation,
        data_json = excluded.data_json,
        error = excluded.error,
        updated_at = excluded.updated_at
    `);
    const safeStringify = (value: unknown): string => {
      try {
        return JSON.stringify(value ?? null);
      } catch {
        return JSON.stringify({ error: "数据无法序列化" });
      }
    };
    stmt.run(
      input.id,
      input.runId,
      input.messageId,
      input.toolCallId,
      input.name,
      input.status,
      safeStringify(input.input),
      input.observation,
      safeStringify(input.data),
      input.error ?? null,
      input.timestamp,
      input.timestamp,
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
