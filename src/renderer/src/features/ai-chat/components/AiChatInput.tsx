import type React from "react";
import { useState } from "react";
import { Paperclip, SendHorizontal, SlidersHorizontal } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import { Select } from "@renderer/components/ui/Select";
import type {
  AiModelProviderOption,
  AiModelSelection,
} from "@renderer/features/ai-chat/aiChatMock";

// AI 对话输入框组件属性类型。
export type AiChatInputProps = {
  // 可切换的 AI provider 与模型列表。
  modelOptions: AiModelProviderOption[];
  // 当前选中的 AI provider 与模型。
  selectedModel: AiModelSelection | null;
  // 发送消息回调。
  onSendMessage: (text: string) => void;
  // AI 模型切换回调。
  onModelChange: (selection: AiModelSelection) => void;
};

/**
 * AiChatInput - AI 对话底部输入区域组件，包含模型切换、文本输入与辅助功能。
 */
export const AiChatInput = ({
  modelOptions,
  selectedModel,
  onSendMessage,
  onModelChange,
}: AiChatInputProps): React.JSX.Element => {
  const [inputText, setInputText] = useState("");
  const selectedModelValue = selectedModel
    ? `${selectedModel.provider}::${selectedModel.model}`
    : "";
  const hasModelOptions = modelOptions.some((provider) => provider.models.length > 0);

  // 构造供 Select 组件使用的选项列表，支持 provider 分组。
  const selectOptions = hasModelOptions
    ? modelOptions.map((provider) => ({
        label: provider.name,
        options: provider.models.map((model) => ({
          value: `${provider.id}::${model.id}`,
          label: model.name, // 仅使用模型名，不需要包含 provider 前缀
        })),
      }))
    : [{ value: "", label: "无可用模型" }];

  /**
   * 发送消息处理函数。
   */
  const handleSend = (): void => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  /**
   * 处理输入框键盘按键事件，支持 Enter 键发送消息，Shift + Enter 换行。
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * 处理 AI 模型切换，value 使用 provider/model 组合避免跨 provider 模型重名。
   */
  const handleModelChange = (value: string): void => {
    const [provider, model] = value.split("::");
    if (!provider || !model) return;
    onModelChange({ provider, model });
  };

  return (
    <div className="flex-shrink-0 border-t border-white/5 p-3 bg-black/5">
      <div className="relative rounded-[6px] border border-white/5 bg-white/[0.01] p-2 flex flex-col gap-2">
        {/* 输入框 */}
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入您的问题..."
          aria-label="AI 对话输入框"
          className="w-full bg-transparent text-sm text-white placeholder:text-white/20 outline-none resize-none leading-relaxed px-1"
        />

        {/* 工具栏与发送按钮 */}
        <div className="flex items-center justify-between">
          {/* 左侧附加操作 */}
          <div className="flex min-w-0 items-center gap-2">
            <Select
              value={selectedModelValue}
              onChange={handleModelChange}
              options={selectOptions}
              position="up"
              bgClass="bg-black"
              disabled={!hasModelOptions}
              className="!w-fit max-w-[220px]"
            />
            <IconButton
              aria-label="添加附件"
              disabled
              className="text-white/30 h-6 w-6 cursor-not-allowed"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              aria-label="设置工具模式"
              disabled
              className="text-white/30 h-6 w-6 cursor-not-allowed"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          {/* 右侧发送按钮 */}
          <IconButton
            aria-label="发送消息"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
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
  );
};
