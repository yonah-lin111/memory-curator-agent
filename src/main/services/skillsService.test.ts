import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 缓存相关的模块级 state，并在测试开始前 mock 掉存储路径
let tempDir: string

vi.mock('@/paths', () => ({
  getSkillsDir: () => tempDir
}))

import { loadSkills, getAvailableSkillsForAgent, clearSkillsCache } from './skillsService'

describe('skillsService', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mc-skills-test-'))
    clearSkillsCache()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
    clearSkillsCache()
    vi.restoreAllMocks()
  })

  it('scans skills directory and parses frontmatter correctly', async () => {
    const skillContent = `---
name: Code Refactoring
description: Optimize and simplify complex components
supportedAgents:
  - common
  - prompt-design
---
Optimize the following code structure following the strict principles.
`
    await writeFile(join(tempDir, 'refactor.md'), skillContent, 'utf8')

    const skills = await loadSkills(true)
    expect(skills).toHaveLength(1)
    expect(skills[0]).toEqual({
      id: 'refactor',
      name: 'Code Refactoring',
      description: 'Optimize and simplify complex components',
      supportedAgents: ['common', 'prompt-design'],
      content: 'Optimize the following code structure following the strict principles.',
      location: join(tempDir, 'refactor.md')
    })
  })

  it('filters skills by supported agents correctly', async () => {
    const globalSkill = `---
name: Global Helper
description: General assistant guidelines
---
Help user.
`
    const designSkill = `---
name: Prompt Craft
description: Specific to prompt engineering
supportedAgents:
  - prompt-design
---
Craft excellent system prompts.
`
    await writeFile(join(tempDir, 'global.md'), globalSkill, 'utf8')
    await writeFile(join(tempDir, 'design.md'), designSkill, 'utf8')

    // 清理缓存加载
    clearSkillsCache()

    // 1. 获取 prompt-design 代理的可行技能：应当包括全局和专属
    const designSkills = await getAvailableSkillsForAgent('prompt-design')
    expect(designSkills.map(s => s.id)).toEqual(['global', 'design'])

    // 2. 获取 common 代理的可行技能：应当仅包含全局技能
    const commonSkills = await getAvailableSkillsForAgent('common')
    expect(commonSkills.map(s => s.id)).toEqual(['global'])
  })
})
