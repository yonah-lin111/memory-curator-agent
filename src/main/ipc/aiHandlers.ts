import { ipcMain } from "electron";
import { getDatabase } from "@/db";
import {
  createNotesService,
  type DatabaseConnection as NotesDatabaseConnection,
} from "@/services/notesService";
import {
  createJournalsService,
  type DatabaseConnection as JournalsDatabaseConnection,
} from "@/services/journalsService";
import {
  createPeopleService,
  type DatabaseConnection as PeopleDatabaseConnection,
} from "@/services/peopleService";
import {
  createTodosService,
  type DatabaseConnection as TodosDatabaseConnection,
} from "@/services/todosService";
import {
  createSnippetsService,
  type DatabaseConnection as SnippetsDatabaseConnection,
} from "@/services/snippetsService";
import {
  createNoteCategoryService,
  type DatabaseConnection as CatDatabaseConnection,
} from "@/services/noteCategoryService";
import {
  createThemesService,
  type DatabaseConnection as ThemesDatabaseConnection,
} from "@/services/themesService";
import {
  createBillsService,
  type DatabaseConnection as BillsDatabaseConnection,
} from "@/services/billsService";
import {
  createAiChatPersistenceService,
  type DatabaseConnection as AiChatDatabaseConnection,
} from "@/services/aiChatPersistenceService";
import {
  createFilesService,
  type DatabaseConnection as FilesDatabaseConnection,
} from "@/services/filesService";
import { scheduleAiChatImageMaintenance } from "@/services/aiChatImageMaintenance";
import { createAgentToolRegistry } from "@/agent/tools/toolRegistry";
import { createAggregatorService } from "@/services/aggregatorService";

import {
  type AiChatSessionListPayload,
  type AiAskAnswerPayload,
  type AiToolConfirmationAnswerPayload,
} from "./ai/types";
import {
  pendingAskAnswers,
  pendingToolConfirmations,
  cancelAiChatRun,
  cancelAiChatAsk,
  isStringMatrix,
} from "./ai/state";
import {
  createSystemPrompt,
  createModelOptionsResponse,
  createTimestamp,
} from "./ai/helpers";
import { startAiChat } from "./ai/chatRunner";

// 为测试兼容性重新导出方法
export { createSystemPrompt, createModelOptionsResponse };

/**
 * 注册 AI IPC 处理器。
 */
export const registerAiHandlers = (): void => {
  const database = getDatabase();
  const notesService = createNotesService(
    database as unknown as NotesDatabaseConnection,
  );
  const journalsService = createJournalsService(
    database as unknown as JournalsDatabaseConnection,
  );
  const peopleService = createPeopleService(
    database as unknown as PeopleDatabaseConnection,
  );
  const todosService = createTodosService(
    database as unknown as TodosDatabaseConnection,
  );
  const snippetsService = createSnippetsService(
    database as unknown as SnippetsDatabaseConnection,
  );
  const noteCategoryService = createNoteCategoryService(
    database as unknown as CatDatabaseConnection,
  );
  const themesService = createThemesService(
    database as unknown as ThemesDatabaseConnection,
  );
  const billsService = createBillsService(
    database as unknown as BillsDatabaseConnection,
  );
  const aiChatService = createAiChatPersistenceService(
    database as unknown as AiChatDatabaseConnection,
  );
  const aggregatorService = createAggregatorService({
    todosService,
    snippetsService,
    journalsService,
    billsService,
    notesService,
  });

  const toolRegistry = createAgentToolRegistry({
    notesService,
    journalsService,
    peopleService,
    todosService,
    snippetsService,
    noteCategoryService,
    themesService,
    billsService,
    aggregatorService,
  });

  ipcMain.handle("ai:model-options:get", async () =>
    createModelOptionsResponse(),
  );

  ipcMain.handle(
    "ai:sessions:list",
    async (_, payload?: AiChatSessionListPayload) =>
      aiChatService.listSessions(payload),
  );

  ipcMain.handle("ai:session:get", async (_, sessionId: string) =>
    aiChatService.getSession(sessionId),
  );

  ipcMain.handle(
    "ai:session:title:update",
    async (_, sessionId: string, title: string) => {
      aiChatService.updateSessionTitle(sessionId, title, createTimestamp());
    },
  );

  ipcMain.handle("ai:session:delete", async (_, sessionId: string) => {
    aiChatService.deleteSession(sessionId);
    const filesService = createFilesService({
      database: database as unknown as FilesDatabaseConnection,
    });
    scheduleAiChatImageMaintenance(filesService);
  });

  ipcMain.handle("ai:session:turn:undo", async (_, sessionId: string) => {
    const result = await aiChatService.undoLastTurn(
      sessionId,
      createTimestamp(),
    );
    const filesService = createFilesService({
      database: database as unknown as FilesDatabaseConnection,
    });
    scheduleAiChatImageMaintenance(filesService);
    return result;
  });

  ipcMain.handle(
    "ai:session:turn:delete",
    async (_, sessionId: string, messageId: string) => {
      const result = await aiChatService.deleteTurnByMessageId(
        sessionId,
        messageId,
        createTimestamp(),
      );
      const filesService = createFilesService({
        database: database as unknown as FilesDatabaseConnection,
      });
      scheduleAiChatImageMaintenance(filesService);
      return result;
    },
  );

  ipcMain.handle(
    "ai:chat:ask-answer",
    async (_, payload: AiAskAnswerPayload) => {
      if (
        !payload ||
        typeof payload.requestId !== "string" ||
        !isStringMatrix(payload.answers)
      ) {
        throw new Error("Invalid Ask answer payload");
      }

      const pending = pendingAskAnswers.get(payload.requestId);
      if (!pending) {
        throw new Error(`Ask request is not pending: ${payload.requestId}`);
      }

      pendingAskAnswers.delete(payload.requestId);
      pending.resolve(payload.answers);
    },
  );

  ipcMain.handle(
    "ai:chat:tool-confirmation-answer",
    async (_, payload: AiToolConfirmationAnswerPayload) => {
      if (
        !payload ||
        typeof payload.requestId !== "string" ||
        (payload.action !== "confirm" && payload.action !== "cancel")
      ) {
        throw new Error("Invalid tool confirmation payload");
      }

      const pending = pendingToolConfirmations.get(payload.requestId);
      if (!pending) {
        throw new Error(
          `Tool confirmation request is not pending: ${payload.requestId}`,
        );
      }

      pendingToolConfirmations.delete(payload.requestId);
      pending.resolve(payload.action);
    },
  );

  ipcMain.handle("ai:chat:cancel", async (_, runId: string) => {
    if (typeof runId !== "string" || !runId.trim()) {
      throw new Error("Invalid AI run id");
    }

    cancelAiChatRun(runId, aiChatService);
  });

  ipcMain.handle("ai:chat:ask-cancel", async (_, runId: string) => {
    if (typeof runId !== "string" || !runId.trim()) {
      throw new Error("Invalid AI run id");
    }

    cancelAiChatAsk(runId);
  });

  ipcMain.handle("ai:chat:start", async (event, payload) => {
    return startAiChat(event, payload, { aiChatService, toolRegistry });
  });
};
