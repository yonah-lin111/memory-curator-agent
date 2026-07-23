import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useToast } from "@/components/ui/Toast"
import type { AgentMentionPanelState } from "@/features/curator/components/CuratorInput/types"
import { getMatchedCuratorAgentMentions } from "@/features/curator/curatorAgentMentions"

import { useCuratorContextStore } from "@/features/curator/curatorContextStore"
import { resolveAgentMentionPanelState } from "@/lib/ai-shared/utils"

// 统一的 mention 选项结构（兼容 Agent 与 Skill）。
export interface UnifiedMentionOption {
  id: string
  kind: "agent" | "skill"
  token: string
  label: string
  description: string
  skillContent?: string
  location?: string
}

/**
 * useCuratorMentions - 专门管理 AI 输入框内输入 "@" 符号触发 Agent Mentions 与 Skills 的统一微 Hook。
 * 支持在同一个 "@" 菜单下模糊检索并选择 Agent 和自定义 Skill。
 */
export const useCuratorMentions = (
  inputText: string,
  setInputText: (value: string) => void,
  sessionId: string,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  adjustTextareaHeight: () => void,
  resetHistoryCursor: () => void,
) => {
  const toast = useToast()
  const contextStore = useCuratorContextStore()
  const [skills, setSkills] = useState<any[]>([])
  const [agentMentionPanelState, setAgentMentionPanelState] =
    useState<AgentMentionPanelState | null>(null)
  const [activeAgentIndex, setActiveAgentIndex] = useState(0)

  // 当面板被唤醒时，自动异步读取本地的所有 Skill Markdown 列表。
  useEffect(() => {
    if (!agentMentionPanelState) return

    const fetchSkills = async () => {
      try {
        if (window.api?.skills) {
          const list = await window.api.skills.list(false)
          setSkills(list || [])
        }
      } catch (error) {
        console.error("Failed to load skills in useCuratorMentions:", error)
      }
    }

    fetchSkills()
  }, [Boolean(agentMentionPanelState)])

  // 整理出统一展示的匹配选项（包含 Agent 和 Skill）。
  const matchedAgentMentions = useMemo((): UnifiedMentionOption[] => {
    if (!agentMentionPanelState) return []

    const query = agentMentionPanelState.query

    // 1. 获取匹配的 Agent 列表
    const matchedAgents = getMatchedCuratorAgentMentions(query).map(
      (agent): UnifiedMentionOption => ({
        id: agent.id,
        kind: "agent",
        token: agent.token,
        label: agent.label,
        description: agent.description,
      }),
    )

    // 2. 获取匹配的 Skill 列表并转换格式
    const normalizedQuery = query.trim().toLowerCase().replace(/^@/, "")
    const isFuzzyMatch = (q: string, k: string): boolean => {
      if (!q) return true
      let qi = 0
      for (const char of k) {
        if (char === q[qi]) qi += 1
        if (qi === q.length) return true
      }
      return false
    }

    const matchedSkills = skills
      .filter((skill) =>
        [skill.name, skill.id, skill.description || "", `${skill.id}[skill]`, "skill"].some(
          (keyword) => isFuzzyMatch(normalizedQuery, keyword.toLowerCase()),
        ),
      )
      .map(
        (skill): UnifiedMentionOption => ({
          id: skill.id,
          kind: "skill",
          token: `@${skill.id}[skill]`,
          label: skill.name,
          description: skill.description || "加载自定义技能系统提示词",
          skillContent: skill.content,
          location: skill.location,
        }),
      )

    return [...matchedAgents, ...matchedSkills]
  }, [agentMentionPanelState, skills])

  const isAgentPanelOpen = Boolean(agentMentionPanelState && matchedAgentMentions.length > 0)

  const activeAgent = matchedAgentMentions[activeAgentIndex] ?? matchedAgentMentions[0]

  /**
   * 关闭 agent mention 面板。
   */
  const closeAgentMentionPanel = useCallback((): void => {
    setAgentMentionPanelState(null)
    setActiveAgentIndex(0)
  }, [])

  /**
   * 根据输入值和光标位置同步 agent mention 面板。
   */
  const syncAgentMentionPanel = useCallback(
    (value: string, cursor: number): void => {
      const nextState = resolveAgentMentionPanelState(value, cursor)
      if (!nextState) {
        closeAgentMentionPanel()
        return
      }

      setAgentMentionPanelState(nextState)
      setActiveAgentIndex(0)
    },
    [closeAgentMentionPanel],
  )

  /**
   * 插入选中的 agent token 或 skill token 并恢复输入焦点。
   */
  const selectAgentMention = useCallback(
    (option: UnifiedMentionOption): void => {
      const textarea = textareaRef.current
      if (!textarea || !agentMentionPanelState) {
        return
      }

      const cursor = textarea.selectionStart
      const nextValue = `${inputText.slice(0, agentMentionPanelState.start)}${option.token} ${inputText.slice(cursor)}`
      const nextCursor = agentMentionPanelState.start + option.token.length + 1

      // 如果选择的是 Skill，则执行手动挂载 Session 级别的状态更新
      if (option.kind === "skill" && option.skillContent) {
        if (!sessionId) {
          toast.warning("请先选择一个对话会话再挂载技能")
          return
        }

        contextStore.addItem({
          key: `skill-${option.id}`,
          sessionId,
          kind: "skill",
          title: `Skill: ${option.label}`,
          sourceId: option.id,
          summary: option.description,
          content: option.skillContent,
          tokens: Math.ceil(option.skillContent.length / 4),
          createdAt: Date.now(),
          meta: {
            name: option.label,
            description: option.description,
            location: option.location || "",
          },
        })

        toast.success(`已激活技能: ${option.label}`)
      }

      setInputText(nextValue)
      resetHistoryCursor()
      closeAgentMentionPanel()
      requestAnimationFrame(() => {
        adjustTextareaHeight()
        textarea.focus()
        textarea.setSelectionRange(nextCursor, nextCursor)
      })
    },
    [
      inputText,
      agentMentionPanelState,
      sessionId,
      contextStore,
      setInputText,
      resetHistoryCursor,
      closeAgentMentionPanel,
      adjustTextareaHeight,
      textareaRef,
      toast,
    ],
  )

  /**
   * 循环切换 agent mention 面板选中项。
   */
  const moveActiveAgent = useCallback(
    (direction: 1 | -1): void => {
      setActiveAgentIndex((currentIndex) => {
        if (matchedAgentMentions.length === 0) {
          return 0
        }

        return (
          (currentIndex + direction + matchedAgentMentions.length) % matchedAgentMentions.length
        )
      })
    },
    [matchedAgentMentions.length],
  )

  /**
   * 光标移动离开查询区间时关闭 agent mention 面板。
   */
  const handleTextareaCursorMove = useCallback((): void => {
    const textarea = textareaRef.current
    if (!textarea || !agentMentionPanelState) {
      return
    }

    const nextState = resolveAgentMentionPanelState(textarea.value, textarea.selectionStart)
    if (!nextState) {
      closeAgentMentionPanel()
    }
  }, [agentMentionPanelState, closeAgentMentionPanel, textareaRef])

  return {
    agentMentionPanelState,
    activeAgentIndex,
    matchedAgentMentions,
    isAgentPanelOpen,
    activeAgent,
    setActiveAgentIndex,
    syncAgentMentionPanel,
    closeAgentMentionPanel,
    selectAgentMention,
    moveActiveAgent,
    handleTextareaCursorMove,
  }
}
