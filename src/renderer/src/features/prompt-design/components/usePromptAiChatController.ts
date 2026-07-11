import { useState, useCallback, useEffect, useRef } from "react";
import type { CuratorToolStep } from "@/features/curator/types";

export type PromptAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  model?: string;
  /** 推理思考内容 */
  reasoning?: string;
  /** 工具调用步骤列表 */
  toolSteps?: CuratorToolStep[];
  // 标记生成是否被中断以渲染删除线样式
  cancelled?: boolean;
};

export type PromptAiUndoResult = {
  status: "empty" | "undone" | "deleted_empty";
  prompt?: string;
} | false;

/**
 * 文件工具 UI 显示名称映射。
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  prompt_file_read: "Read",
  prompt_glob: "Glob",
  prompt_grep: "Grep",
  prompt_editor_replace: "Replace editor",
  prompt_editor_replace_lines: "Replace editor lines",
  prompt_editor_delete_lines: "Delete editor lines",
};

/**
 * 将后端持久化的工具步骤格式转换为前端 CuratorToolStep 格式。
 * 后端 schema: { id, name, status, input, observation?, data?, createdAt?, endedAt? }
 * 前端类型:    { id, title, status, tool, input?, observation, data? }
 */
const mapBackendToolStep = (raw: any): CuratorToolStep => {
  const toolName = raw.tool || raw.name || "";
  return {
    id: raw.id,
    title: `Tool result: ${TOOL_DISPLAY_NAMES[toolName] || toolName}`,
    status: raw.status,
    tool: TOOL_DISPLAY_NAMES[toolName] || toolName,
    input: raw.input,
    observation: raw.observation ?? "",
    data: raw.data,
  };
};

