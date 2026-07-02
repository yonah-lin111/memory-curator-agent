import type { AgentTool } from '@/agent/types'
import { createReadTool } from './readTool'
import { createGlobTool } from './globTool'
import { createGrepTool } from './grepTool'

/**
 * 创建 Prompt Design AI 专用文件读取工具集。
 * 所有工具限定在 projectRoot 目录内操作。
 * projectRoot 为空时返回空数组（虚拟项目无文件系统访问）。
 */
export const createPromptFileTools = (projectRoot: string): AgentTool[] =>
  projectRoot
    ? [createReadTool(projectRoot), createGlobTool(projectRoot), createGrepTool(projectRoot)]
    : []
