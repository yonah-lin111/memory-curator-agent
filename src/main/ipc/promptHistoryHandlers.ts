import { ipcMain } from "electron"
import {
  createPromptHistoryService,
  type PromptHistoryScope,
} from "@/services/promptHistoryService"

/**
 * 注册提示词历史 IPC 处理器。
 */
export const registerPromptHistoryHandlers = (): void => {
  const promptHistoryServices: Record<
    PromptHistoryScope,
    ReturnType<typeof createPromptHistoryService>
  > = {
    curator: createPromptHistoryService({ scope: "curator" }),
    "prompt-design": createPromptHistoryService({ scope: "prompt-design" }),
  }

  ipcMain.handle("ai:prompt-history:list", (_, scope: PromptHistoryScope) =>
    promptHistoryServices[scope].list(),
  )
  ipcMain.handle("ai:prompt-history:add", (_, scope: PromptHistoryScope, prompt: string) =>
    promptHistoryServices[scope].add(prompt),
  )
}
