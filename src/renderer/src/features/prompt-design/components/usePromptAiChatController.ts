import { useState, useCallback, useEffect, useRef } from "react";
import type {
  CuratorAskAnswerSubmitPayload,
  CuratorToolConfirmationAnswerSubmitPayload,
} from "@/components/ai-shared/AskRequestPanel";
import type { CuratorMessage, CuratorMessagePart, CuratorToolStep } from "@/features/curator/types";

export type PromptAiPart = Extract<CuratorMessagePart, { kind: "text" | "reasoning" | "tool" }>;

type PromptAiPersistedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  model?: string;
  parts?: CuratorMessagePart[];
  toolSteps?: CuratorToolStep[];
  cancelled?: boolean;
};

type PromptAiSession = {
  id: string;
  title: string;
  time: string;
  status: "idle" | "running" | "completed" | "failed";
  messages: CuratorMessage[];
};

type PromptAiEvent =
  | { type: "run_started"; runId: string; sessionId: string; model?: string }
  | { type: "text_delta" | "reasoning_delta"; runId: string; sessionId: string; delta: string }
  | { type: "tool_started"; runId: string; sessionId: string; toolStep: CuratorToolStep }
  | { type: "tool_finished"; runId: string; sessionId: string; toolStepId: string; observation?: string; data?: unknown }
  | { type: "tool_failed"; runId: string; sessionId: string; toolStepId: string; error?: string }
  | { type: "turn_finished" | "done"; runId: string; sessionId: string }
  | { type: "session_title_updated"; runId: string; sessionId: string; title: string }
  | { type: "error"; runId: string; sessionId: string; message: string };

export type PromptAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  model?: string;
  parts?: PromptAiPart[];
  /** 旧消费方的思考内容聚合，渲染仍以 parts 为准。 */
  reasoning?: string;
  toolSteps?: CuratorToolStep[];
  cancelled?: boolean;
};

export type PromptAiUndoResult = {
  status: "empty" | "undone" | "deleted_empty";
  prompt?: string;
} | false;

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  prompt_file_read: "Read",
  prompt_glob: "Glob",
  prompt_grep: "Grep",
  prompt_editor_replace: "Replace editor",
  prompt_editor_replace_lines: "Replace editor lines",
  prompt_editor_delete_lines: "Delete editor lines",
};

/**
 * 标准化历史工具步骤，兼容早期的 name 字段。
 */
const mapBackendToolStep = (raw: CuratorToolStep): CuratorToolStep => {
  const toolName = raw.tool;
  return {
    ...raw,
    title: raw.title || `Tool result: ${TOOL_DISPLAY_NAMES[toolName] || toolName}`,
    tool: TOOL_DISPLAY_NAMES[toolName] || toolName,
    observation: raw.observation ?? "",
  };
};

/**
 * 旧记录没有可用 parts 时，按历史字段重建可渲染片段。
 */
const resolveMessageParts = (message: PromptAiPersistedMessage): PromptAiPart[] => {
  const usableParts = message.parts?.filter(
    (part): part is PromptAiPart => part.kind === "text" || part.kind === "reasoning" || part.kind === "tool",
  ) || [];

  const nextParts = [...usableParts];
  const hasText = nextParts.some((part) => part.kind === "text");
  const hasTool = nextParts.some((part) => part.kind === "tool");

  if (!hasText && message.content) {
    nextParts.push({
      id: `${message.id}-content`,
      kind: "text",
      content: message.content,
    });
  }

  if (!hasTool && message.toolSteps?.length) {
    const toolParts: PromptAiPart[] = message.toolSteps.map((step) => ({
      id: `${message.id}-tool-${step.id}`,
      kind: "tool",
      stepId: step.id,
    }));
    const firstTextIndex = nextParts.findIndex((part) => part.kind === "text");
    if (firstTextIndex !== -1) {
      nextParts.splice(firstTextIndex, 0, ...toolParts);
    } else {
      nextParts.push(...toolParts);
    }
  }

  return nextParts;
};

