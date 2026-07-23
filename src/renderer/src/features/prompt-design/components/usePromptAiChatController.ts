import { useCallback, useEffect, useRef, useState } from "react"
import type {
  CuratorAskAnswerSubmitPayload,
  CuratorToolConfirmationAnswerSubmitPayload,
} from "@/components/ai-shared/AskRequestPanel"
import type { CuratorMessage, CuratorMessagePart, CuratorToolStep } from "@/features/curator/types"
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore"
import type { PromptDesignReference } from "@/features/prompt-design/types"

export type PromptAiPart = Extract<CuratorMessagePart, { kind: "text" | "reasoning" | "tool" }>

// MCP 工具展示数据。
export type PromptAiMcpServer = {
  id: string
  name: string
  tools: Array<{ name: string; description: string }>
}

type PromptAiPersistedMessage = {
  id: string
  role: "user" | "assistant" | "system" | "system_command"
  content: string
  createdAt: string
  model?: string
  parts?: CuratorMessagePart[]
  toolSteps?: CuratorToolStep[]
  cancelled?: boolean
  references?: PromptDesignReference[]
}

type PromptAiSession = {
  id: string
  title: string
  time: string
  status: "idle" | "running" | "completed" | "failed"
  messages: CuratorMessage[]
}

type PromptAiEvent =
  | {
      type: "run_started"
      runId: string
      sessionId: string
      model?: string
      currentDocumentTruncated?: boolean
    }
  | { type: "text_delta" | "reasoning_delta"; runId: string; sessionId: string; delta: string }
  | { type: "tool_started"; runId: string; sessionId: string; toolStep: CuratorToolStep }
  | {
      type: "tool_finished"
      runId: string
      sessionId: string
      toolStepId: string
      observation?: string
      data?: unknown
    }
  | { type: "tool_failed"; runId: string; sessionId: string; toolStepId: string; error?: string }
  | { type: "turn_finished" | "done"; runId: string; sessionId: string }
  | { type: "session_title_updated"; runId: string; sessionId: string; title: string }
  | { type: "error"; runId: string; sessionId: string; message: string }

export type PromptAiMessage = {
  id: string
  role: "user" | "assistant" | "system" | "system_command"
  content: string
  time: string
  model?: string
  parts?: PromptAiPart[]
  /** 旧消费方的思考内容聚合，渲染仍以 parts 为准。 */
  reasoning?: string
  toolSteps?: CuratorToolStep[]
  cancelled?: boolean
  references?: PromptDesignReference[]
  mcpServers?: PromptAiMcpServer[]
}

export type PromptAiSendOptions = { references?: PromptDesignReference[] }

export type PromptAiUndoResult =
  | {
      status: "empty" | "undone" | "deleted_empty"
      prompt?: string
    }
  | false

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  prompt_file_read: "Read",
  prompt_glob: "Glob",
  prompt_grep: "Grep",
  prompt_editor_replace: "Replace editor",
  prompt_editor_insert_lines: "Insert editor lines",
  prompt_editor_replace_lines: "Replace editor lines",
  prompt_editor_delete_lines: "Delete editor lines",
}

/**
 * 标准化历史工具步骤，兼容早期的 name 字段。
 */
const mapBackendToolStep = (raw: CuratorToolStep): CuratorToolStep => {
  const toolName = raw.tool
  return {
    ...raw,
    title: raw.title || `Tool result: ${TOOL_DISPLAY_NAMES[toolName] || toolName}`,
    tool: raw.mcp?.toolName || TOOL_DISPLAY_NAMES[toolName] || toolName,
    observation: raw.observation ?? "",
  }
}

/**
 * 旧记录没有可用 parts 时，按历史字段重建可渲染片段。
 */
