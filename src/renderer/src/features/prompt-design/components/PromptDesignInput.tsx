import React, { useRef, useEffect } from "react";
import { Send, X, Paperclip } from "lucide-react";

interface PromptDesignInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isGenerating?: boolean;
}

export const PromptDesignInput: React.FC<PromptDesignInputProps> = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  isGenerating = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isGenerating) {
        onSubmit();
      }
    }
  };

  return (
    <div className="flex flex-col w-full bg-[#1e1e1e] border border-white/10 rounded-lg p-2 focus-within:border-white/30 transition-colors">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息，或使用 / 触发命令..."
        className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/30 outline-none resize-none min-h-[40px] max-h-[200px] px-2 py-1"
        rows={1}
      />
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center space-x-1">
          <button className="p-1.5 text-white/40 hover:text-white/80 hover:bg-white/5 rounded-md transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          {isGenerating ? (
            <button
              onClick={onCancel}
              className="flex items-center justify-center p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                if (value.trim()) onSubmit();
              }}
              disabled={!value.trim()}
              className="flex items-center justify-center p-1.5 text-white/40 hover:text-white/90 hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-white/40 rounded-md transition-colors bg-white/5"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
