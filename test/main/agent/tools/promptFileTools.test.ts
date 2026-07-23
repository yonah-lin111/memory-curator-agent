import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { createPromptFileTools } from "@/agent/tools/promptFileTools"
import { assertInsideProject } from "@/agent/tools/promptFileTools/pathGuard"

describe("promptFileTools", () => {
  const projectRoot = path.resolve(__dirname, "../../../../fixtures/test-project")

  // 确保测试用目录和文件存在
  const setupTestFiles = () => {
    if (!fs.existsSync(projectRoot)) {
      fs.mkdirSync(projectRoot, { recursive: true })
    }
    fs.writeFileSync(path.join(projectRoot, "a.txt"), "line1\nline2\nline3")
    fs.writeFileSync(path.join(projectRoot, "b.log"), "log entry 1\nlog entry 2")
    const subDir = path.join(projectRoot, "sub")
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true })
    }
    fs.writeFileSync(path.join(subDir, "c.txt"), "nested content")
  }

  const cleanupTestFiles = () => {
    if (fs.existsSync(projectRoot)) {
      fs.rmSync(projectRoot, { recursive: true, force: true })
    }
  }

  it("pathGuard.ts -> assertInsideProject 阻断穿越攻击", () => {
    expect(() => assertInsideProject(projectRoot, "../passwd")).toThrow()
    expect(() => assertInsideProject(projectRoot, "/etc/passwd")).toThrow()
    const resolved = assertInsideProject(projectRoot, "a.txt")
    expect(resolved).toBe(path.join(projectRoot, "a.txt"))
  })

  it("prompt_file_read 遇到不存在路径不抛出异常，返回结构化纠正结果", async () => {
    setupTestFiles()
    const tools = createPromptFileTools(projectRoot)
    const readTool = tools.find((t) => t.name === "prompt_file_read")!

    const result = await readTool.execute({ filePath: "non-existent.txt" })
    expect(result.observation).toContain("Error: The specified path does not exist.")
    expect(result.observation).toContain("non-existent.txt")
    expect(result.observation).toContain(projectRoot)
    expect(result.observation).toContain("prompt_glob")

    const data = result.data as any
    expect(data.error).toBe("ENOENT")
    expect(data.requestedPath).toBe("non-existent.txt")
    expect(data.projectRoot).toBe(projectRoot)

    cleanupTestFiles()
  })

  it("prompt_file_read 正常读取文件和目录", async () => {
    setupTestFiles()
    const tools = createPromptFileTools(projectRoot)
    const readTool = tools.find((t) => t.name === "prompt_file_read")!

    // 读取文件
    const fileResult = await readTool.execute({ filePath: "a.txt" })
    expect(fileResult.observation).toContain("line1")
    expect(fileResult.observation).toContain("<type>file</type>")

    // 读取目录
    const dirResult = await readTool.execute({ filePath: "sub" })
    expect(dirResult.observation).toContain("c.txt")
    expect(dirResult.observation).toContain("<type>directory</type>")

    cleanupTestFiles()
  })

  it("prompt_glob 遇到不存在的搜索路径，返回友好提示不崩溃", async () => {
    setupTestFiles()
    const tools = createPromptFileTools(projectRoot)
    const globTool = tools.find((t) => t.name === "prompt_glob")!

    const result = await globTool.execute({ pattern: "*.txt", path: "non-existent-dir" })
    expect(result.observation).toContain("Error: The specified directory does not exist.")
    const data = result.data as any
    expect(data.error).toBe("ENOENT")

    cleanupTestFiles()
  })

  it("prompt_grep 遇到不存在的搜索路径，返回友好提示不崩溃", async () => {
    setupTestFiles()
    const tools = createPromptFileTools(projectRoot)
    const grepTool = tools.find((t) => t.name === "prompt_grep")!

    const result = await grepTool.execute({ pattern: "line", path: "non-existent-dir" })
    expect(result.observation).toContain("Error: The specified directory does not exist.")
    const data = result.data as any
    expect(data.error).toBe("ENOENT")

    cleanupTestFiles()
  })
})