const resolveMessageParts = (message: PromptAiPersistedMessage): PromptAiPart[] => {
  const usableParts =
    message.parts?.filter(
      (part): part is PromptAiPart =>
        part.kind === "text" || part.kind === "reasoning" || part.kind === "tool",
    ) || []

  const nextParts = [...usableParts]
  const hasText = nextParts.some((part) => part.kind === "text")
  const hasTool = nextParts.some((part) => part.kind === "tool")

  if (!hasText && message.content) {
    nextParts.push({
      id: `${message.id}-content`,
      kind: "text",
      content: message.content,
    })
  }

  if (!hasTool && message.toolSteps?.length) {
    const toolParts: PromptAiPart[] = message.toolSteps.map((step) => ({
      id: `${message.id}-tool-${step.id}`,
      kind: "tool",
      stepId: step.id,
    }))
    const firstTextIndex = nextParts.findIndex((part) => part.kind === "text")
    if (firstTextIndex !== -1) {
      nextParts.splice(firstTextIndex, 0, ...toolParts)
    } else {
      nextParts.push(...toolParts)
    }
  }

  return nextParts
}

/**
 * 从持久化片段中提取 MCP 工具快照。
 */
const resolveMcpServers = (
  parts: CuratorMessagePart[] | undefined,
): PromptAiMcpServer[] | undefined => parts?.find((part) => part.kind === "mcp-overview")?.servers

/**
 * 避免思考块在切换到后续片段时因状态未闭合而持续处于加载态。
 */
const completeReasoningParts = (parts: PromptAiPart[] | undefined): PromptAiPart[] => {
  if (!parts) return []
  return parts.map((part) =>
    part.kind === "reasoning" && part.status !== "done"
      ? { ...part, status: "done" as const }
      : part,
  )
}

/**
 * 连续同类型流式增量合并，工具事件会自然截断片段。
 */
const appendStreamPart = (
  parts: PromptAiPart[] | undefined,
  kind: "text" | "reasoning",
  delta: string,
): PromptAiPart[] => {
  let nextParts = [...(parts ?? [])]
  if (kind === "text") {
    nextParts = completeReasoningParts(nextParts)
  }
  const lastPart = nextParts.at(-1)
  if (lastPart?.kind === kind) {
    nextParts[nextParts.length - 1] = { ...lastPart, content: lastPart.content + delta }
    return nextParts
  }

  nextParts.push({
    id: `stream-${Date.now()}-${nextParts.length}`,
    kind,
    content: delta,
    ...(kind === "reasoning" ? { status: "streaming" as const } : {}),
  })
  return nextParts
}

/**
 * 将指定事件应用到最后一条助手消息，保持流式和历史消息结构一致。
 */
const updateLastAssistantMessage = (
  messages: PromptAiMessage[],
  update: (message: PromptAiMessage) => PromptAiMessage,
): PromptAiMessage[] => {
  const lastIndex = messages.length - 1
  const lastMessage = messages[lastIndex]
  if (!lastMessage || lastMessage.role !== "assistant") return messages

  const nextMessages = [...messages]
  nextMessages[lastIndex] = update(lastMessage)
  return nextMessages
}

/**
 * 管理 Prompt AI 会话、流式片段和编辑器工具建议。
 */
