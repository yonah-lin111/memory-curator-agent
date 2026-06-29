import { useState, useRef, useLayoutEffect } from "react";
import { PromptAiChatMessageBubble } from "./PromptAiChatMessageBubble";
import { PromptAiChatInput } from "./PromptAiChatInput";

const INITIAL_MESSAGES = [
  {
    id: "msg-1",
    role: "user" as const,
    content: "帮我优化一下这个 Prompt，让它语气更专业一点。",
    time: "10:23"
  },
  {
    id: "msg-2",
    role: "assistant" as const,
    content: "这是一个优化后的 Prompt，请查看：\n\n```markdown\n作为一名专业的行业分析师，请根据提供的数据，以客观、严谨的口吻撰写一份分析报告。\n```",
    reasoning: "用户要求优化 Prompt 的语气，使其更加专业。我需要分析当前的任务，添加角色设定（行业分析师），并明确语气要求（客观、严谨）。",
    time: "10:24",
    model: "claude-3.5-sonnet"
  },
  {
    id: "msg-3",
    role: "user" as const,
    content: "我还想加点结构化的要求，比如分点作答。",
    time: "10:25"
  },
  {
    id: "msg-4",
    role: "assistant" as const,
    content: "好的，我已经添加了结构化输出的要求：\n\n```markdown\n作为一名专业的行业分析师，请根据提供的数据，以客观、严谨的口吻撰写一份分析报告。请按照以下结构组织你的回答：\n\n1.  **核心发现**：用三句话总结最重要的数据洞察。\n2.  **详细分析**：分点展开，使用列表或表格展示。\n3.  **行动建议**：给出至少两条可执行的建议。\n```",
    toolCall: {
      name: "evaluate_prompt",
      args: '{"prompt": "作为一名...", "criteria": ["professionalism", "structure"]}',
      result: '{"score": 9.5, "feedback": "Prompt is highly structured and professional."}',
      status: "success" as const
    },
    time: "10:26",
    model: "claude-3.5-sonnet"
  }
];

export const PromptAiChatWorkspace = () => {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestUserMessageRef = useRef<HTMLDivElement>(null);
  const [bottomSpacerHeight, setBottomSpacerHeight] = useState(0);
  const [topPinnedUserId, setTopPinnedUserId] = useState<string | null>(null);

  const LATEST_ASSISTANT_TOP_OFFSET = 4;

  const handleSend = (text: string) => {
    const userMsgId = `msg-${Date.now()}`;
    const newMessage = {
      id: userMsgId,
      role: "user" as const,
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    };
    setMessages(prev => [...prev, newMessage]);
    setTopPinnedUserId(newMessage.id);

    // 模拟 AI 回复
    setTimeout(() => {
      const aiMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant" as const,
        content: "这是一个自动回复的 Mock 消息，您可以继续进行其他测试或操作。",
        reasoning: "检测到用户输入，正在根据上下文生成对应的 Mock 响应。",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        model: "claude-3.5-sonnet"
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  useLayoutEffect(() => {
    if (!topPinnedUserId) {
      setBottomSpacerHeight(0);
      return;
    }

    const container = scrollContainerRef.current;
    const userMessage = latestUserMessageRef.current;

    if (container && userMessage) {
      setBottomSpacerHeight((prev) => {
        const viewportHeight = container.clientHeight;
        const targetScrollTop = Math.max(
          userMessage.offsetTop - LATEST_ASSISTANT_TOP_OFFSET,
          0
        );
        const requiredSpacer = Math.round(
          Math.max(
            0,
            targetScrollTop + viewportHeight - container.scrollHeight + prev
          )
        );

        return Math.abs(prev - requiredSpacer) > 3 ? requiredSpacer : prev;
      });
    }
  }, [topPinnedUserId, messages.length]);

  useLayoutEffect(() => {
    if (topPinnedUserId && latestUserMessageRef.current && scrollContainerRef.current) {
      const targetTop = Math.max(
        latestUserMessageRef.current.offsetTop - LATEST_ASSISTANT_TOP_OFFSET,
        0
      );
      scrollContainerRef.current.scrollTo({
        top: targetTop,
        behavior: "smooth"
      });
    }
  }, [topPinnedUserId, messages.length, bottomSpacerHeight]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* 消息区域容器 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧：消息区域（消息列表 + 输入区域） */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* 消息列表 */}
          <div
            ref={scrollContainerRef}
            style={{
              paddingLeft: "1rem",
              paddingRight: "1rem",
            }}
            className="flex-1 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] [overflow-anchor:none] py-4 flex flex-col min-w-0"
          >
            <div className="max-w-[860px] mx-auto w-full flex flex-col gap-4 flex-1">
              {messages.map((message) => {
                const isLatestUser = message.role === "user" && message.id === topPinnedUserId;
                return (
                  <div key={message.id} ref={isLatestUser ? latestUserMessageRef : null}>
                    <PromptAiChatMessageBubble message={message} />
                  </div>
                );
              })}
              {bottomSpacerHeight > 0 && (
                <div
                  data-ai-chat-bottom-spacer="true"
                  style={{ height: `${bottomSpacerHeight}px` }}
                  className="flex-shrink-0"
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 输入区域 */}
          <PromptAiChatInput onSend={handleSend} />
        </div>
      </div>
    </div>
  );
};
