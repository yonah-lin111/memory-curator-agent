import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import matter from 'gray-matter'
import { getSkillsDir } from '@/paths'

// AI Agent 技能数据模型。
export interface AiAgentSkill {
  // 唯一标识（通常为文件名除去后缀，或 frontmatter 中的 id/name）
  id: string
  // 显示名称
  name: string
  // 简短描述
  description: string
  // 支持的 agent 列表，若无或为空则全局可用
  supportedAgents?: string[]
  // 实际的 prompt 内容
  content: string
  // 所在绝对路径
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
 * 确保 Skills 目录存在，如果不存在则自动创建，支持用户体验。
 */
const ensureSkillsDir = async (): Promise<string> => {
  const dir = getSkillsDir()
  const { mkdirSync } = await import('node:fs')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 扫描并加载特定目录下的所有 Skill Markdown 文件。
 * 核心逻辑采用 gray-matter 提取 Frontmatter 和正文。
 */
export const loadSkills = async (forceRefresh = false): Promise<AiAgentSkill[]> => {
  if (skillsCache && !forceRefresh) {
    return skillsCache
  }

  const dir = await ensureSkillsDir()
  const files = await readdir(dir)
  const skills: AiAgentSkill[] = []

  for (const file of files) {
    if (extname(file).toLowerCase() !== '.md') {
      continue
    }

    const filePath = join(dir, file)
    try {
      const fileContent = await readFile(filePath, 'utf8')
      const { data, content } = matter(fileContent)
      const frontmatter = data as SkillFrontmatter

      // 提取基本元数据，缺省时使用文件名作为兜底。
      const id = file.replace(/\.md$/i, '')
      const name = frontmatter.name || id
      const description = frontmatter.description || ''
      const supportedAgents = Array.isArray(frontmatter.supportedAgents)
        ? frontmatter.supportedAgents.map(String)
        : undefined

      skills.push({
        id,
        name,
        description,
        supportedAgents,
        content: content.trim(),
        location: filePath
      })
    } catch (error) {
      // 容错处理：不因为单个 Skill 文件语法错误崩溃，保证整体服务高可用。
      console.error(`Failed to parse skill file ${filePath}:`, error)
    }
  }

  // 按名称字母排序，确保下拉列表的一致性。
  skillsCache = skills.sort((a, b) => a.name.localeCompare(b.name))
  return skillsCache
}

/**
 * 获取适用于特定 AI Agent 的所有 Skills。
 * 如果 Skill 限制了 supportedAgents，则必须包含对应的 agentId；否则全局通用。
 */
export const getAvailableSkillsForAgent = async (agentId: string): Promise<AiAgentSkill[]> => {
  const allSkills = await loadSkills()
  return allSkills.filter((skill) => {
    // supportedAgents 缺省或为空表示全局可用
    if (!skill.supportedAgents || skill.supportedAgents.length === 0) {
      return true
    }
    return skill.supportedAgents.includes(agentId)
  })
}

/**
 * 清除技能缓存，下次获取时将重新扫描磁盘。
 */
export const clearSkillsCache = (): void => {
  skillsCache = null
}
