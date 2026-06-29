import { useState } from "react";
import { Paperclip, RotateCcw, SendHorizontal } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

export const PromptAiChatInput = ({ onSend }: { onSend?: (text: string) => void }) => {
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (inputText.trim() && onSend) {
      onSend(inputText.trim());
      setInputText("");
    }
  };

  return (
    <div className="flex-shrink-0 p-3">
      <div className="relative rounded-[6px] border border-white/5 bg-white/[0.01] p-2 flex flex-col gap-2 max-w-[860px] mx-auto w-full">
        {/* 输入框 */}
        <textarea
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="输入您的问题..."
          aria-label="Prompt AI Chat Input Area"
          className="w-full bg-transparent text-sm text-white placeholder:text-white/20 outline-none resize-none leading-relaxed px-1 transition-[height] duration-200 ease-out"
          style={{ minHeight: '24px' }}
        />

        {/* 工具栏与发送按钮 */}
        <div className="flex items-center justify-between mt-1">
          {/* 左侧附加操作 */}
          <div className="flex min-w-0 items-center gap-2">
            <IconButton
              aria-label="Add attachment"
              className="text-white/30 hover:text-white/50"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          {/* 右侧发送与清空按钮 */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Clear input"
              onClick={() => setInputText("")}
              disabled={!inputText}
              className={`h-6 w-6 rounded-full flex items-center justify-center bg-transparent transition-colors ${
                inputText
                  ? "text-white/45 hover:text-white"
                  : "text-white/10 cursor-not-allowed"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <IconButton
              aria-label="Send message"
              disabled={!inputText.trim()}
              highlighted={!!inputText.trim()}
              onClick={handleSend}
              className={`rounded-full flex items-center justify-center transition-all ${
                inputText.trim()
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              <SendHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
};
