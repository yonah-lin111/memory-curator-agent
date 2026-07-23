import { existsSync } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import matter from "gray-matter"
import { isAiChatAgentId } from "@/agent/core/agentHints"
import { getSkillsDir } from "@/paths"
import { readAiSettingsConfig } from "@/services/configService"

// 项目内置 Skill 根目录；生产包由 electron-builder 复制到 Resources。
const getBuiltinSkillsDir = (): string => {
  const packagedSkillsDir = process.resourcesPath
    ? join(process.resourcesPath, "resources", "skills")
    : ""
  return existsSync(packagedSkillsDir)
    ? packagedSkillsDir
    : join(process.cwd(), "resources", "skills")
}

// AI Agent 技能数据模型。
export interface AiAgentSkill {
  // 唯一标识（目录名）
  id: string
  // 显示名称
  name: string
  // 简短描述
  description: string
  // 支持的 agent 列表，若无或为空则全局可用
  supportedAgents?: string[]
  // 实际的 prompt 内容
  content: string
  // skill.md 所在绝对路径
  location: string
}

// 技能文件 frontmatter 的结构。
interface SkillFrontmatter {
  name?: string
  description?: string
  supportedAgents?: string[]
  [key: string]: unknown
}

// 缓存解析后的 skills 列表，避免频繁扫描磁盘。
let skillsCache: AiAgentSkill[] | null = null

/**
 * 确保 Skills 目录存在，如果不存在则自动创建。
 */
const ensureSkillsDir = async (): Promise<string> => {
  const dir = getSkillsDir()
  const { mkdirSync } = await import("node:fs")
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 扫描并加载 Skills 目录下的所有技能。
 * 目录结构：skills/<技能名>/skill.md
 */
export const loadSkills = async (forceRefresh = false): Promise<AiAgentSkill[]> => {
  if (skillsCache && !forceRefresh) {
    return skillsCache
  }

  const skills: AiAgentSkill[] = []

  const loadSkillsFromDir = async (dir: string): Promise<void> => {
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const entryPath = join(dir, entry)
      let stats
      try {
        stats = await stat(entryPath)
      } catch {
        continue
      }
      // 跳过非目录项和已由内置目录加载的同名 Skill。
      if (!stats.isDirectory() || skills.some((skill) => skill.id === entry)) {
        continue
      }

      const skillMdPath = join(entryPath, "skill.md")
      try {
        const fileContent = await readFile(skillMdPath, "utf8")
        const { data, content } = matter(fileContent)
        const frontmatter = data as SkillFrontmatter

        // 目录名作为 id，frontmatter 中的 name/id 优先作为显示名。
        const id = entry
        const name = frontmatter.name || id
        const description = frontmatter.description || ""
        const supportedAgents = Array.isArray(frontmatter.supportedAgents)
          ? frontmatter.supportedAgents.map(String)
          : undefined

        skills.push({
          id,
          name,
          description,
          supportedAgents,
          content: content.trim(),
          location: skillMdPath,
        })
      } catch (error) {
        // 容错处理：不因为单个 Skill 文件语法错误崩溃。
        console.error(`Failed to parse skill file ${skillMdPath}:`, error)
      }
    }
  }

  await loadSkillsFromDir(getBuiltinSkillsDir())
  await loadSkillsFromDir(await ensureSkillsDir())

  // 按名称字母排序，确保下拉列表的一致性。
  skillsCache = skills.sort((a, b) => a.name.localeCompare(b.name))
  return skillsCache
}

/**
 * 获取适用于特定 Agent 的所有 Skills。
 *
 * 过滤规则（按优先级）：
 * - supportedAgents 缺省或为空 → 全局可用（等同于 public）
 * - 包含 'public' → 所有 agent 类型均可用
 * - 包含 'curator' → 所有策展 agent（AiChatAgentId）可用
 * - 包含 'prompt-design' → 提示词设计 agent 可用
 * - 包含具体 agentId → 精确匹配
 */
export const getAvailableSkillsForAgent = async (agentId: string): Promise<AiAgentSkill[]> => {
  const allSkills = await loadSkills()
  const disabledSkillIds = new Set(readAiSettingsConfig().disabledSkillIds)
  return allSkills.filter((skill) => {
    if (disabledSkillIds.has(skill.id)) {
      return false
    }
    // 未指定或空 → 全局可用
    if (!skill.supportedAgents || skill.supportedAgents.length === 0) {
      return true
    }
    // public 关键字 → 所有 agent 可用
    if (skill.supportedAgents.includes("public")) {
      return true
    }
    // curator 关键字 → 所有策展 agent 可用
    if (skill.supportedAgents.includes("curator") && isAiChatAgentId(agentId)) {
      return true
    }
    // 精确匹配（含 'prompt-design' 等）
    return skill.supportedAgents.includes(agentId)
  })
}

/**
 * 清除技能缓存，下次获取时将重新扫描磁盘。
 */
export const clearSkillsCache = (): void => {
  skillsCache = null
}
