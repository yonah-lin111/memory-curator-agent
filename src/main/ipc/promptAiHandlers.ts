import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { createCompactUuid } from "@/id";
import { loadProviderConfig } from "@/agent/providers/providerConfig";
import { createModelProvider } from "@/agent/providers/providerFactory";
import { runReactAgent } from "@/agent/core/reactAgent";
import { PromptAiPersistenceService } from "@/services/promptAiPersistenceService";
import { getDatabase } from "@/db";
import { createSessionTitle } from "./ai/helpers";

export type PromptAiChatStartPayload = {
  runId?: string;
  sessionId: string;
  designItemId: string;
  message: string;
  provider?: string;
  model?: string;
};

let persistenceService: PromptAiPersistenceService | null = null;

function getPersistence(): PromptAiPersistenceService {
  if (!persistenceService) {
    persistenceService = new PromptAiPersistenceService(getDatabase());
  }
  return persistenceService;
}

// Store active runs to allow cancellation
const activePromptAiRuns = new Map<
  string,
  { abortController: AbortController }
>();

export function registerPromptAiHandlers(): void {
  ipcMain.handle(
    "prompt-ai:chat:start",
    async (event: IpcMainInvokeEvent, payload: PromptAiChatStartPayload) => {
      const runId = payload.runId || createCompactUuid();
      const abortController = new AbortController();
      activePromptAiRuns.set(runId, { abortController });

      // Start background process
      Promise.resolve()
        .then(() =>
          runPromptAiChat(event.sender, payload, runId, abortController.signal),
        )
        .catch(console.error);

      return { runId };
    },
  );

  ipcMain.handle("prompt-ai:chat:cancel", (_, runId: string) => {
    const run = activePromptAiRuns.get(runId);
    if (run) {
      run.abortController.abort();
      activePromptAiRuns.delete(runId);
    }
  });

  ipcMain.handle("prompt-ai:sessions:list", (_, designItemId: string) => {
    return getPersistence().listSessions(designItemId);
  });

  ipcMain.handle("prompt-ai:session:get", (_, sessionId: string) => {
    return getPersistence().getSession(sessionId);
  });

  ipcMain.handle("prompt-ai:session:create", (_, designItemId: string) => {
    const sessionId = createCompactUuid();
    getPersistence().ensureSession({
      id: sessionId,
      designItemId,
      title: "新建对话",
      status: "idle",
      timestamp: new Date().toISOString()
    });
    return getPersistence().getSession(sessionId);
  });

  ipcMain.handle("prompt-ai:session:title:update", (_, sessionId: string, title: string) => {
    return getPersistence().updateSessionTitle(sessionId, title);
  });

  ipcMain.handle("prompt-ai:session:delete", (_, sessionId: string) => {
    return getPersistence().deleteSession(sessionId);
  });
}

async function runPromptAiChat(
  sender: Electron.WebContents,
  payload: PromptAiChatStartPayload,
  runId: string,
  signal: AbortSignal,
) {
  const db = getPersistence();
  const now = new Date().toISOString();

  const providerConfig = loadProviderConfig();
  const providerId = payload.provider || providerConfig.defaultProvider;
  const modelId = payload.model || providerConfig.defaultModel;

  const providerConfigObj = providerConfig.providers[providerId];
  if (!providerConfigObj) {
    throw new Error(`Provider ${providerId} not found`);
  }
  const provider = await createModelProvider(providerConfigObj);

  // 检查是否需要生成标题：该会话为首次发送消息
  const existingSession = db.getSession(payload.sessionId);
  const shouldCreateTitle =
    !existingSession || existingSession.messages.length === 0;

  db.ensureSession({
    id: payload.sessionId,
    designItemId: payload.designItemId,
    title: shouldCreateTitle ? "新建对话" : existingSession!.title,
    status: "running",
    timestamp: now,
  });

  const userMessageId = createCompactUuid();
  db.appendMessage({
    id: userMessageId,
    sessionId: payload.sessionId,
    role: "user",
    content: payload.message,
    timestamp: now,
  });

  const assistantMessageId = createCompactUuid();
  db.appendMessage({
    id: assistantMessageId,
    sessionId: payload.sessionId,
    role: "assistant",
    content: "",
    model: modelId,
    timestamp: now,
  });

  db.recordAgentRun(runId, payload.sessionId, assistantMessageId, now);

  // 后台异步生成会话标题
  if (shouldCreateTitle) {
    void (async () => {
      const title = await createSessionTitle(providerConfig, payload.message);
      db.updateSessionTitle(payload.sessionId, title);
      if (sender.isDestroyed?.()) return;
      sender.send("prompt-ai:chat:event", {
        type: "session_title_updated",
        runId,
        sessionId: payload.sessionId,
        title,
      });
    })();
  }

  // Reconstruct messages for context
  const session = db.getSession(payload.sessionId);
  const agentMessages =
    session?.messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })) || [];

  // Prepend system message for Prompt Design context
  agentMessages.unshift({
    role: "system",
    content:
      "You are a helpful AI assistant specializing in Prompt Design and Engineering.",
  });

  let finalContent = "";

  try {
    const generator = runReactAgent({
      provider,
      model: modelId,
      messages: agentMessages,
      tools: [], // No tools for now
      signal,
    });

    for await (const event of generator) {
      if (signal.aborted) break;

      if (event.type === "run_started") {
        sender.send("prompt-ai:chat:event", {
          type: "run_started",
          runId,
          sessionId: payload.sessionId,
          model: modelId,
        });
      } else if (event.type === "text_delta") {
        finalContent += event.delta;
        sender.send("prompt-ai:chat:event", {
          type: "text_delta",
          runId,
          sessionId: payload.sessionId,
          delta: event.delta,
        });
      } else if (event.type === "turn_finished") {
        sender.send("prompt-ai:chat:event", {
          type: "turn_finished",
          runId,
          sessionId: payload.sessionId,
        });
      }
    }

    db.updateMessageContent(assistantMessageId, finalContent);
    db.updateAgentRunStatus(runId, "completed");
    db.ensureSession({
      id: payload.sessionId,
      designItemId: payload.designItemId,
      title: "Prompt Design Session",
      status: "idle",
      timestamp: new Date().toISOString(),
    });

    sender.send("prompt-ai:chat:event", {
      type: "done",
      runId,
      sessionId: payload.sessionId,
    });
  } catch (err: any) {
    if (signal.aborted) {
      db.updateMessageContent(assistantMessageId, finalContent);
      db.updateAgentRunStatus(runId, "failed", "Aborted by user");
    } else {
      console.error("Prompt AI error:", err);
      db.updateAgentRunStatus(runId, "failed", err.message);
      sender.send("prompt-ai:chat:event", {
        type: "error",
        runId,
        sessionId: payload.sessionId,
        message: err.message,
      });
    }
    db.ensureSession({
      id: payload.sessionId,
      designItemId: payload.designItemId,
      title: "Prompt Design Session",
      status: "failed",
      timestamp: new Date().toISOString(),
    });
  } finally {
    activePromptAiRuns.delete(runId);
  }
}
