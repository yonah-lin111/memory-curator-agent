import type { AgentTool, AgentToolResult } from '@/agent/types'
import type { AiAgentSkill } from '@/services/skillsService'

// load_skill 入参
type SkillLoadInput = {
  name: string
}

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 解析入参。
 */
const parseInput = (input: unknown): SkillLoadInput => {
  if (!isRecord(input)) return { name: '' }
  return {
    name: typeof input.name === 'string' ? input.name.trim() : ''
  }
}

/**
 * 创建 load_skill 工具，允许 AI 按需加载 Skill 完整提示词内容。
 */
export const createSkillTool = (skills: AiAgentSkill[]): AgentTool => {
  const skillNames = skills.map((s) => s.id)

  return {
    name: 'load_skill',
    description: `Load skill\n${skillNames.join('\n')}`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: `Skill name. Available: ${skillNames.join(', ')}`
        }
      },
      required: ['name']
    },
    execute: async (input): Promise<AgentToolResult> => {
      const { name } = parseInput(input)
      if (!name) {
        throw new Error('Skill name is required.')
      }

      const skill = skills.find((s) => s.id === name)
      if (!skill) {
        throw new Error(
          `Skill "${name}" not found. Available: ${skillNames.join(', ')}`
        )
      }

      return {
        observation: `# ${skill.name}\n\n${skill.content}`,
        data: skill
      }
    }
  }
}