export const usePromptAiChatController = (
  designItemId: string,
  currentDocument: string,
  onEditorSuggestion: (originalContent: string, candidateContent: string) => boolean,
  isSuggestedQuestionTriggerEnabled: boolean,
) => {
  const [messages, setMessages] = useState<PromptAiMessage[]>([])
  const messagesRef = useRef<PromptAiMessage[]>(messages)
  messagesRef.current = messages
  const [sessionId, setSessionId] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [sessionInitialized, setSessionInitialized] = useState(false)
  const [sessions, setSessions] = useState<PromptAiSession[]>([])
  const [references, setReferences] = useState<PromptDesignReference[]>([])
  const [requestContext, setRequestContext] = useState({
    currentDocument,
    references: [] as PromptDesignReference[],
  })
  const currentDocumentRef = useRef(currentDocument)
  const documentVersionRef = useRef(0)
  const pendingRunDocumentRef = useRef<string | null>(null)
  const activeRunIdRef = useRef<string | null>(null)
  // 在渲染阶段同步，保证读取工具始终获得最新候选正文。
  if (currentDocumentRef.current !== currentDocument) {
    currentDocumentRef.current = currentDocument
    documentVersionRef.current += 1
  }
  const [currentDocumentTruncated, setCurrentDocumentTruncated] = useState(false)
  // 仅记录当前可见会话中刚完成的助手消息，避免历史消息重新触发推荐问题。
  const [suggestedQuestionMessageId, setSuggestedQuestionMessageId] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuggestedQuestionTriggerEnabled) {
      setSuggestedQuestionMessageId(null)
    }
  }, [isSuggestedQuestionTriggerEnabled])

  const fetchSessions = useCallback(async () => {
    if (!designItemId) return
    const items = await window.api.promptAi!.listSessions(designItemId)
    setSessions(
      items.map((item) => ({
        ...item,
        time: item.lastMessageAt,
      })),
    )
    return items
  }, [designItemId])

  const loadSession = useCallback(async (sid: string) => {
    const session = await window.api.promptAi!.getSession(sid)
    if (!session) return

    setSuggestedQuestionMessageId(null)
    setSessionId(session.id)
    setReferences([])
    setMessages(
      session.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content || "",
        time: message.createdAt,
        model: message.model,
        parts: resolveMessageParts(message),
        reasoning: message.parts
          ?.filter((part) => part.kind === "reasoning")
          .map((part) => part.content)
          .join(""),
        toolSteps: message.toolSteps?.map(mapBackendToolStep),
        references: message.references,
        mcpServers: resolveMcpServers(message.parts),
        cancelled: message.cancelled,
      })),
    )
  }, [])

  useEffect(() => {
    const init = async () => {
      setSessionInitialized(false)
      const items = await fetchSessions()
      if (items?.length) {
        await loadSession(items[0].id)
      } else {
        setSessionId(`sess-${Date.now()}`)
      }
      setSessionInitialized(true)
    }
    void init()
  }, [fetchSessions, loadSession])

  useEffect(() => {
    if (!sessionId) return

    const unlisten = window.api.promptAi!.onChatEvent((event: PromptAiEvent) => {
      if (event.sessionId !== sessionId) return

      if (event.type === "run_started") {
        pendingRunDocumentRef.current = null
        setCurrentDocumentTruncated(event.currentDocumentTruncated === true)
        setIsGenerating(true)
        if (event.model) {
          setMessages((previous) =>
            updateLastAssistantMessage(previous, (message) => ({ ...message, model: event.model })),
          )
        }
      } else if (event.type === "text_delta") {
        setMessages((previous) =>
          updateLastAssistantMessage(previous, (message) => ({
            ...message,
            content: message.content + event.delta,
            parts: appendStreamPart(message.parts, "text", event.delta),
          })),
        )
      } else if (event.type === "reasoning_delta") {
        setMessages((previous) =>
          updateLastAssistantMessage(previous, (message) => ({
            ...message,
            reasoning: (message.reasoning ?? "") + event.delta,
            parts: appendStreamPart(message.parts, "reasoning", event.delta),
          })),
        )
      } else if (event.type === "tool_started") {
        setMessages((previous) =>
          updateLastAssistantMessage(previous, (message) => ({
            ...message,
            toolSteps: [...(message.toolSteps ?? []), event.toolStep],
            parts: [
              ...completeReasoningParts(message.parts),
              { id: `tool-${event.toolStep.id}`, kind: "tool", stepId: event.toolStep.id },
            ],
          })),
        )
      } else if (event.type === "tool_finished") {
        setMessages((previous) =>
          updateLastAssistantMessage(previous, (message) => ({
            ...message,
            toolSteps: message.toolSteps?.map((step) =>
              step.id === event.toolStepId
                ? {
                    ...step,
                    status: "done",
                    observation: event.observation ?? "",
                    data: event.data,
                  }
                : step,
            ),
          })),
        )
      } else if (event.type === "tool_failed") {
        setMessages((previous) =>
          updateLastAssistantMessage(previous, (message) => ({
            ...message,
            toolSteps: message.toolSteps?.map((step) =>
              step.id === event.toolStepId
                ? { ...step, status: "failed", observation: event.error ?? "" }
                : step,
            ),
          })),
        )
      } else if (event.type === "done") {
        setIsGenerating(false)
        if (event.runId === activeRunIdRef.current) activeRunIdRef.current = null
        if (isSuggestedQuestionTriggerEnabled) {
          const latestMessage = messagesRef.current.at(-1)
          setSuggestedQuestionMessageId(
            latestMessage?.role === "assistant" ? latestMessage.id : null,
          )
        }
        setMessages((previous) =>
          updateLastAssistantMessage(previous, (message) => ({
            ...message,
            parts: message.parts?.map((part) =>
              part.kind === "reasoning" ? { ...part, status: "done" } : part,
            ),
          })),
        )
      } else if (event.type === "session_title_updated") {
        void fetchSessions()
      } else if (event.type === "error") {
        setIsGenerating(false)
        if (event.runId === activeRunIdRef.current) activeRunIdRef.current = null
        console.error("AI chat error:", event.message)
      }
    })

    return unlisten
  }, [fetchSessions, isSuggestedQuestionTriggerEnabled, onEditorSuggestion, sessionId])

  useEffect(
    () =>
      window.api.promptAi!.onEditorReadRequest((request) => {
        if (request.designItemId !== designItemId) return
        void window.api.promptAi!.respondEditorRead({
          ...request,
          content: currentDocumentRef.current,
          version: documentVersionRef.current,
        })
      }),
    [designItemId],
  )

  /**
   * 仅在候选正文仍基于同一版本时应用主进程写请求，并以 ACK 作为工具成功条件。
   */
  useEffect(
    () =>
      window.api.promptAi!.onEditorApplyRequest((request) => {
        if (request.designItemId !== designItemId) return
        if (request.baseVersion !== documentVersionRef.current) {
          void window.api.promptAi!.respondEditorApply({
            ...request,
            content: currentDocumentRef.current,
            version: documentVersionRef.current,
          })
          return
        }
        const workingContent = currentDocumentRef.current
        if (!onEditorSuggestion(workingContent, request.content)) {
          void window.api.promptAi!.respondEditorApply({
            ...request,
            content: workingContent,
            version: documentVersionRef.current,
          })
          return
        }
        // 在响应 ACK 前同步更新 ref，阻止连续 IPC 读取到旧候选正文。
        currentDocumentRef.current = request.content
        documentVersionRef.current += 1
        void window.api.promptAi!.respondEditorApply({
          ...request,
          content: request.content,
          version: documentVersionRef.current,
        })
      }),
    [designItemId, onEditorSuggestion],
  )

  const LATEST_ASSISTANT_TOP_OFFSET = 4

  const handleNewChat = useCallback(() => {
    if (isGenerating) return
    setSuggestedQuestionMessageId(null)
    setSessionId(`sess-${Date.now()}`)
    setMessages([])
  }, [isGenerating])

  const handleSessionChange = useCallback(
    (sid: string) => {
      if (!isGenerating) {
        setSuggestedQuestionMessageId(null)
        void loadSession(sid)
      }
    },
    [isGenerating, loadSession],
  )

  const handleRenameChat = useCallback(
    async (sid: string, title: string) => {
      try {
        await window.api.promptAi!.updateSessionTitle(sid, title)
        await fetchSessions()
        return true
      } catch (error) {
        console.error("Failed to rename chat:", error)
        return false
      }
    },
    [fetchSessions],
  )

  const handleDeleteChat = useCallback(
    async (sid: string) => {
      try {
        await window.api.promptAi!.deleteSession(sid)
        await fetchSessions()
        if (sessionId === sid) handleNewChat()
        return true
      } catch (error) {
        console.error("Failed to delete chat:", error)
        return false
      }
    },
    [fetchSessions, handleNewChat, sessionId],
  )

  const handleUndo = useCallback(async (): Promise<PromptAiUndoResult> => {
    if (isGenerating) return false
    if (!messages.length) return { status: "empty" }
    const latestTurnStart = [...messages]
      .reverse()
      .find((message) => message.role === "user" || message.role === "system_command")
    const prompt = latestTurnStart?.role === "user" ? latestTurnStart.content : undefined
    const referenceSnapshot =
      latestTurnStart?.role === "user"
        ? (latestTurnStart.references?.map((reference) => ({ ...reference })) ?? [])
        : []

    try {
      const updated = await window.api.promptAi!.undoLastTurn(sessionId)
      if (!updated) return false
      if (!updated.messages.length) {
        const isDeleted = await handleDeleteChat(sessionId)
        if (isDeleted) setReferences(referenceSnapshot)
        return isDeleted ? { status: "deleted_empty", prompt } : false
      }
      await loadSession(sessionId)
      setReferences(referenceSnapshot)
      return { status: "undone", prompt }
    } catch (error) {
      console.error("Failed to undo last turn:", error)
      return false
    }
  }, [handleDeleteChat, isGenerating, loadSession, messages, sessionId])

  /**
   * 取消当前生成，并标记当前问答为已取消。
   */
  const handleCancelGeneration = useCallback(async (): Promise<void> => {
    if (!isGenerating || !activeRunIdRef.current) return
    try {
      await window.api.promptAi!.cancelChat(activeRunIdRef.current)
      setIsGenerating(false)
      activeRunIdRef.current = null
      setMessages((previous) => {
        const lastUserIndex = previous.findLastIndex((message) => message.role === "user")

        return previous.map((message, index) =>
          index === lastUserIndex || index === previous.length - 1
            ? { ...message, cancelled: true }
            : message,
        )
      })
    } catch (error) {
      console.error("Failed to cancel AI chat:", error)
    }
  }, [isGenerating])

  const sendMessage = useCallback(
    async (text: string, selectedModel?: string, options?: PromptAiSendOptions) => {
      if (isGenerating || !text.trim() || !sessionInitialized) return
      const [providerId, modelId] = selectedModel?.split("::") ?? []
      const time = new Date().toISOString()
      const referenceSnapshot = options?.references?.map((reference) => ({ ...reference }))
      setReferences([])
      setSuggestedQuestionMessageId(null)
      setMessages((previous) => [
        ...previous,
        {
          id: `msg-${Date.now()}`,
          role: "user",
          content: text,
          time,
          references: referenceSnapshot,
        },
        {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          content: "",
          model: modelId,
          time,
          parts: [],
        },
      ])
      setIsGenerating(true)
      setCurrentDocumentTruncated(false)
      setRequestContext({
        currentDocument: "",
        references: referenceSnapshot ?? [],
      })
      pendingRunDocumentRef.current = currentDocumentRef.current

      const { itemName } = usePromptDesignStore.getState()

      try {
        const { runId } = await window.api.promptAi!.startChat({
          sessionId,
          designItemId,
          message: text,
          provider: providerId,
          model: modelId,
          currentDocumentName: itemName,
          references: referenceSnapshot,
        })
        activeRunIdRef.current = runId
        await fetchSessions()
      } catch (error) {
        console.error("Failed to send message", error)
        pendingRunDocumentRef.current = null
        setIsGenerating(false)
      }
    },
    [designItemId, fetchSessions, isGenerating, sessionId, sessionInitialized],
  )

  /**
   * 读取可连接的 MCP 服务并以本地助手消息展示，避免命令进入模型上下文。
   */
  const showMcpTools = useCallback(async (): Promise<void> => {
    if (isGenerating) return

    const time = new Date().toISOString()
    try {
      const mcpCommand = await window.api.promptAi!.listMcpTools({ sessionId, designItemId })
      if (mcpCommand) {
        setMessages((previous) => [
          ...previous,
          {
            id: mcpCommand.command.id,
            role: "system_command",
            content: mcpCommand.command.content,
            time: mcpCommand.command.time,
          },
          {
            id: mcpCommand.result.id,
            role: "system",
            content: "",
            time: mcpCommand.result.time,
            mcpServers: mcpCommand.result.servers,
          },
        ])
        return
      }

      // 兼容主进程热更新前仍返回空值的 IPC 处理器。
      const session = await window.api.promptAi!.getSession(sessionId)
      const command = session?.messages.at(-2)
      const result = session?.messages.at(-1)
      const mcpServers = resolveMcpServers(result?.parts)
      if (command?.role !== "system_command" || result?.role !== "system" || !mcpServers) {
        throw new Error("MCP command result is unavailable")
      }
      setMessages((previous) => [
        ...previous,
        {
          id: command.id,
          role: "system_command",
          content: command.content,
          time: command.createdAt,
        },
        {
          id: result.id,
          role: "system",
          content: result.content,
          time: result.createdAt,
          mcpServers,
        },
      ])
    } catch (error) {
      console.error("Failed to load MCP tools:", error)
      setMessages((previous) => [
        ...previous,
        {
          id: `mcp-${Date.now()}`,
          role: "system",
          content: "Unable to load MCP tools.",
          time,
          parts: [
            { id: `mcp-${Date.now()}-error`, kind: "text", content: "Unable to load MCP tools." },
          ],
        },
      ])
    }
  }, [designItemId, isGenerating, sessionId])

  const handleSubmitAskAnswer = useCallback(async (payload: CuratorAskAnswerSubmitPayload) => {
    await window.api.promptAi!.submitAskAnswer(payload)
  }, [])

  const handleSubmitToolConfirmationAnswer = useCallback(
    async (payload: CuratorToolConfirmationAnswerSubmitPayload) => {
      await window.api.promptAi!.submitToolConfirmationAnswer(payload)
    },
    [],
  )

  const handleDeleteTurn = useCallback(
    async (messageId: string): Promise<void> => {
      if (isGenerating) return
      try {
        const localMessageIndex = messages.findIndex((message) => message.id === messageId)
        const persistedSession = await window.api.promptAi!.getSession(sessionId)
        const persistedMessage =
          localMessageIndex >= 0 &&
          persistedSession?.messages[localMessageIndex]?.role === messages[localMessageIndex].role
            ? persistedSession.messages[localMessageIndex]
            : undefined

        await window.api.promptAi!.deleteTurn(sessionId, persistedMessage?.id ?? messageId)
        await loadSession(sessionId)
        await fetchSessions()
      } catch (error) {
        console.error("Failed to delete AI chat turn:", error)
      }
    },
    [fetchSessions, isGenerating, loadSession, messages, sessionId],
  )

  const handleRegenerateLatestAnswer = useCallback(async (): Promise<void> => {
    if (isGenerating) return
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")
    if (!latestUserMessage) return
    await handleUndo()
    await sendMessage(latestUserMessage.content)
  }, [handleUndo, isGenerating, messages, sendMessage])

  const handleEditAndResendUserMessage = useCallback(
    async (messageId: string, text: string): Promise<void> => {
      if (isGenerating || !text.trim()) return
      await handleDeleteTurn(messageId)
      await sendMessage(text)
    },
    [handleDeleteTurn, isGenerating, sendMessage],
  )

  return {
    activeSessionId: sessionId,
    messages,
    sessions,
    sendMessage,
    handleNewChat,
    handleSessionChange,
    handleRenameChat,
    handleDeleteChat,
    handleUndo,
    handleDeleteTurn,
    handleRegenerateLatestAnswer,
    handleEditAndResendUserMessage,
    handleCancelGeneration,
    handleSubmitAskAnswer,
    handleSubmitToolConfirmationAnswer,
    showMcpTools,
    isGenerating,
    references,
    setReferences,
    contextDocument: isGenerating ? requestContext.currentDocument : currentDocument,
    contextReferences: isGenerating ? requestContext.references : references,
    currentDocumentTruncated,
    sessionInitialized,
    LATEST_ASSISTANT_TOP_OFFSET,
    suggestedQuestionMessageId,
  }
}