export function usePromptAiChatController(
  designItemId: string,
  editorContent: string,
  onEditorSuggestion: (originalContent: string, candidateContent: string) => void,
) {
  const [messages, setMessages] = useState<PromptAiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const editorContentRef = useRef(editorContent);
  const runEditorContentRef = useRef(new Map<string, string>());
  const activeRunIdRef = useRef<string | null>(null);
  const latestUserPromptRef = useRef<string | null>(null);
  latestUserPromptRef.current = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content ?? null;

  useEffect(() => {
    editorContentRef.current = editorContent;
  }, [editorContent]);

  const fetchSessions = useCallback(async () => {
    if (!designItemId) return;
    const items = await window.api.promptAi!.listSessions(designItemId);
    setSessions(items);
    return items;
  }, [designItemId]);

  const loadSession = useCallback(async (sid: string) => {
    const session = await window.api.promptAi!.getSession(sid);
    if (session) {
      setSessionId(session.id);
      setMessages(
        session.messages.map((m: any) => {
          const parts = m.parts || [];
          const reasoningPart = parts.find(
            (p: any) => p.kind === "reasoning" || p.type === "reasoning"
          );
          const reasoning = reasoningPart?.content || reasoningPart?.text || undefined;

          return {
            id: m.id,
            role: m.role,
            content: m.content || "",
            time: new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            model: m.model,
            reasoning,
            toolSteps: m.toolSteps?.map(mapBackendToolStep) || undefined,
            cancelled: m.cancelled,
          };
        }),
      );
    }
  }, []);

  // 初始化会话
  useEffect(() => {
    const init = async () => {
      setSessionInitialized(false);
      const items = await fetchSessions();
      if (items && items.length > 0) {
        await loadSession(items[0].id);
      } else {
        setSessionId(`sess-${Date.now()}`);
      }
      setSessionInitialized(true);
    };
    init();
  }, [fetchSessions, loadSession]);

  // 处理传入事件
  useEffect(() => {
    if (!sessionId) return;

    const unlisten = window.api.promptAi!.onChatEvent((event: any) => {
      if (event.sessionId !== sessionId) return;

      if (event.type === "run_started") {
        if (event.runId) {
          runEditorContentRef.current.set(event.runId, editorContentRef.current);
        }
        setIsGenerating(true);
        if (event.model) {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                ...lastMsg,
                model: event.model,
              };
              return newMessages;
            }
            return prev;
          });
        }
      } else if (event.type === "text_delta") {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + event.delta,
            };
            return newMessages;
          }
          return prev;
        });
      } else if (event.type === "tool_started") {
        const step: CuratorToolStep = event.toolStep;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              toolSteps: [...(lastMsg.toolSteps || []), step],
            };
            return newMessages;
          }
          return prev;
        });
      } else if (event.type === "tool_finished") {
        if (event.data?.operation && typeof event.data.content === "string") {
          onEditorSuggestion(
            runEditorContentRef.current.get(event.runId) ?? editorContentRef.current,
            event.data.content,
          );
        }
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "assistant" && lastMsg.toolSteps) {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              toolSteps: lastMsg.toolSteps.map((s) =>
                s.id === event.toolStepId
                  ? { ...s, status: "done" as const, observation: event.observation ?? "", data: event.data }
                  : s
              ),
            };
            return newMessages;
          }
          return prev;
        });
      } else if (event.type === "tool_failed") {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "assistant" && lastMsg.toolSteps) {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              toolSteps: lastMsg.toolSteps.map((s) =>
                s.id === event.toolStepId
                  ? { ...s, status: "failed" as const, observation: event.error ?? "" }
                  : s
              ),
            };
            return newMessages;
          }
          return prev;
        });
      } else if (event.type === "reasoning_delta") {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              reasoning: (lastMsg.reasoning || "") + event.delta,
            };
            return newMessages;
          }
          return prev;
        });
      } else if (event.type === "turn_finished") {
        // turn_finished 仅代表单次对话轮次结束，可能仍有后续工具调用，须等 done 信号才重置生成态
      } else if (event.type === "done") {
        setIsGenerating(false);
        if (event.runId === activeRunIdRef.current) {
          activeRunIdRef.current = null;
        }
        if (event.runId) {
          runEditorContentRef.current.delete(event.runId);
        }
      } else if (event.type === "session_title_updated") {
        // 后台标题总结完成后刷新会话列表
        void fetchSessions();
      } else if (event.type === "error") {
        setIsGenerating(false);
        if (event.runId === activeRunIdRef.current) {
          activeRunIdRef.current = null;
        }
        console.error("AI chat error:", event.message);
      }
    });

    return unlisten;
  }, [sessionId, onEditorSuggestion]);

  const LATEST_ASSISTANT_TOP_OFFSET = 4;

  const handleNewChat = useCallback(() => {
    if (isGenerating) return;
    setSessionId(`sess-${Date.now()}`);
    setMessages([]);
  }, [isGenerating]);

  const handleSessionChange = useCallback((sid: string) => {
    if (isGenerating) return;
    loadSession(sid);
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
      if (sessionId === sid) {
        handleNewChat();
      }
      return true;
    } catch (error) {
      console.error("Failed to delete chat:", error);
      return false;
    }
  }, [fetchSessions, sessionId, handleNewChat]);

  const handleUndo = useCallback(async (): Promise<PromptAiUndoResult> => {
    if (isGenerating) return false;
    if (messages.length === 0) {
      return { status: "empty" };
    }

    const prompt = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content;

    try {
      const updated = await window.api.promptAi!.undoLastTurn(sessionId);
      if (updated) {
        if (updated.messages.length === 0) {
          const isDeleted = await handleDeleteChat(sessionId);
          return isDeleted ? { status: "deleted_empty", prompt } : false;
        }

        await loadSession(sessionId);
        return { status: "undone", prompt };
      }
      return false;
    } catch (error) {
      console.error("Failed to undo last turn:", error);
      return false;
    }
  }, [isGenerating, messages, sessionId, loadSession, handleDeleteChat]);

  /**
   * 取消当前生成，并在取消前保留最后一条用户提示词。
   */
  const handleCancelGeneration = useCallback(async (): Promise<string | null> => {
    if (!isGenerating || !activeRunIdRef.current) {
      return null;
    }

    const prompt = latestUserPromptRef.current;

    try {
      await window.api.promptAi!.cancelChat(activeRunIdRef.current);
      setIsGenerating(false);
      activeRunIdRef.current = null;

      // 立即在前端标记最后一条助手消息已被取消以应用删除线样式
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            ...lastMsg,
            cancelled: true,
          };
          return newMessages;
        }
        return prev;
      });

      return prompt;
    } catch (error) {
      console.error("Failed to cancel AI chat:", error);
      return null;
    }
  }, [isGenerating]);

  const sendMessage = useCallback(
    async (text: string, selectedModel?: string) => {
      if (isGenerating || !text.trim() || !sessionInitialized) return;

      const [providerId, modelId] = selectedModel?.split("::") ?? [];

      const newMsg: PromptAiMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      };

      latestUserPromptRef.current = text;
      setMessages((prev) => [
        ...prev,
        newMsg,
        {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          content: "",
          model: modelId,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
        },
      ]);

      setIsGenerating(true);

      try {
        const { runId } = await window.api.promptAi!.startChat({
          sessionId,
          designItemId,
          message: text,
          provider: providerId,
          model: modelId,
          editorContent,
        });
        activeRunIdRef.current = runId;
        await fetchSessions(); // 更新会话列表以反映新标题等变化
      } catch (err) {
        console.error("Failed to send message", err);
        setIsGenerating(false);
      }
    },
    [sessionId, designItemId, editorContent, isGenerating, sessionInitialized],
  );

  const handleSubmitToolConfirmationAnswer = useCallback(
    async (requestId: string, action: "confirm" | "cancel") => {
      await window.api.promptAi!.submitToolConfirmationAnswer({ requestId, action });
    },
    [],
  );

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
    handleCancelGeneration,
    handleSubmitToolConfirmationAnswer,
    isGenerating,
    sessionInitialized,
    LATEST_ASSISTANT_TOP_OFFSET,
  };
}
