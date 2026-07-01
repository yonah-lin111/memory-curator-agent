import { useState, useRef, useEffect } from "react";
import { Paperclip, RotateCcw, SendHorizontal } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { useActiveAiModels } from "@/features/ai-chat/hooks/useActiveAiModels";

export const PromptAiChatInput = ({
  onSend,
  disabled,
}: {
  onSend?: (text: string) => void;
  disabled?: boolean;
}) => {
  const [inputText, setInputText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { selectedModel, hasModelOptions, selectOptions, handleModelChange } =
    useActiveAiModels();

  const TEXTAREA_MIN_ROWS = 2;

  const handleContainerClick = (e: React.MouseEvent) => {
    // 如果点击的是容器本身（而非内部子元素），则聚焦输入框
    if (e.target === e.currentTarget && textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSend = () => {
    if (disabled) return;
    if (inputText.trim() && onSend) {
      onSend(inputText.trim());
      setInputText("");
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const minHeight = TEXTAREA_MIN_ROWS * 20;
      const newHeight =
        inputText.length === 0
          ? minHeight
          : Math.max(
              minHeight,
              Math.min(textareaRef.current.scrollHeight, 180),
            );

      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [inputText]);

  return (
    <div className="flex-shrink-0 p-3">
      <div
        className={`relative rounded-[6px] border border-white/5 bg-white/[0.01] p-2 flex flex-col gap-2 max-w-[860px] mx-auto w-full cursor-text ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onClick={handleContainerClick}
      >
        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          disabled={disabled}
          rows={TEXTAREA_MIN_ROWS}
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
        />

        {/* 工具栏与发送按钮 */}
        <div className="flex items-center justify-between mt-1 cursor-default">
          {/* 左侧附加操作 */}
          <div className="flex min-w-0 items-center gap-2">
            <Select
              value={selectedModel}
              onChange={handleModelChange}
              options={selectOptions}
              position="up"
              bgClass="bg-[#303030]"
              disabled={!hasModelOptions}
              className="!w-fit max-w-[220px]"
            />

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
