import type React from "react";
import { X, Send, Bot, FileText, Minimize2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

interface PromptAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PromptAIAssistant = ({ isOpen, onClose }: PromptAIAssistantProps): React.JSX.Element => {
  return (
    <div 
      className={`h-full bg-[#1A1A1A] border-l border-white/5 flex flex-col transition-all duration-300 ease-out overflow-hidden ${
        isOpen ? "w-[340px] opacity-100" : "w-0 opacity-0 border-none"
      }`}
    >
      <div className="flex-shrink-0 h-12 px-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center text-white/80">
          <Bot className="w-4 h-4 mr-2 text-amber-400" />
          <span className="text-sm font-medium">AI 助手</span>
        </div>
        <IconButton size="small" onClick={onClose} title="折叠助手 (Cmd+J)">
          <Minimize2 className="w-3.5 h-3.5" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Placeholder Message */}
        <div className="flex gap-2 text-sm text-white/80">
          <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Bot className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex-1 bg-white/5 p-3 rounded-[6px] rounded-tl-none">
            你好！我是你的提示词助手。你可以要求我：
            <ul className="mt-2 text-white/60 list-disc pl-4 space-y-1">
              <li>优化当前的提示词</li>
              <li>添加 few-shot 示例</li>
              <li>分析提示词的 Token 消耗</li>
              <li>测试此提示词的效果</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 p-3 border-t border-white/5 bg-[#141414]">
        <div className="relative flex items-center bg-[#212121] border border-white/10 rounded-[6px] p-1 focus-within:border-white/30 transition-colors">
          <textarea
            className="flex-1 bg-transparent text-sm text-white px-2 py-1.5 resize-none outline-none max-h-32 min-h-[36px]"
            placeholder="输入你的要求..."
            rows={1}
          />
          <IconButton preset="primary" size="small" className="ml-1 self-end mb-0.5">
            <Send className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};
