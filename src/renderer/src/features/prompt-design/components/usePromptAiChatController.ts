import { useState, useCallback, useEffect } from "react";
import type { AiToolStep } from "@/features/ai-chat/types";

export type PromptAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  model?: string;
  /** 推理思考内容 */
  reasoning?: string;
  /** 工具调用步骤列表 */
  toolSteps?: AiToolStep[];
};

/**
 * 文件工具 UI 显示名称映射。
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  prompt_file_read: "Read",
  prompt_glob: "Glob",
  prompt_grep: "Grep",
};

/**
 * 将后端持久化的工具步骤格式转换为前端 AiToolStep 格式。
 * 后端 schema: { id, name, status, input, observation?, data?, createdAt?, endedAt? }
 * 前端类型:    { id, title, status, tool, input?, observation, data? }
 */
const mapBackendToolStep = (raw: any): AiToolStep => ({
  id: raw.id,
  title: `Tool result: ${TOOL_DISPLAY_NAMES[raw.name] || raw.name}`,
  status: raw.status,
  tool: TOOL_DISPLAY_NAMES[raw.name] || raw.name,
  input: raw.input,
  observation: raw.observation ?? "",
  data: raw.data,
});

export function usePromptAiChatController(designItemId: string) {
  const [messages, setMessages] = useState<PromptAiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

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
        session.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content || "",
          time: new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          model: m.model,
          toolSteps: m.toolSteps?.map(mapBackendToolStep) || undefined,
        })),
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
        const step: AiToolStep = event.toolStep;
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
      } else if (event.type === "turn_finished" || event.type === "done") {
        setIsGenerating(false);
      } else if (event.type === "session_title_updated") {
        // 后台标题总结完成后刷新会话列表
        void fetchSessions();
      } else if (event.type === "error") {
        setIsGenerating(false);
        console.error("AI chat error:", event.message);
      }
    });

    return unlisten;
  }, [sessionId]);

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

  const handleUndo = useCallback(async () => {
    if (isGenerating) return;
    const updated = await window.api.promptAi!.undoLastTurn(sessionId);
    if (updated) {
      if (updated.messages.length === 0) {
        await handleDeleteChat(sessionId);
      } else {
        await loadSession(sessionId);
      }
    }
  }, [isGenerating, sessionId, loadSession, handleDeleteChat]);

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
        await window.api.promptAi!.startChat({
          sessionId,
          designItemId,
          message: text,
          provider: providerId,
          model: modelId,
        });
        await fetchSessions(); // 更新会话列表以反映新标题等变化
      } catch (err) {
        console.error("Failed to send message", err);
        setIsGenerating(false);
      }
    },
    [sessionId, designItemId, isGenerating, sessionInitialized],
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
    isGenerating,
    sessionInitialized,
    LATEST_ASSISTANT_TOP_OFFSET,
  };
}