/**
 * 避免思考块在切换到后续片段时因状态未闭合而持续处于加载态。
 */
const completeReasoningParts = (parts: PromptAiPart[] | undefined): PromptAiPart[] => {
  if (!parts) return [];
  return parts.map((part) =>
    part.kind === "reasoning" && part.status !== "done"
      ? { ...part, status: "done" as const }
      : part,
  );
};

/**
 * 连续同类型流式增量合并，工具事件会自然截断片段。
 */
const appendStreamPart = (
  parts: PromptAiPart[] | undefined,
  kind: "text" | "reasoning",
  delta: string,
): PromptAiPart[] => {
  let nextParts = [...(parts ?? [])];
  if (kind === "text") {
    nextParts = completeReasoningParts(nextParts);
  }
  const lastPart = nextParts.at(-1);
  if (lastPart?.kind === kind) {
    nextParts[nextParts.length - 1] = { ...lastPart, content: lastPart.content + delta };
    return nextParts;
  }

  nextParts.push({
    id: `stream-${Date.now()}-${nextParts.length}`,
    kind,
    content: delta,
    ...(kind === "reasoning" ? { status: "streaming" as const } : {}),
  });
  return nextParts;
};

/**
 * 将指定事件应用到最后一条助手消息，保持流式和历史消息结构一致。
 */
const updateLastAssistantMessage = (
  messages: PromptAiMessage[],
  update: (message: PromptAiMessage) => PromptAiMessage,
): PromptAiMessage[] => {
  const lastIndex = messages.length - 1;
  const lastMessage = messages[lastIndex];
  if (!lastMessage || lastMessage.role !== "assistant") return messages;

  const nextMessages = [...messages];
  nextMessages[lastIndex] = update(lastMessage);
  return nextMessages;
};

/**
 * 管理 Prompt AI 会话、流式片段和编辑器工具建议。
 */
