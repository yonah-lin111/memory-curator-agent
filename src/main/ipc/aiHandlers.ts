import { ipcMain } from "electron"
import { createModelProvider } from "@/agent/providers/providerFactory"
import { createAgentToolRegistry } from "@/agent/tools/toolRegistry"
import { getDatabase } from "@/db"
import { createAggregatorService } from "@/services/aggregatorService"
import { scheduleAiChatImageMaintenance } from "@/services/aiChatImageMaintenance"
import {
  type DatabaseConnection as AiChatDatabaseConnection,
  createAiChatPersistenceService,
} from "@/services/aiChatPersistenceService"
import {
  type DatabaseConnection as BillsDatabaseConnection,
  createBillsService,
} from "@/services/billsService"
import { readAiSettingsConfig } from "@/services/configService"
import {
  createFilesService,
  type DatabaseConnection as FilesDatabaseConnection,
} from "@/services/filesService"
import {
  createJournalsService,
  type DatabaseConnection as JournalsDatabaseConnection,
} from "@/services/journalsService"
import {
  type DatabaseConnection as CatDatabaseConnection,
  createNoteCategoryService,
} from "@/services/noteCategoryService"
import {
  createNotesService,
  type DatabaseConnection as NotesDatabaseConnection,
} from "@/services/notesService"
import {
  createPeopleService,
  type DatabaseConnection as PeopleDatabaseConnection,
} from "@/services/peopleService"
import {
  createSnippetsService,
  type DatabaseConnection as SnippetsDatabaseConnection,
} from "@/services/snippetsService"
import {
  createThemesService,
  type DatabaseConnection as ThemesDatabaseConnection,
} from "@/services/themesService"
import {
  createTodosService,
  type DatabaseConnection as TodosDatabaseConnection,
} from "@/services/todosService"
import { submitAskAnswer } from "./ai/ask"
import { startAiChat } from "./ai/chatRunner"
import { createModelOptionsResponse, createSystemPrompt, createTimestamp } from "./ai/helpers"
import { cancelAiChatAsk, cancelAiChatRun, pendingToolConfirmations } from "./ai/state"
import {
  type AiAskAnswerPayload,
  type AiChatSessionListPayload,
  type AiToolConfirmationAnswerPayload,
} from "./ai/types"

// 推荐问题请求中的精简对话消息。
type SuggestedQuestionContextMessage = {
  role: "user" | "assistant"
  content: string
}

/**
 * 解析模型返回的推荐问题，保证界面仅接收 2-4 条非空文本。
 */
export const parseSuggestedQuestions = (content: string): string[] => {
  const normalizeQuestions = (values: unknown[]): string[] => {
    const questions = Array.from(
      new Set(
        values
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ).slice(0, 4)
    return questions.length >= 2 ? questions : []
  }

  const json =
    content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? content.match(/\[[\s\S]*\]/)?.[0]
  if (json) {
    try {
      const parsed = JSON.parse(json) as unknown
      if (Array.isArray(parsed)) return normalizeQuestions(parsed)
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { questions?: unknown }).questions)
      ) {
        return normalizeQuestions((parsed as { questions: unknown[] }).questions)
      }
    } catch {
      // JSON 不完整时继续尝试解析常见的编号列表。
    }
  }

  const listQuestions = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.、])\s*/, "").trim())
    .filter((line) => line.endsWith("？") || line.endsWith("?"))

  return normalizeQuestions(listQuestions)
}

/**
 * 按模型上下文预算保留最近对话，避免辅助请求挤占主对话的可用上下文。
 */
export const trimSuggestedQuestionContext = (
  messages: SuggestedQuestionContextMessage[],
  maxChars: number,
): SuggestedQuestionContextMessage[] => {
  const selected: SuggestedQuestionContextMessage[] = []
  let usedChars = 0

  for (const message of messages.slice(-12).reverse()) {
    const availableChars = maxChars - usedChars
    if (availableChars <= 0) break
    const content = message.content.slice(-Math.min(8000, availableChars))
    if (!content) continue
    selected.unshift({ ...message, content })
    usedChars += content.length
  }

  return selected
}

// 为测试兼容性重新导出方法
export { createModelOptionsResponse, createSystemPrompt }

/**
 * 注册 AI IPC 处理器。
 */
