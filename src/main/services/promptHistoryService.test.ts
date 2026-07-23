import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createPromptHistoryService } from "@/services/promptHistoryService"

// 测试期间创建的临时目录。
let tempDirs: string[] = []

/**
 * 创建隔离的提示词历史服务。
 */
const createIsolatedService = async (): Promise<{
  historyDir: string
  service: ReturnType<typeof createPromptHistoryService>
}> => {
  const historyDir = await mkdtemp(join(tmpdir(), "mc-prompt-history-"))
  tempDirs = [...tempDirs, historyDir]

  return {
    historyDir,
    service: createPromptHistoryService({ historyDir }),
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  tempDirs = []
})

describe("createPromptHistoryService", () => {
  it("persists prompts to a JSON history file with newest item last", async () => {
    const { historyDir, service } = await createIsolatedService()

    await service.add(" first prompt ")
    const history = await service.add("second prompt")

    expect(history).toEqual(["first prompt", "second prompt"])

    const fileContent = await readFile(join(historyDir, "ai-chat-prompts.json"), "utf8")
    expect(JSON.parse(fileContent)).toEqual({
      version: 1,
      prompts: ["first prompt", "second prompt"],
    })
  })

  it("moves duplicate prompts to the newest position", async () => {
    const { service } = await createIsolatedService()

    await service.add("first prompt")
    await service.add("second prompt")
    const history = await service.add("first prompt")

    expect(history).toEqual(["second prompt", "first prompt"])
  })

  it("keeps curator history in the legacy file and isolates prompt-design history", async () => {
    const { historyDir } = await createIsolatedService()
    const curatorService = createPromptHistoryService({ historyDir, scope: "curator" })
    const promptDesignService = createPromptHistoryService({ historyDir, scope: "prompt-design" })

    await curatorService.add("curator prompt")

    await expect(promptDesignService.list()).resolves.toEqual([])
    await promptDesignService.add("prompt design prompt")
    await expect(curatorService.list()).resolves.toEqual(["curator prompt"])

    await expect(
      readFile(join(historyDir, "prompt-design-ai-chat-prompts.json"), "utf8"),
    ).resolves.toContain("prompt design prompt")
  })

  it("returns empty history when the JSON file is unreadable", async () => {
    const { historyDir, service } = await createIsolatedService()

    await writeFile(join(historyDir, "ai-chat-prompts.json"), "{broken", "utf8")

    await expect(service.list()).resolves.toEqual([])
  })
})