export const usePromptAiChatController = (
  designItemId: string,
  editorContent: string,
  onEditorSuggestion: (originalContent: string, candidateContent: string) => void,
) => {
  const [messages, setMessages] = useState<PromptAiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [sessions, setSessions] = useState<PromptAiSession[]>([]);
  const editorContentRef = useRef(editorContent);
  const runEditorContentRef = useRef(new Map<string, string>());
  const activeRunIdRef = useRef<string | null>(null);
  const latestUserPromptRef = useRef<string | null>(null);
  latestUserPromptRef.current = [...messages].reverse().find((message) => message.role === "user")?.content ?? null;

  useEffect(() => {
    editorContentRef.current = editorContent;
  }, [editorContent]);

  const fetchSessions = useCallback(async () => {
    if (!designItemId) return;
    const items = await window.api.promptAi!.listSessions(designItemId);
    setSessions(items.map((item) => ({
      ...item,
      time: item.lastMessageAt,
    })));
    return items;
  }, [designItemId]);

  const loadSession = useCallback(async (sid: string) => {
    const session = await window.api.promptAi!.getSession(sid);
    if (!session) return;

    setSessionId(session.id);
    setMessages(session.messages.map((message) => ({
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
      cancelled: message.cancelled,
    })));
  }, []);

  useEffect(() => {
    const init = async () => {
      setSessionInitialized(false);
      const items = await fetchSessions();
      if (items?.length) {
        await loadSession(items[0].id);
      } else {
        setSessionId(`sess-${Date.now()}`);
      }
      setSessionInitialized(true);
    };
    void init();
  }, [fetchSessions, loadSession]);

  useEffect(() => {
    if (!sessionId) return;

    const unlisten = window.api.promptAi!.onChatEvent((event: PromptAiEvent) => {
      if (event.sessionId !== sessionId) return;

      if (event.type === "run_started") {
        runEditorContentRef.current.set(event.runId, editorContentRef.current);
        setIsGenerating(true);
        if (event.model) {
          setMessages((previous) => updateLastAssistantMessage(previous, (message) => ({ ...message, model: event.model })));
        }
      } else if (event.type === "text_delta") {
        setMessages((previous) => updateLastAssistantMessage(previous, (message) => ({
          ...message,
          content: message.content + event.delta,
          parts: appendStreamPart(message.parts, "text", event.delta),
        })));
      } else if (event.type === "reasoning_delta") {
        setMessages((previous) => updateLastAssistantMessage(previous, (message) => ({
          ...message,
          reasoning: (message.reasoning ?? "") + event.delta,
          parts: appendStreamPart(message.parts, "reasoning", event.delta),
        })));
      } else if (event.type === "tool_started") {
        setMessages((previous) => updateLastAssistantMessage(previous, (message) => ({
          ...message,
          toolSteps: [...(message.toolSteps ?? []), event.toolStep],
          parts: [
            ...completeReasoningParts(message.parts),
            { id: `tool-${event.toolStep.id}`, kind: "tool", stepId: event.toolStep.id },
          ],
        })));
      } else if (event.type === "tool_finished") {
        if (
          typeof event.data === "object" &&
          event.data !== null &&
          "operation" in event.data &&
          "content" in event.data &&
          typeof event.data.content === "string"
        ) {
          onEditorSuggestion(runEditorContentRef.current.get(event.runId) ?? editorContentRef.current, event.data.content);
        }
        setMessages((previous) => updateLastAssistantMessage(previous, (message) => ({
          ...message,
          toolSteps: message.toolSteps?.map((step) => step.id === event.toolStepId
            ? { ...step, status: "done", observation: event.observation ?? "", data: event.data }
            : step),
        })));
      } else if (event.type === "tool_failed") {
        setMessages((previous) => updateLastAssistantMessage(previous, (message) => ({
          ...message,
          toolSteps: message.toolSteps?.map((step) => step.id === event.toolStepId
            ? { ...step, status: "failed", observation: event.error ?? "" }
            : step),
        })));
      } else if (event.type === "done") {
        setIsGenerating(false);
        if (event.runId === activeRunIdRef.current) activeRunIdRef.current = null;
        runEditorContentRef.current.delete(event.runId);
        setMessages((previous) => updateLastAssistantMessage(previous, (message) => ({
          ...message,
          parts: message.parts?.map((part) => part.kind === "reasoning" ? { ...part, status: "done" } : part),
        })));
      } else if (event.type === "session_title_updated") {
        void fetchSessions();
      } else if (event.type === "error") {
        setIsGenerating(false);
        if (event.runId === activeRunIdRef.current) activeRunIdRef.current = null;
        console.error("AI chat error:", event.message);
      }
    });

    return unlisten;
  }, [fetchSessions, onEditorSuggestion, sessionId]);

  const LATEST_ASSISTANT_TOP_OFFSET = 4;

  const handleNewChat = useCallback(() => {
    if (isGenerating) return;
    setSessionId(`sess-${Date.now()}`);
    setMessages([]);
  }, [isGenerating]);

  const handleSessionChange = useCallback((sid: string) => {
    if (!isGenerating) void loadSession(sid);
  }, [isGenerating, loadSession]);

  const handleRenameChat = useCallback(async (sid: string, title: string) => {
    try {
      await window.api.promptAi!.updateSessionTitle(sid, title);
      await fetchSessions();
      return true;
    } catch (error) {
      console.error("Failed to rename chat:", error);
      return false;
    }
  }, [fetchSessions]);

  const handleDeleteChat = useCallback(async (sid: string) => {
    try {
      await window.api.promptAi!.deleteSession(sid);
      await fetchSessions();
      if (sessionId === sid) handleNewChat();
      return true;
    } catch (error) {
      console.error("Failed to delete chat:", error);
      return false;
    }
  }, [fetchSessions, handleNewChat, sessionId]);

  const handleUndo = useCallback(async (): Promise<PromptAiUndoResult> => {
    if (isGenerating) return false;
    if (!messages.length) return { status: "empty" };
    const prompt = [...messages].reverse().find((message) => message.role === "user")?.content;

    try {
      const updated = await window.api.promptAi!.undoLastTurn(sessionId);
      if (!updated) return false;
      if (!updated.messages.length) {
        const isDeleted = await handleDeleteChat(sessionId);
        return isDeleted ? { status: "deleted_empty", prompt } : false;
      }
      await loadSession(sessionId);
      return { status: "undone", prompt };
    } catch (error) {
      console.error("Failed to undo last turn:", error);
      return false;
    }
  }, [handleDeleteChat, isGenerating, loadSession, messages, sessionId]);

  /**
   * 取消当前生成，并保留最后一条用户提示词供输入框恢复。
   */
  const handleCancelGeneration = useCallback(async (): Promise<string | null> => {
    if (!isGenerating || !activeRunIdRef.current) return null;
    const prompt = latestUserPromptRef.current;
    try {
      await window.api.promptAi!.cancelChat(activeRunIdRef.current);
      setIsGenerating(false);
      activeRunIdRef.current = null;
      setMessages((previous) => updateLastAssistantMessage(previous, (message) => ({ ...message, cancelled: true })));
      return prompt;
    } catch (error) {
      console.error("Failed to cancel AI chat:", error);
      return null;
    }
  }, [isGenerating]);

  const sendMessage = useCallback(async (text: string, selectedModel?: string) => {
    if (isGenerating || !text.trim() || !sessionInitialized) return;
    const [providerId, modelId] = selectedModel?.split("::") ?? [];
    const time = new Date().toISOString();
    latestUserPromptRef.current = text;
    setMessages((previous) => [...previous,
      { id: `msg-${Date.now()}`, role: "user", content: text, time },
      { id: `msg-${Date.now()}-ai`, role: "assistant", content: "", model: modelId, time, parts: [] },
    ]);
    setIsGenerating(true);

    try {
      const { runId } = await window.api.promptAi!.startChat({ sessionId, designItemId, message: text, provider: providerId, model: modelId, editorContent });
      activeRunIdRef.current = runId;
      await fetchSessions();
    } catch (error) {
      console.error("Failed to send message", error);
      setIsGenerating(false);
    }
  }, [designItemId, editorContent, fetchSessions, isGenerating, sessionId, sessionInitialized]);

  const handleSubmitAskAnswer = useCallback(async (payload: CuratorAskAnswerSubmitPayload) => {
    await window.api.promptAi!.submitAskAnswer(payload);
  }, []);

  const handleSubmitToolConfirmationAnswer = useCallback(async (payload: CuratorToolConfirmationAnswerSubmitPayload) => {
    await window.api.promptAi!.submitToolConfirmationAnswer(payload);
  }, []);

  const handleDeleteTurn = useCallback(async (messageId: string): Promise<void> => {
    if (isGenerating) return;
    try {
      await window.api.promptAi!.deleteTurn(sessionId, messageId);
      await loadSession(sessionId);
      await fetchSessions();
    } catch (error) {
      console.error("Failed to delete AI chat turn:", error);
    }
  }, [fetchSessions, isGenerating, loadSession, sessionId]);

  const handleRegenerateLatestAnswer = useCallback(async (): Promise<void> => {
    if (isGenerating) return;
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!latestUserMessage) return;
    await handleUndo();
    await sendMessage(latestUserMessage.content);
  }, [handleUndo, isGenerating, messages, sendMessage]);

  const handleEditAndResendUserMessage = useCallback(async (messageId: string, text: string): Promise<void> => {
    if (isGenerating || !text.trim()) return;
    await handleDeleteTurn(messageId);
    await sendMessage(text);
  }, [handleDeleteTurn, isGenerating, sendMessage]);

  return {
    activeSessionId: sessionId, messages, sessions, sendMessage, handleNewChat,
    handleSessionChange, handleRenameChat, handleDeleteChat, handleUndo,
    handleDeleteTurn, handleRegenerateLatestAnswer, handleEditAndResendUserMessage,
    handleCancelGeneration, handleSubmitAskAnswer, handleSubmitToolConfirmationAnswer, isGenerating,
    sessionInitialized, LATEST_ASSISTANT_TOP_OFFSET,
  };
};