export const registerAiHandlers = (): void => {
  const database = getDatabase()
  const notesService = createNotesService(database as unknown as NotesDatabaseConnection)
  const journalsService = createJournalsService(database as unknown as JournalsDatabaseConnection)
  const peopleService = createPeopleService(database as unknown as PeopleDatabaseConnection)
  const todosService = createTodosService(database as unknown as TodosDatabaseConnection)
  const snippetsService = createSnippetsService(database as unknown as SnippetsDatabaseConnection)
  const noteCategoryService = createNoteCategoryService(
    database as unknown as CatDatabaseConnection,
  )
  const themesService = createThemesService(database as unknown as ThemesDatabaseConnection)
  const billsService = createBillsService(database as unknown as BillsDatabaseConnection)
  const aiChatService = createAiChatPersistenceService(
    database as unknown as AiChatDatabaseConnection,
  )
  const aggregatorService = createAggregatorService({
    todosService,
    snippetsService,
    journalsService,
    billsService,
    notesService,
  })

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
  })

  ipcMain.handle("ai:model-options:get", async () => createModelOptionsResponse())

  ipcMain.handle(
    "ai:suggested-questions:generate",
    async (_, messages: SuggestedQuestionContextMessage[], excludedQuestions: string[] = []) => {
      const settings = readAiSettingsConfig()
      if (!settings.suggestedQuestionsEnabled || messages.length === 0) return []
      const selection = settings.suggestedQuestions
      const providerConfig = settings.providers[selection.provider]
      if (!providerConfig || !providerConfig.models[selection.model]) return []
      const context = trimSuggestedQuestionContext(
        messages,
        Math.max(4000, Math.floor(providerConfig.models[selection.model].limit.context * 3)),
      )
      if (context.length === 0) return []

      try {
        const provider = await createModelProvider(providerConfig)
        let output = ""
        for await (const event of provider.streamTurn({
          model: selection.model,
          tools: [],
          messages: [
            {
              role: "system",
              content: `根据以下对话生成 2 到 4 个用户下一步可以直接提问的中文问题。不得重复以下已有问题：${JSON.stringify(excludedQuestions)}。仅返回 JSON 字符串数组，不要解释、Markdown 或工具调用。`,
            },
            ...context,
          ],
        })) {
          if (event.type === "text_delta") output += event.delta
        }
        return parseSuggestedQuestions(output)
      } catch {
        return []
      }
    },
  )

  ipcMain.handle("ai:sessions:list", async (_, payload?: AiChatSessionListPayload) =>
    aiChatService.listSessions(payload),
  )

  ipcMain.handle("ai:session:get", async (_, sessionId: string) =>
    aiChatService.getSession(sessionId),
  )

  ipcMain.handle("ai:session:title:update", async (_, sessionId: string, title: string) => {
    aiChatService.updateSessionTitle(sessionId, title, createTimestamp())
  })

  ipcMain.handle("ai:session:delete", async (_, sessionId: string) => {
    aiChatService.deleteSession(sessionId)
    const filesService = createFilesService({
      database: database as unknown as FilesDatabaseConnection,
    })
    scheduleAiChatImageMaintenance(filesService)
  })

  ipcMain.handle("ai:session:turn:undo", async (_, sessionId: string) => {
    const result = await aiChatService.undoLastTurn(sessionId, createTimestamp())
    const filesService = createFilesService({
      database: database as unknown as FilesDatabaseConnection,
    })
    scheduleAiChatImageMaintenance(filesService)
    return result
  })

  ipcMain.handle("ai:session:turn:delete", async (_, sessionId: string, messageId: string) => {
    const result = await aiChatService.deleteTurnByMessageId(
      sessionId,
      messageId,
      createTimestamp(),
    )
    const filesService = createFilesService({
      database: database as unknown as FilesDatabaseConnection,
    })
    scheduleAiChatImageMaintenance(filesService)
    return result
  })

  ipcMain.handle("ai:chat:ask-answer", async (_, payload: AiAskAnswerPayload) =>
    submitAskAnswer(payload),
  )

  ipcMain.handle(
    "ai:chat:tool-confirmation-answer",
    async (_, payload: AiToolConfirmationAnswerPayload) => {
      if (
        !payload ||
        typeof payload.requestId !== "string" ||
        (payload.action !== "confirm" && payload.action !== "cancel")
      ) {
        throw new Error("Invalid tool confirmation payload")
      }

      const pending = pendingToolConfirmations.get(payload.requestId)
      if (!pending) {
        throw new Error(`Tool confirmation request is not pending: ${payload.requestId}`)
      }

      pendingToolConfirmations.delete(payload.requestId)
      pending.resolve(payload.action)
    },
  )

  ipcMain.handle("ai:chat:cancel", async (_, runId: string) => {
    if (typeof runId !== "string" || !runId.trim()) {
      throw new Error("Invalid AI run id")
    }

    cancelAiChatRun(runId, aiChatService)
  })

  ipcMain.handle("ai:chat:ask-cancel", async (_, runId: string) => {
    if (typeof runId !== "string" || !runId.trim()) {
      throw new Error("Invalid AI run id")
    }

    cancelAiChatAsk(runId)
  })

  ipcMain.handle("ai:chat:start", async (event, payload) => {
    return startAiChat(event, payload, { aiChatService, toolRegistry })
  })
}
