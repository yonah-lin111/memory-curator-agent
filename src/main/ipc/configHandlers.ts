import { ipcMain } from "electron"
import {
  type AiSettingsConfig,
  readAiSettingsConfig,
  saveAiSettingsConfig,
} from "@/services/configService"

/**
 * 注册配置文件相关 IPC 处理器。
 */
export const registerConfigHandlers = (): void => {
  ipcMain.handle("config:ai:get", () => readAiSettingsConfig())
  ipcMain.handle("config:ai:save", (_, payload: AiSettingsConfig) => saveAiSettingsConfig(payload))
}
