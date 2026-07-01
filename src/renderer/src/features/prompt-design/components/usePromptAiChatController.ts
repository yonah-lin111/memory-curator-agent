import { useState, useCallback, useEffect } from "react";

export type PromptAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  model?: string;
};

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
        })),
      );
    }
  }, []);

  // Initialize a session
  useEffect(() => {
    const init = async () => {
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

  // Handle incoming events
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
      } else if (event.type === "turn_finished" || event.type === "done") {
        setIsGenerating(false);
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
        await fetchSessions(); // Update session list to reflect new titles etc.
      } catch (err) {
        console.error("Failed to send message", err);
        setIsGenerating(false);
      }
    },
    [sessionId, designItemId, isGenerating, sessionInitialized],
  );

  return {
    messages,
    sessions,
    sendMessage,
    handleNewChat,
    handleSessionChange,
    isGenerating,
    LATEST_ASSISTANT_TOP_OFFSET,
  };
}
