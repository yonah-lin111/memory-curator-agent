import React, { useState, useRef, useEffect } from "react";
import { ChevronRight, PanelRightClose, MessageSquare } from "lucide-react";
import { usePromptDesignController } from "../usePromptDesignController";
import { usePromptDesignAgent } from "../hooks/usePromptDesignAgent";
import { PromptDesignInput } from "./PromptDesignInput";
import { PromptCommandPanel } from "./PromptCommandPanel";
// import { AiChatMessageBubble } from "../../ai-chat/components/AiChatMessageBubble";

export const PromptDesignAIPanel = (): React.JSX.Element => {
  const { isAIPanelOpen, toggleAIPanel, activeDesignId, designs } = usePromptDesignController();
  
  // AI Hook stub (will connect to chat runner in later phases)
  const activeDesign = activeDesignId ? designs[activeDesignId] : null;
  const { messages, input, setInput, isGenerating, sendMessage, handleStop } = usePromptDesignAgent(
    activeDesign?.chatSessionId
  );

  const [isCommandPanelOpen, setIsCommandPanelOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle input changes, check for command trigger
  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.startsWith("/")) {
      setIsCommandPanelOpen(true);
    } else {
      setIsCommandPanelOpen(false);
    }
  };

  const handleSend = () => {
    if (input.trim() && !isGenerating) {
      sendMessage(input.trim());
      setIsCommandPanelOpen(false);
    }
  };

  const handleCommandSelect = (cmd: any) => {
    setInput(cmd.label + " ");
    setIsCommandPanelOpen(false);
  };

  if (!isAIPanelOpen) {
    return (
      <div className="flex flex-col items-center py-4 w-[48px] h-full border-l border-white/5 bg-[#0a0a0a]">
        <button
          onClick={() => toggleAIPanel(true)}
          className="p-2 text-white/40 hover:text-white/80 hover:bg-white/5 rounded-md transition-colors tooltip-trigger"
          title="展开 AI 助手"
        >
          <PanelRightClose className="w-5 h-5 rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[360px] h-full border-l border-white/5 bg-[#0a0a0a] relative">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-4 h-[52px] border-b border-white/5 shrink-0">
        <div className="flex items-center space-x-2 overflow-hidden">
          <MessageSquare className="w-4 h-4 text-white/40" />
          <span className="text-sm font-medium text-white/80 truncate">
            {activeDesign ? `AI 助手 - ${activeDesign.title}` : "AI 助手"}
          </span>
        </div>
        <button
          onClick={() => toggleAIPanel(false)}
          className="p-1.5 text-white/40 hover:text-white/80 hover:bg-white/5 rounded-md transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 消息列表区 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-4">
            <MessageSquare className="w-8 h-8 opacity-50" />
            <p className="text-sm text-center">
              {activeDesign 
                ? "选中了卡片，向 AI 描述你想如何优化或修改这个提示词" 
                : "在左侧选中或创建一个提示词卡片开始设计"}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div 
                className={`max-w-[90%] rounded-lg p-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-500/20 text-white/90 border border-blue-500/30' 
                    : 'bg-white/5 text-white/80 border border-white/10'
                }`}
              >
                {/* 暂时用简单文本渲染，后续接入 AiChatMessageBubble */}
                {msg.content?.[0]?.text || ""}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入区 */}
      <div className="p-4 border-t border-white/5 bg-[#0a0a0a] relative">
        <PromptCommandPanel
          isOpen={isCommandPanelOpen}
          onClose={() => setIsCommandPanelOpen(false)}
          onSelect={handleCommandSelect}
          filterText={input.startsWith("/") ? input.slice(1) : ""}
        />
        <PromptDesignInput
          value={input}
          onChange={handleInputChange}
          onSubmit={handleSend}
          onCancel={handleStop}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
};
